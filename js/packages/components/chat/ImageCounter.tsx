import React from 'react'

import { Text, Icon } from '@ui-kitten/components'
import { View } from 'react-native'

import { useThemeColor } from '@berty-tech/store/hooks'
import { useStyles } from '@berty-tech/styles'

export const ImageCounter: React.FC<{ count: number }> = ({ count }) => {
	const [{ border, padding }] = useStyles()
	const colors = useThemeColor()

	return (
		<View
			style={[
				{
					flexDirection: 'row',
					backgroundColor: colors['background-header'],
					alignItems: 'center',
					justifyContent: 'center',
				},
				padding.small,
				border.radius.large,
			]}
		>
			<Icon name='plus' width={22} height={22} fill={colors['reverted-main-text']} />
			<Text
				style={{
					color: colors['reverted-main-text'],
					fontSize: 18,
				}}
			>
				{count}
			</Text>
		</View>
	)
}
