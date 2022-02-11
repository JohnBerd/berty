import { useThemeColor } from '@berty-tech/store'
import { useStyles } from '@berty-tech/styles'
import React, { createContext, FC, ReactNode, useContext, useEffect, useState } from 'react'
import { Modal, View } from 'react-native'
import { TouchableWithoutFeedback } from 'react-native-gesture-handler'

const ModalContext = createContext<{
	hide: (resetStack?: boolean) => void
	show: (component: ReactNode) => void
	modalVisible: boolean
}>({
	hide: () => {},
	show: () => {},
	modalVisible: false,
})

export const ConversationModalProvider: FC = ({ children }) => {
	const colors = useThemeColor()
	const [{ padding, border }] = useStyles()
	const [visible, setVisible] = useState<boolean>(false)
	const [stack, setStack] = useState<ReactNode[]>([])

	const show = (component: ReactNode) => {
		setStack([...stack, component])
		setVisible(true)
	}

	const hide = (resetStack: boolean = false) => {
		let newStack = [...stack]

		if (!resetStack) {
			newStack.pop()
		} else {
			newStack = []
		}
		setStack(newStack)
		setVisible(newStack.length !== 0)
	}

	useEffect(() => {
		if (!stack.length) {
			return
		}
		setVisible(false)
		setTimeout(() => {
			setVisible(true)
		}, 50)
	}, [stack.length])

	return (
		<ModalContext.Provider value={{ hide, show, modalVisible: visible }}>
			<Modal
				transparent
				visible={visible}
				animationType='slide'
				style={{
					position: 'relative',
					flex: 1,
					height: '100%',
				}}
			>
				<View
					style={{
						zIndex: 999,
						position: 'absolute',
						bottom: 0,
						left: 0,
						right: 0,
						top: 0,
					}}
				>
					<TouchableWithoutFeedback onPress={() => hide()} style={{ height: '100%' }} />
				</View>
				<View
					style={{
						zIndex: 999,
						position: 'absolute',
						bottom: 0,
						left: 0,
						right: 0,
					}}
				>
					<View style={{ width: '100%' }}>
						<View
							style={[
								border.radius.top.large,
								border.shadow.big,
								padding.bottom.large,
								{
									backgroundColor: colors['main-background'],
									shadowColor: colors.shadow,
								},
							]}
						>
							{stack.length ? stack[stack.length - 1] : null}
						</View>
					</View>
				</View>
			</Modal>
			{children}
		</ModalContext.Provider>
	)
}

export const useConversationModal = () => {
	const context = useContext(ModalContext)
	if (!context) {
		throw new Error('useConversationModal must be used within a ModalProvider')
	}
	return context
}
