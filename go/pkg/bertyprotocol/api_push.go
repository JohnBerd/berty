package bertyprotocol

import (
	"bytes"
	"context"
	crand "crypto/rand"
	"fmt"
	"sync"

	"github.com/ipfs/go-cid"
	"github.com/libp2p/go-libp2p-core/crypto"
	"go.uber.org/zap"
	"golang.org/x/crypto/nacl/box"
	"google.golang.org/grpc"

	"berty.tech/berty/v2/go/internal/cryptoutil"
	"berty.tech/berty/v2/go/internal/grpcutil"
	"berty.tech/berty/v2/go/pkg/errcode"
	"berty.tech/berty/v2/go/pkg/protocoltypes"
	"berty.tech/berty/v2/go/pkg/pushtypes"
)

func PushSealTokenForServer(receiver *protocoltypes.PushServiceReceiver, server *protocoltypes.PushServer) (*protocoltypes.PushMemberTokenUpdate, error) {
	if server == nil || len(server.ServerKey) != cryptoutil.KeySize {
		return nil, errcode.ErrInvalidInput.Wrap(fmt.Errorf("expected a server key of %d bytes", cryptoutil.KeySize))
	}

	if receiver == nil {
		return nil, errcode.ErrInvalidInput.Wrap(fmt.Errorf("expected the receiver value to be defined"))
	}

	serverKey := [cryptoutil.KeySize]byte{}
	for i, c := range server.ServerKey {
		serverKey[i] = c
	}

	opaqueToken, err := receiver.Marshal()
	if err != nil {
		return nil, errcode.ErrSerialization.Wrap(err)
	}

	opaqueToken, err = box.SealAnonymous(nil, opaqueToken, &serverKey, crand.Reader)
	if err != nil {
		return nil, err
	}

	return &protocoltypes.PushMemberTokenUpdate{
		Token:  opaqueToken,
		Server: server,
	}, nil
}

func (s *service) getPushClient(host string) (pushtypes.PushServiceClient, error) {
	s.muPushClients.RLock()

	if cc, ok := s.pushClients[host]; ok {
		s.muPushClients.RUnlock()
		return pushtypes.NewPushServiceClient(cc), nil
	}

	s.muPushClients.RUnlock()

	return s.createAndGetPushClientWithoutToken(s.ctx, host)
}

func (s *service) createAndGetPushClient(ctx context.Context, host string, token string) (pushtypes.PushServiceClient, error) {
	s.muPushClients.Lock()
	defer s.muPushClients.Unlock()

	if cc, ok := s.pushClients[host]; ok {
		cc.Close()
		s.pushClients[host] = nil
	}

	gopts := []grpc.DialOption{
		grpc.WithPerRPCCredentials(grpcutil.NewUnsecureSimpleAuthAccess("bearer", token)),
	}

	if s.grpcInsecure {
		gopts = append(gopts, grpc.WithInsecure())
	}

	cc, err := grpc.DialContext(ctx, host, gopts...)
	if err != nil {
		return nil, err
	}

	// monitor push client state
	go monitorPushServer(s.ctx, cc, s.logger)

	s.pushClients[host] = cc
	return pushtypes.NewPushServiceClient(cc), err
}

func (s *service) createAndGetPushClientWithoutToken(ctx context.Context, host string) (pushtypes.PushServiceClient, error) {
	return s.createAndGetPushClient(ctx, host, "")
}

func (s *service) PushReceive(ctx context.Context, request *protocoltypes.PushReceive_Request) (*protocoltypes.PushReceive_Reply, error) {
	return s.pushHandler.PushReceive(request.Payload)
}

