import React, { useEffect, useState } from 'react'
import {
	ScrollView,
	View,
	Text as TextNative,
	ActivityIndicator,
	TouchableOpacity,
	StatusBar,
} from 'react-native'
import { Layout, Text, Icon } from '@ui-kitten/components'
import { useTranslation } from 'react-i18next'
import { useNavigation } from '@react-navigation/native'

import { useStyles } from '@berty-tech/styles'
import { useThemeColor } from '@berty-tech/store/hooks'
import { protocolMethodsHooks } from '@berty-tech/store/methods'
import beapi from '@berty-tech/api'

import { usePrevious } from '../hooks'
import { pbDateToNum } from '../helpers'

const PeerItem: React.FC<{ item: beapi.protocol.PeerList.IPeer; highlighted: boolean }> = ({
	item,
	highlighted,
}) => {
	const { id, minLatency, isActive, features } = item
	const [{ padding, border, text, row, height, width }] = useStyles()
	const colors = useThemeColor()
	const [isDropdown, setIsDropdown] = useState(false)

	return (
		<View style={[border.scale(1), border.radius.small, { borderColor: colors['secondary-text'] }]}>
			<View
				style={[
					{ justifyContent: 'space-evenly', flexDirection: 'row', alignItems: 'center' },
					highlighted && { backgroundColor: colors['positive-asset'] },
					padding.small,
				]}
			>
				<View style={[row.center, { flex: 1 }]}>
					<View
						style={[
							width(12),
							height(12),
							border.radius.scale(6),
							{ backgroundColor: isActive ? colors['background-header'] : colors['warning-asset'] },
						]}
					/>
				</View>
				<View style={[row.center, { flex: 2 }]}>
					<Icon
						name='earth'
						pack='custom'
						fill={colors['alt-secondary-background-header']}
						width={25}
						height={25}
					/>
				</View>
				<View style={[row.center, { flex: 2 }]}>
					{features?.length
						? features.map(value => {
								let name, pack, fill
								switch (value) {
									case beapi.protocol.PeerList.Feature.BertyFeature:
										name = 'berty'
										pack = 'custom'
										break
									case beapi.protocol.PeerList.Feature.QuicFeature:
										name = 'network'
										pack = 'custom'
										fill = colors['alt-secondary-background-header']
										break
								}
								return (
									<Icon
										key={value}
										name={name}
										pack={pack}
										fill={fill || null}
										width={25}
										height={25}
									/>
								)
						  })
						: null}
				</View>
				<Text style={[text.align.center, { flex: 4 }]}>{id?.substr(0, 9)}</Text>
				<Text numberOfLines={1} style={[text.align.center, { flex: 3 }]}>
					{minLatency ? minLatency + 'ms' : '?'}
				</Text>
				<TouchableOpacity
					style={[row.center, { flex: 1 }]}
					onPress={() => setIsDropdown(!isDropdown)}
				>
					<Icon
						name='arrow-ios-downward'
						fill={colors['alt-secondary-background-header']}
						width={25}
						height={25}
					/>
				</TouchableOpacity>
			</View>
			{isDropdown && (
				<View style={[padding.small]}>
					<Text>{JSON.stringify(item, null, 2)}</Text>
				</View>
			)}
		</View>
	)
}

type PeersTypes = {
	berty: number
	quic: number
	ble: number
}

function getPeersTypes(peers: beapi.protocol.PeerList.IPeer[] | null) {
	let peersTypes = {
		berty: 0,
		quic: 0,
		ble: 0,
	}

	peers?.forEach(value => {
		value?.features?.forEach(feature => {
			switch (feature) {
				case beapi.protocol.PeerList.Feature.BertyFeature:
					peersTypes.berty += 1
					break
				case beapi.protocol.PeerList.Feature.QuicFeature:
					peersTypes.quic += 1
					break
			}
		})
	})

	return peersTypes
}

