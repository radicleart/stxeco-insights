
import { CONFIG } from '$lib/config';
import { c32address, c32addressDecode } from 'c32check';
import { sbtcConfig } from '$stores/stores'
import { fetchUiInit, fetchUserBalances, setAuthorisation } from '$lib/bridge_api'
import type { SbtcConfig, SbtcUserSettingI } from '$types/sbtc_config';
import { StacksTestnet, StacksMainnet, StacksMocknet } from '@stacks/network';
import { openSignatureRequestPopup, type SignatureData, type StacksProvider } from '@stacks/connect';import { AppConfig, UserSession, showConnect, getStacksProvider } from '@stacks/connect';
import { getPegWalletAddressFromPublicKey, type AddressObject, type SbtcContractDataType, tsToDate } from 'sbtc-bridge-lib' 
import { hashMessage, verifyMessageSignature } from '@stacks/encryption';
import { defaultSbtcConfig } from '$lib/sbtc';
import { hex } from '@scure/base';
import type { ExchangeRate } from 'sbtc-bridge-lib';
import { AddressPurpose, BitcoinNetworkType, getAddress } from 'sats-connect'
import type { GetAddressOptions } from 'sats-connect'
import { getStacksAddressFromPubkey } from 'sbtc-bridge-lib/dist/payload_utils';
import { StacksMessageType, publicKeyFromSignatureVrs } from '@stacks/transactions';
import { isExecutiveTeamMember } from './sbtc_admin';

const appConfig = new AppConfig(['store_write', 'publish_data']);
export const userSession = new UserSession({ appConfig }); // we will use this export from other files
const authMessage = 'Please sign authentication'
let userMessage:string;
let provider:StacksProvider;

export const webWalletNeeded = false;
export const minimumDeposit = 10000
export const revealPayment = 10001

export function getStacksNetwork() {
	const network = CONFIG.VITE_NETWORK;
	let stxNetwork:StacksMainnet|StacksTestnet;
	/**
	if (CONFIG.VITE_ENVIRONMENT === 'nakamoto') {
		stxNetwork = new StacksTestnet({
			url: 'https://api.nakamoto.testnet.hiro.so',
		});
		return stxNetwork
	 }
	  */
	if (network === 'devnet') stxNetwork = new StacksMocknet();
	else if (network === 'testnet') stxNetwork = new StacksTestnet();
	else if (network === 'mainnet') stxNetwork = new StacksMainnet();
	else stxNetwork = new StacksMocknet();
	return stxNetwork;
}

export function decodeStacksAddress(stxAddress:string) {
	if (!stxAddress) throw new Error('Needs a stacks address');
	const decoded = c32addressDecode(stxAddress)
	return decoded
}
  
export function encodeStacksAddress (network:string, b160Address:string) {
	let version = 26
	if (network === 'mainnet') version = 22
	const address = c32address(version, b160Address) // 22 for mainnet
	return address
}

export async function fetchSbtcBalance (conf:SbtcConfig, fromLogin:boolean|undefined) {
	const localKs = conf.keySets[CONFIG.VITE_NETWORK];
	if (!fromLogin && localKs	&& localKs.stxAddress && localKs.cardinal) { // && sessionStacks === localKs.stxAddress) {
		conf.keySets[CONFIG.VITE_NETWORK] = await getBalances(CONFIG.VITE_SBTC_CONTRACT_ID, localKs)
		sbtcConfig.update(() => conf);
		return conf;
	} else {
		await addresses(async function(addr:AddressObject) {
			if (addr) {
				conf.keySets[CONFIG.VITE_NETWORK] = await getBalances(CONFIG.VITE_SBTC_CONTRACT_ID, addr)
				sbtcConfig.update(() => conf);
			}
			return conf;
		});
	}
}
async function getBalances(contractId:string, addressObject:AddressObject):Promise<AddressObject> {
	let result:AddressObject;
	const tempSegwit0 = addressObject.btcPubkeySegwit0
	const tempSegwit1 = addressObject.btcPubkeySegwit1
	try {
		result = await fetchUserBalances(addressObject);
		try {
			result.sBTCBalance = Number(result.stacksTokenInfo?.fungible_tokens[contractId + '::sbtc'].balance)
		} catch (err) {
			result.sBTCBalance = 0
		}
	} catch(err) {
		result = addressObject;
		console.log('Network down...');
	}
	if (!result.sBTCBalance) result.sBTCBalance = 0
	result.btcPubkeySegwit0 = tempSegwit0
	result.btcPubkeySegwit1 = tempSegwit1
	return result;
}
function getStacksAddress() {
	if (loggedIn()) {
		const userData = userSession.loadUserData();
		const stxAddress = (CONFIG.VITE_NETWORK === 'testnet' || CONFIG.VITE_NETWORK === 'devnet') ? userData.profile.stxAddress.testnet : userData.profile.stxAddress.mainnet;
		return stxAddress
	}
	return
}