func (s *service) PushSend(ctx context.Context, request *protocoltypes.PushSend_Request) (*protocoltypes.PushSend_Reply, error) {
	gc, err := s.GetContextGroupForID(request.GroupPublicKey)
	if err != nil {
		return nil, err
	}

	_, c, err := cid.CidFromBytes(request.CID)
	if err != nil {
		return nil, errcode.ErrInvalidInput.Wrap(err)
	}

	sealedMessageEnvelope, err := gc.messageStore.GetOutOfStoreMessageEnvelope(ctx, c)
	if err != nil {
		return nil, errcode.ErrInternal.Wrap(err)
	}

	pushTargets, err := s.getPushTargetsByServer(gc, request.GroupMembers)
	if err != nil {
		return nil, errcode.ErrInternal.Wrap(err)
	}

	if len(pushTargets) == 0 {
		s.logger.Info("PushSend - pushing - no targets", zap.String("cid", c.String()))
		return &protocoltypes.PushSend_Reply{}, nil
	}

	wg := sync.WaitGroup{}
	wg.Add(len(pushTargets))

	for serverAddr, pushTokens := range pushTargets {
		go func(serverAddr string, pushTokens []*pushtypes.PushServiceOpaqueReceiver) {
			s.logger.Info("PushSend - pushing", zap.String("cid", c.String()), zap.String("server", serverAddr))
			defer wg.Done()

			if len(pushTokens) == 0 {
				s.logger.Info("no push receivers", zap.String("push-server", serverAddr))
				return
			}

			client, err := s.getPushClient(serverAddr)
			if err != nil {
				s.logger.Error("error while dialing push server", zap.String("push-server", serverAddr), zap.Error(err))
				return
			}

			if _, err := client.Send(ctx, &pushtypes.PushServiceSend_Request{
				Envelope:  sealedMessageEnvelope,
				Priority:  pushtypes.PushServicePriority_PushPriorityNormal,
				Receivers: pushTokens,
			}); err != nil {
				s.logger.Error("error while dialing push server", zap.String("push-server", serverAddr), zap.Error(err))
				return
			}
		}(serverAddr, pushTokens)
	}

	wg.Wait()

	return &protocoltypes.PushSend_Reply{}, nil
}

func (s *service) getPushTargetsByServer(gc *GroupContext, targetGroupMembers []*protocoltypes.MemberWithDevices) (map[string][]*pushtypes.PushServiceOpaqueReceiver, error) {
	pushTargets := []*protocoltypes.PushMemberTokenUpdate(nil)
	serverTokens := map[string][]*pushtypes.PushServiceOpaqueReceiver{}
	targetDevices := []crypto.PubKey(nil)

	if len(targetGroupMembers) == 0 {
		targetDevices = gc.metadataStore.ListOtherMembersDevices()
	} else {
		for _, memberAndDevices := range targetGroupMembers {
			pk, err := crypto.UnmarshalEd25519PublicKey(memberAndDevices.MemberPK)
			if err != nil {
				return nil, errcode.ErrDeserialization.Wrap(err)
			}

			if len(memberAndDevices.DevicePKs) == 0 {
				// If no devices provided push all devices
				devices, err := gc.metadataStore.GetDevicesForMember(pk)
				if err != nil {
					return nil, errcode.ErrInternal.Wrap(err)
				}

				targetDevices = append(targetDevices, devices...)
				continue
			}

			for _, pkB := range memberAndDevices.DevicePKs {
				devPK, err := crypto.UnmarshalEd25519PublicKey(pkB)
				if err != nil {
					return nil, errcode.ErrDeserialization.Wrap(err)
				}

				member, err := gc.metadataStore.GetMemberByDevice(devPK)
				if err != nil {
					s.logger.Warn("error while retrieving member for device", zap.Error(err))
					continue
				}

				if !member.Equals(devPK) {
					s.logger.Warn("device does not belong to member")
					continue
				}

				targetDevices = append(targetDevices, devPK)
			}
		}
	}

	for _, d := range targetDevices {
		pushToken, err := gc.metadataStore.GetPushTokenForDevice(d)
		if err != nil {
			s.logger.Info("unable to get push token for device")
			continue
		}

		pushTargets = append(pushTargets, pushToken)
	}

	for _, pushTarget := range pushTargets {
		serverTokens[pushTarget.Server.ServiceAddr] = append(serverTokens[pushTarget.Server.ServiceAddr], &pushtypes.PushServiceOpaqueReceiver{OpaqueToken: pushTarget.Token})
	}

	return serverTokens, nil
}

