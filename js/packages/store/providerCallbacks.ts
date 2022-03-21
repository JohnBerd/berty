import beapi from '@berty-tech/api'
import { useAppDispatch } from '@berty-tech/react-redux'
import { setNextAccount, setStateOnBoardingReady } from '@berty-tech/redux/reducers/ui.reducer'

import { accountService, storageRemove, storageGet, storageSet } from './accountService'
import { defaultPersistentOptions } from './context'
import {
	refreshAccountList,
	closeAccountWithProgress,
	importAccountWithProgress,
} from './effectableCallbacks'
import { Maybe } from './hooks'
import { MessengerActions, PersistentOptionsUpdate, reducerAction } from './types'
import { storageKeyForAccount } from './utils'

export const importAccount = async (
	embedded: boolean,
	dispatch: (arg0: reducerAction) => void,
	path: string,
	reduxDispatch: ReturnType<typeof useAppDispatch>,
) => {
	if (!embedded) {
		return
	}

	// TODO: check if bridge is running
	let resp: beapi.account.ImportAccountWithProgress.Reply | null

	try {
		await closeAccountWithProgress(dispatch, reduxDispatch)
		resp = await importAccountWithProgress(path, dispatch, reduxDispatch)
	} catch (e) {
		console.warn('unable to import account', e)
		return
	}

	if (!resp) {
		throw new Error('no account returned')
	}

	if (!resp.accountMetadata?.accountId) {
		throw new Error('no account id returned')
	}

	await refreshAccountList(embedded, dispatch)

	reduxDispatch(setNextAccount(resp.accountMetadata.accountId))
}

export const updateAccount = async (
	embedded: boolean,
	dispatch: (arg0: reducerAction) => void,
	payload: any,
) => {
	if (!embedded) {
		return
	}

	try {
		let obj: any = {
			accountId: payload.accountId,
		}
		if (payload.accountName) {
			obj.accountName = payload.accountName
		}
		if (payload.publicKey) {
			obj.publicKey = payload.publicKey
		}
		if (payload.avatarCid) {
			obj.avatarCid = payload.avatarCid
		}
		await accountService.updateAccount(obj)
	} catch (e) {
		console.warn('unable to update account', e)
		return
	}

	await refreshAccountList(embedded, dispatch)
}

export const switchAccount = async (
	embedded: boolean,
	dispatch: (arg0: reducerAction) => void,
	accountID: string,
	reduxDispatch: ReturnType<typeof useAppDispatch>,
) => {
	if (!embedded) {
		return
	}

	try {
		await closeAccountWithProgress(dispatch, reduxDispatch)
	} catch (e) {
		console.warn('unable to close account', e)
		return
	}
	reduxDispatch(setNextAccount(accountID))
}

export const deleteAccount = async (
	embedded: boolean,
	dispatch: (arg0: reducerAction) => void,
	selectedAccount: string | null,
	reduxDispatch: ReturnType<typeof useAppDispatch>,
) => {
	if (!embedded) {
		return
	}
	// close current account service
	await closeAccountWithProgress(dispatch, reduxDispatch)
	let accounts: beapi.account.IAccountMetadata[] = []
	if (selectedAccount !== null) {
		// delete account service and account data storage
		await accountService.deleteAccount({ accountId: selectedAccount })
		await storageRemove(storageKeyForAccount(selectedAccount))
		accounts = await refreshAccountList(embedded, dispatch)
	} else {
		console.warn('state.selectedAccount is null and this should not occur')
	}

	if (!Object.values(accounts).length) {
		// reset to OnBoarding
		reduxDispatch(setStateOnBoardingReady())
	} else {
		// open the last opened if an other account exist
		let accountSelected: beapi.account.IAccountMetadata | null = null
		for (const account of accounts) {
			if (!accountSelected) {
				accountSelected = account
			} else if (
				accountSelected &&
				accountSelected.lastOpened &&
				account.lastOpened &&
				accountSelected.lastOpened < account.lastOpened
			) {
				accountSelected = account
			}
		}
		reduxDispatch(setNextAccount(accountSelected?.accountId))
	}
}

export const restart = async (
	embedded: boolean,
	dispatch: (arg0: reducerAction) => void,
	accountID: Maybe<string>,
	reduxDispatch: ReturnType<typeof useAppDispatch>,
) => {
	if (!embedded) {
		return
	}

	try {
		await closeAccountWithProgress(dispatch, reduxDispatch)
	} catch (e) {
		console.warn('unable to close account')
		return
	}
	reduxDispatch(setNextAccount(accountID))
}

export const setPersistentOption = async (
	dispatch: (arg0: reducerAction) => void,
	selectedAccount: string | null,
	action: PersistentOptionsUpdate,
) => {
	if (selectedAccount === null) {
		console.warn('no account opened')
		return
	}

	try {
		let opts = {}
		let persistOpts = await storageGet(storageKeyForAccount(selectedAccount))

		if (persistOpts) {
			opts = JSON.parse(persistOpts)
		}

		const updatedPersistOpts = {
			...defaultPersistentOptions(),
			...opts,
			[action.type]: action.payload,
		}

		await storageSet(storageKeyForAccount(selectedAccount), JSON.stringify(updatedPersistOpts))

		dispatch({
			type: MessengerActions.SetPersistentOption,
			payload: updatedPersistOpts,
		})
	} catch (e) {
		console.warn('store setPersistentOption Failed:', e)
		return
	}
}
