import { AnchorProvider, BN, Wallet, web3 } from "@project-serum/anchor";
import { utf8 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import { BaseSpl } from "./baseSpl";
import { calcNonDecimalValue, deployJsonData, getKeypairFromEnv, sendAndConfirmTransaction, sleep } from "../utils";
import { ENV, RPC_ENDPOINT_DEV, RPC_ENDPOINT_MAIN } from "../constants";

import { TokenMetadataAuthorizationDetails, getAccountParsingAndAssertingFunction, Sft } from '@metaplex-foundation/js/dist/types';
import {
  PROGRAM_ID as MPL_ID,
  Metadata,
  TokenStandard,
  createUpdateMetadataAccountV2Instruction,
  createUpdateInstruction
} from "@metaplex-foundation/mpl-token-metadata";

import {
  CreateNftBuilderParams,
  Metaplex
} from "@metaplex-foundation/js";
import { MintLayout, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { MPLTokenInfo } from "./types";

const log = console.log;


type MPLTransferInput = {
  mint: web3.PublicKey | string,
  sender: web3.PublicKey | string,
  receiver: web3.PublicKey | string,
  /** default it take a single one token easy for NFT, SFT */
  amount?: number
  /** default (`true`)*/
  init_ata_if_needed?: boolean
  tokenStandard: TokenStandard
  /** default (`false`)*/
  isPNFT?: boolean
}

type BurnInput = {
  mint: web3.PublicKey | string,
  owner: web3.PublicKey | string,
  /** default it burn a single one token easy for NFT, SFT */
  amount?: number
  /** default(`get from the onchain data`) */
  decimal?: number
}

export class BaseMpl {
  connection: web3.Connection;
  mplIxs: web3.TransactionInstruction[] = [];
  mplSigns: web3.Keypair[] = [];
  metaplex: Metaplex;
  provider: AnchorProvider
  baseSpl: BaseSpl

  constructor(wallet: Wallet, web3Config: { endpoint: string }) {
    this.connection = new web3.Connection(web3Config.endpoint, { commitment: 'confirmed' });
    this.metaplex = new Metaplex(this.connection);
    this.provider = new AnchorProvider(this.connection, wallet, { commitment: 'confirmed' });
    this.baseSpl = new BaseSpl(this.connection)

    if (this.metaplex.identity().publicKey.toBase58() != wallet.publicKey.toBase58()) {
      this.metaplex.identity().setDriver({
        publicKey: wallet.publicKey,
        signMessage: null as any, //TODO: Need to improve it
        signTransaction: wallet.signTransaction,
        signAllTransactions: wallet.signAllTransactions,
      });
    }
  }

  setUpCallBack = (
    ixs: web3.TransactionInstruction[],
    signs: web3.Keypair[]
  ) => {
    if (ixs) {
      this.mplIxs.push(...ixs);
      log("ixs added to mpl : ", ixs);
    }
    if (signs) {
      log("sings added to mpl : ", signs);
      this.mplSigns.push(...signs);
    }
  };

  reinit(wallet: Wallet): void {
    const user = wallet.publicKey
    if (this.metaplex.identity().publicKey.toBase58() != user.toBase58()) {
      this.metaplex.identity().setDriver({
        publicKey: user,
        signMessage: (wallet as any).signMessage,
        signTransaction: wallet.signTransaction,
        signAllTransactions: wallet.signAllTransactions,
      });
    }
    this.mplIxs = [];
    this.mplSigns = []
    this.provider = new AnchorProvider(this.connection, wallet, { commitment: 'confirmed' });
  }

  static getEditionAccount(tokenId: web3.PublicKey) {
    return web3.PublicKey.findProgramAddressSync(
      [
        utf8.encode("metadata"),
        MPL_ID.toBuffer(),
        tokenId.toBuffer(),
        utf8.encode("edition"),
      ],
      MPL_ID
    )[0];
  }

  static getMetadataAccount(tokenId: web3.PublicKey) {
    return web3.PublicKey.findProgramAddressSync(
      [utf8.encode("metadata"), MPL_ID.toBuffer(), tokenId.toBuffer()],
      MPL_ID
    )[0];
  }

  static getCollectionAuthorityRecordAccount(collection: web3.PublicKey, authority: web3.PublicKey): web3.PublicKey {
    return web3.PublicKey.findProgramAddressSync(
      [
        utf8.encode("metadata"),
        MPL_ID.toBuffer(),
        collection.toBuffer(),
        utf8.encode("collection_authority"),
        authority.toBuffer()
      ],
      MPL_ID
    )[0];
  }

  async createToken(input: CreateNftBuilderParams, opts: { decimal?: number, mintAmount?: number, mintKeypair?: web3.Keypair, revokeAuthorities?: boolean }) {
    const ixs = [];
    const user = this?.provider?.publicKey;
    const baseSpl = new BaseSpl(this.connection);
    let { decimal, mintAmount, mintKeypair } = opts;
    decimal = decimal ?? 0;
    try {
      mintKeypair = mintKeypair ?? web3.Keypair.generate();
      let { ixs: mintIxs, mintKeypair: _mintKeypair } = await baseSpl.createToken({ decimal, mintAuthority: user, mintingInfo: { tokenAmount: mintAmount }, mintKeypair })
      ixs.push(...mintIxs)
      input.useNewMint = mintKeypair;
      input.mintTokens = false;
      const mint = mintKeypair.publicKey;
      const txBuilder = await this.metaplex.nfts().builders().create(input);
      const setMetadataIxs = txBuilder.getInstructions();
      ixs.push(...setMetadataIxs)

      // speedup
      const updateCuIx = web3.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: ENV.COMPUTE_UNIT_PRICE })
      const recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
      if (opts.revokeAuthorities) {
        ixs.push(this.baseSpl.revokeAuthority({ authorityType: 'MINTING', currentAuthority: this.provider.publicKey, mint }))
        ixs.push(this.baseSpl.revokeAuthority({ authorityType: 'FREEZING', currentAuthority: this.provider.publicKey, mint }))
      }
      const tx = new web3.Transaction().add(updateCuIx, ...ixs);
      tx.feePayer = user;
      tx.recentBlockhash = recentBlockhash
      tx.sign(getKeypairFromEnv())
      tx.sign(mintKeypair)

      const res = await this.provider.sendAndConfirm(tx, [mintKeypair], { maxRetries: 20 }).catch(async () => {
        await sleep(2_000)
        return this.provider.sendAndConfirm(tx, [mintKeypair!], { maxRetries: 20 }).catch((createTokenSendAndConfirmError) => {
          log({ createTokenSendAndConfirmError })
          return null
        })
      });
      // const res = await sendAndConfirmTransaction(tx, this.connection).catch((sendAndConfirmTransactionError) => {
      //   log({ sendAndConfirmTransactionError })
      //   return null
      // })
      if (!res) throw "Tx failed"
      return {
        txSignature: res,
        token: mintKeypair.publicKey.toBase58()
      }
    } catch (error) {
      log({ mplTokenCreateError: error })
      return null
    }
  }

  async transfer(input: MPLTransferInput) {
    let {
      mint,
      receiver,
      sender,
      amount,
      tokenStandard,
      isPNFT
    } = input;
    if (typeof mint == 'string') mint = new web3.PublicKey(mint)
    if (typeof sender == 'string') sender = new web3.PublicKey(sender)
    if (typeof receiver == 'string') receiver = new web3.PublicKey(receiver)
    amount = amount ?? 1;
    isPNFT = isPNFT ?? false
    let authorizationDetails: TokenMetadataAuthorizationDetails | undefined;
    if (isPNFT) {
      const tokenInfo = await this.getTokenInfo(mint)
      const rules = tokenInfo.metadata?.programmableConfig?.ruleSet
      if (rules) authorizationDetails = { rules }
    }
    try {
      const ixs = this.metaplex.nfts().builders().transfer({
        nftOrSft: { address: mint, tokenStandard },
        toOwner: receiver,
        amount: { basisPoints: new BN(amount) as any, currency: { decimals: 0, namespace: "spl-token", symbol: "" } },//TODO:
        // amount: null as any,
        fromOwner: sender,
        authorizationDetails
      }).getInstructions()
      const tx = new web3.Transaction().add(...ixs)
      const sign = await this.provider.sendAndConfirm(tx)
      return sign
    } catch (error) {
      log({ mplTransferError: error })
    }
  }

  async burn(input: BurnInput) {
    let {
      mint,
      owner,
      amount,
      decimal
    } = input
    if (typeof mint == 'string') mint = new web3.PublicKey(mint)
    if (typeof owner == 'string') owner = new web3.PublicKey(owner)
    if (!amount) {
      amount = 1
      decimal = 0;
    } else {
      if (!decimal)
        decimal = (await this.baseSpl.getMint(mint)).decimals
      amount = amount * (10 ** decimal)
    }

    const ixs = this.metaplex.nfts().builders().delete({
      mintAddress: mint,
      amount: { basisPoints: new BN(amount) as any, currency: { decimals: decimal, namespace: "spl-token", symbol: "" } }//TODO:
      // amount: token(amount)
    }).getInstructions()
    const tx = new web3.Transaction().add(...ixs)
    const sign = await this.provider.sendAndConfirm(tx)
    return sign
  }

  async getTokenInfo(mint: web3.PublicKey | string): Promise<MPLTokenInfo> {
    if (typeof mint == 'string') mint = new web3.PublicKey(mint)
    const metadataAccount = BaseMpl.getMetadataAccount(mint)
    const accountInfoes = await this.connection.getMultipleAccountsInfo([mint, metadataAccount])
    if (!accountInfoes[0]) throw "Token not found"
    let tokenInfo = MintLayout.decode(accountInfoes[0].data)
    if (!tokenInfo.isInitialized) throw "Token dosen't initialise"

    let metadata: Metadata | null = null
    if (accountInfoes[1]) metadata = Metadata.deserialize(accountInfoes[1].data)[0]
    return {
      address: mint,
      mintInfo: tokenInfo,
      metadata
    }
  }

  async getAndCheckTokenName(mint: web3.PublicKey, defaultName = ' ') {
    try {
      const metadataAccount = BaseMpl.getMetadataAccount(mint)
      const [mintAccountInfo, metadataAccountInfo] = await this.connection.getMultipleAccountsInfo([mint, metadataAccount]).catch(error => [null, null]);
      if (!mintAccountInfo
        || mintAccountInfo.owner.toBase58() != TOKEN_PROGRAM_ID.toBase58()
        || mintAccountInfo.data.length != MintLayout.span
      ) return null
      let name = mint.toBase58()
      if (metadataAccountInfo) {
        const res = BaseMpl.getTokenNameFromAccountInfo(metadataAccountInfo)
        if (res) return res
      }
      return defaultName
    } catch (error) {
      return null
    }
  }

  static getTokenNameFromAccountInfo(accountInfo: web3.AccountInfo<Buffer> | null) {
    if (!accountInfo) return undefined
    try {
      const metadata = Metadata.deserialize(accountInfo.data)[0]
      return metadata?.data?.name?.split("\0")[0]
    } catch (error) {
      return undefined
    }
  }

  // async verifyCollectionItem(input: VerifyNftCollectionBuilderParams) {
  //   const ixs = this.metaplex
  //     .nfts()
  //     .builders()
  //     .verifyCollection(input)
  //     .getInstructions();
  //   const tx = new web3.Transaction().add(...ixs);
  //   return { tx };
  // }

  getRevokeMetadataAuthIx(token: web3.PublicKey, owner: web3.PublicKey) {
    const metadata = BaseMpl.getMetadataAccount(token)
    const ix = createUpdateMetadataAccountV2Instruction({
      metadata, updateAuthority: owner
    }, {
      updateMetadataAccountArgsV2: {
        data: null,
        isMutable: false,
        primarySaleHappened: false,
        updateAuthority: null
      }
    })
    return ix
  }
}
