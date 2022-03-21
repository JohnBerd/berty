import React from 'react'

import { SvgProps } from 'react-native-svg'

import AccountBerty from './custom-icons-svgs/account-berty.svg'
import AddNewGroup from './custom-icons-svgs/add-new-group.svg'
import Berty from './custom-icons-svgs/berty_picto.svg'
import WrongMan from './custom-icons-svgs/wrong-man.svg'
import Privacy from './custom-icons-svgs/privacy.svg'
import COGChip from './custom-icons-svgs/cog-chip.svg'
import PrivacyModeBackground from './custom-icons-svgs/privacy-mode-bg.svg'
import MicrophoneFooter from './custom-icons-svgs/microphone-footer.svg'
import CameraFooter from './custom-icons-svgs/camera-footer.svg'
import Bertyzzz from './custom-icons-svgs/bertyzzz.svg'
import Bubble from './custom-icons-svgs/bubble.svg'
import CameraOutline from './custom-icons-svgs/camera-outline.svg'
import Camera from './custom-icons-svgs/camera.svg'
import Network from './custom-icons-svgs/chart-network-light.svg'
import Config from './custom-icons-svgs/config.svg'
import Earth from './custom-icons-svgs/earth.svg'
import Proximity from './custom-icons-svgs/proximity.svg'
import Services from './custom-icons-svgs/services.svg'
import ExpertBluetooth from './custom-icons-svgs/expert-bluetooth.svg'
import ExpertSetting from './custom-icons-svgs/expert-mdns.svg'
import ExpertPushNotif from './custom-icons-svgs/expert-push-notif.svg'
import ExpertNode from './custom-icons-svgs/expert-node.svg'
import Files from './custom-icons-svgs/files.svg'
import Fingerprint from './custom-icons-svgs/fingerprint.svg'
import Gallery from './custom-icons-svgs/gallery.svg'
import Gif from './custom-icons-svgs/gif.svg'
import Id from './custom-icons-svgs/id.svg'
import Microphone from './custom-icons-svgs/microphone.svg'
import Next from './custom-icons-svgs/next.svg'
import Pause from './custom-icons-svgs/pause-player.svg'
import Peer from './custom-icons-svgs/peer.svg'
import Play from './custom-icons-svgs/play-player.svg'
import Plus from './custom-icons-svgs/plus.svg'
import Prev from './custom-icons-svgs/prev.svg'
import QRCode from './custom-icons-svgs/qr.svg'
import Quote from './custom-icons-svgs/quote.svg'
import Settings from './custom-icons-svgs/settings.svg'
import Share from './custom-icons-svgs/share.svg'
import Tor from './custom-icons-svgs/Tor.svg'
import UserPlus from './custom-icons-svgs/user-plus.svg'
import Users from './custom-icons-svgs/users.svg'
import Volume from './custom-icons-svgs/volume.svg'

const iconsMap: { [key: string]: React.FC<SvgProps> } = {
	fingerprint: Fingerprint,
	qr: QRCode,
	'add-new-group': AddNewGroup,
	share: Share,
	bubble: Bubble,
	id: Id,
	users: Users,
	'user-plus': UserPlus,
	quote: Quote,
	earth: Earth,
	network: Network,
	tor: Tor,
	berty: Berty,
	plus: Plus,
	'account-berty': AccountBerty,
	microphone: Microphone,
	play: Play,
	pause: Pause,
	camera: Camera,
	gallery: Gallery,
	files: Files,
	gif: Gif,
	'camera-outline': CameraOutline,
	'wrong-man': WrongMan,
	privacy: Privacy,
	'cog-chip': COGChip,
	'privacy-bg': PrivacyModeBackground,
	'microphone-footer': MicrophoneFooter,
	'camera-footer': CameraFooter,
	bertyzzz: Bertyzzz,
	volume: Volume,
	prev: Prev,
	next: Next,
	settings: Settings,
	config: Config,
	proximity: Proximity,
	peer: Peer,
	services: Services,
	'expert-ble': ExpertBluetooth,
	'expert-setting': ExpertSetting,
	'expert-push-notif': ExpertPushNotif,
	'expert-node': ExpertNode,
}

const CustomIcon: React.FC<{
	name: string
	width: number
	height: number
	fill: string
	style: any
}> = ({ name, width, height, fill, style = [] }) => {
	const Icon = iconsMap[name]
	if (!Icon) {
		return null
	}
	return <Icon width={width} height={height} color={fill} style={style} />
}

const IconProvider = (name: string) => ({
	toReactElement: (props: any) => CustomIcon({ name, ...props }),
})

function createIconsMap() {
	return new Proxy(
		{},
		{
			get(_, name: string) {
				return IconProvider(name)
			},
		},
	)
}

export const CustomIconsPack = {
	name: 'custom',
	icons: createIconsMap(),
}
