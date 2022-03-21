import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { Platform } from 'react-native'

import beapi from '@berty-tech/api'
import { globals } from '@berty-tech/config'
import { ServiceClientType } from '@berty-tech/grpc-bridge/welsh-clients.gen'
import {
	NotificationsInhibitor,
	PersistentOptions,
	PersistentOptionsKeys,
	PersistentOptionsSuggestions,
	StreamInProgress,
	UpdatesProfileNotification,
} from '@berty-tech/store'

/**
 *
 * Types
 *
 */

export const defaultPersistentOptions = (): PersistentOptions => {
	let suggestions: PersistentOptionsSuggestions = {}
	Object.values(globals.berty.contacts).forEach(async value => {
		if (value.suggestion) {
			suggestions = {
				...suggestions,
				[value.name]: {
					link: value.link,
					displayName: value.name,
					state: 'unread',
					pk: '',
					icon: value.icon,
				},
			}
		}
	})
	return {
		[PersistentOptionsKeys.Notifications]: {
			enable: true,
		},
		[PersistentOptionsKeys.Suggestions]: suggestions,
		[PersistentOptionsKeys.Debug]: {
			enable: false,
		},
		[PersistentOptionsKeys.Log]: {
			format: 'json',
		},
		[PersistentOptionsKeys.Configurations]: {},
		[PersistentOptionsKeys.LogFilters]: {
			format: '*:bty*',
		},
		[PersistentOptionsKeys.TyberHost]: {
			address: Platform.OS === 'android' ? '10.0.2.2:4242' : '127.0.0.1:4242',
		},
		[PersistentOptionsKeys.OnBoardingFinished]: {
			isFinished: false,
		},
		[PersistentOptionsKeys.ProfileNotification]: {
			[UpdatesProfileNotification]: 0,
		},
	}
}

export type UiState = {
	appState: MESSENGER_APP_STATE[keyof MESSENGER_APP_STATE]
	selectedAccount: string | null
	nextSelectedAccount: string | null
	client: ServiceClientType<beapi.messenger.MessengerService> | null
	protocolClient: ServiceClientType<beapi.protocol.ProtocolService> | null
	streamError: unknown
	streamInProgress: StreamInProgress | null
	notificationsInhibitors: NotificationsInhibitor[]
	persistentOptions: PersistentOptions
	daemonAddress: string
	clearClients: (() => Promise<void>) | (() => void) | null
	embedded: boolean
	debugMode: boolean
	accounts: beapi.account.IAccountMetadata[]
	networkConfig: beapi.account.INetworkConfig
	handledLink: boolean
}

export enum MESSENGER_APP_STATE {
	INIT = 'init',
	CLOSED = 'closed',
	OPENING_WAITING_FOR_DAEMON = 'openingWaitingForDaemon',
	OPENING_WAITING_FOR_CLIENTS = 'openingWaitingForClients',
	OPENING_LISTING_EVENTS = 'openingListingEvents',
	OPENING_GETTING_LOCAL_SETTINGS = 'openingGettingLocalSettings',
	OPENING_MARK_CONVERSATIONS_AS_CLOSED = 'openingMarkConversationsAsClosed',
	GET_STARTED = 'getStarted',
	READY = 'ready',
	CLOSING_DAEMON = 'closingDaemon',
	DELETING_CLOSING_DAEMON = 'deletingClosingDaemon',
	DELETING_CLEARING_STORAGE = 'deletingClearingStorage',
	STREAM_DONE = 'streamDone',
	PRE_READY = 'preReady',
}

