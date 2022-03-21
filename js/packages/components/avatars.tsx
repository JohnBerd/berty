import React from 'react'

import palette from 'google-palette'
import { Image, View, ViewStyle, Text, TouchableOpacity } from 'react-native'
import { withBadge } from 'react-native-elements'
import { SHA3 } from 'sha3'

import beapi from '@berty-tech/api'
import OrangeBotAvatar from '@berty-tech/assets/berty_bot_orange_bg.png'
import PinkBotAvatar from '@berty-tech/assets/berty_bot_pink_bg.png'
import BlueDevAvatar from '@berty-tech/assets/berty_dev_blue_bg.png'
import GreenDevAvatar from '@berty-tech/assets/berty_dev_green_bg.png'
import { navigate } from '@berty-tech/navigation'
import { useAccount, useContact, useConversation, useMember } from '@berty-tech/react-redux'
import { Maybe, useMessengerContext, useThemeColor } from '@berty-tech/store'
import { useStyles } from '@berty-tech/styles'

import AttachmentImage from './AttachmentImage'
import Logo from './main/1_berty_picto.svg'
import GroupAvatar from './main/Avatar_Group_Copy_19.png'

export type AvatarStyle = Omit<
	ViewStyle,
	'borderRadius' | 'width' | 'height' | 'alignItems' | 'justifyContent'
>

const pal = palette('tol-rainbow', 256)

export const GenericAvatar: React.FC<{
	cid: Maybe<string>
	colorSeed: Maybe<string>
	size: number
	style?: AvatarStyle
	isEditable?: boolean
	nameSeed: Maybe<string>
	pressable?: boolean
}> = React.memo(({ cid, size, colorSeed, style, isEditable = false, nameSeed, pressable }) => {
	const [{ border }] = useStyles()
	const colors = useThemeColor()

	const padding = Math.round(size / 28)
	let innerSize = Math.round(size - 2 * padding)
	let content: JSX.Element
	if (cid) {
		if (innerSize % 2) {
			innerSize--
		}
		content = (
			<View>
				<AttachmentImage
					cid={cid}
					style={{ width: innerSize, height: innerSize, borderRadius: innerSize / 2 }}
					pressable={pressable}
				/>
				{isEditable && (
					<View
						style={[
							{
								width: innerSize,
								height: innerSize,
								position: 'absolute',
								backgroundColor: colors['positive-asset'],
								opacity: 0.6,
							},
							border.radius.scale(innerSize / 2),
						]}
					/>
				)}
			</View>
		)
	} else {
		let iconSize = Math.round(innerSize - innerSize / 10) // adjust for jdenticon bug
		if (iconSize % 2) {
			iconSize--
		}
		content = (
			<View style={{ justifyContent: 'center', alignItems: 'center' }}>
				<NameAvatar size={size} style={style} colorSeed={colorSeed} nameSeed={nameSeed} />
				{isEditable && (
					<View
						style={[
							{
								width: innerSize,
								height: innerSize,
								position: 'absolute',
								backgroundColor: colors['positive-asset'],
								opacity: 0.6,
							},
							border.radius.scale(innerSize / 2),
						]}
					/>
				)}
			</View>
		)
	}
	return (
		<View style={{ zIndex: -1 }}>
			<View
				style={[
					style,
					{
						borderRadius: size / 2,
						width: size,
						height: size,
						alignItems: 'center',
						justifyContent: 'center',
						backgroundColor: colors['main-background'],
					},
				]}
			>
				{content}
			</View>
		</View>
	)
})

const hardcodedAvatars = {
	berty_dev_green_bg: GreenDevAvatar,
	berty_bot_pink_bg: PinkBotAvatar,
	berty_dev_blue_bg: BlueDevAvatar,
	berty_bot_orange_bg: OrangeBotAvatar,

	group: GroupAvatar,
}

export type HardcodedAvatarKey = keyof typeof hardcodedAvatars

export const HardcodedAvatar: React.FC<{
	size: number
	style?: AvatarStyle
	name: HardcodedAvatarKey
	pressable?: boolean
}> = React.memo(({ size, style, name, pressable }) => {
	const colors = useThemeColor()

	let avatar = hardcodedAvatars[name]
	if (!avatar) {
		avatar = Logo
	}

	return (
		<TouchableOpacity
			activeOpacity={0.9}
			disabled={!pressable}
			onPress={() => {
				navigate('Modals.ImageView', { images: [avatar], previewOnly: true })
			}}
			style={[
				style,
				{
					borderRadius: size / 2,
					backgroundColor: colors['main-background'],
				},
			]}
		>
			<Image
				source={avatar}
				style={{
					width: size,
					height: size,
					borderRadius: size / 2,
				}}
			/>
		</TouchableOpacity>
	)
})

export const AccountAvatar: React.FC<{
	size: number
	style?: AvatarStyle
	isEditable?: boolean
}> = React.memo(({ size, style, isEditable }) => {
	const account = useAccount()
	const colors = useThemeColor()
	return (
		<GenericAvatar
			nameSeed={account.displayName}
			cid={account.avatarCid}
			size={size}
			colorSeed={colors['main-text']}
			style={style}
			isEditable={isEditable}
		/>
	)
})

