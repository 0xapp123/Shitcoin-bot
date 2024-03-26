import { web3 } from "@project-serum/anchor";
import {
  MINT_SIZE,
  AuthorityType as SetAuthorityType,
  TOKEN_PROGRAM_ID,
  AccountLayout as TokenAccountLayout,
  createAssociatedTokenAccountInstruction,
  createBurnInstruction,
  createInitializeMintInstruction,
  createMintToInstruction,
  createSetAuthorityInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
  getMint
} from "@solana/spl-token";
import { calcDecimalValue, calcNonDecimalValue, sleep } from "./utils";

const log = console.log;

export type CreateTokenOptions = {
  mintAuthority: web3.PublicKey;
  /** default (`mintAuthority`) */
  payer?: web3.PublicKey;
  /** default (`mintAuthority`) */
  freezAuthority?: web3.PublicKey;
  /** default (`0`) */
  decimal?: number;
  /** default (`Keypair.genrate()`) */
  mintKeypair?: web3.Keypair,
  mintingInfo?: {
    /** default (`mintAuthority`) */
    tokenReceiver?: web3.PublicKey;
    /** default (`1`) */
    tokenAmount?: number;
    /** default (`false`) */
    allowOffCurveOwner?: boolean;
  };
};

export type GetOrCreateTokenAccountOptions = {
  mint: web3.PublicKey,
  owner: web3.PublicKey,
  /** default (`owner`) */
  payer?: web3.PublicKey,
  /** default (`false`) */
  allowOffCurveOwner?: boolean;
  checkCache?: boolean
}

export type MintToInput = {
  mintAuthority: web3.PublicKey | string,
  /** default (`mintAuthority`) */
  receiver?: web3.PublicKey | string
  mint: web3.PublicKey | string,
  /** default (`1`) */
  amount?: number,
  /** default (`false`) */
  receiverIsOffCurve?: boolean,
  /** default (`false`) */
  init_if_needed?: boolean
  /** default (`null`) fetch from mint*/
  mintDecimal?: number
}

export type TransferInput = {
  sender: web3.PublicKey | string,
  receiver: web3.PublicKey | string
  mint: web3.PublicKey | string,
  /** default (`1`) */
  amount?: number,
  receiverIsOffCurve?: boolean,
  /** get decimal from onchain token data if not found provided */
  decimal?: number
  init_if_needed?: boolean
  /** default (`sender`) */
  payer?: web3.PublicKey | string,
}

export type BurnInput = {
  mint: web3.PublicKey | string,
  owner: web3.PublicKey | string,
  amount?: number,
  decimal?: number
}

export type TranferMintAuthority = {
  mint: web3.PublicKey,
  currentAuthority: web3.PublicKey,
  newAuthority: web3.PublicKey,
}

export type RevokeAuthorityInput = {
  authorityType: "MINTING" | "FREEZING",
  mint: web3.PublicKey,
  currentAuthority: web3.PublicKey,
}

export class BaseSpl {
  private connection: web3.Connection;
  private splIxs: web3.TransactionInstruction[] = [];
  private cacheAta: Set<String>;

  constructor(connection: web3.Connection) {
    this.connection = connection;
    this.cacheAta = new Set();
  }

  __reinit() {
    this.splIxs = [];
    this.cacheAta = new Set();
  }

  async createToken(opts: CreateTokenOptions) {
    this.__reinit();
    let {
      mintAuthority,
      decimal,
      payer,
      freezAuthority,
      mintKeypair,
      mintingInfo,
    } = opts;

    payer = payer ?? mintAuthority;
    freezAuthority = freezAuthority ?? mintAuthority;
    decimal = decimal ?? 0;
    mintKeypair = mintKeypair ?? web3.Keypair.generate();

    const mint = mintKeypair.publicKey;
    const rent = await this.connection.getMinimumBalanceForRentExemption(
      MINT_SIZE
    );

    const ix1 = web3.SystemProgram.createAccount({
      fromPubkey: payer,
      lamports: rent,
      newAccountPubkey: mint,
      programId: TOKEN_PROGRAM_ID,
      space: MINT_SIZE,
    });
    this.splIxs.push(ix1);

    const ix2 = createInitializeMintInstruction(
      mintKeypair.publicKey,
      decimal,
      mintAuthority,
      freezAuthority
    );
    this.splIxs.push(ix2);

    if (mintingInfo && mintingInfo.tokenAmount) {
      let {
        tokenReceiver,
        allowOffCurveOwner,
        tokenAmount
      } = mintingInfo;
      tokenReceiver = mintingInfo.tokenReceiver ?? opts.mintAuthority;
      allowOffCurveOwner = allowOffCurveOwner ?? false;
      tokenAmount = tokenAmount ?? 1
      tokenAmount = tokenAmount * (10 ** decimal)
      const { ata, ix: createTokenAccountIx } =
        this.createTokenAccount(
          mint,
          tokenReceiver,
          allowOffCurveOwner,
          payer,
        );
      this.splIxs.push(createTokenAccountIx);
      const ix3 = createMintToInstruction(
        mint,
        ata,
        mintAuthority,
        tokenAmount
      );
      this.splIxs.push(ix3);
    }
    const ixs = this.splIxs;
    this.__reinit();
    return {
      mintKeypair,
      ixs,
    };
  }

