package bertyprotocol

import (
	"context"
	crand "crypto/rand"
	"encoding/base64"
	"fmt"
	"sync"
	"time"

	"github.com/libp2p/go-libp2p-core/crypto"
	"go.uber.org/zap"
	"golang.org/x/crypto/nacl/box"

	"berty.tech/berty/v2/go/internal/cryptoutil"
	"berty.tech/berty/v2/go/internal/ipfsutil"
	"berty.tech/berty/v2/go/pkg/errcode"
	"berty.tech/berty/v2/go/pkg/protocoltypes"
	"berty.tech/go-orbit-db/stores"
)

const CurrentGroupVersion = 1

// NewGroupMultiMember creates a new Group object and an invitation to be used by
// the first member of the group
func NewGroupMultiMember() (*protocoltypes.Group, crypto.PrivKey, error) {
	priv, pub, err := crypto.GenerateEd25519Key(crand.Reader)
	if err != nil {
		return nil, nil, errcode.ErrCryptoKeyGeneration.Wrap(err)
	}

	pubBytes, err := pub.Raw()
	if err != nil {
		return nil, nil, errcode.ErrSerialization.Wrap(err)
	}

	signing, _, err := crypto.GenerateEd25519Key(crand.Reader)
	if err != nil {
		return nil, nil, errcode.ErrCryptoKeyGeneration.Wrap(err)
	}

	signingBytes, err := cryptoutil.SeedFromEd25519PrivateKey(signing)
	if err != nil {
		return nil, nil, errcode.ErrSerialization.Wrap(err)
	}

	skSig, err := priv.Sign(signingBytes)
	if err != nil {
		return nil, nil, errcode.ErrCryptoSignature.Wrap(err)
	}

	group := &protocoltypes.Group{
		PublicKey: pubBytes,
		Secret:    signingBytes,
		SecretSig: skSig,
		GroupType: protocoltypes.GroupTypeMultiMember,
	}

	updateKey, err := cryptoutil.GetLinkKeyArray(group)
	if err != nil {
		return nil, nil, errcode.ErrCryptoKeyGeneration.Wrap(err)
	}

	linkKeySig, err := priv.Sign(updateKey[:])
	if err != nil {
		return nil, nil, errcode.ErrCryptoSignature.Wrap(err)
	}

	group.LinkKeySig = linkKeySig

	return group, priv, nil
}

func metadataStoreListSecrets(ctx context.Context, gc *GroupContext) map[crypto.PubKey]*protocoltypes.DeviceSecret {
	publishedSecrets := map[crypto.PubKey]*protocoltypes.DeviceSecret{}

	m := gc.MetadataStore()
	ownSK := gc.getMemberPrivKey()
	g := gc.Group()

	metadatas, err := m.ListEvents(ctx, nil, nil, false)
	if err != nil {
		return nil
	}
	for metadata := range metadatas {
		if metadata == nil {
			continue
		}

		pk, ds, err := openDeviceSecret(metadata.Metadata, ownSK, g)
		if errcode.Is(err, errcode.ErrInvalidInput) || errcode.Is(err, errcode.ErrGroupSecretOtherDestMember) {
			continue
		}

		if err != nil {
			gc.logger.Error("unable to open device secret", zap.Error(err))
			continue
		}

		publishedSecrets[pk] = ds
	}

	return publishedSecrets
}

func FillMessageKeysHolderUsingNewData(ctx context.Context, gc *GroupContext) <-chan crypto.PubKey {
	m := gc.MetadataStore()
	ch := make(chan crypto.PubKey)
	sub := m.Subscribe(ctx)

	go func() {
		for evt := range sub {
			e, ok := evt.(*protocoltypes.GroupMetadataEvent)
			if !ok {
				continue
			}

			if e.Metadata.EventType != protocoltypes.EventTypeGroupDeviceSecretAdded {
				continue
			}

			pk, ds, err := openDeviceSecret(e.Metadata, gc.getMemberPrivKey(), gc.Group())
			if errcode.Is(err, errcode.ErrInvalidInput) {
				continue
			}

			if errcode.Is(err, errcode.ErrGroupSecretOtherDestMember) {
				continue
			}

			if err != nil {
				gc.logger.Error("an error occurred while opening device secrets", zap.Error(err))
				continue
			}

			if err = gc.MessageKeystore().RegisterChainKey(gc.Group(), pk, ds, gc.DevicePubKey().Equals(pk)); err != nil {
				gc.logger.Error("unable to register chain key", zap.Error(err))
				continue
			}

			// A new chainKey is registered, check if cached messages can be opened with it
			if rawPK, err := pk.Raw(); err == nil {
				go gc.MessageStore().openMessageCacheForPK(ctx, rawPK)
			}

			ch <- pk
		}

		close(ch)
	}()

	return ch
}