function getProvider() {
	if (!provider) provider = getStacksProvider()
	const prod = (provider.getProductInfo) ? provider.getProductInfo() : undefined;
	if (!prod) throw new Error('Provider not found')
	return prod
}

export function isXverse() {
	const prov1 = (window as any).LeatherProvider //getProvider()
	const prov2 = (window as any).XverseProvider //getProvider()
	const xverse = getProvider().name.toLowerCase().indexOf('xverse') > -1
	return xverse
}

export function isHiro() {
	return getProvider().name.toLowerCase().indexOf('hiro') > -1
}

export function isAsigna() {
	return getProvider().name.toLowerCase().indexOf('asigna') > -1
}

export function isLeather() {
	return getProvider().name.toLowerCase().indexOf('leather') > -1
}

async function addresses(callback:any):Promise<AddressObject|undefined> {
	if (!loggedIn()) return {} as AddressObject;
	const userData = userSession.loadUserData();
	const network = CONFIG.VITE_NETWORK;
	//let something = hashP2WPKH(payload.public_keys[0])
	const stxAddress = getStacksAddress();
	let ordinal = 'unknown'
	let cardinal = 'unknown'
	let btcPubkeySegwit0 = 'unknown'
	let btcPubkeySegwit1 = 'unknown'

	try {
		if (!userData.profile.btcAddress) {
			// asigna
			callback({
				network,
				stxAddress,
				cardinal: 'unknown',
				ordinal: 'unknown',
				btcPubkeySegwit0: 'unknown',
				btcPubkeySegwit1: 'unknown',
				sBTCBalance: 0,
				stxBalance: 0
			});
		} else if (typeof userData.profile.btcAddress === 'string') {
			// xverse
			callback({
				network,
				stxAddress,
				cardinal: userData.profile.btcAddress,
				ordinal: 'unknown',
				btcPubkeySegwit0: 'unknown',
				btcPubkeySegwit1: 'unknown',
				sBTCBalance: 0,
				stxBalance: 0
			});
		} else {
			try {
				ordinal = userData.profile.btcAddress.p2tr.testnet
				cardinal = userData.profile.btcAddress.p2wpkh.testnet
				if (network === 'mainnet') {
					ordinal = userData.profile.btcAddress.p2tr.mainnet
					cardinal = userData.profile.btcAddress.p2wpkh.mainnet
				} else if (network === 'devnet') {
					ordinal = userData.profile.btcAddress.p2tr.regtest
					cardinal = userData.profile.btcAddress.p2wpkh.regtest
				} else if (network === 'signet') {
					ordinal = userData.profile.btcAddress.p2tr.signet
					cardinal = userData.profile.btcAddress.p2wpkh.signet
				}
				btcPubkeySegwit0 = userData.profile.btcPublicKey.p2wpkh
				btcPubkeySegwit1 = userData.profile.btcPublicKey.p2tr
			} catch(err:any) { 
				//
			}
	
			if (userData.profile.btcAddress) {
				callback({
					network,
					stxAddress,
					cardinal,
					ordinal,
					btcPubkeySegwit0,
					btcPubkeySegwit1,
					sBTCBalance: 0,
					stxBalance: 0
				});
			} else {
				callback({
					network,
					stxAddress,
					cardinal: 'unknown',
					ordinal: 'unknown',
					btcPubkeySegwit0: 'unknown',
					btcPubkeySegwit1: 'unknown',
					sBTCBalance: 0,
					stxBalance: 0
				});
			}
		}
	} catch(err:any) {
		console.log('addresses: ', err)
		let myType = BitcoinNetworkType.Testnet
		if (getStacksNetwork().isMainnet()) myType = BitcoinNetworkType.Mainnet
		const getAddressOptions:GetAddressOptions = {
			payload: {
				purposes: [AddressPurpose.Ordinals, AddressPurpose.Payment],
				message: 'Address for receiving Ordinals and payments',
				  network: {
					type: myType
				},
			},
			onFinish: (response:any) => {
				console.log(response)
				const obj = response.addresses;
				callback({
					network,
					stxAddress,
					cardinal: obj.find((o:any) => o.purpose === 'payment').address,
					ordinal: obj.find((o:any) => o.purpose === 'ordinals').address,
					btcPubkeySegwit0: obj.find((o:any) => o.purpose === 'payment').publicKey,
					btcPubkeySegwit1: obj.find((o:any) => o.purpose === 'ordinals').publicKey,
					sBTCBalance: 0,
					stxBalance: 0
				});
			},
			onCancel: () => {
				throw new Error('cancelled');
			}
		}
		await getAddress(getAddressOptions);
	}
}

