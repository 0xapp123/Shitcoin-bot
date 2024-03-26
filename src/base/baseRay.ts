import { web3 } from "@project-serum/anchor";
import { SplAccount, MarketStateLayout, Market as RayMarket, MarketV2, Liquidity, ApiPoolInfo, LIQUIDITY_STATE_LAYOUT_V4, TxVersion, LiquidityPoolJsonInfo, poolKeys2JsonInfo, PoolUtils, ApiInfo, ApiPoolInfoV4, PoolInfoLayout, ApiPoolInfoItem, PublicKeyish, jsonInfo2PoolKeys, LIQUIDITY_STATE_LAYOUT_V5, getMultipleLookupTableInfo, LOOKUP_TABLE_CACHE, LiquidityPoolKeysV4, fetchMultipleMintInfos, RAYDIUM_MAINNET, MAINNET_PROGRAM_ID, MAINNET_FARM_POOLS, Token, TokenAmount, Percent, CurrencyAmount, LiquidityStateLayoutV4, LiquidityStateLayoutV5, LiquidityStateV4, LiquidityStateV5, LiquidityPoolKeys, _SERUM_PROGRAM_ID_V3, SwapSide, LiquidityPoolInfo, AmmConfigLayout, getPdaAmmConfigId, SPL_ACCOUNT_LAYOUT, Fee, currencyEquals, LiquidityAssociatedPoolKeys, ZERO, } from '@raydium-io/raydium-sdk'
import { BaseRayInput } from "./types";
import fs from 'fs';
import { ACCOUNT_SIZE, AccountLayout, MintLayout, NATIVE_MINT, TOKEN_PROGRAM_ID, amountToUiAmount, createAssociatedTokenAccountInstruction, createInitializeAccountInstruction, decodeAmountToUiAmountInstructionUnchecked, getAssociatedTokenAddressSync, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import { BaseSpl } from "./baseSpl";
import { createSyncNativeInstruction } from '@solana/spl-token'
import { EVENT_QUEUE_LENGTH, ORDERBOOK_LENGTH, REQUEST_QUEUE_LENGTH, getVaultOwnerAndNonce } from "./orderbookUtils";
import { DexInstructions, Market, MARKET_STATE_LAYOUT_V2, MARKET_STATE_LAYOUT_V3 } from "@openbook-dex/openbook";
import { _MARKET_STAT_LAYOUT_V1 } from "@openbook-dex/openbook/lib/market";
import { BN } from '@project-serum/anchor'
import useSerumMarketAccountSizes from "./getMarketAccountSizes";
import { Result } from "./types";
import { calcDecimalValue, calcNonDecimalValue, getNullableResutFromPromise, sleep } from "./utils";
import { toBufferBE } from "bigint-buffer";
import { ENV } from "../constants";

// export const RAYDIUM_AMM_PROGRAM = new web3.PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8")
// const _OPEN_BOOK_DEX_PROGRAM = "srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX"
export type CreateMarketInput = {
  baseMint: web3.PublicKey,
  quoteMint: web3.PublicKey
  tickers: {
    lotSize: number,
    tickSize: number
  }
}

export type AddLiquidityInput = {
  user: web3.PublicKey
  poolKeys: LiquidityPoolKeys,
  baseMintAmount: number | BN,
  quoteMintAmount: number | BN,
  fixedSide: 'base' | 'quote'
}
export type RemoveLiquidityInput = {
  user: web3.PublicKey
  poolKeys: LiquidityPoolKeys,
  amount: number,
}
export type BuyFromPoolInput = {
  poolKeys: LiquidityPoolKeys,
  amountIn: TokenAmount
  amountOut: TokenAmount
  user: web3.PublicKey
  fixedSide: SwapSide
  tokenAccountIn: web3.PublicKey,
  tokenAccountOut: web3.PublicKey
}
export type CreatePoolInput = {
  baseMint: web3.PublicKey,
  quoteMint: web3.PublicKey,
  marketId: web3.PublicKey,
  baseMintAmount: number,
  quoteMintAmount: number,
}
export type ComputeBuyAmountInput = {
  poolKeys: LiquidityPoolKeys,
  user: web3.PublicKey
  amount: number,
  inputAmountType: 'send' | 'receive',
  buyToken: 'base' | 'quote',
  /** default (1 %) */
  slippage?: Percent
}

export type ComputeAnotherAmountInput = {
  poolKeys: LiquidityPoolKeysV4,
  amount: number
  /** default( `true` ) */
  isRawAmount?: boolean
  /** default( `Percent(1, 100)` = 1%) */
  slippage?: Percent,
  fixedSide: 'base' | 'quote',
}

const log = console.log
export class BaseRay {
  private connection: web3.Connection
  private baseSpl: BaseSpl
  private cacheIxs: web3.TransactionInstruction[]
  // private pools: LiquidityPoolJsonInfo[];
  private pools: Map<string, LiquidityPoolJsonInfo>;
  private cachedPoolKeys: Map<string, LiquidityPoolKeys>;
  ammProgramId: web3.PublicKey
  private orderBookProgramId: web3.PublicKey
  private feeDestinationId: web3.PublicKey

  constructor(input: BaseRayInput) {
    this.connection = new web3.Connection(input.rpcEndpointUrl, { commitment: "confirmed", confirmTransactionInitialTimeout: 60000 })
    this.baseSpl = new BaseSpl(this.connection)
    this.cacheIxs = []
    this.cachedPoolKeys = new Map();
    this.pools = new Map();
    if (input.rpcEndpointUrl == "https://api.devnet.solana.com") {
      this.ammProgramId = new web3.PublicKey("HWy1jotHpo6UqeQxx49dpYYdQB8wj9Qk9MdxwjLvDHB8")
      this.feeDestinationId = new web3.PublicKey("3XMrhbv989VxAMi3DErLV9eJht1pHppW5LbKxe9fkEFR")
      this.orderBookProgramId = new web3.PublicKey("EoTcMgcDRTJVZDMZWBoU6rhYHZfkNTVEAfz3uUJRcYGj")
    } else {
      this.feeDestinationId = new web3.PublicKey("7YttLkHDoNj9wyDur5pM1ejNaAvT9X4eqaYcHQqtj2G5")
      this.ammProgramId = new web3.PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8")
      this.orderBookProgramId = new web3.PublicKey("srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX")
    }

    // let liquidityJson: any = {};
    // try {
    //   liquidityJson = JSON.parse(fs.readFileSync("./rayRes.json").toString());
    // } catch (error) {
    //   this.fetchPools()
    // }
    // const officialPools = liquidityJson?.official ?? [];
    // const unOfficialPools = liquidityJson?.unOfficial ?? [];
    // for (let pool of officialPools) this.pools.set(pool.id, pool)
    // for (let pool of unOfficialPools) this.pools.set(pool.id, pool)
  }

  async getMarketInfo(marketId: web3.PublicKey) {
    const marketAccountInfo = await this.connection.getAccountInfo(marketId).catch((error) => null)
    if (!marketAccountInfo) throw "Market not found"
    try {
      return RayMarket.getLayouts(3).state.decode(marketAccountInfo.data)
    } catch (parseMeketDataError) {
      // log({ parseMeketDataError })
    }
    return null
  }

  private ixsAdderCallback = (ixs: web3.TransactionInstruction[] = []) => {
    this.cacheIxs.push(...ixs)
  }
  reInit = () => this.cacheIxs = []
  getPoolInfo = (poolId: string) => this.pools.get(poolId)

  async getPoolKeys(poolId: web3.PublicKey): Promise<LiquidityPoolKeys> {
    if (!this.pools) this.pools = new Map();
    if (!this.cachedPoolKeys) this.cachedPoolKeys = new Map();
    const cache2 = this.cachedPoolKeys.get(poolId.toBase58())
    if (cache2) {
      return cache2
    }
    // const cache = this.pools.get(poolId.toBase58())
    // if (cache) {
    //   return jsonInfo2PoolKeys(cache) as LiquidityPoolKeys
    // }

    const accountInfo = await this.connection.getAccountInfo(poolId)
    if (!accountInfo) throw "Pool info not found"
    let poolState: LiquidityStateV4 | LiquidityStateV5 | undefined = undefined
    let version: 4 | 5 | undefined = undefined
    let poolAccountOwner = accountInfo.owner
    if (accountInfo.data.length == LIQUIDITY_STATE_LAYOUT_V4.span) {
      poolState = LIQUIDITY_STATE_LAYOUT_V4.decode(accountInfo.data)
      version = 4
    } else if (accountInfo.data.length == LIQUIDITY_STATE_LAYOUT_V5.span) {
      poolState = LIQUIDITY_STATE_LAYOUT_V5.decode(accountInfo.data)
      version = 5
    } else throw "Invalid Pool data lenght"
    if (!poolState || !version) throw "Invalid pool address"

    let { authority,
      baseDecimals,
      baseMint,
      baseVault,
      configId,
      id,
      lookupTableAccount,
      lpDecimals,
      lpMint,
      lpVault,
      marketAuthority,
      marketId,
      marketProgramId,
      marketVersion,
      nonce,
      openOrders,
      programId,
      quoteDecimals,
      quoteMint,
      quoteVault,
      targetOrders,
      // version,
      withdrawQueue,
    } = Liquidity.getAssociatedPoolKeys({
      baseMint: poolState.baseMint,
      baseDecimals: poolState.baseDecimal.toNumber(),
      quoteMint: poolState.quoteMint,
      quoteDecimals: poolState.quoteDecimal.toNumber(),
      marketId: poolState.marketId,
      marketProgramId: poolState.marketProgramId,
      marketVersion: 3,
      programId: poolAccountOwner,
      version,
    })
    if (lpMint.toBase58() != poolState.lpMint.toBase58()) {
      throw "Found some invalid keys"
    }

    // log({ version, baseMint: baseMint.toBase58(), quoteMint: quoteMint.toBase58(), lpMint: lpMint.toBase58(), marketId: marketId.toBase58(), marketProgramId: marketProgramId.toBase58() })
    let marketState: any = undefined;
    const marketAccountInfo = await this.connection.getAccountInfo(marketId).catch((error) => null)
    if (!marketAccountInfo) throw "Market not found"
    try {
      marketState = RayMarket.getLayouts(marketVersion).state.decode(marketAccountInfo.data)
      // if (mProgramIdStr != _SERUM_PROGRAM_ID_V3 && mProgramIdStr != _OPEN_BOOK_DEX_PROGRAM) {
      // }
    } catch (parseMeketDataError) {
      log({ parseMeketDataError })
    }
    if (!marketState) throw "MarketState not found"
    const { baseVault: marketBaseVault, quoteVault: marketQuoteVault, eventQueue: marketEventQueue, bids: marketBids, asks: marketAsks } = marketState
    const res: LiquidityPoolKeys = {
      baseMint,
      quoteMint,
      quoteDecimals,
      baseDecimals,
      authority,
      baseVault,
      quoteVault,
      id,
      lookupTableAccount,
      lpDecimals,
      lpMint,
      lpVault,
      marketAuthority,
      marketId,
      marketProgramId,
      marketVersion,
      openOrders,
      programId,
      targetOrders,
      version,
      withdrawQueue,
      marketAsks,
      marketBids,
      marketBaseVault,
      marketQuoteVault,
      marketEventQueue,
    }
    this.cachedPoolKeys.set(poolId.toBase58(), res)
    // log({ poolKeys: res })
    return res;
  }

  private addPoolKeys(poolInfo: LiquidityAssociatedPoolKeys, marketState: any) {
    const { authority, baseDecimals, baseMint, baseVault, configId, id, lookupTableAccount, lpDecimals, lpMint, lpVault, marketAuthority, marketId, marketProgramId, marketVersion, nonce, openOrders, programId, quoteDecimals, quoteMint, quoteVault, targetOrders, version, withdrawQueue, } = poolInfo
    const { baseVault: marketBaseVault, quoteVault: marketQuoteVault, eventQueue: marketEventQueue, bids: marketBids, asks: marketAsks } = marketState
    const res: LiquidityPoolKeys = {
      baseMint,
      quoteMint,
      quoteDecimals,
      baseDecimals,
      authority,
      baseVault,
      quoteVault,
      id,
      lookupTableAccount,
      lpDecimals,
      lpMint,
      lpVault,
      marketAuthority,
      marketId,
      marketProgramId,
      marketVersion,
      openOrders,
      programId,
      targetOrders,
      version,
      withdrawQueue,
      marketAsks,
      marketBids,
      marketBaseVault,
      marketQuoteVault,
      marketEventQueue,
    }
    this.cachedPoolKeys.set(id.toBase58(), res)
  }

  // async fetchPools() {
  //   const liquidityJsonStr = await (await fetch("https://api.raydium.io/v2/sdk/token/raydium.mainnet.json")).text();
  //   const liquidityJson = JSON.parse(liquidityJsonStr)
  //   const officialPools = liquidityJson?.official ?? [];
  //   const unOfficialPools = liquidityJson?.unOfficial ?? [];
  //   for (let pool of officialPools) this.pools.set(pool.id, pool)
  //   for (let pool of unOfficialPools) this.pools.set(pool.id, pool)
  //   fs.writeFileSync('./rayRes.json', liquidityJsonStr)
  //   log("Pool fetched")
  // }

  async addLiquidity(input: AddLiquidityInput): Promise<{ ixs: web3.TransactionInstruction[], signers: web3.Signer[] }> {
    this.reInit();
    let { poolKeys, baseMintAmount: baseAmount, quoteMintAmount: quoteAmount, fixedSide } = input
    const user = input.user
    // let poolKeys = await getNullableResutFromPromise(this.getPoolKeys(poolId), { logError: true });
    // if (!poolKeys) throw "pool not found"
    const base = poolKeys.baseMint
    const baseMintDecimals = poolKeys.baseDecimals;
    const quote = poolKeys.quoteMint
    const quoteMintDecimals = poolKeys.quoteDecimals;
    const lpMint = poolKeys.lpMint
    const { ata: lpTokenAccount } = await this.baseSpl.getOrCreateTokenAccount({ mint: lpMint, owner: user, checkCache: true }, this.ixsAdderCallback)
    const { ata: baseTokenAccount } = await this.baseSpl.getOrCreateTokenAccount({ mint: base, owner: user, checkCache: true }, this.ixsAdderCallback)
    const { ata: quoteTokenAccount } = await this.baseSpl.getOrCreateTokenAccount({ mint: quote, owner: user, checkCache: true }, this.ixsAdderCallback)
    let baseAmountIn: string
    let quoteAmountIn: string
    if (typeof baseAmount == 'number' && typeof quoteAmount == 'number') {
      baseAmountIn = calcNonDecimalValue(baseAmount, baseMintDecimals).toString()
      quoteAmountIn = calcNonDecimalValue(quoteAmount, quoteMintDecimals).toString()
    } else {
      baseAmountIn = (baseAmount as BN).toNumber().toString()
      quoteAmountIn = (quoteAmount as BN).toNumber().toString()
    }

    if (base.toBase58() == NATIVE_MINT.toBase58() || quote.toBase58() == NATIVE_MINT.toBase58()) {
      let nativeAmount: string;
      let nativeTokenAccount: web3.PublicKey;
      if (base.toBase58() == NATIVE_MINT.toBase58()) {
        nativeTokenAccount = baseTokenAccount
        nativeAmount = baseAmountIn
      } else {
        nativeTokenAccount = quoteTokenAccount
        nativeAmount = quoteAmountIn
      }
      const sendSolIx = web3.SystemProgram.transfer({
        fromPubkey: user,
        toPubkey: nativeTokenAccount,
        lamports: BigInt(nativeAmount)
      })
      const syncWSolAta = createSyncNativeInstruction(nativeTokenAccount, TOKEN_PROGRAM_ID)
      this.cacheIxs.push(sendSolIx, syncWSolAta)
    }
    const rayIxs = Liquidity.makeAddLiquidityInstruction({
      baseAmountIn,
      quoteAmountIn,
      fixedSide,
      poolKeys,
      userKeys: {
        baseTokenAccount, lpTokenAccount, owner: user,
        quoteTokenAccount
      }
    }).innerTransaction
    const recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash
    const message = new web3.TransactionMessage({
      instructions: [...this.cacheIxs, ...rayIxs.instructions],
      payerKey: user,
      recentBlockhash
    }).compileToV0Message()
    const mainTx = new web3.VersionedTransaction(message)
    if (rayIxs.signers) mainTx.signatures.push(...rayIxs.signers)
    return {
      ixs: [...this.cacheIxs, ...rayIxs.instructions],
      signers: [...rayIxs.signers]
    }
  }

  async removeLiquidity(input: RemoveLiquidityInput): Promise<Result<{ ixs: web3.TransactionInstruction[] }, string>> {
    const { user, poolKeys } = input
    const { baseMint, quoteMint, lpMint, lpDecimals } = poolKeys
    const baseTokenAccount = (await this.baseSpl.getOrCreateTokenAccount({ mint: baseMint, owner: user, checkCache: true }, this.ixsAdderCallback)).ata
    const quoteTokenAccount = (await this.baseSpl.getOrCreateTokenAccount({ mint: quoteMint, owner: user, checkCache: true }, this.ixsAdderCallback)).ata
    const lpTokenAccount = (await this.baseSpl.getOrCreateTokenAccount({ mint: lpMint, owner: user, checkCache: true }, this.ixsAdderCallback)).ata

    const lpTokenAccountInfo = await this.connection.getAccountInfo(lpTokenAccount);
    if (!lpTokenAccountInfo) return { Err: "No lp token found" }
    const totalLp = Number(AccountLayout.decode(lpTokenAccountInfo.data).amount.toString())
    const totalLpD = calcDecimalValue(totalLp, lpDecimals);
    log("lp token: ", lpMint.toBase58())
    log("user lp token ata: ", lpTokenAccount.toBase58())
    log("Total available lp tokens : ", totalLpD)
    let amount = calcNonDecimalValue(input.amount, lpDecimals).toString()
    if (Number(amount) > totalLp) {
      return { Err: "not have enought lp tokens" }
    }
    if (input.amount == -1) amount = totalLp.toString()
    const ixs = Liquidity.makeRemoveLiquidityInstruction({
      amountIn: amount, poolKeys, userKeys: {
        baseTokenAccount, lpTokenAccount, owner: user, quoteTokenAccount
      }
    }).innerTransaction.instructions
    return {
      Ok: {
        ixs: [...this.cacheIxs, ...ixs]
      }
    }
  }

  async removeLiquidityFaster(input: RemoveLiquidityInput): Promise<Result<{ ixs: web3.TransactionInstruction[] }, string>> {
    const { user, poolKeys } = input
    const { baseMint, quoteMint, lpMint, lpDecimals } = poolKeys
    const baseTokenAccount = getAssociatedTokenAddressSync(baseMint, user)
    const quoteTokenAccount = getAssociatedTokenAddressSync(quoteMint, user)
    const lpTokenAccount = getAssociatedTokenAddressSync(lpMint, user)
    let amount = input.amount
    const ixs = Liquidity.makeRemoveLiquidityInstruction({
      amountIn: amount.toString(), poolKeys, userKeys: {
        baseTokenAccount, lpTokenAccount, owner: user, quoteTokenAccount
      }
    }).innerTransaction.instructions
    return {
      Ok: {
        ixs: [...ixs]
      }
    }
  }

  async buyFromPool(input: BuyFromPoolInput): Promise<{ ixs: web3.TransactionInstruction[], signers: web3.Signer[] }> {
    this.reInit();
    const { amountIn, amountOut, poolKeys, user, fixedSide, tokenAccountIn, tokenAccountOut } = input
    const { baseMint, quoteMint } = poolKeys
    const { ata: baseTokenAccount } = await this.baseSpl.getOrCreateTokenAccount({ mint: baseMint, owner: user, checkCache: true }, this.ixsAdderCallback)
    const { ata: quoteTokenAccount } = await this.baseSpl.getOrCreateTokenAccount({ mint: quoteMint, owner: user, checkCache: true }, this.ixsAdderCallback)
    const inToken = (amountIn as TokenAmount).token.mint;
    if (inToken.toBase58() == NATIVE_MINT.toBase58()) {
      let lamports = BigInt(amountIn.raw.toNumber())
      const sendSolIx = web3.SystemProgram.transfer({
        fromPubkey: user,
        toPubkey: tokenAccountIn,
        lamports
      })
      const syncWSolAta = createSyncNativeInstruction(tokenAccountIn, TOKEN_PROGRAM_ID)
      this.cacheIxs.push(sendSolIx, syncWSolAta)
    }
    let rayIxs = Liquidity.makeSwapInstruction({
      poolKeys,
      amountIn: amountIn.raw,
      amountOut: amountOut.raw,
      fixedSide,
      userKeys: { owner: user, tokenAccountIn, tokenAccountOut },
    }).innerTransaction

    const recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash
    const message = new web3.TransactionMessage({
      instructions: [...this.cacheIxs, ...rayIxs.instructions],
      payerKey: user,
      recentBlockhash
    }).compileToV0Message()
    const mainTx = new web3.VersionedTransaction(message)
    if (rayIxs.signers) mainTx.signatures.push(...rayIxs.signers)
    return {
      ixs: [...this.cacheIxs, ...rayIxs.instructions],
      signers: [...rayIxs.signers]
    }
  }

  async createPool(input: CreatePoolInput, user: web3.PublicKey) {
    this.reInit();
    const userBaseAta = getAssociatedTokenAddressSync(input.baseMint, user)
    const userQuoteAta = getAssociatedTokenAddressSync(input.quoteMint, user)

    let [baseMintAccountInfo, quoteMintAccountInfo, marketAccountInfo, userBaseAtaInfo, userQuoteAtaInfo] = await this.connection.getMultipleAccountsInfo([input.baseMint, input.quoteMint, input.marketId, userBaseAta, userQuoteAta]).catch(() => [null, null, null, null])
    if (!baseMintAccountInfo || !quoteMintAccountInfo || !marketAccountInfo) throw "AccountInfo not found"
    if (input.baseMint.toBase58() != NATIVE_MINT.toBase58() && !userBaseAtaInfo) throw "Don't have enought tokens"
    else {
      if (input.baseMint.toBase58() == NATIVE_MINT.toBase58()) {
        const todo = web3.PublicKey.default
        const buf = Buffer.alloc(SPL_ACCOUNT_LAYOUT.span)
        SPL_ACCOUNT_LAYOUT.encode({
          mint: NATIVE_MINT,
          amount: new BN(0),
          isNative: new BN(1),
          owner: user,
          closeAuthority: todo,
          closeAuthorityOption: 1,
          delegate: todo,
          delegatedAmount: new BN(1),
          delegateOption: 1,
          isNativeOption: 1,
          state: 1
        }, buf)
        userBaseAtaInfo = {
          data: buf,
        } as any
      }
    }
    if (input.quoteMint.toBase58() != NATIVE_MINT.toBase58() && !userQuoteAtaInfo) throw "Don't have enought tokens"
    else {
      if (input.quoteMint.toBase58() == NATIVE_MINT.toBase58()) {
        const todo = web3.PublicKey.default
        const buf = Buffer.alloc(SPL_ACCOUNT_LAYOUT.span)
        SPL_ACCOUNT_LAYOUT.encode({
          mint: NATIVE_MINT,
          amount: new BN(0),
          isNative: new BN(1),
          owner: user,
          closeAuthority: todo,
          closeAuthorityOption: 1,
          delegate: todo,
          delegatedAmount: new BN(1),
          delegateOption: 1,
          isNativeOption: 1,
          state: 1
        }, buf)
        userQuoteAtaInfo = {
          data: buf,
        } as any
      }
    }
    const baseMintState = MintLayout.decode(baseMintAccountInfo.data);
    const quoteMintState = MintLayout.decode(quoteMintAccountInfo.data);
    // const marketState = RayMarket.getLayouts(3).state.decode(marketAccountInfo.data)
    const marketInfo = {
      marketId: input.marketId,
      programId: marketAccountInfo.owner
    }
    const baseMintInfo = {
      mint: input.baseMint,
      decimals: baseMintState.decimals
    }
    const quoteMintInfo = {
      mint: input.quoteMint,
      decimals: quoteMintState.decimals
    }
    const baseAmount = new BN(toBufferBE(BigInt(calcNonDecimalValue(input.baseMintAmount, baseMintState.decimals).toString()), 8))
    const quoteAmount = new BN(toBufferBE(BigInt(calcNonDecimalValue(input.quoteMintAmount, quoteMintState.decimals).toString()), 8))
    // const quoteAmount = new BN(calcNonDecimalValue(input.quoteMintAmount, quoteMintState.decimals))

    const poolInfo = Liquidity.getAssociatedPoolKeys({
      version: 4,
      marketVersion: 3,
      marketId: marketInfo.marketId,
      baseMint: baseMintInfo.mint,
      quoteMint: quoteMintInfo.mint,
      baseDecimals: baseMintInfo.decimals,
      quoteDecimals: quoteMintInfo.decimals,
      programId: this.ammProgramId,
      marketProgramId: marketInfo.programId,
    })
    const marketState = RayMarket.getLayouts(3).state.decode(marketAccountInfo.data)
    this.addPoolKeys(poolInfo, marketState);

    const startTime = new BN(Math.trunc(Date.now() / 1000) - 4)
    // const createPoolIxs = Liquidity.makeCreatePoolV4InstructionV2({
    //   programId: this.ammProgramId,
    //   ammId: poolInfo.id,
    //   ammAuthority: poolInfo.authority,
    //   ammOpenOrders: poolInfo.openOrders,
    //   lpMint: poolInfo.lpMint,
    //   coinMint: poolInfo.baseMint,
    //   pcMint: poolInfo.quoteMint,
    //   coinVault: poolInfo.baseVault,
    //   pcVault: poolInfo.quoteVault,
    //   ammTargetOrders: poolInfo.targetOrders,
    //   marketProgramId: poolInfo.marketProgramId,
    //   marketId: poolInfo.marketId,
    //   userWallet: user,
    //   userCoinVault: userBaseAta,
    //   userPcVault: userQuoteAta,
    //   userLpVault: getAssociatedTokenAddressSync(poolInfo.lpMint, user),
    //   ammConfigId: poolInfo.configId,
    //   feeDestinationId,
    //   nonce: poolInfo.nonce,
    //   openTime: startTime,
    //   coinAmount: baseAmount,
    //   pcAmount: quoteAmount,
    // }).innerTransaction

    const createPoolIxs = (await Liquidity.makeCreatePoolV4InstructionV2Simple({
      marketInfo,
      baseMintInfo,
      quoteMintInfo,
      baseAmount,
      quoteAmount,
      associatedOnly: true,
      checkCreateATAOwner: true,
      connection: this.connection,
      feeDestinationId: this.feeDestinationId,
      makeTxVersion: TxVersion.LEGACY,
      ownerInfo: {
        feePayer: user,
        tokenAccounts: [
          { accountInfo: SPL_ACCOUNT_LAYOUT.decode(userBaseAtaInfo!.data), programId: TOKEN_PROGRAM_ID, pubkey: userBaseAta },
          { accountInfo: SPL_ACCOUNT_LAYOUT.decode(userQuoteAtaInfo!.data), programId: TOKEN_PROGRAM_ID, pubkey: userQuoteAta }
        ],
        wallet: user,
        useSOLBalance: true
      },
      programId: this.ammProgramId,
      startTime
      // computeBudgetConfig: { microLamports: 250_000, units: 8000_000 },
    })).innerTransactions

    const ixs: web3.TransactionInstruction[] = []
    const signers: web3.Signer[] = []
    // ixs.push(...createPoolIxs.instructions)
    // signers.push(...createPoolIxs.signers)
    for (let ix of createPoolIxs) {
      ixs.push(...ix.instructions)
      signers.push(...ix.signers)
    }
    return { ixs, signers, poolId: Liquidity.getAssociatedId({ marketId: marketInfo.marketId, programId: this.ammProgramId }), baseAmount, quoteAmount, baseDecimals: poolInfo.baseDecimals, quoteDecimals: poolInfo.quoteDecimals }
  }

  async createMarket(input: CreateMarketInput, user: web3.PublicKey)
    : Promise<Result<{
      marketId: web3.PublicKey,
      vaultInstructions: web3.TransactionInstruction[];
      vaultSigners: web3.Signer[];
      marketInstructions: web3.TransactionInstruction[];
      marketSigners: web3.Signer[];
    }, string>> {
    const { Keypair, SystemProgram } = web3;
    const { baseMint, quoteMint } = input;
    const marketAccounts = {
      market: Keypair.generate(),
      requestQueue: Keypair.generate(),
      eventQueue: Keypair.generate(),
      bids: Keypair.generate(),
      asks: Keypair.generate(),
      baseVault: Keypair.generate(),
      quoteVault: Keypair.generate(),
    };
    const programID = this.orderBookProgramId
    const vaultInstructions: web3.TransactionInstruction[] = []
    const vaultSigners: web3.Signer[] = []
    const [vaultOwner, vaultOwnerNonce] = await getVaultOwnerAndNonce(
      marketAccounts.market.publicKey,
      programID
    );

    vaultInstructions.push(
      ...[
        SystemProgram.createAccount({
          fromPubkey: user,
          newAccountPubkey: marketAccounts.baseVault.publicKey,
          lamports: await this.connection.getMinimumBalanceForRentExemption(
            ACCOUNT_SIZE
          ),
          space: ACCOUNT_SIZE,
          programId: TOKEN_PROGRAM_ID,
        }),
        SystemProgram.createAccount({
          fromPubkey: user,
          newAccountPubkey: marketAccounts.quoteVault.publicKey,
          lamports: await this.connection.getMinimumBalanceForRentExemption(
            ACCOUNT_SIZE
          ),
          space: ACCOUNT_SIZE,
          programId: TOKEN_PROGRAM_ID,
        }),
        createInitializeAccountInstruction(
          marketAccounts.baseVault.publicKey,
          baseMint,
          vaultOwner
        ),
        createInitializeAccountInstruction(
          marketAccounts.quoteVault.publicKey,
          quoteMint,
          vaultOwner
        ),
      ]
    );
    vaultSigners.push(marketAccounts.baseVault, marketAccounts.quoteVault);
    const [baseMintAccountInfo, quoteMintAccountInfo] = await this.connection.getMultipleAccountsInfo([baseMint, quoteMint])
    let baseMintDecimals: number;
    let quoteMintDecimals: number;
    if (!baseMintAccountInfo || !quoteMintAccountInfo) return { Err: "Invalid token address! Token not found" }
    try {
      baseMintDecimals = MintLayout.decode(baseMintAccountInfo.data).decimals
      quoteMintDecimals = MintLayout.decode(quoteMintAccountInfo.data).decimals
    } catch (error) {
      return { Err: "Invalid token address! Token not found" }
    }
    let tickers = input.tickers
    const baseLotSize = new BN(Math.round(10 ** baseMintDecimals * tickers.lotSize))
    const quoteLotSize = new BN(Math.round(tickers.lotSize * 10 ** quoteMintDecimals * tickers.tickSize))
    if (baseLotSize.eq(ZERO)) return { Err: 'lot size is too small' }
    if (quoteLotSize.eq(ZERO)) return { Err: 'tick size or lot size is too small' }
    // log({ baseLotSize: baseLotSize.toNumber() })
    // log({ quoteLotSize: quoteLotSize.toNumber() })

    // create market account
    const marketInstructions: web3.TransactionInstruction[] = []
    const marketSigners: web3.Signer[] = [marketAccounts.market, marketAccounts.bids, marketAccounts.asks, marketAccounts.eventQueue, marketAccounts.requestQueue]
    marketInstructions.push(
      SystemProgram.createAccount({
        newAccountPubkey: marketAccounts.market.publicKey,
        fromPubkey: user,
        space: Market.getLayout(programID).span,
        lamports: await this.connection.getMinimumBalanceForRentExemption(
          Market.getLayout(programID).span
        ),
        programId: programID,
      })
    );
    const {
      totalEventQueueSize,
      totalOrderbookSize,
      totalRequestQueueSize,
    } = useSerumMarketAccountSizes({
      eventQueueLength: EVENT_QUEUE_LENGTH,
      requestQueueLength: REQUEST_QUEUE_LENGTH,
      orderbookLength: ORDERBOOK_LENGTH,
    }, this.connection, programID);
    // create request queue
    marketInstructions.push(
      SystemProgram.createAccount({
        newAccountPubkey: marketAccounts.requestQueue.publicKey,
        fromPubkey: user,
        space: totalRequestQueueSize,
        lamports: await this.connection.getMinimumBalanceForRentExemption(
          totalRequestQueueSize
        ),
        programId: programID,
      })
    );
    // create event queue
    marketInstructions.push(
      SystemProgram.createAccount({
        newAccountPubkey: marketAccounts.eventQueue.publicKey,
        fromPubkey: user,
        space: totalEventQueueSize,
        lamports: await this.connection.getMinimumBalanceForRentExemption(
          totalEventQueueSize
        ),
        programId: programID,
      })
    );

    const orderBookRentExempt =
      await this.connection.getMinimumBalanceForRentExemption(totalOrderbookSize);
    // create bids
    marketInstructions.push(
      SystemProgram.createAccount({
        newAccountPubkey: marketAccounts.bids.publicKey,
        fromPubkey: user,
        space: totalOrderbookSize,
        lamports: orderBookRentExempt,
        programId: programID,
      })
    );
    // create asks
    marketInstructions.push(
      SystemProgram.createAccount({
        newAccountPubkey: marketAccounts.asks.publicKey,
        fromPubkey: user,
        space: totalOrderbookSize,
        lamports: orderBookRentExempt,
        programId: programID,
      })
    );
    marketInstructions.push(
      DexInstructions.initializeMarket({
        market: marketAccounts.market.publicKey,
        requestQueue: marketAccounts.requestQueue.publicKey,
        eventQueue: marketAccounts.eventQueue.publicKey,
        bids: marketAccounts.bids.publicKey,
        asks: marketAccounts.asks.publicKey,
        baseVault: marketAccounts.baseVault.publicKey,
        quoteVault: marketAccounts.quoteVault.publicKey,
        baseMint,
        quoteMint,
        baseLotSize,
        quoteLotSize,
        feeRateBps: 150, // Unused in v3
        quoteDustThreshold: new BN(500), // Unused in v3
        vaultSignerNonce: vaultOwnerNonce,
        programId: programID,
      })
    );

    return {
      Ok: {
        marketId: marketAccounts.market.publicKey,
        vaultInstructions,
        vaultSigners,
        marketInstructions,
        marketSigners
      }
    }
  }

  async computeBuyAmount(input: ComputeBuyAmountInput, etc?: { extraBaseResever?: number, extraQuoteReserve?: number, extraLpSupply?: number }) {
    const { amount, buyToken, inputAmountType, poolKeys, user } = input;
    const slippage = input.slippage ?? new Percent(1, 100)
    const base = poolKeys.baseMint
    const baseMintDecimals = poolKeys.baseDecimals;
    const quote = poolKeys.quoteMint
    const quoteMintDecimals = poolKeys.quoteDecimals;
    const baseTokenAccount = getAssociatedTokenAddressSync(base, user)
    const quoteTokenAccount = getAssociatedTokenAddressSync(quote, user)
    const baseR = new Token(TOKEN_PROGRAM_ID, base, baseMintDecimals);
    const quoteR = new Token(TOKEN_PROGRAM_ID, quote, quoteMintDecimals);
    let amountIn: TokenAmount
    let amountOut: TokenAmount
    let tokenAccountIn: web3.PublicKey
    let tokenAccountOut: web3.PublicKey
    const [lpAccountInfo, baseVAccountInfo, quoteVAccountInfo] = await this.connection.getMultipleAccountsInfo([poolKeys.lpMint, poolKeys.baseVault, poolKeys.quoteVault].map((e) => new web3.PublicKey(e))).catch(() => [null, null, null, null])
    if (!lpAccountInfo || !baseVAccountInfo || !quoteVAccountInfo) throw "Failed to fetch some data"
    // const lpSupply = new BN(Number(MintLayout.decode(lpAccountInfo.data).supply.toString()))
    // const baseReserve = new BN(Number(AccountLayout.decode(baseVAccountInfo.data).amount.toString()))
    // const quoteReserve = new BN(Number(AccountLayout.decode(quoteVAccountInfo.data).amount.toString()))

    const lpSupply = new BN(toBufferBE(MintLayout.decode(lpAccountInfo.data).supply, 8)).addn(etc?.extraLpSupply ?? 0)
    const baseReserve = new BN(toBufferBE(AccountLayout.decode(baseVAccountInfo.data).amount, 8)).addn(etc?.extraBaseResever ?? 0)
    const quoteReserve = new BN(toBufferBE(AccountLayout.decode(quoteVAccountInfo.data).amount, 8)).addn(etc?.extraQuoteReserve ?? 0)
    let fixedSide: SwapSide;

    const poolInfo: LiquidityPoolInfo = {
      baseDecimals: poolKeys.baseDecimals,
      quoteDecimals: poolKeys.quoteDecimals,
      lpDecimals: poolKeys.lpDecimals,
      lpSupply,
      baseReserve,
      quoteReserve,
      startTime: null as any,
      status: null as any
    }

    if (inputAmountType == 'send') {
      fixedSide = 'in'
      if (buyToken == 'base') {
        amountIn = new TokenAmount(quoteR, amount.toString(), false)
        // amountOut = Liquidity.computeAmountOut({ amountIn, currencyOut: baseR, poolInfo, poolKeys, slippage }).amountOut
        amountOut = Liquidity.computeAmountOut({ amountIn, currencyOut: baseR, poolInfo, poolKeys, slippage }).minAmountOut as TokenAmount
      } else {
        amountIn = new TokenAmount(baseR, amount.toString(), false)
        // amountOut = Liquidity.computeAmountOut({ amountIn, currencyOut: quoteR, poolInfo, poolKeys, slippage }).amountOut
        amountOut = Liquidity.computeAmountOut({ amountIn, currencyOut: quoteR, poolInfo, poolKeys, slippage }).minAmountOut as TokenAmount
      }
    } else {
      fixedSide = 'out'
      if (buyToken == 'base') {
        amountOut = new TokenAmount(baseR, amount.toString(), false)
        // amountIn = Liquidity.computeAmountIn({ amountOut, currencyIn: quoteR, poolInfo, poolKeys, slippage }).amountIn
        amountIn = Liquidity.computeAmountIn({ amountOut, currencyIn: quoteR, poolInfo, poolKeys, slippage }).maxAmountIn as TokenAmount
      } else {
        amountOut = new TokenAmount(quoteR, amount.toString(), false)
        // amountIn = Liquidity.computeAmountIn({ amountOut, currencyIn: baseR, poolInfo, poolKeys, slippage }).amountIn
        amountIn = Liquidity.computeAmountIn({ amountOut, currencyIn: baseR, poolInfo, poolKeys, slippage }).maxAmountIn as TokenAmount
      }
    }
    if (buyToken == 'base') {
      tokenAccountOut = baseTokenAccount
      tokenAccountIn = quoteTokenAccount
    } else {
      tokenAccountOut = quoteTokenAccount
      tokenAccountIn = baseTokenAccount
    }

    return {
      amountIn,
      amountOut,
      tokenAccountIn,
      tokenAccountOut,
      fixedSide
    }
  }

  async computeAnotherAmount({ amount, fixedSide, poolKeys, isRawAmount, slippage }: ComputeAnotherAmountInput) {
    isRawAmount = isRawAmount ?? true
    slippage = slippage ?? new Percent(1, 100)
    const { baseMint, baseVault, quoteMint, quoteVault, baseDecimals, quoteDecimals, lpDecimals, lpMint } = poolKeys;

    const anotherToken = fixedSide == 'base' ? poolKeys.quoteMint : poolKeys.baseMint
    // if (anotherToken.toBase58() != baseMint.toBase58() && anotherToken.toBase58() != quoteMint.toBase58()) throw "Invalid another token"

    //TODO: create another function (refactor)
    const [poolAccountInfo, baseVAccountInfo, quoteVAccountInfo, lpMintAInfo] = await this.connection.getMultipleAccountsInfo([poolKeys.id, baseVault, quoteVault, lpMint]).catch(() => [null, null, null, null, null]);
    if (!poolAccountInfo
      || !baseVAccountInfo
      || !quoteVAccountInfo
      || !lpMintAInfo
    ) throw "Failed to fetch somedata"
    let poolState: LiquidityStateV4 | LiquidityStateV5 | undefined = undefined
    if (poolAccountInfo.data.length == LIQUIDITY_STATE_LAYOUT_V4.span) {
      poolState = LIQUIDITY_STATE_LAYOUT_V4.decode(poolAccountInfo.data)
    } else if (poolAccountInfo.data.length == LIQUIDITY_STATE_LAYOUT_V5.span) {
      poolState = LIQUIDITY_STATE_LAYOUT_V5.decode(poolAccountInfo.data)
    } else throw "Invalid Pool data lenght"
    if (!poolState) throw "Invalid pool address"
    const lpSupply = new BN(Number(MintLayout.decode(lpMintAInfo.data).supply.toString()))
    const baseReserve = new BN(Number(AccountLayout.decode(baseVAccountInfo.data).amount.toString()))
    const quoteReserve = new BN(Number(AccountLayout.decode(quoteVAccountInfo.data).amount.toString()))

    let current: Token;
    let currentTokenAmount: TokenAmount
    let another: Token;
    // let anotherTokenAmount: TokenAmount
    if (anotherToken.toBase58() == quoteMint.toBase58()) {
      current = new Token(TOKEN_PROGRAM_ID, baseMint, baseDecimals)
      another = new Token(TOKEN_PROGRAM_ID, quoteMint, quoteDecimals);
      currentTokenAmount = new TokenAmount(current, amount.toString(), isRawAmount)
    } else {
      current = new Token(TOKEN_PROGRAM_ID, quoteMint, quoteDecimals);
      another = new Token(TOKEN_PROGRAM_ID, baseMint, baseDecimals)
      currentTokenAmount = new TokenAmount(current, amount.toString(), isRawAmount)
    }

    const { status, poolOpenTime } = poolState
    const poolInfo: LiquidityPoolInfo = {
      baseDecimals,
      quoteDecimals,
      baseReserve,
      lpDecimals,
      lpSupply,
      quoteReserve,
      startTime: poolOpenTime,
      status
    }
    const res = Liquidity.computeAnotherAmount({ poolKeys, slippage, amount: currentTokenAmount, anotherCurrency: another, poolInfo })

    if (current.mint.toBase58() == baseMint.toBase58()) {
      return {
        baseMintAmount: currentTokenAmount.raw,
        quoteMintAmount: res.maxAnotherAmount.raw,
        liquidity: res.liquidity
      }
    } else {
      return {
        baseMintAmount: res.maxAnotherAmount.raw,
        quoteMintAmount: currentTokenAmount.raw,
        liquidity: res.liquidity
      }
    }
  }
}