  createTokenAccount(
    mint: web3.PublicKey,
    owner: web3.PublicKey,
    allowOffCurveOwner: boolean = false,
    payer?: web3.PublicKey
  ) {
    const ata = getAssociatedTokenAddressSync(mint, owner, allowOffCurveOwner);
    const ix = createAssociatedTokenAccountInstruction(
      payer ?? owner,
      ata,
      owner,
      mint
    );

    return {
      ata,
      ix,
    };
  }

  async getOrCreateTokenAccount(
    input: GetOrCreateTokenAccountOptions,
    ixCallBack?: (ixs?: web3.TransactionInstruction[]) => void
  ) {
    let {
      owner,
      mint,
      payer,
      allowOffCurveOwner,
      checkCache
    } = input;
    allowOffCurveOwner = allowOffCurveOwner ?? false
    payer = payer ?? owner;
    const ata = getAssociatedTokenAddressSync(mint, owner, allowOffCurveOwner);
    let ix: web3.TransactionInstruction | null = null;
    const info = await this.connection.getAccountInfo(ata).catch(async () => {
      await sleep(2_000)
      return this.connection.getAccountInfo(ata).catch((getAccountInfoError) => {
        log({ getAccountInfoError })
        return undefined
      })
    });
    if (info === undefined) throw "Failed to fetch data"

    if (!info) {
      ix = this.createTokenAccount(mint, owner, allowOffCurveOwner, payer).ix;
      if (ixCallBack) {
        if (checkCache) {
          if (!this.cacheAta.has(ata.toBase58())) {
            ixCallBack([ix])
            this.cacheAta.add(ata.toBase58())
          } else log("already exist")
        } else {
          ixCallBack([ix])
        }
      }
    }
    return {
      ata,
      ix,
    };
  }

  async getMintToInstructions(input: MintToInput) {
    let { mintAuthority, mint, receiver, amount, receiverIsOffCurve, init_if_needed, mintDecimal } = input;
    if (typeof mintAuthority == 'string') mintAuthority = new web3.PublicKey(mintAuthority)
    if (typeof mint == 'string') mint = new web3.PublicKey(mint)
    if (typeof receiver == 'string') receiver = new web3.PublicKey(receiver)
    receiver = receiver ?? mintAuthority
    receiverIsOffCurve = receiverIsOffCurve ?? false
    init_if_needed = init_if_needed ?? false;
    amount = amount ?? 1

    if (!mintDecimal)
      mintDecimal = (await getMint(this.connection, mint)).decimals

    amount = calcNonDecimalValue(amount, mintDecimal)
    const receiverAta = getAssociatedTokenAddressSync(mint, receiver, receiverIsOffCurve)
    const ixs: web3.TransactionInstruction[] = []

    if (init_if_needed) {
      const ataInfo = await this.connection.getAccountInfo(receiverAta)
      if (!ataInfo) { // init ata if needed
        const ix = createAssociatedTokenAccountInstruction(mintAuthority, receiverAta, receiver, mint)
        ixs.push(ix)
      }
    }

    const ix = createMintToInstruction(mint, receiverAta, mintAuthority, BigInt(amount.toString()));
    ixs.push(ix)
    return ixs;
  }

