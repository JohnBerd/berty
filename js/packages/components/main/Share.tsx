import React, { FC, ReactNode, useCallback, useEffect, useState } from 'react'
import { View, Vibration, StatusBar, Text, Share, ScrollView } from 'react-native'
import { Layout } from '@ui-kitten/components'
import QRCodeScanner from 'react-native-qrcode-scanner'

import { useThemeColor } from '@berty-tech/store/hooks'
import { useStyles } from '@berty-tech/styles'
import { ScreenFC, useNavigation } from '@berty-tech/navigation'
import { useFocusEffect } from '@react-navigation/core'
import { useAccount } from '@berty-tech/react-redux'
import { useMessengerClient } from '@berty-tech/store'

import ScanTarget from './scan_target.svg'
import QRCode from 'react-native-qrcode-svg'
import { LoaderDots } from '../gates'
import { AccountAvatar } from '../avatars'
import logo from '../main/1_berty_picto.png'
import { useTranslation } from 'react-i18next'
import { ButtonSetting, ButtonSettingRow } from '../shared-components'
import { checkPermissions } from '@berty-tech/rnutil/checkPermissions'

const QrCode: FC<{ size: number }> = ({ size }) => {
	const client = useMessengerClient()
	const colors = useThemeColor()
	const account = useAccount()
	const [link, setLink] = useState<string>('')

	const getAccountLink = useCallback(async () => {
		if (account.displayName) {
			const ret = await client?.instanceShareableBertyID({
				reset: false,
				displayName: account.displayName,
			})
			if (ret?.internalUrl) {
				setLink(ret?.internalUrl)
			}
		}
	}, [account.displayName, client])

	useEffect(() => {
		getAccountLink()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	return link ? (
		<QRCode
			size={size}
			value={link}
			logo={logo}
			color={colors['background-header']}
			mode='circle'
			backgroundColor={colors['main-background']}
		/>
	) : (
		<View style={{ width: size, height: size, justifyContent: 'center' }}>
			<LoaderDots />
		</View>
	)
}

const ScanBody: FC<{ visible: boolean }> = ({ visible = true }) => {
	const navigation = useNavigation()
	const [
		{ background, margin, flex, column, border },
		{ windowHeight, windowWidth, isGteIpadSize, fontScale },
	] = useStyles()

	const qrScanSize = isGteIpadSize
		? Math.min(windowHeight, windowWidth) * 0.5
		: Math.min(windowHeight * 0.8, windowWidth * 0.8) - 1.25 * (26 * fontScale)

	return (
		<View
			style={[
				background.black,
				margin.horizontal.small,
				column.item.center,
				flex.align.center,
				flex.justify.center,
				border.radius.medium,
				{
					height: qrScanSize,
					aspectRatio: 1,
				},
			]}
		>
			{visible && (
				<QRCodeScanner
					onRead={({ data, type }) => {
						if ((type as string) === 'QR_CODE' || (type as string) === 'org.iso.QRCode') {
							// I would like to use binary mode in QR but this scanner seems to not support it, extended tests were done
							navigation.navigate('Modals.ManageDeepLink', { type: 'qr', value: data })
							Vibration.vibrate(1000)
						}
					}}
					cameraProps={{ captureAudio: false }}
					containerStyle={[
						border.radius.medium,
						{ width: '100%', height: '100%', overflow: 'hidden' },
					]}
					cameraStyle={{ width: '100%', height: '100%', aspectRatio: 1 }}
				/>
			)}

			<ScanTarget height='75%' width='75%' style={{ position: 'absolute' }} />
		</View>
	)
}

const ShareQr: FC = () => {
	const [{ margin, text }, { windowWidth, windowHeight, scaleSize }] = useStyles()
	const colors = useThemeColor()
	const account = useAccount()
	const qrCodeSize = Math.min(windowHeight, windowWidth) * 0.45

	return (
		<View>
			<View
				style={[
					margin.top.big,
					margin.bottom.small,
					{ alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
				]}
			>
				<View style={[margin.right.small]}>
					<AccountAvatar size={24 * scaleSize} />
				</View>
				<Text style={[text.size.medium, { color: colors['main-text'] }]}>
					{account.displayName || ''}
				</Text>
			</View>
			<QrCode size={qrCodeSize} />
		</View>
	)
}

const ShareContainer: FC<{ element: ReactNode }> = ({ element, children }) => {
	const colors = useThemeColor()
	const [{ padding, border, margin }, { windowWidth, windowHeight, isGteIpadSize, fontScale }] =
		useStyles()

	const containerSize = isGteIpadSize
		? Math.min(windowHeight, windowWidth) * 0.5
		: Math.min(windowHeight * 0.8, windowWidth * 0.8) - 1.25 * (26 * fontScale)

	return (
		<View
			style={[
				border.radius.bottom.huge,
				padding.bottom.huge,
				padding.top.medium,
				{
					backgroundColor: colors['background-header'],
				},
			]}
		>
			<View
				style={[
					border.radius.medium,
					margin.bottom.big,
					{
						alignSelf: 'center',
						backgroundColor: colors['main-background'],
						alignItems: 'center',
						width: containerSize,
						height: containerSize,
					},
				]}
			>
				{element}
			</View>
			{children}
		</View>
	)
}

export const ShareModal: ScreenFC<'Main.Share'> = () => {
	const [{ flex, margin, height, width }] = useStyles()
	const colors = useThemeColor()
	const [isScannerVisible, setIsScannerVisible] = useState<boolean>(true)
	const [isScannerSelected, setIsScannerSelected] = useState<boolean>(false)
	const { navigate, goBack } = useNavigation()
	const { t } = useTranslation()
	const account = useAccount()
	const url = account.link

	const askCameraPermissions = useCallback(async () => {
		await checkPermissions('camera', {
			navigate,
			navigateToPermScreenOnProblem: true,
		})
	}, [navigate])

	useEffect(() => {
		askCameraPermissions()
	}, [askCameraPermissions])

	useFocusEffect(
		useCallback(() => {
			setIsScannerVisible(true)
			return () => {
				setIsScannerVisible(false)
			}
		}, []),
	)

	const toggleScanner = useCallback(
		() => setIsScannerSelected(!isScannerSelected),
		[isScannerSelected],
	)

	const handleSwitchQr = useCallback(async () => {
		if (!isScannerSelected) {
			await checkPermissions('camera', {
				navigate,
				navigateToPermScreenOnProblem: true,
				onComplete: () => {
					toggleScanner()
					goBack()
				},
				onSuccess: () => {
					toggleScanner()
				},
			})
		} else {
			toggleScanner()
		}
	}, [goBack, isScannerSelected, navigate, toggleScanner])

	return (
		<Layout style={[flex.tiny, { backgroundColor: colors['main-background'] }]}>
			<StatusBar backgroundColor={colors['background-header']} barStyle='light-content' />
			<ScrollView
				style={[
					margin.bottom.medium,
					{
						backgroundColor: colors['main-background'],
					},
				]}
			>
				<ShareContainer
					element={isScannerSelected ? <ScanBody visible={isScannerVisible} /> : <ShareQr />}
				>
					<ButtonSettingRow
						state={[
							{
								displayComponent: isScannerSelected && <QrCode size={80} />,
								name: t('settings.share.tap-to-scan'),
								icon: 'camera-outline',
								color: colors['background-header'],
								style: [margin.right.scale(20), height(120), width(120)],
								onPress: handleSwitchQr,
							},
							{
								name: t('settings.share.invite'),
								icon: 'link-outline',
								color: colors['background-header'],
								style: [height(120), height(120), width(120)],
								onPress: async () => {
									if (url) {
										try {
											await Share.share({ url, message: url })
										} catch (e) {
											console.error(e)
										}
									}
								},
							},
						]}
					/>
				</ShareContainer>
				<View style={[margin.horizontal.medium]}>
					<ButtonSetting
						name={t('settings.share.create-group')}
						onPress={() => navigate('Main.CreateGroupAddMembers')}
					/>
				</View>
			</ScrollView>
		</Layout>
	)
}
