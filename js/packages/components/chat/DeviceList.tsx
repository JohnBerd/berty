import React, { useState, useEffect } from 'react'

import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import { useSelector } from 'react-redux'

import { berty } from '@berty-tech/api/root.pb'
import { ButtonDropDown } from '@berty-tech/components/shared-components'
import { selectClient } from '@berty-tech/redux/reducers/ui.reducer'
import {
	getDevicesForConversationAndMember,
	getSharedPushTokensForConversation,
} from '@berty-tech/store'
import { useStyles } from '@berty-tech/styles'

const UserDevicesList: React.FC<{ memberPk: string; conversationPk: string }> = ({
	memberPk,
	conversationPk,
}) => {
	const cutoff = 16
	const [{ padding }] = useStyles()
	const { t } = useTranslation()
	const [tokens, setTokens] = useState<berty.messenger.v1.ISharedPushToken[]>([])
	const [devices, setDevices] = useState<berty.messenger.v1.IDevice[]>([])
	const client = useSelector(selectClient)

	useEffect(() => {
		if (!client) {
			return
		}

		getSharedPushTokensForConversation(client, conversationPk).then(setTokens).catch(console.warn)
	}, [conversationPk, client, setTokens])

	useEffect(() => {
		if (!client) {
			return
		}

		getDevicesForConversationAndMember(client, conversationPk, memberPk).then(setDevices)
	}, [conversationPk, client, memberPk, setDevices])

	const tokensMap = Object.fromEntries(tokens.map(t => [t.devicePublicKey, t.token]))

	return (
		<>
			{devices.map((m, key) => {
				return (
					<View
						key={key}
						style={{
							flexDirection: 'row',
							alignItems: 'center',
						}}
					>
						<View
							style={[
								padding.top.small,
								{
									alignSelf: 'flex-start',
								},
							]}
						/>

						<ButtonDropDown
							title={
								m?.memberPublicKey?.substring(0, cutoff) ||
								t('chat.multi-member-settings.members-devices-button.unknown')
							}
							body={
								tokensMap[m?.publicKey || '']
									? [
											t('chat.devices.push.enabled'),
											(tokensMap[m?.publicKey || ''] || '').substring(0, cutoff),
									  ].join(' ')
									: t('chat.devices.push.not-enabled')
							}
						/>
					</View>
				)
			})}
		</>
	)
}

export default UserDevicesList
