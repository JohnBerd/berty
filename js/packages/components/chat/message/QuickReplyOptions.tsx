import React from 'react'

import { Text } from '@ui-kitten/components'
import Long from 'long'
import { TouchableOpacity, View } from 'react-native'

import beapi from '@berty-tech/api'
import { useAppDispatch } from '@berty-tech/react-redux'
import { useThemeColor, useMessengerClient } from '@berty-tech/store'
import { useStyles } from '@berty-tech/styles'

const QuickReplyOption: React.FC<{
	convPk: string
	option: beapi.messenger.IReplyOption
}> = ({ convPk, option }) => {
	const client = useMessengerClient()
	const colors = useThemeColor()
	const [{ padding, border, margin }] = useStyles()
	const dispatch = useAppDispatch()

	return (
		<TouchableOpacity
			onPress={async () => {
				try {
					if (!client) {
						return
					}
					const usermsg: beapi.messenger.AppMessage.IUserMessage = { body: option.payload }
					const buf = beapi.messenger.AppMessage.UserMessage.encode(usermsg).finish()
					const reply = await client.interact({
						conversationPublicKey: convPk,
						type: beapi.messenger.AppMessage.Type.TypeUserMessage,
						payload: buf,
					})
					const optimisticInteraction: beapi.messenger.IInteraction = {
						cid: reply.cid,
						isMine: true,
						conversationPublicKey: convPk,
						type: beapi.messenger.AppMessage.Type.TypeUserMessage,
						payload: buf,
						sentDate: Long.fromNumber(Date.now()).toString() as unknown as Long,
					}
					dispatch({
						type: 'messenger/InteractionUpdated',
						payload: { interaction: optimisticInteraction },
					})
				} catch (e: any) {
					console.warn('error sending message:', e)
				}
			}}
		>
			<View
				style={[
					border.radius.top.small,
					border.radius.left.small,
					border.radius.right.small,
					margin.top.tiny,
					border.scale(2),
					padding.horizontal.scale(8),
					padding.vertical.scale(4),
					{ borderColor: colors['secondary-text'] },
				]}
			>
				<Text style={{ color: colors['secondary-text'] }}>{option.display || ''}</Text>
			</View>
		</TouchableOpacity>
	)
}

export const QuickReplyOptions: React.FC<{
	convPk: string
	options: beapi.messenger.IReplyOption[]
}> = ({ convPk, options }) => {
	const [{ flex }] = useStyles()

	return (
		<View style={[flex.align.start]}>
			{(options || []).map(opt => (
				<QuickReplyOption key={opt.display} convPk={convPk} option={opt} />
			))}
		</View>
	)
}