const expectedAppStateChanges: {
	[key: string]: MESSENGER_APP_STATE[keyof MESSENGER_APP_STATE][]
} = {
	[MESSENGER_APP_STATE.INIT]: [
		MESSENGER_APP_STATE.OPENING_WAITING_FOR_CLIENTS,
		MESSENGER_APP_STATE.OPENING_WAITING_FOR_DAEMON,
		MESSENGER_APP_STATE.GET_STARTED,
	],
	[MESSENGER_APP_STATE.CLOSED]: [
		MESSENGER_APP_STATE.OPENING_WAITING_FOR_CLIENTS,
		MESSENGER_APP_STATE.OPENING_WAITING_FOR_DAEMON,
		MESSENGER_APP_STATE.CLOSING_DAEMON,
	],
	[MESSENGER_APP_STATE.OPENING_WAITING_FOR_DAEMON]: [
		MESSENGER_APP_STATE.STREAM_DONE,
		MESSENGER_APP_STATE.OPENING_WAITING_FOR_CLIENTS,
	],
	[MESSENGER_APP_STATE.OPENING_WAITING_FOR_CLIENTS]: [
		MESSENGER_APP_STATE.OPENING_WAITING_FOR_DAEMON,
		MESSENGER_APP_STATE.OPENING_LISTING_EVENTS,
		MESSENGER_APP_STATE.OPENING_MARK_CONVERSATIONS_AS_CLOSED,
	],
	[MESSENGER_APP_STATE.OPENING_LISTING_EVENTS]: [
		MESSENGER_APP_STATE.OPENING_WAITING_FOR_DAEMON,
		MESSENGER_APP_STATE.OPENING_GETTING_LOCAL_SETTINGS,
	],
	[MESSENGER_APP_STATE.OPENING_GETTING_LOCAL_SETTINGS]: [
		MESSENGER_APP_STATE.OPENING_MARK_CONVERSATIONS_AS_CLOSED,
	],
	[MESSENGER_APP_STATE.OPENING_MARK_CONVERSATIONS_AS_CLOSED]: [
		MESSENGER_APP_STATE.PRE_READY,
		MESSENGER_APP_STATE.READY,
	],
	[MESSENGER_APP_STATE.GET_STARTED]: [MESSENGER_APP_STATE.OPENING_WAITING_FOR_DAEMON],
	[MESSENGER_APP_STATE.READY]: [
		MESSENGER_APP_STATE.OPENING_WAITING_FOR_DAEMON,
		MESSENGER_APP_STATE.DELETING_CLOSING_DAEMON,
		MESSENGER_APP_STATE.CLOSING_DAEMON,
		MESSENGER_APP_STATE.OPENING_WAITING_FOR_CLIENTS,
		MESSENGER_APP_STATE.STREAM_DONE,
	],
	[MESSENGER_APP_STATE.CLOSING_DAEMON]: [
		MESSENGER_APP_STATE.CLOSED,
		MESSENGER_APP_STATE.OPENING_WAITING_FOR_DAEMON,
		MESSENGER_APP_STATE.OPENING_WAITING_FOR_CLIENTS,
	],
	[MESSENGER_APP_STATE.DELETING_CLOSING_DAEMON]: [MESSENGER_APP_STATE.DELETING_CLEARING_STORAGE],
	[MESSENGER_APP_STATE.DELETING_CLEARING_STORAGE]: [
		MESSENGER_APP_STATE.CLOSED,
		MESSENGER_APP_STATE.OPENING_WAITING_FOR_DAEMON,
	],
	[MESSENGER_APP_STATE.PRE_READY]: [MESSENGER_APP_STATE.READY],
	[MESSENGER_APP_STATE.STREAM_DONE]: [
		MESSENGER_APP_STATE.OPENING_WAITING_FOR_DAEMON,
		MESSENGER_APP_STATE.GET_STARTED,
		MESSENGER_APP_STATE.OPENING_WAITING_FOR_CLIENTS,
	],
}

export const isExpectedAppStateChange = (
	former: MESSENGER_APP_STATE[keyof MESSENGER_APP_STATE],
	next: MESSENGER_APP_STATE[keyof MESSENGER_APP_STATE],
): boolean => {
	console.log({ former, next })
	if (former === next) {
		return true
	}
	return (expectedAppStateChanges[former as string] || []).indexOf(next) !== -1
}

/**
 *
 * State
 *
 */

export const sliceName = 'ui'

const makeRoot = <T>(val: T) => ({
	[sliceName]: val,
})

const initialState: UiState = {
	appState: MESSENGER_APP_STATE.INIT,
	selectedAccount: null,
	nextSelectedAccount: null,
	client: null,
	protocolClient: null,
	streamError: null,
	streamInProgress: null,
	notificationsInhibitors: [],
	persistentOptions: defaultPersistentOptions(),
	daemonAddress: '',
	clearClients: null,
	embedded: true,
	debugMode: true,
	accounts: [],
	networkConfig: {},
	handledLink: false,
}

const rootInitialState = makeRoot(initialState)
type LocalRootState = typeof rootInitialState

/**
 *
 * Actions
 *
 */

const setStateOpeningFn = (state: UiState) => {
	if (state.nextSelectedAccount === null) {
		return
	}

	state.selectedAccount = state.nextSelectedAccount
	state.nextSelectedAccount = null
	state.embedded
		? changeAppState(state, MESSENGER_APP_STATE.OPENING_WAITING_FOR_DAEMON)
		: changeAppState(state, MESSENGER_APP_STATE.OPENING_WAITING_FOR_CLIENTS)
}

const setStateClosedFn = (state: UiState) => {
	state.accounts = state.accounts
	state.embedded = state.embedded
	state.daemonAddress = state.daemonAddress
	changeAppState(state, MESSENGER_APP_STATE.CLOSED)
	state.nextSelectedAccount = state.embedded ? state.nextSelectedAccount : '0'

	if (state.nextSelectedAccount !== null) {
		setStateOpeningFn(state)
	}
}

