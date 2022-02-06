import chai, { expect } from 'chai'
import { Contract } from 'ethers'
import { AddressZero, Zero, MaxUint256 } from 'ethers/constants'
import { BigNumber, bigNumberify } from 'ethers/utils'
import { solidity, MockProvider, createFixtureLoader } from 'ethereum-waffle'
import { ecsign } from 'ethereumjs-util'

import { expandTo18Decimals, getApprovalDigest, mineBlock, MINIMUM_LIQUIDITY } from './shared/utilities'
import { v2Fixture } from './shared/fixtures'

chai.use(solidity)

const overrides = {
  gasLimit: 9999999
}

enum RouterVersion {
  CybarRouter01 = 'CybarRouter01',
  CybarRouter02 = 'CybarRouter02'
}

describe('CybarRouter{01,02}', () => {
  for (const routerVersion of Object.keys(RouterVersion)) {
    const provider = new MockProvider({
      hardfork: 'istanbul',
      mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
      gasLimit: 9999999
    })
    const [wallet] = provider.getWallets()
    const loadFixture = createFixtureLoader(provider, [wallet])

    let token0: Contract
    let token1: Contract
    let WFTM: Contract
    let WFTMPartner: Contract
    let factory: Contract
    let router: Contract
    let pair: Contract
    let WFTMPair: Contract
    let routerEventEmitter: Contract
    beforeEach(async function() {
      const fixture = await loadFixture(v2Fixture)
      token0 = fixture.token0
      token1 = fixture.token1
      WFTM = fixture.WFTM
      WFTMPartner = fixture.WFTMPartner
      factory = fixture.factoryV2
      router = {
        [RouterVersion.CybarRouter01]: fixture.router01,
        [RouterVersion.CybarRouter02]: fixture.router02
      }[routerVersion as RouterVersion]
      pair = fixture.pair
      WFTMPair = fixture.WFTMPair
      routerEventEmitter = fixture.routerEventEmitter
    })

    afterEach(async function() {
      expect(await provider.getBalance(router.address)).to.eq(Zero)
    })

    describe(routerVersion, () => {
      it('factory, WFTM', async () => {
        expect(await router.factory()).to.eq(factory.address)
        expect(await router.WFTM()).to.eq(WFTM.address)
      })

      it('addLiquidity', async () => {
        const token0Amount = expandTo18Decimals(1)
        const token1Amount = expandTo18Decimals(4)

        const expectedLiquidity = expandTo18Decimals(2)
        await token0.approve(router.address, MaxUint256)
        await token1.approve(router.address, MaxUint256)
        await expect(
          router.addLiquidity(
            token0.address,
            token1.address,
            token0Amount,
            token1Amount,
            0,
            0,
            wallet.address,
            MaxUint256,
            overrides
          )
        )
          .to.emit(token0, 'Transfer')
          .withArgs(wallet.address, pair.address, token0Amount)
          .to.emit(token1, 'Transfer')
          .withArgs(wallet.address, pair.address, token1Amount)
          .to.emit(pair, 'Transfer')
          .withArgs(AddressZero, AddressZero, MINIMUM_LIQUIDITY)
          .to.emit(pair, 'Transfer')
          .withArgs(AddressZero, wallet.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
          .to.emit(pair, 'Sync')
          .withArgs(token0Amount, token1Amount)
          .to.emit(pair, 'Mint')
          .withArgs(router.address, token0Amount, token1Amount)

        expect(await pair.balanceOf(wallet.address)).to.eq(expectedLiquidity.sub(MINIMUM_LIQUIDITY))
      })

      it('addLiquidityFTM', async () => {
        const WFTMPartnerAmount = expandTo18Decimals(1)
        const FTMAmount = expandTo18Decimals(4)

        const expectedLiquidity = expandTo18Decimals(2)
        const WFTMPairToken0 = await WFTMPair.token0()
        await WFTMPartner.approve(router.address, MaxUint256)
        await expect(
          router.addLiquidityFTM(
            WFTMPartner.address,
            WFTMPartnerAmount,
            WFTMPartnerAmount,
            FTMAmount,
            wallet.address,
            MaxUint256,
            { ...overrides, value: FTMAmount }
          )
        )
          .to.emit(WFTMPair, 'Transfer')
          .withArgs(AddressZero, AddressZero, MINIMUM_LIQUIDITY)
          .to.emit(WFTMPair, 'Transfer')
          .withArgs(AddressZero, wallet.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
          .to.emit(WFTMPair, 'Sync')
          .withArgs(
            WFTMPairToken0 === WFTMPartner.address ? WFTMPartnerAmount : FTMAmount,
            WFTMPairToken0 === WFTMPartner.address ? FTMAmount : WFTMPartnerAmount
          )
          .to.emit(WFTMPair, 'Mint')
          .withArgs(
            router.address,
            WFTMPairToken0 === WFTMPartner.address ? WFTMPartnerAmount : FTMAmount,
            WFTMPairToken0 === WFTMPartner.address ? FTMAmount : WFTMPartnerAmount
          )

        expect(await WFTMPair.balanceOf(wallet.address)).to.eq(expectedLiquidity.sub(MINIMUM_LIQUIDITY))
      })

      async function addLiquidity(token0Amount: BigNumber, token1Amount: BigNumber) {
        await token0.transfer(pair.address, token0Amount)
        await token1.transfer(pair.address, token1Amount)
        await pair.mint(wallet.address, overrides)
      }
      it('removeLiquidity', async () => {
        const token0Amount = expandTo18Decimals(1)
        const token1Amount = expandTo18Decimals(4)
        await addLiquidity(token0Amount, token1Amount)

        const expectedLiquidity = expandTo18Decimals(2)
        await pair.approve(router.address, MaxUint256)
        await expect(
          router.removeLiquidity(
            token0.address,
            token1.address,
            expectedLiquidity.sub(MINIMUM_LIQUIDITY),
            0,
            0,
            wallet.address,
            MaxUint256,
            overrides
          )
        )
          .to.emit(pair, 'Transfer')
          .withArgs(wallet.address, pair.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
          .to.emit(pair, 'Transfer')
          .withArgs(pair.address, AddressZero, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
          .to.emit(token0, 'Transfer')
          .withArgs(pair.address, wallet.address, token0Amount.sub(500))
          .to.emit(token1, 'Transfer')
          .withArgs(pair.address, wallet.address, token1Amount.sub(2000))
          .to.emit(pair, 'Sync')
          .withArgs(500, 2000)
          .to.emit(pair, 'Burn')
          .withArgs(router.address, token0Amount.sub(500), token1Amount.sub(2000), wallet.address)

        expect(await pair.balanceOf(wallet.address)).to.eq(0)
        const totalSupplyToken0 = await token0.totalSupply()
        const totalSupplyToken1 = await token1.totalSupply()
        expect(await token0.balanceOf(wallet.address)).to.eq(totalSupplyToken0.sub(500))
        expect(await token1.balanceOf(wallet.address)).to.eq(totalSupplyToken1.sub(2000))
      })

      it('removeLiquidityFTM', async () => {
        const WFTMPartnerAmount = expandTo18Decimals(1)
        const FTMAmount = expandTo18Decimals(4)
        await WFTMPartner.transfer(WFTMPair.address, WFTMPartnerAmount)
        await WFTM.deposit({ value: FTMAmount })
        await WFTM.transfer(WFTMPair.address, FTMAmount)
        await WFTMPair.mint(wallet.address, overrides)

        const expectedLiquidity = expandTo18Decimals(2)
        const WFTMPairToken0 = await WFTMPair.token0()
        await WFTMPair.approve(router.address, MaxUint256)
        await expect(
          router.removeLiquidityFTM(
            WFTMPartner.address,
            expectedLiquidity.sub(MINIMUM_LIQUIDITY),
            0,
            0,
            wallet.address,
            MaxUint256,
            overrides
          )
        )
          .to.emit(WFTMPair, 'Transfer')
          .withArgs(wallet.address, WFTMPair.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
          .to.emit(WFTMPair, 'Transfer')
          .withArgs(WFTMPair.address, AddressZero, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
          .to.emit(WFTM, 'Transfer')
          .withArgs(WFTMPair.address, router.address, FTMAmount.sub(2000))
          .to.emit(WFTMPartner, 'Transfer')
          .withArgs(WFTMPair.address, router.address, WFTMPartnerAmount.sub(500))
          .to.emit(WFTMPartner, 'Transfer')
          .withArgs(router.address, wallet.address, WFTMPartnerAmount.sub(500))
          .to.emit(WFTMPair, 'Sync')
          .withArgs(
            WFTMPairToken0 === WFTMPartner.address ? 500 : 2000,
            WFTMPairToken0 === WFTMPartner.address ? 2000 : 500
          )
          .to.emit(WFTMPair, 'Burn')
          .withArgs(
            router.address,
            WFTMPairToken0 === WFTMPartner.address ? WFTMPartnerAmount.sub(500) : FTMAmount.sub(2000),
            WFTMPairToken0 === WFTMPartner.address ? FTMAmount.sub(2000) : WFTMPartnerAmount.sub(500),
            router.address
          )

        expect(await WFTMPair.balanceOf(wallet.address)).to.eq(0)
        const totalSupplyWFTMPartner = await WFTMPartner.totalSupply()
        const totalSupplyWFTM = await WFTM.totalSupply()
        expect(await WFTMPartner.balanceOf(wallet.address)).to.eq(totalSupplyWFTMPartner.sub(500))
        expect(await WFTM.balanceOf(wallet.address)).to.eq(totalSupplyWFTM.sub(2000))
      })

      it('removeLiquidityWithPermit', async () => {
        const token0Amount = expandTo18Decimals(1)
        const token1Amount = expandTo18Decimals(4)
        await addLiquidity(token0Amount, token1Amount)

        const expectedLiquidity = expandTo18Decimals(2)

        const nonce = await pair.nonces(wallet.address)
        const digest = await getApprovalDigest(
          pair,
          { owner: wallet.address, spender: router.address, value: expectedLiquidity.sub(MINIMUM_LIQUIDITY) },
          nonce,
          MaxUint256
        )

        const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(wallet.privateKey.slice(2), 'hex'))

        await router.removeLiquidityWithPermit(
          token0.address,
          token1.address,
          expectedLiquidity.sub(MINIMUM_LIQUIDITY),
          0,
          0,
          wallet.address,
          MaxUint256,
          false,
          v,
          r,
          s,
          overrides
        )
      })

      it('removeLiquidityFTMWithPermit', async () => {
        const WFTMPartnerAmount = expandTo18Decimals(1)
        const FTMAmount = expandTo18Decimals(4)
        await WFTMPartner.transfer(WFTMPair.address, WFTMPartnerAmount)
        await WFTM.deposit({ value: FTMAmount })
        await WFTM.transfer(WFTMPair.address, FTMAmount)
        await WFTMPair.mint(wallet.address, overrides)

        const expectedLiquidity = expandTo18Decimals(2)

        const nonce = await WFTMPair.nonces(wallet.address)
        const digest = await getApprovalDigest(
          WFTMPair,
          { owner: wallet.address, spender: router.address, value: expectedLiquidity.sub(MINIMUM_LIQUIDITY) },
          nonce,
          MaxUint256
        )

        const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(wallet.privateKey.slice(2), 'hex'))

        await router.removeLiquidityFTMWithPermit(
          WFTMPartner.address,
          expectedLiquidity.sub(MINIMUM_LIQUIDITY),
          0,
          0,
          wallet.address,
          MaxUint256,
          false,
          v,
          r,
          s,
          overrides
        )
      })

      describe('swapExactTokensForTokens', () => {
        const token0Amount = expandTo18Decimals(5)
        const token1Amount = expandTo18Decimals(10)
        const swapAmount = expandTo18Decimals(1)
        const expectedOutputAmount = bigNumberify('1663887962654218072')

        beforeEach(async () => {
          await addLiquidity(token0Amount, token1Amount)
          await token0.approve(router.address, MaxUint256)
        })

        it('happy path', async () => {
          await expect(
            router.swapExactTokensForTokens(
              swapAmount,
              0,
              [token0.address, token1.address],
              wallet.address,
              MaxUint256,
              overrides
            )
          )
            .to.emit(token0, 'Transfer')
            .withArgs(wallet.address, pair.address, swapAmount)
            .to.emit(token1, 'Transfer')
            .withArgs(pair.address, wallet.address, expectedOutputAmount)
            .to.emit(pair, 'Sync')
            .withArgs(token0Amount.add(swapAmount), token1Amount.sub(expectedOutputAmount))
            .to.emit(pair, 'Swap')
            .withArgs(router.address, swapAmount, 0, 0, expectedOutputAmount, wallet.address)
        })

        it('amounts', async () => {
          await token0.approve(routerEventEmitter.address, MaxUint256)
          await expect(
            routerEventEmitter.swapExactTokensForTokens(
              router.address,
              swapAmount,
              0,
              [token0.address, token1.address],
              wallet.address,
              MaxUint256,
              overrides
            )
          )
            .to.emit(routerEventEmitter, 'Amounts')
            .withArgs([swapAmount, expectedOutputAmount])
        })

        it('gas', async () => {
          // ensure that setting price{0,1}CumulativeLast for the first time doesn't affect our gas math
          await mineBlock(provider, (await provider.getBlock('latest')).timestamp + 1)
          await pair.sync(overrides)

          await token0.approve(router.address, MaxUint256)
          await mineBlock(provider, (await provider.getBlock('latest')).timestamp + 1)
          const tx = await router.swapExactTokensForTokens(
            swapAmount,
            0,
            [token0.address, token1.address],
            wallet.address,
            MaxUint256,
            overrides
          )
          const receipt = await tx.wait()
          expect(receipt.gasUsed).to.eq(
            {
              [RouterVersion.CybarRouter01]: 102516,
              [RouterVersion.CybarRouter02]: 102538
            }[routerVersion as RouterVersion]
          )
        }).retries(3)
      })

      describe('swapTokensForExactTokens', () => {
        const token0Amount = expandTo18Decimals(5)
        const token1Amount = expandTo18Decimals(10)
        const expectedSwapAmount = bigNumberify('556668893342240036')
        const outputAmount = expandTo18Decimals(1)

        beforeEach(async () => {
          await addLiquidity(token0Amount, token1Amount)
        })

        it('happy path', async () => {
          await token0.approve(router.address, MaxUint256)
          await expect(
            router.swapTokensForExactTokens(
              outputAmount,
              MaxUint256,
              [token0.address, token1.address],
              wallet.address,
              MaxUint256,
              overrides
            )
          )
            .to.emit(token0, 'Transfer')
            .withArgs(wallet.address, pair.address, expectedSwapAmount)
            .to.emit(token1, 'Transfer')
            .withArgs(pair.address, wallet.address, outputAmount)
            .to.emit(pair, 'Sync')
            .withArgs(token0Amount.add(expectedSwapAmount), token1Amount.sub(outputAmount))
            .to.emit(pair, 'Swap')
            .withArgs(router.address, expectedSwapAmount, 0, 0, outputAmount, wallet.address)
        })

        it('amounts', async () => {
          await token0.approve(routerEventEmitter.address, MaxUint256)
          await expect(
            routerEventEmitter.swapTokensForExactTokens(
              router.address,
              outputAmount,
              MaxUint256,
              [token0.address, token1.address],
              wallet.address,
              MaxUint256,
              overrides
            )
          )
            .to.emit(routerEventEmitter, 'Amounts')
            .withArgs([expectedSwapAmount, outputAmount])
        })
      })

      describe('swapExactFTMForTokens', () => {
        const WFTMPartnerAmount = expandTo18Decimals(10)
        const FTMAmount = expandTo18Decimals(5)
        const swapAmount = expandTo18Decimals(1)
        const expectedOutputAmount = bigNumberify('1663887962654218072')

        beforeEach(async () => {
          await WFTMPartner.transfer(WFTMPair.address, WFTMPartnerAmount)
          await WFTM.deposit({ value: FTMAmount })
          await WFTM.transfer(WFTMPair.address, FTMAmount)
          await WFTMPair.mint(wallet.address, overrides)

          await token0.approve(router.address, MaxUint256)
        })

        it('happy path', async () => {
          const WFTMPairToken0 = await WFTMPair.token0()
          await expect(
            router.swapExactFTMForTokens(0, [WFTM.address, WFTMPartner.address], wallet.address, MaxUint256, {
              ...overrides,
              value: swapAmount
            })
          )
            .to.emit(WFTM, 'Transfer')
            .withArgs(router.address, WFTMPair.address, swapAmount)
            .to.emit(WFTMPartner, 'Transfer')
            .withArgs(WFTMPair.address, wallet.address, expectedOutputAmount)
            .to.emit(WFTMPair, 'Sync')
            .withArgs(
              WFTMPairToken0 === WFTMPartner.address
                ? WFTMPartnerAmount.sub(expectedOutputAmount)
                : FTMAmount.add(swapAmount),
              WFTMPairToken0 === WFTMPartner.address
                ? FTMAmount.add(swapAmount)
                : WFTMPartnerAmount.sub(expectedOutputAmount)
            )
            .to.emit(WFTMPair, 'Swap')
            .withArgs(
              router.address,
              WFTMPairToken0 === WFTMPartner.address ? 0 : swapAmount,
              WFTMPairToken0 === WFTMPartner.address ? swapAmount : 0,
              WFTMPairToken0 === WFTMPartner.address ? expectedOutputAmount : 0,
              WFTMPairToken0 === WFTMPartner.address ? 0 : expectedOutputAmount,
              wallet.address
            )
        })

        it('amounts', async () => {
          await expect(
            routerEventEmitter.swapExactFTMForTokens(
              router.address,
              0,
              [WFTM.address, WFTMPartner.address],
              wallet.address,
              MaxUint256,
              {
                ...overrides,
                value: swapAmount
              }
            )
          )
            .to.emit(routerEventEmitter, 'Amounts')
            .withArgs([swapAmount, expectedOutputAmount])
        })

        it('gas', async () => {
          const WFTMPartnerAmount = expandTo18Decimals(10)
          const FTMAmount = expandTo18Decimals(5)
          await WFTMPartner.transfer(WFTMPair.address, WFTMPartnerAmount)
          await WFTM.deposit({ value: FTMAmount })
          await WFTM.transfer(WFTMPair.address, FTMAmount)
          await WFTMPair.mint(wallet.address, overrides)

          // ensure that setting price{0,1}CumulativeLast for the first time doesn't affect our gas math
          await mineBlock(provider, (await provider.getBlock('latest')).timestamp + 1)
          await pair.sync(overrides)

          const swapAmount = expandTo18Decimals(1)
          await mineBlock(provider, (await provider.getBlock('latest')).timestamp + 1)
          const tx = await router.swapExactFTMForTokens(
            0,
            [WFTM.address, WFTMPartner.address],
            wallet.address,
            MaxUint256,
            {
              ...overrides,
              value: swapAmount
            }
          )
          const receipt = await tx.wait()
          expect(receipt.gasUsed).to.eq(
            {
              [RouterVersion.CybarRouter01]: 139420,
              [RouterVersion.CybarRouter02]: 139420
            }[routerVersion as RouterVersion]
          )
        }).retries(3)
      })

      describe('swapTokensForExactFTM', () => {
        const WFTMPartnerAmount = expandTo18Decimals(5)
        const FTMAmount = expandTo18Decimals(10)
        const expectedSwapAmount = bigNumberify('556668893342240036')
        const outputAmount = expandTo18Decimals(1)

        beforeEach(async () => {
          await WFTMPartner.transfer(WFTMPair.address, WFTMPartnerAmount)
          await WFTM.deposit({ value: FTMAmount })
          await WFTM.transfer(WFTMPair.address, FTMAmount)
          await WFTMPair.mint(wallet.address, overrides)
        })

        it('happy path', async () => {
          await WFTMPartner.approve(router.address, MaxUint256)
          const WFTMPairToken0 = await WFTMPair.token0()
          await expect(
            router.swapTokensForExactFTM(
              outputAmount,
              MaxUint256,
              [WFTMPartner.address, WFTM.address],
              wallet.address,
              MaxUint256,
              overrides
            )
          )
            .to.emit(WFTMPartner, 'Transfer')
            .withArgs(wallet.address, WFTMPair.address, expectedSwapAmount)
            .to.emit(WFTM, 'Transfer')
            .withArgs(WFTMPair.address, router.address, outputAmount)
            .to.emit(WFTMPair, 'Sync')
            .withArgs(
              WFTMPairToken0 === WFTMPartner.address
                ? WFTMPartnerAmount.add(expectedSwapAmount)
                : FTMAmount.sub(outputAmount),
              WFTMPairToken0 === WFTMPartner.address
                ? FTMAmount.sub(outputAmount)
                : WFTMPartnerAmount.add(expectedSwapAmount)
            )
            .to.emit(WFTMPair, 'Swap')
            .withArgs(
              router.address,
              WFTMPairToken0 === WFTMPartner.address ? expectedSwapAmount : 0,
              WFTMPairToken0 === WFTMPartner.address ? 0 : expectedSwapAmount,
              WFTMPairToken0 === WFTMPartner.address ? 0 : outputAmount,
              WFTMPairToken0 === WFTMPartner.address ? outputAmount : 0,
              router.address
            )
        })

        it('amounts', async () => {
          await WFTMPartner.approve(routerEventEmitter.address, MaxUint256)
          await expect(
            routerEventEmitter.swapTokensForExactFTM(
              router.address,
              outputAmount,
              MaxUint256,
              [WFTMPartner.address, WFTM.address],
              wallet.address,
              MaxUint256,
              overrides
            )
          )
            .to.emit(routerEventEmitter, 'Amounts')
            .withArgs([expectedSwapAmount, outputAmount])
        })
      })

      describe('swapExactTokensForFTM', () => {
        const WFTMPartnerAmount = expandTo18Decimals(5)
        const FTMAmount = expandTo18Decimals(10)
        const swapAmount = expandTo18Decimals(1)
        const expectedOutputAmount = bigNumberify('1663887962654218072')

        beforeEach(async () => {
          await WFTMPartner.transfer(WFTMPair.address, WFTMPartnerAmount)
          await WFTM.deposit({ value: FTMAmount })
          await WFTM.transfer(WFTMPair.address, FTMAmount)
          await WFTMPair.mint(wallet.address, overrides)
        })

        it('happy path', async () => {
          await WFTMPartner.approve(router.address, MaxUint256)
          const WFTMPairToken0 = await WFTMPair.token0()
          await expect(
            router.swapExactTokensForFTM(
              swapAmount,
              0,
              [WFTMPartner.address, WFTM.address],
              wallet.address,
              MaxUint256,
              overrides
            )
          )
            .to.emit(WFTMPartner, 'Transfer')
            .withArgs(wallet.address, WFTMPair.address, swapAmount)
            .to.emit(WFTM, 'Transfer')
            .withArgs(WFTMPair.address, router.address, expectedOutputAmount)
            .to.emit(WFTMPair, 'Sync')
            .withArgs(
              WFTMPairToken0 === WFTMPartner.address
                ? WFTMPartnerAmount.add(swapAmount)
                : FTMAmount.sub(expectedOutputAmount),
              WFTMPairToken0 === WFTMPartner.address
                ? FTMAmount.sub(expectedOutputAmount)
                : WFTMPartnerAmount.add(swapAmount)
            )
            .to.emit(WFTMPair, 'Swap')
            .withArgs(
              router.address,
              WFTMPairToken0 === WFTMPartner.address ? swapAmount : 0,
              WFTMPairToken0 === WFTMPartner.address ? 0 : swapAmount,
              WFTMPairToken0 === WFTMPartner.address ? 0 : expectedOutputAmount,
              WFTMPairToken0 === WFTMPartner.address ? expectedOutputAmount : 0,
              router.address
            )
        })

        it('amounts', async () => {
          await WFTMPartner.approve(routerEventEmitter.address, MaxUint256)
          await expect(
            routerEventEmitter.swapExactTokensForFTM(
              router.address,
              swapAmount,
              0,
              [WFTMPartner.address, WFTM.address],
              wallet.address,
              MaxUint256,
              overrides
            )
          )
            .to.emit(routerEventEmitter, 'Amounts')
            .withArgs([swapAmount, expectedOutputAmount])
        })
      })

      describe('swapFTMForExactTokens', () => {
        const WFTMPartnerAmount = expandTo18Decimals(10)
        const FTMAmount = expandTo18Decimals(5)
        const expectedSwapAmount = bigNumberify('556668893342240036')
        const outputAmount = expandTo18Decimals(1)

        beforeEach(async () => {
          await WFTMPartner.transfer(WFTMPair.address, WFTMPartnerAmount)
          await WFTM.deposit({ value: FTMAmount })
          await WFTM.transfer(WFTMPair.address, FTMAmount)
          await WFTMPair.mint(wallet.address, overrides)
        })

        it('happy path', async () => {
          const WFTMPairToken0 = await WFTMPair.token0()
          await expect(
            router.swapFTMForExactTokens(
              outputAmount,
              [WFTM.address, WFTMPartner.address],
              wallet.address,
              MaxUint256,
              {
                ...overrides,
                value: expectedSwapAmount
              }
            )
          )
            .to.emit(WFTM, 'Transfer')
            .withArgs(router.address, WFTMPair.address, expectedSwapAmount)
            .to.emit(WFTMPartner, 'Transfer')
            .withArgs(WFTMPair.address, wallet.address, outputAmount)
            .to.emit(WFTMPair, 'Sync')
            .withArgs(
              WFTMPairToken0 === WFTMPartner.address
                ? WFTMPartnerAmount.sub(outputAmount)
                : FTMAmount.add(expectedSwapAmount),
              WFTMPairToken0 === WFTMPartner.address
                ? FTMAmount.add(expectedSwapAmount)
                : WFTMPartnerAmount.sub(outputAmount)
            )
            .to.emit(WFTMPair, 'Swap')
            .withArgs(
              router.address,
              WFTMPairToken0 === WFTMPartner.address ? 0 : expectedSwapAmount,
              WFTMPairToken0 === WFTMPartner.address ? expectedSwapAmount : 0,
              WFTMPairToken0 === WFTMPartner.address ? outputAmount : 0,
              WFTMPairToken0 === WFTMPartner.address ? 0 : outputAmount,
              wallet.address
            )
        })

        it('amounts', async () => {
          await expect(
            routerEventEmitter.swapFTMForExactTokens(
              router.address,
              outputAmount,
              [WFTM.address, WFTMPartner.address],
              wallet.address,
              MaxUint256,
              {
                ...overrides,
                value: expectedSwapAmount
              }
            )
          )
            .to.emit(routerEventEmitter, 'Amounts')
            .withArgs([expectedSwapAmount, outputAmount])
        })
      })
    })
  }
})