func FillMessageKeysHolderUsingPreviousData(ctx context.Context, gc *GroupContext) <-chan crypto.PubKey {
	ch := make(chan crypto.PubKey)
	publishedSecrets := metadataStoreListSecrets(ctx, gc)

	go func() {
		for pk, sec := range publishedSecrets {
			if err := gc.MessageKeystore().RegisterChainKey(gc.Group(), pk, sec, gc.DevicePubKey().Equals(pk)); err != nil {
				gc.logger.Error("unable to register chain key", zap.Error(err))
			} else {
				ch <- pk
			}
		}

		close(ch)
	}()

	return ch
}

func activateGroupContext(ctx context.Context, gc *GroupContext, contact crypto.PubKey, selfAnnouncement bool) error {
	wg := sync.WaitGroup{}
	wg.Add(2)

	syncChMKH := make(chan bool, 1)
	syncChSecrets := make(chan bool, 1)

	// Fill keystore
	go func() {
		ch := FillMessageKeysHolderUsingNewData(ctx, gc)
		wg.Done()

		for pk := range ch {
			if pk.Equals(gc.memberDevice.PrivateDevice().GetPublic()) {
				select {
				case syncChMKH <- true:
				default:
				}
			}
		}

		close(syncChMKH)
	}()

	go func() {
		ch := WatchNewMembersAndSendSecrets(ctx, gc.logger, gc)
		wg.Done()

		for pk := range ch {
			if pk.Equals(gc.memberDevice.PrivateMember().GetPublic()) {
				select {
				case syncChSecrets <- true:
				default:
				}
			}
		}

		close(syncChSecrets)
	}()

	wg.Wait()

	start := time.Now()
	ch := FillMessageKeysHolderUsingPreviousData(ctx, gc)
	for pk := range ch {
		if pk.Equals(gc.memberDevice.PrivateDevice().GetPublic()) {
			select {
			case syncChMKH <- true:
			default:
			}
		}
	}

	gc.logger.Info(fmt.Sprintf("FillMessageKeysHolderUsingPreviousData took %s", time.Since(start)))

	start = time.Now()
	ch = SendSecretsToExistingMembers(ctx, gc, contact)
	for pk := range ch {
		if pk.Equals(gc.memberDevice.PrivateMember().GetPublic()) {
			select {
			case syncChSecrets <- true:
			default:
			}
		}
	}

	gc.logger.Info(fmt.Sprintf("SendSecretsToExistingMembers took %s", time.Since(start)))

	if selfAnnouncement {
		start = time.Now()
		op, err := gc.MetadataStore().AddDeviceToGroup(ctx)
		if err != nil {
			return errcode.ErrInternal.Wrap(err)
		}

		gc.logger.Info(fmt.Sprintf("AddDeviceToGroup took %s", time.Since(start)))

		if op != nil {
			// Waiting for async events to be handled
			if ok := <-syncChMKH; !ok {
				return errcode.ErrInternal.Wrap(fmt.Errorf("error while registering own secrets"))
			}

			if ok := <-syncChSecrets; !ok {
				return errcode.ErrInternal.Wrap(fmt.Errorf("error while sending own secrets"))
			}
		}
	}

	return nil
}

func ActivateGroupContext(ctx context.Context, gc *GroupContext, contact crypto.PubKey) error {
	return activateGroupContext(ctx, gc, contact, true)
}

func TagGroupContextPeers(ctx context.Context, gc *GroupContext, ipfsCoreAPI ipfsutil.ExtendedCoreAPI, weight int) {
	id := gc.Group().GroupIDAsString()

	chSub1 := gc.metadataStore.Subscribe(ctx)
	go func() {
		for e := range chSub1 {
			if evt, ok := e.(*stores.EventNewPeer); ok {
				ipfsCoreAPI.ConnMgr().TagPeer(evt.Peer, fmt.Sprintf("grp_%s", id), weight)
			}
		}
	}()

	chSub2 := gc.messageStore.Subscribe(ctx)
	go func() {
		for e := range chSub2 {
			if evt, ok := e.(*stores.EventNewPeer); ok {
				ipfsCoreAPI.ConnMgr().TagPeer(evt.Peer, fmt.Sprintf("grp_%s", id), weight)
			}
		}
	}()
}