const NetworkMapBody: React.FC<{ peers: beapi.protocol.PeerList.IReply | null }> = ({ peers }) => {
	const [{ margin, text }] = useStyles()
	const colors = useThemeColor()
	const { t }: any = useTranslation()
	const [sortPeers, setSortPeers] = useState<beapi.protocol.PeerList.IPeer[] | null>(null)
	const [typesPeers, setTypesPeers] = useState<PeersTypes | null>(null)

	const prevPeers = usePrevious(sortPeers)

	useEffect(() => {
		if (peers?.peers) {
			setSortPeers(
				Object.values(peers.peers).sort(
					(a, b) => pbDateToNum(a.minLatency) - pbDateToNum(b.minLatency),
				),
			)
			setTypesPeers(getPeersTypes(peers.peers))
		}
	}, [peers])

	return (
		<View style={[{ flexDirection: 'column' }]}>
			{sortPeers?.length ? (
				<View>
					<View style={[margin.medium]}>
						<TextNative
							style={[
								{ fontFamily: 'Open Sans', color: colors['alt-secondary-background-header'] },
								text.bold.medium,
								text.size.large,
							]}
						>
							{`${t('settings.network-map.online-peers')} ${sortPeers.length}`}
						</TextNative>
						<View
							style={{
								flexDirection: 'row',
								alignItems: 'center',
								justifyContent: 'space-around',
								marginTop: 15,
							}}
						>
							<View style={{ flexDirection: 'row', alignItems: 'center' }}>
								<Icon name='berty' pack='custom' width={25} height={25} />
								<TextNative
									style={[
										{
											fontFamily: 'Open Sans',
											color: colors['alt-secondary-background-header'],
										},
										text.bold.medium,
										text.size.large,
										margin.left.tiny,
									]}
								>
									{typesPeers?.berty}
								</TextNative>
							</View>
							<View style={{ flexDirection: 'row', alignItems: 'center' }}>
								<Icon
									name='network'
									pack='custom'
									fill={colors['alt-secondary-background-header']}
									width={25}
									height={25}
								/>
								<TextNative
									style={[
										{
											fontFamily: 'Open Sans',
											color: colors['alt-secondary-background-header'],
										},
										text.bold.medium,
										text.size.large,
										margin.left.tiny,
									]}
								>
									{typesPeers?.quic}
								</TextNative>
							</View>
							<View style={{ flexDirection: 'row', alignItems: 'center' }}>
								<Icon
									name='bluetooth'
									fill={colors['alt-secondary-background-header']}
									width={25}
									height={25}
								/>
								<TextNative
									style={[
										{
											fontFamily: 'Open Sans',
											color: colors['alt-secondary-background-header'],
										},
										text.bold.medium,
										text.size.large,
										margin.left.tiny,
									]}
								>
									{typesPeers?.ble}
								</TextNative>
							</View>
						</View>
					</View>
					<>
						{sortPeers.map(value => {
							const elem = prevPeers?.find(v => value.id?.toString() === v.id?.toString())
							return (
								<PeerItem
									key={value.id}
									item={value}
									highlighted={elem ? false : prevPeers ? true : false}
								/>
							)
						})}
					</>
				</View>
			) : (
				<View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 100 }}>
					<ActivityIndicator size='large' />
				</View>
			)}
		</View>
	)
}

export const NetworkMap = () => {
	const navigation = useNavigation()
	const colors = useThemeColor()
	const [{}, { scaleSize }] = useStyles()
	const { reply: peers = {}, call, called } = protocolMethodsHooks.usePeerList()

	useEffect(() => {
		if (!called) {
			call()
		}
	}, [called, call])

	React.useLayoutEffect(() => {
		navigation.setOptions({
			headerRight: () => (
				<TouchableOpacity onPress={() => call()}>
					<Icon
						name='refresh-outline'
						width={30 * scaleSize}
						height={30 * scaleSize}
						fill={colors['reverted-main-text']}
					/>
				</TouchableOpacity>
			),
		})
	})

	return (
		<Layout style={{ flex: 1, backgroundColor: colors['main-background'] }}>
			<StatusBar
				backgroundColor={colors['alt-secondary-background-header']}
				barStyle='light-content'
			/>
			<ScrollView bounces={false}>
				<NetworkMapBody peers={peers} />
			</ScrollView>
		</Layout>
	)
}
