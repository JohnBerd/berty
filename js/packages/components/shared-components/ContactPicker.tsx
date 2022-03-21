import React, { useEffect, useState } from 'react'

import { CheckBox, Icon, Text } from '@ui-kitten/components'
import { useTranslation } from 'react-i18next'
import { ScrollView, TextInput, TouchableOpacity, View } from 'react-native'

import beapi from '@berty-tech/api'
import { berty } from '@berty-tech/api/root.pb'
import { useAppDispatch, useAppSelector, useContactSearchResults } from '@berty-tech/react-redux'
import {
	addMemberToInvitationList,
	removeMemberFromInvitationListById,
	resetInvitationList,
	selectInvitationListMembers,
} from '@berty-tech/redux/reducers/groupCreationForm.reducer'
import { useThemeColor } from '@berty-tech/store/hooks'
import { useStyles } from '@berty-tech/styles'

import { ContactAvatar } from '../avatars'

// Styles
const useStylesCreateGroup = () => {
	const [{ border }] = useStyles()
	const colors = useThemeColor()

	return {
		separateBar: [border.scale(0.6), { borderColor: `${colors['secondary-text']}90` }],
	}
}

// Type
type ContactPickerProps = {
	accountContacts: beapi.messenger.IContact[]
}

type ContactItemProps = {
	separateBar?: boolean
	contact: berty.messenger.v1.IContact
	added: boolean
}

const ContactItem: React.FC<ContactItemProps> = ({ contact, added, separateBar = true }) => {
	const [{ row, margin, padding, text }, { scaleSize }] = useStyles()
	const _styles = useStylesCreateGroup()
	const colors = useThemeColor()
	const dispatch = useAppDispatch()

	return (
		<View>
			<TouchableOpacity
				onPress={() => {
					if (added) {
						dispatch(removeMemberFromInvitationListById(contact.publicKey!))
					} else {
						dispatch(addMemberToInvitationList(contact))
					}
				}}
				style={[row.fill, padding.right.small]}
			>
				<View style={[row.left, row.item.justify, padding.vertical.small, { flexShrink: 1 }]}>
					<ContactAvatar size={50 * scaleSize} publicKey={contact.publicKey} />
					<Text
						numberOfLines={1}
						style={[
							text.size.medium,
							margin.left.medium,
							row.item.justify,
							{ flexShrink: 1, color: colors['main-text'] },
						]}
					>
						{contact.displayName!}
					</Text>
				</View>
				<View style={[row.item.justify]}>
					<CheckBox
						checked={added}
						onChange={(isChecked: any) => {
							if (isChecked) {
								dispatch(addMemberToInvitationList(contact))
							} else {
								dispatch(removeMemberFromInvitationListById(contact.publicKey!))
							}
						}}
					/>
				</View>
			</TouchableOpacity>
			{separateBar && <View style={[_styles.separateBar]} />}
		</View>
	)
}

export const ContactPicker: React.FC<ContactPickerProps> = ({ accountContacts }) => {
	const [{ padding, row, margin, border }, { scaleHeight, scaleSize }] = useStyles()
	const colors = useThemeColor()
	const [searchText, setSearchText] = useState('')
	const searchContacts = useContactSearchResults(searchText)
	const { t }: { t: any } = useTranslation()
	const members = useAppSelector(selectInvitationListMembers)
	const dispatch = useAppDispatch()
	let contacts = searchText.length ? searchContacts : accountContacts
	contacts = contacts.filter(
		(contact: any) => contact.state === beapi.messenger.Contact.State.Accepted,
	)

	useEffect(() => {
		dispatch(resetInvitationList())
	}, [dispatch])

	return (
		<View
			style={[
				padding.horizontal.large,
				padding.top.small,
				{ flex: 1, backgroundColor: colors['main-background'] },
			]}
		>
			<View
				style={[
					padding.small,
					row.left,
					border.radius.medium,
					{ backgroundColor: colors['input-background'], alignItems: 'center' },
				]}
			>
				<Icon
					name='search-outline'
					width={30 * scaleHeight}
					height={30 * scaleHeight}
					fill={colors['secondary-text']}
					style={row.item.justify}
				/>
				<TextInput
					style={[
						margin.left.small,
						{
							color: colors['secondary-text'],
							paddingVertical: 8 * scaleHeight,
							flex: 1,
						},
					]}
					placeholder={t('main.home.create-group.search-placeholder')}
					placeholderTextColor={colors['secondary-text']}
					onChangeText={setSearchText}
					autoCorrect={false}
				/>
			</View>

			<ScrollView
				contentContainerStyle={[padding.top.medium, { paddingBottom: 75 * scaleSize }]}
				style={[margin.top.small, { flex: 1 }]}
				showsVerticalScrollIndicator={false}
			>
				{contacts.map((contact, index) => (
					<ContactItem
						key={contact.publicKey}
						added={!!members.find(member => member.publicKey === contact.publicKey)}
						contact={contact}
						separateBar={index < contacts.length - 1}
					/>
				))}
			</ScrollView>
		</View>
	)
}