  async transfer(input: TransferInput) {
    let {
      mint,
      sender,
      receiver,
      receiverIsOffCurve,
      init_if_needed,
      decimal,
      payer,
    } = input;
    receiverIsOffCurve = receiverIsOffCurve ?? false;
    payer = payer ?? sender
    input.amount = input.amount ?? 1;

    if (typeof mint == 'string') mint = new web3.PublicKey(mint)
    if (typeof sender == 'string') sender = new web3.PublicKey(sender)
    if (typeof receiver == 'string') receiver = new web3.PublicKey(receiver)
    if (typeof payer == 'string') payer = new web3.PublicKey(payer)
    const ixs: web3.TransactionInstruction[] = [];
    if (!decimal) {
      const mintInfo = await getMint(this.connection, mint);
      decimal = mintInfo.decimals;
    }
    const amount = calcNonDecimalValue(input.amount, decimal);
    const senderAta = getAssociatedTokenAddressSync(mint, sender)
    const receiverAta = getAssociatedTokenAddressSync(mint, receiver, receiverIsOffCurve)
    if (init_if_needed) {
      const { ata: _, ix: ix1 } = await this.getOrCreateTokenAccount({ mint, owner: sender, payer })
      if (ix1) ixs.push(ix1)
      const { ata: __, ix: ix2 } = await this.getOrCreateTokenAccount({ mint, owner: receiver, payer, allowOffCurveOwner: receiverIsOffCurve })
      if (ix2) ixs.push(ix2)
    }

    const ix = createTransferInstruction(senderAta, receiverAta, sender, amount);
    ixs.push(ix)
    return ixs
  }

  async burn(input: BurnInput) {
    let {
      mint, owner,
      amount, decimal
    } = input
    if (typeof mint == 'string') mint = new web3.PublicKey(mint)
    if (typeof owner == 'string') owner = new web3.PublicKey(owner)
    amount = amount ?? 1;
    if (!decimal) {
      const tokenInfo = await getMint(this.connection, mint)
      decimal = tokenInfo.decimals;
    }
    amount = amount * (10 ** decimal)
    const ata = getAssociatedTokenAddressSync(mint, owner)
    const ix = createBurnInstruction(ata, mint, owner, amount)
    return ix;
  }

  tranferMintAuthority(input: TranferMintAuthority, ixCallBack?: (ixs?: web3.TransactionInstruction[]) => void) {
    const {
      mint,
      currentAuthority,
      newAuthority,
    } = input
    const ix = createSetAuthorityInstruction(mint, currentAuthority, SetAuthorityType.MintTokens, newAuthority);
    if (ixCallBack) ixCallBack([ix])
    return {
      ix,
    }
  }

  tranferFreezAuthority(input: TranferMintAuthority, ixCallBack?: (ixs?: web3.TransactionInstruction[]) => void) {
    const {
      mint,
      currentAuthority,
      newAuthority,
    } = input
    const ix = createSetAuthorityInstruction(mint, currentAuthority, SetAuthorityType.FreezeAccount, newAuthority);
    if (ixCallBack) ixCallBack([ix])
    return {
      ix,
    }
  }

  revokeAuthority(input: RevokeAuthorityInput, ixCallBack?: (ixs?: web3.TransactionInstruction[]) => void) {
    const {
      mint,
      currentAuthority,
      authorityType
    } = input
    const setAuthType = authorityType == 'MINTING' ? SetAuthorityType.MintTokens : SetAuthorityType.FreezeAccount
    const ix = createSetAuthorityInstruction(mint, currentAuthority, setAuthType, null);
    if (ixCallBack) ixCallBack([ix])
    // return {
    //   ix,
    // }
    return ix;
  }

  async listAllOwnerTokens(owner: web3.PublicKey | string) {
    if (typeof owner == 'string') owner = new web3.PublicKey(owner)
    //TODO: can be improved
    const parsedTokenAccounts = (await this.connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID })).value
    const res: { token: web3.PublicKey, amount: number }[] = []
    for (let i of parsedTokenAccounts) {
      const parsedAccountInfo = i.account.data;
      const mintAddress = new web3.PublicKey(parsedAccountInfo.parsed?.info?.mint)
      const tokenBalance: number = parsedAccountInfo.parsed?.info?.tokenAmount?.uiAmount;
      res.push({
        amount: tokenBalance,
        token: mintAddress
      })
    }
    return res;
  }

  async getMint(mint: web3.PublicKey | string) {
    if (typeof mint == 'string') mint = new web3.PublicKey(mint)
    return getMint(this.connection, mint)
  }

  static getTokenAccountFromAccountInfo(accountInfo: web3.AccountInfo<Buffer> | null) {
    if (!accountInfo) return null
    try {
      return TokenAccountLayout.decode(accountInfo.data)
    } catch (error) { return null }
  }

  async getSolBalance(user: web3.PublicKey) {
    const account = await this.connection.getAccountInfo(user).catch(() => null)
    if (account) {
      return calcDecimalValue(account.lamports, 9)
    }
    return null
  }
}

