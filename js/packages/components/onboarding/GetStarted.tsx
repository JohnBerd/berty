import React from 'react'
import { View, StatusBar } from 'react-native'
import { Text } from '@ui-kitten/components'
import { useTranslation } from 'react-i18next'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'

import { useNotificationsInhibitor, useThemeColor } from '@berty-tech/store/hooks'
import { useStyles } from '@berty-tech/styles'
import { storageSet, GlobalPersistentOptionsKeys } from '@berty-tech/store/context'

import Logo from './berty_gradient_square.svg'
import Button from './Button'

export const GetStarted = () => {
	useNotificationsInhibitor(() => true)
	const [{ absolute, column, flex, padding, text }] = useStyles()
	const colors = useThemeColor()
	const { navigate } = useNavigation()
	const { t }: any = useTranslation()

	return (
		<SafeAreaView
			style={[
				absolute.fill,
				column.justify,
				padding.medium,
				{ backgroundColor: colors['main-background'] },
			]}
		>
			<StatusBar backgroundColor={colors['main-background']} barStyle='dark-content' />
			<View style={[flex.medium]} />
			<View style={[flex.big, { flexDirection: 'row', justifyContent: 'center' }]}>
				<Logo height='60%' width='65%' />
			</View>
			<View style={[flex.medium]}>
				<Text
					style={[
						padding.horizontal.medium,
						text.align.center,
						text.align.bottom,
						{
							lineHeight: 24,
							letterSpacing: 0.4,
							color: colors['main-text'],
						},
					]}
				>
					{t('onboarding.getstarted.desc') as any}
				</Text>
			</View>
			<View style={[flex.medium]}>
				<Button
					style={{ ...column.item.center, backgroundColor: colors['background-header'] }}
					textStyle={{ textTransform: 'uppercase', color: colors['reverted-main-text'] }}
					onPress={async () => {
						await storageSet(GlobalPersistentOptionsKeys.IsNewAccount, 'isNew')
						navigate('Onboarding.CreateAccount', {})
					}}
				>
					{t('onboarding.getstarted.button')}
				</Button>
			</View>
		</SafeAreaView>
	)
}