const changeAppState = (
	state: UiState,
	newAppState: MESSENGER_APP_STATE[keyof MESSENGER_APP_STATE],
) => {
	if (!isExpectedAppStateChange(state.appState, newAppState)) {
		console.warn(`unexpected app state change from ${state.appState} to ${newAppState}`)
	}
	state.appState = newAppState
}

const slice = createSlice({
	name: sliceName,
	initialState,
	reducers: {
		setStreamError(state: UiState, { payload: { error } }: PayloadAction<{ error: unknown }>) {
			state.streamError = error
		},
		// addFakeData(_: UiState, { payload: { interactions } }: PayloadAction<{ interactions: any }>) {
		// 	// useless code
		// 	let fakeInteractions: { [key: string]: unknown[] } = {}
		// 	for (const inte of interactions || []) {
		// 		if (!fakeInteractions[inte.conversationPublicKey]) {
		// 			fakeInteractions[inte.conversationPublicKey] = []
		// 			fakeInteractions[inte.conversationPublicKey].push(inte)
		// 		}
		// 	}
		// },
		deleteFakeData() {},
		setDaemonAddress(state: UiState, { payload: { value } }: PayloadAction<{ value: string }>) {
			state.daemonAddress = value
		},
		setPersistentOptions(state: UiState, { payload }: PayloadAction<PersistentOptions>) {
			state.persistentOptions = payload
		},
		setStateOpeningListingEvents(
			state: UiState,
			{
				payload,
			}: PayloadAction<{
				messengerClient?: ServiceClientType<beapi.messenger.MessengerService> | null
				protocolClient?: ServiceClientType<beapi.protocol.ProtocolService> | null
				clearClients?: (() => Promise<void>) | (() => void) | null
			}>,
		) {
			state.client = payload.messengerClient || state.client
			state.protocolClient = payload.protocolClient || state.protocolClient
			state.clearClients = payload.clearClients || state.clearClients
			changeAppState(state, MESSENGER_APP_STATE.OPENING_LISTING_EVENTS)
		},
		setStateClosed: setStateClosedFn,
		setNextAccount(state: UiState, { payload }: PayloadAction<string | null | undefined>) {
			if (payload === null || payload === undefined || !state.embedded) {
				return
			}
			state.nextSelectedAccount = payload
			setStateClosedFn(state)
		},
		setStateOpening: setStateOpeningFn,
		setStateOpeningClients(state: UiState) {
			state.appState = MESSENGER_APP_STATE.OPENING_WAITING_FOR_CLIENTS
		},
		setStateOpeningGettingLocalSettings(state: UiState) {
			state.appState = MESSENGER_APP_STATE.OPENING_GETTING_LOCAL_SETTINGS
		},
		setStateOpeningMarkConversationsClosed(state: UiState) {
			state.appState = MESSENGER_APP_STATE.OPENING_MARK_CONVERSATIONS_AS_CLOSED
		},
		setStatePreReady(state: UiState) {
			state.appState = MESSENGER_APP_STATE.PRE_READY
		},
		setStateReady(state: UiState) {
			state.appState = MESSENGER_APP_STATE.READY
		},
		setAccounts(state: UiState, { payload }: PayloadAction<beapi.account.IAccountMetadata[]>) {
			state.accounts = payload
		},
		bridgeClosed(state: UiState) {
			if (state.appState === MESSENGER_APP_STATE.DELETING_CLOSING_DAEMON) {
				state.appState = MESSENGER_APP_STATE.DELETING_CLEARING_STORAGE
			}
			setStateClosedFn(state)
		},
		addNotificationInhibitor(
			state: UiState,
			{ payload: { inhibitor } }: PayloadAction<{ inhibitor: NotificationsInhibitor }>,
		) {
			if (state.notificationsInhibitors.includes(inhibitor)) {
				return
			}
			state.notificationsInhibitors = [...state.notificationsInhibitors, inhibitor]
		},
		removeNotificationInhibitor(
			state: UiState,
			{ payload: { inhibitor } }: PayloadAction<{ inhibitor: NotificationsInhibitor }>,
		) {
			if (!state.notificationsInhibitors.includes(inhibitor)) {
				return
			}

			state.notificationsInhibitors = state.notificationsInhibitors.filter(
				(inh: any) => inh !== inhibitor,
			)
		},
		setCreatedAccount(state: UiState, { payload }: PayloadAction<{ accountId: string | null }>) {
			state.nextSelectedAccount = payload?.accountId
			state.appState = MESSENGER_APP_STATE.OPENING_WAITING_FOR_CLIENTS
			setStateClosedFn(state)
		},
		setStateStreamInProgress(state: UiState, { payload }: PayloadAction<StreamInProgress | null>) {
			state.streamInProgress = payload
		},
		setStateStreamDone(state: UiState) {
			state.appState = MESSENGER_APP_STATE.STREAM_DONE
			state.streamInProgress = null
		},
		setStateOnBoardingReady(state: UiState) {
			state.appState = MESSENGER_APP_STATE.GET_STARTED
		},
	},
})