func (s *service) PushShareToken(ctx context.Context, request *protocoltypes.PushShareToken_Request) (*protocoltypes.PushShareToken_Reply, error) {
	gc, err := s.GetContextGroupForID(request.GroupPK)
	if err != nil {
		return nil, errcode.ErrInvalidInput.Wrap(err)
	}

	token, err := PushSealTokenForServer(request.Receiver, request.Server)
	if err != nil {
		return nil, errcode.ErrInternal.Wrap(err)
	}

	if _, err := gc.metadataStore.SendPushToken(ctx, token); err != nil {
		return nil, err
	}

	return &protocoltypes.PushShareToken_Reply{}, nil
}

func (s *service) PushSetDeviceToken(ctx context.Context, request *protocoltypes.PushSetDeviceToken_Request) (*protocoltypes.PushSetDeviceToken_Reply, error) {
	s.lock.Lock()
	defer s.lock.Unlock()

	if request.Receiver == nil || request.Receiver.TokenType == pushtypes.PushServiceTokenType_PushTokenUndefined {
		return nil, errcode.ErrInvalidInput.Wrap(fmt.Errorf("invalid push token provided"))
	}

	request.Receiver.RecipientPublicKey = s.pushHandler.PushPK()[:]

	if currentReceiver := s.accountGroup.metadataStore.getCurrentDevicePushToken(); currentReceiver != nil && bytes.Equal(currentReceiver.Token, request.Receiver.Token) {
		return &protocoltypes.PushSetDeviceToken_Reply{}, nil
	}

	if _, err := s.accountGroup.metadataStore.RegisterDevicePushToken(ctx, request.Receiver); err != nil {
		return nil, errcode.ErrInternal.Wrap(err)
	}

	return &protocoltypes.PushSetDeviceToken_Reply{}, nil
}

func (s *service) PushSetServer(ctx context.Context, request *protocoltypes.PushSetServer_Request) (*protocoltypes.PushSetServer_Reply, error) {
	s.lock.Lock()
	defer s.lock.Unlock()

	if request.Server == nil {
		return nil, errcode.ErrInvalidInput.Wrap(fmt.Errorf("no push server provided"))
	}

	if currentServer := s.accountGroup.metadataStore.getCurrentDevicePushServer(); currentServer != nil &&
		bytes.Equal(currentServer.ServerKey, request.Server.ServerKey) &&
		currentServer.ServiceAddr == request.Server.ServiceAddr {
		return &protocoltypes.PushSetServer_Reply{}, nil
	}

	if _, err := s.accountGroup.metadataStore.RegisterDevicePushServer(ctx, request.Server); err != nil {
		return nil, errcode.ErrInternal.Wrap(err)
	}

	if err := s.pushHandler.UpdatePushServer(request.Server); err != nil {
		return nil, errcode.ErrInternal.Wrap(err)
	}

	return &protocoltypes.PushSetServer_Reply{}, nil
}

func (s *service) GetCurrentDevicePushConfig() (*protocoltypes.PushServiceReceiver, *protocoltypes.PushServer) {
	currentToken := s.accountGroup.metadataStore.getCurrentDevicePushToken()
	currentServer := s.accountGroup.metadataStore.getCurrentDevicePushServer()

	return currentToken, currentServer
}

func monitorPushServer(ctx context.Context, cc *grpc.ClientConn, logger *zap.Logger) {
	currentState := cc.GetState()
	for cc.WaitForStateChange(ctx, currentState) {
		currentState = cc.GetState()
		logger.Debug("push grpc client state updated",
			zap.String("target", cc.Target()),
			zap.String("state", currentState.String()))
	}
}