export const NameAvatar: React.FC<{
	colorSeed: Maybe<string>
	size: number
	style?: AvatarStyle
	nameSeed: Maybe<string>
}> = React.memo(({ colorSeed, size, style, nameSeed }) => {
	const colors = useThemeColor()

	const h = new SHA3(256).update(colorSeed || '').digest()
	const color = '#' + pal[h[0]]

	const codePoint = (nameSeed || '?').codePointAt(0)
	const char = codePoint ? String.fromCodePoint(codePoint) : '?'

	return (
		<View
			style={[
				style,
				{
					width: size,
					height: size,
					backgroundColor: color,
					borderRadius: size / 2,
					alignItems: 'center',
					justifyContent: 'center',
				},
			]}
		>
			<Text
				style={{
					color: colors['reverted-main-text'],
					fontSize: size * 0.5,
					includeFontPadding: false,
				}}
			>
				{char}
			</Text>
		</View>
	)
})

export const ContactAvatar: React.FC<{
	publicKey: Maybe<string>
	size: number
	style?: AvatarStyle
	fallbackNameSeed?: Maybe<string>
	pressable?: boolean
}> = React.memo(({ publicKey, size, style, fallbackNameSeed, pressable }) => {
	const contact = useContact(publicKey)
	const ctx = useMessengerContext()
	const suggestion = Object.values(ctx.persistentOptions?.suggestions).find(v => v.pk === publicKey)
	if (suggestion) {
		return (
			<HardcodedAvatar
				size={size}
				style={style}
				name={suggestion.icon as any}
				pressable={pressable}
			/>
		)
	}
	return (
		<GenericAvatar
			nameSeed={contact?.displayName || fallbackNameSeed}
			cid={contact?.avatarCid}
			size={size}
			colorSeed={publicKey}
			style={style}
			pressable={pressable}
		/>
	)
})

export const MemberAvatar: React.FC<{
	publicKey: Maybe<string>
	conversationPublicKey: Maybe<string>
	size: number
	pressable?: boolean
}> = React.memo(({ publicKey, conversationPublicKey, size, pressable }) => {
	const member = useMember(conversationPublicKey, publicKey)

	return (
		<GenericAvatar
			cid={member?.avatarCid}
			size={size}
			colorSeed={publicKey}
			nameSeed={member?.displayName}
			pressable={pressable}
		/>
	)
})

export const MultiMemberAvatar: React.FC<{
	size: number
	style?: AvatarStyle
	publicKey?: Maybe<string>
	fallbackNameSeed?: Maybe<string>
	pressable?: boolean
}> = React.memo(({ size, style, publicKey, fallbackNameSeed, pressable }) => {
	const ctx = useMessengerContext()
	const conv = useConversation(publicKey)
	// this useMemo prevents flickering
	return React.useMemo(() => {
		const suggestion = Object.values(ctx.persistentOptions?.suggestions).find(
			v => v.pk === publicKey,
		)
		let content: React.ReactElement
		if (suggestion) {
			content = (
				<HardcodedAvatar
					size={size}
					style={style}
					name={suggestion.icon as any}
					pressable={pressable}
				/>
			)
		} else {
			content = (
				<GenericAvatar
					size={size}
					style={style}
					cid={conv?.avatarCid}
					colorSeed={publicKey}
					nameSeed={conv?.displayName || fallbackNameSeed}
					pressable={pressable}
				/>
			)
		}
		const badgeSize = size / 3
		class GroupBadge extends React.Component {
			render = () => <HardcodedAvatar size={badgeSize} name={'group'} />
		}
		const Avatar = () => content
		const WrappedAvatar = withBadge('', { Component: GroupBadge })(Avatar)
		return <WrappedAvatar />
	}, [
		conv?.avatarCid,
		conv?.displayName,
		ctx.persistentOptions?.suggestions,
		fallbackNameSeed,
		pressable,
		publicKey,
		size,
		style,
	])
})

export const ConversationAvatar: React.FC<{
	publicKey: Maybe<string>
	size: number
	style?: AvatarStyle
}> = React.memo(({ publicKey, size, style }) => {
	const conv = useConversation(publicKey)
	const ctx = useMessengerContext()

	if (conv) {
		if (conv.type === beapi.messenger.Conversation.Type.MultiMemberType) {
			return <MultiMemberAvatar size={size} style={style} publicKey={publicKey} />
		} else if (conv.type === beapi.messenger.Conversation.Type.ContactType) {
			return <ContactAvatar size={size} publicKey={conv?.contactPublicKey} />
		}
	}

	const suggestion = Object.values(ctx.persistentOptions?.suggestions).find(v => v.pk === publicKey)
	if (suggestion) {
		return <HardcodedAvatar size={size} style={style} name={suggestion.icon as any} />
	}

	return <GenericAvatar size={size} style={style} cid='' colorSeed={publicKey} nameSeed={'C'} />
})