/**
 *
 * Selectors
 *
 */

const selectSlice = (state: LocalRootState) => state[sliceName]

export const selectMessengerIsDeletingState = (state: LocalRootState): boolean =>
	selectSlice(state).appState === MESSENGER_APP_STATE.DELETING_CLEARING_STORAGE ||
	selectSlice(state).appState === MESSENGER_APP_STATE.DELETING_CLOSING_DAEMON

export const selectMessengerisClosing = (state: LocalRootState): boolean =>
	selectSlice(state).appState === MESSENGER_APP_STATE.DELETING_CLEARING_STORAGE ||
	selectSlice(state).appState === MESSENGER_APP_STATE.DELETING_CLOSING_DAEMON ||
	selectSlice(state).appState === MESSENGER_APP_STATE.CLOSING_DAEMON

export const selectMessengerIsReadyingBasics = (state: LocalRootState): boolean =>
	selectSlice(state).appState === MESSENGER_APP_STATE.OPENING_WAITING_FOR_DAEMON ||
	selectSlice(state).appState === MESSENGER_APP_STATE.OPENING_WAITING_FOR_CLIENTS ||
	selectSlice(state).appState === MESSENGER_APP_STATE.OPENING_LISTING_EVENTS ||
	selectSlice(state).appState === MESSENGER_APP_STATE.OPENING_GETTING_LOCAL_SETTINGS ||
	selectSlice(state).appState === MESSENGER_APP_STATE.CLOSED ||
	selectSlice(state).appState === MESSENGER_APP_STATE.OPENING_MARK_CONVERSATIONS_AS_CLOSED ||
	selectSlice(state).appState === MESSENGER_APP_STATE.STREAM_DONE ||
	selectSlice(state).appState === MESSENGER_APP_STATE.INIT

export const selectAppState = (
	state: LocalRootState,
): MESSENGER_APP_STATE[keyof MESSENGER_APP_STATE] => selectSlice(state).appState

export const selectSelectedAccount = (state: LocalRootState): string | null =>
	selectSlice(state).selectedAccount

export const selectClient = (
	state: LocalRootState,
): ServiceClientType<beapi.messenger.MessengerService> | null => selectSlice(state).client

export const selectProtocolClient = (
	state: LocalRootState,
): ServiceClientType<beapi.protocol.ProtocolService> | null => selectSlice(state).protocolClient

export const selectNetworkConfig = (state: LocalRootState): beapi.account.INetworkConfig =>
	selectSlice(state).networkConfig

export const selectEmbedded = (state: LocalRootState): boolean => selectSlice(state).embedded

export const selectDaemonAddress = (state: LocalRootState): string =>
	selectSlice(state).daemonAddress

export const selectPersistentOptions = (state: LocalRootState): PersistentOptions =>
	selectSlice(state).persistentOptions

export const selectDebugMode = (state: LocalRootState): boolean => selectSlice(state).debugMode

export const selectStreamInProgress = (state: LocalRootState): StreamInProgress | null =>
	selectSlice(state).streamInProgress

export const selectStreamError = (state: LocalRootState): any => selectSlice(state).streamError

export const selectNotificationsInhibitors = (state: LocalRootState): NotificationsInhibitor[] =>
	selectSlice(state).notificationsInhibitors

export const selectAccounts = (state: LocalRootState): beapi.account.IAccountMetadata[] =>
	selectSlice(state).accounts

export const selectClearClients = (
	state: LocalRootState,
): (() => Promise<void>) | (() => void) | null => selectSlice(state).clearClients

export const {
	setStreamError,
	// addFakeData,
	deleteFakeData,
	setDaemonAddress,
	setPersistentOptions,
	setStateOpeningListingEvents,
	setStateClosed,
	setNextAccount,
	setStateOpening,
	setStateOpeningClients,
	setStateOpeningGettingLocalSettings,
	setStateOpeningMarkConversationsClosed,
	setStatePreReady,
	setStateReady,
	setAccounts,
	bridgeClosed,
	addNotificationInhibitor,
	removeNotificationInhibitor,
	setCreatedAccount,
	setStateStreamInProgress,
	setStateStreamDone,
	setStateOnBoardingReady,
} = slice.actions

export default makeRoot(slice.reducer)