export function appDetails() {
	return {
		name: 'stx.eco',
		icon: (window) ? window.location.origin + '/img/stx_eco_logo_icon_white.png' : '/img/stx_eco_logo_icon_white.png',
	}
}

export function makeFlash(el1:HTMLElement|null) {
	let count = 0;
	if (!el1) return;
	el1.classList.add("flasherize-button");
    const ticker = setInterval(function () {
		count++;
		if ((count % 2) === 0) {
			el1.classList.add("flasherize-button");
		}
		else {
			el1.classList.remove("flasherize-button");
		}
		if (count === 2) {
			el1.classList.remove("flasherize-button");
			clearInterval(ticker)
		}
	  }, 2000)
}

export function isLegal(routeId:string):boolean {
	try {
		if (userSession.isUserSignedIn()) return true;
		if (routeId.startsWith('http')) {
			if (routeId.indexOf('/deposit') > -1 || routeId.indexOf('/withdraw') > -1 || routeId.indexOf('/admin') > -1 || routeId.indexOf('/transactions') > -1) {
				return false;
			}
		} else if (['/deposit', '/withdraw', '/admin', '/transactions'].includes(routeId)) {
			return false;
		}
		return true;
	} catch (err) {
		return false
	}
}

export function loggedIn():boolean {
	try {
		return userSession.isUserSignedIn()
	} catch (err) {
		return false
	}
}

export async function authenticate($sbtcConfig:SbtcConfig):Promise<SignatureData|undefined> {
	userMessage = authMessage + ' ' + Math.floor( Math.random() * 1000000);
	userMessage = userMessage + ' on ' + tsToDate(new Date().getTime());
	await signMessage(async function(sigData:SignatureData, message:string) {
		const verified = verifyMessageSignature({ message, publicKey: sigData.publicKey, signature: sigData.signature });
		if (verified) {
		  console.log('sig verififed')
		}
	    const msgHash = hashMessage(message);
    	//const stxAddresses = await getStacksAddressFromSignature(msgHash, sigData.signature );
		const pubkey = publicKeyFromSignatureVrs(hex.encode(msgHash), { data: sigData.signature, type: StacksMessageType.MessageSignature })
		console.log('pubkey:', pubkey)
		//console.log('stxAddresses:', stxAddresses)
		console.log('stxAddresses:', getStacksAddressFromPubkey(hex.decode(sigData.publicKey)))

		$sbtcConfig.authHeader = { ...sigData, stxAddress: $sbtcConfig.keySets[CONFIG.VITE_NETWORK].stxAddress, amountSats: 0 }
		setAuthorisation($sbtcConfig.authHeader)
		sbtcConfig.update(() => $sbtcConfig)
		return sigData
	}, userMessage)
	return
}

export async function loginStacks(callback:any) {
	try {
		const provider = getProvider()
		console.log('provider: ', provider)
		if (!userSession.isUserSignedIn()) {
			showConnect({
				userSession,
				appDetails: appDetails(),
				onFinish: async (e:any) => {
					console.log(e)
					await callback(true);
					window.location.reload()
				},
				onCancel: () => {
					callback(false);
				},
			});
		} else {
			callback(true);
		}
	} catch (e) {
		if (window) window.location.href = "https://wallet.hiro.so/wallet/install-web";
		callback(false);
	}
}

export function loginStacksFromHeader(document:any) {
	const el = document.getElementById("connect-wallet")
	if (el) return document.getElementById("connect-wallet").click();
	else return false;
}

export async function signMessage(callback:any, message:string) {
	await openSignatureRequestPopup({
		message,
		network: getStacksNetwork(), // for mainnet, `new StacksMainnet()`
		appDetails: appDetails(),
		onFinish({ publicKey, signature }) {
			let newSig = signature.substring(0, signature.length - 2);
			const recByte = signature.substring(signature.length - 2);
			newSig = recByte + newSig
			const verified1 = verifyMessageSignature({ signature: newSig, message, publicKey });
			if (!verified1) throw new Error('verifyMessageSignature - signature is not valid')
			callback({ publicKey, signature: newSig }, message);
		}
	});
}
export async function signMessageForWithdraw(callback:any, message:string) {
	await openSignatureRequestPopup({
		message,
		network: getStacksNetwork(), // for mainnet, `new StacksMainnet()`
		appDetails: appDetails(),
		onFinish({ publicKey, signature }) {
			//let newSig = signature.substring(0, signature.length - 2);
			//const recByte = signature.substring(signature.length - 2);
			//newSig = recByte + newSig
			//const verified1 = verifyMessageSignature({ signature: newSig, message, publicKey });
			//if (!verified1) throw new Error('verifyMessageSignature - signature is not valid')
			callback({ publicKey, signature }, message);
		}
	});
}