func SendSecretsToExistingMembers(ctx context.Context, gctx *GroupContext, contact crypto.PubKey) <-chan crypto.PubKey {
	ch := make(chan crypto.PubKey)
	members := gctx.MetadataStore().ListMembers()

	// Force sending secret to contact member in contact group
	if gctx.group.GroupType == protocoltypes.GroupTypeContact && len(members) < 2 && contact != nil {
		// Check if contact member is already listed
		found := false
		for _, member := range members {
			if member.Equals(contact) {
				found = true
			}
		}

		// If not listed, add it to the list
		if !found {
			members = append(members, contact)
		}
	}

	go func() {
		for _, pk := range members {
			rawPK, err := pk.Raw()
			if err != nil {
				gctx.logger.Error("failed to serialize pk", zap.Error(err))
				continue
			}

			if _, err := gctx.MetadataStore().SendSecret(ctx, pk); err != nil {
				if !errcode.Is(err, errcode.ErrGroupSecretAlreadySentToMember) {
					gctx.logger.Info("secret already sent secret to member", zap.String("memberpk", base64.StdEncoding.EncodeToString(rawPK)))
					ch <- pk
					continue
				}
			} else {
				gctx.logger.Info("sent secret to existing member", zap.String("memberpk", base64.StdEncoding.EncodeToString(rawPK)))
				ch <- pk
			}
		}

		close(ch)
	}()

	return ch
}

func WatchNewMembersAndSendSecrets(ctx context.Context, logger *zap.Logger, gctx *GroupContext) <-chan crypto.PubKey {
	ch := make(chan crypto.PubKey)
	sub := gctx.MetadataStore().Subscribe(ctx)

	go func() {
		for evt := range sub {
			e, ok := evt.(*protocoltypes.GroupMetadataEvent)
			if !ok {
				continue
			}

			if e.Metadata.EventType != protocoltypes.EventTypeGroupMemberDeviceAdded {
				continue
			}

			event := &protocoltypes.GroupAddMemberDevice{}
			if err := event.Unmarshal(e.Event); err != nil {
				logger.Error("unable to unmarshal payload", zap.Error(err))
				continue
			}

			memberPK, err := crypto.UnmarshalEd25519PublicKey(event.MemberPK)
			if err != nil {
				logger.Error("unable to unmarshal sender member pk", zap.Error(err))
				continue
			}

			if _, err := gctx.MetadataStore().SendSecret(ctx, memberPK); err != nil {
				if !errcode.Is(err, errcode.ErrGroupSecretAlreadySentToMember) {
					logger.Error("unable to send secret to member", zap.Error(err))
				}
			}

			ch <- memberPK
		}

		close(ch)
	}()

	return ch
}

func openDeviceSecret(m *protocoltypes.GroupMetadata, localMemberPrivateKey crypto.PrivKey, group *protocoltypes.Group) (crypto.PubKey, *protocoltypes.DeviceSecret, error) {
	if m == nil || m.EventType != protocoltypes.EventTypeGroupDeviceSecretAdded {
		return nil, nil, errcode.ErrInvalidInput
	}

	s := &protocoltypes.GroupAddDeviceSecret{}
	if err := s.Unmarshal(m.Payload); err != nil {
		return nil, nil, errcode.ErrDeserialization.Wrap(err)
	}

	senderDevicePubKey, err := crypto.UnmarshalEd25519PublicKey(s.DevicePK)
	if err != nil {
		return nil, nil, errcode.ErrDeserialization.Wrap(err)
	}

	destMemberPubKey, err := crypto.UnmarshalEd25519PublicKey(s.DestMemberPK)
	if err != nil {
		return nil, nil, errcode.ErrDeserialization.Wrap(err)
	}

	if !localMemberPrivateKey.GetPublic().Equals(destMemberPubKey) {
		return nil, nil, errcode.ErrGroupSecretOtherDestMember
	}

	mongPriv, mongPub, err := cryptoutil.EdwardsToMontgomery(localMemberPrivateKey, senderDevicePubKey)
	if err != nil {
		return nil, nil, errcode.ErrCryptoKeyConversion.Wrap(err)
	}

	nonce := groupIDToNonce(group)
	decryptedSecret := &protocoltypes.DeviceSecret{}
	decryptedMessage, ok := box.Open(nil, s.Payload, nonce, mongPub, mongPriv)
	if !ok {
		return nil, nil, errcode.ErrCryptoDecrypt
	}

	err = decryptedSecret.Unmarshal(decryptedMessage)
	if err != nil {
		return nil, nil, errcode.ErrDeserialization
	}

	return senderDevicePubKey, decryptedSecret, nil
}

func groupIDToNonce(group *protocoltypes.Group) *[cryptoutil.NonceSize]byte {
	// Nonce doesn't need to be secret, random nor unpredictable, it just needs
	// to be used only once for a given {sender, receiver} set and we will send
	// only one SecretEntryPayload per {localDevicePrivKey, remoteMemberPubKey}
	// So we can reuse groupID as nonce for all SecretEntryPayload and save
	// 24 bytes of storage and bandwidth for each of them.
	//
	// See https://pynacl.readthedocs.io/en/stable/secret/#nonce
	// See Security Model here: https://nacl.cr.yp.to/box.html
	var nonce [cryptoutil.NonceSize]byte

	gid := group.GetPublicKey()

	copy(nonce[:], gid)

	return &nonce
}
