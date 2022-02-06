import { Wallet, Contract } from 'ethers'
import { Web3Provider } from 'ethers/providers'
import { deployContract } from 'ethereum-waffle'

import { expandTo18Decimals } from './utilities'

import ERC20 from '../../build/ERC20.json'
import WFTM9 from '../../build/WFTM9.json'
import CybarRouter01 from '../../build/CybarRouter01.json'
import CybarRouter02 from '../../build/CybarRouter02.json'
import RouterEventEmitter from '../../build/RouterEventEmitter.json'
import CybarFactory from '../../buildCore/CybarFactory.json'
import ICybarPair from '../../build/ICybarPair.json'

const overrides = {
  gasLimit: 9999999
}

interface V2Fixture {
  token0: Contract
  token1: Contract
  WFTM: Contract
  WFTMPartner: Contract
  factoryV2: Contract
  router01: Contract
  router02: Contract
  routerEventEmitter: Contract
  router: Contract
  pair: Contract
  WFTMPair: Contract
}

export async function v2Fixture(provider: Web3Provider, [wallet]: Wallet[]): Promise<V2Fixture> {
  // deploy tokens
  const tokenA = await deployContract(wallet, ERC20, [expandTo18Decimals(10000)])
  const tokenB = await deployContract(wallet, ERC20, [expandTo18Decimals(10000)])
  const WFTM = await deployContract(wallet, WFTM9)
  const WFTMPartner = await deployContract(wallet, ERC20, [expandTo18Decimals(10000)])

  // deploy V2
  const factoryV2 = await deployContract(wallet, CybarFactory, [wallet.address])

  // deploy routers
  const router01 = await deployContract(wallet, CybarRouter01, [factoryV2.address, WFTM.address], overrides)
  const router02 = await deployContract(wallet, CybarRouter02, [factoryV2.address, WFTM.address], overrides)

  // event emitter for testing
  const routerEventEmitter = await deployContract(wallet, RouterEventEmitter, [])

  // initialize V2
  await factoryV2.createPair(tokenA.address, tokenB.address)
  const pairAddress = await factoryV2.getPair(tokenA.address, tokenB.address)
  const pair = new Contract(pairAddress, JSON.stringify(ICybarPair.abi), provider).connect(wallet)

  const token0Address = await pair.token0()
  const token0 = tokenA.address === token0Address ? tokenA : tokenB
  const token1 = tokenA.address === token0Address ? tokenB : tokenA

  await factoryV2.createPair(WFTM.address, WFTMPartner.address)
  const WFTMPairAddress = await factoryV2.getPair(WFTM.address, WFTMPartner.address)
  const WFTMPair = new Contract(WFTMPairAddress, JSON.stringify(ICybarPair.abi), provider).connect(wallet)

  return {
    token0,
    token1,
    WFTM,
    WFTMPartner,
    factoryV2,
    router01,
    router02,
    router: router02, // the default router, 01 had a minor bug
    routerEventEmitter,
    pair,
    WFTMPair
  }
}