export function logUserOut() {
	return userSession.signUserOut();
}

const FORMAT = /[ `!@#$%^&*()_+=[\]{};':"\\|,<>/?~]/;

export function verifyStacksPricipal(stacksAddress?:string) {
	if (!stacksAddress) {
	  throw new Error('Address not found');
	} else if (FORMAT.test(stacksAddress)) {
	  throw new Error('please remove white space / special characters');
	}
	try {
	  const decoded = decodeStacksAddress(stacksAddress.split('.')[0]);
	  if ((CONFIG.VITE_NETWORK === 'testnet' || CONFIG.VITE_NETWORK === 'devnet') && decoded[0] !== 26) {
		throw new Error('Please enter a valid stacks blockchain testnet address');
	  }
	  if (CONFIG.VITE_NETWORK === 'mainnet' && decoded[0] !== 22) {
		throw new Error('Please enter a valid stacks blockchain mainnet address');
	  }
	  return stacksAddress;
	  } catch (err:any) {
		  throw new Error('Invalid stacks principal - please enter a valid ' + CONFIG.VITE_NETWORK + ' account or contract principal.');
	  }
}

export function verifyAmount(amount:number, balance:number) {
	if (!amount || amount === 0) {
		throw new Error('No amount entered');
	}
	if (amount >= balance) {
		throw new Error('Amount is greater than your balance');
	}
  	//if (amount < minimumDeposit) {
	//	throw new Error('Amount must be at least 0.0001 or 10,000 satoshis');
	//  }
}
export function verifySBTCAmount(amount:number, balance:number, fee:number) {
	if (!amount || amount === 0) {
		throw new Error('No amount entered');
	}
	if (amount > (balance - fee)) {
		throw new Error('No more then balance (less fee of ' + fee + ')');
	}
}
  
export async function initApplication(conf:SbtcConfig, fromLogin:boolean|undefined) {
	if (!conf) conf = defaultSbtcConfig as SbtcConfig
	let data = {} as any;
	try {
		data = await fetchUiInit();
		if (data.sbtcContractData.sbtcWalletPublicKey) data.sbtcContractData.sbtcWalletAddress = getPegWalletAddressFromPublicKey(CONFIG.VITE_NETWORK, data.sbtcContractData.sbtcWalletPublicKey);
		conf.loggedIn = false;
		if (userSession.isUserSignedIn()) {
			await fetchSbtcBalance(conf, fromLogin);
			const emTeamMam = await isExecutiveTeamMember(conf.keySets[CONFIG.VITE_NETWORK].stxAddress);
			conf.userSettings.executiveTeamMember = false;emTeamMam.executiveTeamMember
			conf.loggedIn = true;
		}
	} catch (err) {
		data = {
			sbtcContractData: {} as SbtcContractDataType
		} as any; 
	}
	if (!conf.keySets) {
		if (CONFIG.VITE_NETWORK === 'testnet'|| CONFIG.VITE_NETWORK === 'devnet') {
			conf.keySets = { 'testnet': {} as AddressObject };
		} else {
			conf.keySets = { 'mainnet': {} as AddressObject };
		}
	}
	try {
		conf.exchangeRates = data.rates;
		if (!conf.exchangeRates) throw new Error('no exchnage rates')
		const currency = conf.userSettings.currency?.myFiatCurrency?.currency;
		const rateNow = conf.exchangeRates.find((o:any) => o.currency === currency)
		if (rateNow) conf.userSettings.currency.myFiatCurrency = rateNow
		else conf.userSettings.currency.myFiatCurrency = (conf.exchangeRates.find((o:any) => o.currency === 'USD') || {} as ExchangeRate)
	} catch (err) {
		conf.exchangeRates = []
		conf.userSettings.currency.myFiatCurrency = {} as ExchangeRate
	}
	conf.sbtcContractData = data.sbtcContractData;
	conf.btcFeeRates = data.btcFeeRates;
	if (!conf.userSettings) conf.userSettings = {} as SbtcUserSettingI
	if (!conf.keySets || !conf.keySets[CONFIG.VITE_NETWORK]) {
		conf.keySets[CONFIG.VITE_NETWORK] = {} as AddressObject;
	}
	sbtcConfig.update(() => conf);

}

function defaultSettings():SbtcUserSettingI {
	return {
		debugMode: false,
		executiveTeamMember: false,
		currency: {
		  cryptoFirst: true,
		  myFiatCurrency: {
			_id: '',
			currency: 'USD',
			fifteen: 0,
			last: 0,
			buy: 0,
			sell: 0,
			symbol: 'USD',
			name: 'BTCUSD'			  
		  },
		  denomination: 'USD',
		}
	}
}