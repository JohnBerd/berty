import React, { useState } from 'react'

import { useTranslation } from 'react-i18next'
import { View, ScrollView, ActivityIndicator, StatusBar, Text } from 'react-native'

import UserDevicesList from '@berty-tech/components/chat/DeviceList'
import { ScreenFC } from '@berty-tech/navigation'
import { useContact, useConversation } from '@berty-tech/react-redux'
import { useThemeColor } from '@berty-tech/store'
import { useStyles } from '@berty-tech/styles'

import { ContactAvatar } from '../avatars'
import { FingerprintContent } from '../shared-components/FingerprintContent'
import { TabBar } from '../shared-components/TabBar'

const ContactSettingsHeaderContent: React.FC = ({ children }) => {
	const [{ margin }] = useStyles()
	return <View style={[margin.top.big]}>{children}</View>
}

const InfoTab: React.FC<{ contactPk: string }> = ({ contactPk }) => {
	const { t } = useTranslation()
	const contact = useContact(contactPk)
	const conv = useConversation(contact?.conversationPublicKey || '')
	const [{ text, padding }] = useStyles()

	return (
		<>
			<Text style={[text.bold.small, padding.left.small]}>{contact?.displayName || ''}</Text>
			<UserDevicesList conversationPk={contact?.conversationPublicKey || ''} memberPk={contactPk} />
			<Text style={[text.bold.small, padding.left.small]}>
				{t('chat.contact-settings.my-devices')}
			</Text>
			<UserDevicesList
				conversationPk={contact?.conversationPublicKey || ''}
				memberPk={conv?.localMemberPublicKey || ''}
			/>
		</>
	)
}

const SelectedContent: React.FC<{ contentName: string; publicKey: string }> = ({
	contentName,
	publicKey,
}) => {
	switch (contentName) {
		case 'fingerprint':
			return <FingerprintContent seed={publicKey} isEncrypted={false} />
		case 'info':
			return <InfoTab contactPk={publicKey} />
		default:
			return <Text>Error: Unknown content name "{contentName}"</Text>
	}
}

const ContactSettingsHeader: React.FC<{ contact: any }> = ({ contact }) => {
	const [{ border, padding, row, absolute, text }] = useStyles()
	const colors = useThemeColor()
	const { t } = useTranslation()
	const [selectedContent, setSelectedContent] = useState('fingerprint')

	return (
		<View style={[padding.medium, padding.top.scale(50)]}>
			<View
				style={[
					border.radius.scale(30),
					padding.horizontal.medium,
					padding.bottom.medium,
					{ backgroundColor: colors['main-background'] },
				]}
			>
				<View style={[row.item.justify, absolute.scale({ top: -50 })]}>
					<ContactAvatar size={100} publicKey={contact.publicKey} />
				</View>
				<View style={[padding.horizontal.medium, padding.bottom.medium, padding.top.scale(65)]}>
					<Text
						style={[
							text.size.big,
							text.align.center,
							text.bold.small,
							{ color: colors['main-text'] },
						]}
					>
						{contact.displayName}
					</Text>
					<TabBar
						tabs={[
							{
								key: 'fingerprint',
								name: t('chat.contact-settings.fingerprint'),
								icon: 'fingerprint',
								iconPack: 'custom',
							},
							{
								key: 'info',
								name: t('chat.contact-settings.info'),
								icon: 'info-outline',
							},
						]}
						onTabChange={setSelectedContent}
					/>
					<ContactSettingsHeaderContent>
						<SelectedContent publicKey={contact.publicKey} contentName={selectedContent} />
					</ContactSettingsHeaderContent>
				</View>
			</View>
		</View>
	)
}

export const ContactSettings: ScreenFC<'Chat.ContactSettings'> = ({
	route,
	navigation: { goBack },
}) => {
	const { contactId } = route.params
	const colors = useThemeColor()
	const contact = useContact(contactId)
	const [{ padding }] = useStyles()
	if (!contact) {
		goBack()
		return (
			<View
				style={{ height: '100%', width: '100%', alignItems: 'center', justifyContent: 'center' }}
			>
				<ActivityIndicator />
			</View>
		)
	}
	return (
		<>
			<View style={{ flex: 1 }}>
				<StatusBar backgroundColor={colors['background-header']} barStyle='light-content' />
				<ScrollView
					style={{ backgroundColor: colors['main-background'], flex: 1 }}
					bounces={false}
					contentContainerStyle={[padding.bottom.medium]}
				>
					<View style={[padding.medium, { backgroundColor: colors['background-header'] }]}>
						<ContactSettingsHeader contact={contact} />
					</View>
					{/* <ContactSettingsBody id={contact.publicKey} /> */}
				</ScrollView>
			</View>
		</>
	)
}
