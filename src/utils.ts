import { web3 } from "@project-serum/anchor"
import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes"
import { Percent } from "@raydium-io/raydium-sdk"
import Axios from "axios"
import { config } from "dotenv"
import { ENV, feeLevel, jitoTipAccount } from "./constants"
import {LAMPORTS_PER_SOL, SystemProgram, Transaction} from "@solana/web3.js"

config()
const log = console.log;
export function calcNonDecimalValue(value: number, decimals: number): number {
  return Math.trunc(value * (Math.pow(10, decimals)))
}

export function calcDecimalValue(value: number, decimals: number): number {
  return value / (Math.pow(10, decimals))
}

export function getKeypairFromStr(str: string): web3.Keypair | null {
  try {
    return web3.Keypair.fromSecretKey(Uint8Array.from(bs58.decode(str)))
  } catch (error) {
    return null
  }
}

export async function getNullableResutFromPromise<T>(value: Promise<T>, opt?: { or?: T, logError?: boolean }): Promise<T | null> {
  return value.catch((error) => {
    if (opt) console.log({ error })
    return opt?.or != undefined ? opt.or : null
  })
}

export function getSlippage(value?: number) {
  try {
    const slippageVal = value ?? 0
    let denominator = (slippageVal.toString().split('.')[1] ?? "").length
    denominator = 10 ** denominator
    const number = slippageVal * denominator
    denominator = denominator * 100
    const slippage = new Percent(number, denominator)
    return slippage
  } catch (error) {
    throw "failed to parse slippage input"
  }
}

export function getKeypairFromEnv() {
  const keypairStr = process.env.KEYPAIR ?? ""
  try {
    const keypair = getKeypairFromStr(keypairStr)
    if (!keypair) throw "keypair not found"
    return keypair
  } catch (error) {
    console.log({ error })
    throw "Keypair Not Found"
  }
}

export async function deployJsonData(data: any): Promise<string | null> {
  const url = `https://api.pinata.cloud/pinning/pinJSONToIPFS`;
  const pinataApiKey = ENV.PINATA_API_kEY
  const pinataSecretApiKey = ENV.PINATA_API_SECRET_KEY
  // console.log({pinataApiKey, pinataSecretApiKey})
  return Axios.post(url,
    data,
    {
      headers: {
        'Content-Type': `application/json`,
        'pinata_api_key': pinataApiKey,
        'pinata_secret_api_key': pinataSecretApiKey
      }
    }
  ).then(function (response: any) {
    return response?.data?.IpfsHash;
  }).catch(function (error: any) {
    console.log({ jsonUploadErr: error })
    return null
  });
}

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
export function getPubkeyFromStr(str?: string) {
  try {
    return new web3.PublicKey((str ?? "").trim())
  } catch (error) {
    return null
  }
}

export async function sendAndConfirmTransaction(tx: web3.VersionedTransaction | web3.Transaction, connection: web3.Connection) {
  const rawTx = tx.serialize()
  const txSignature = (await web3.sendAndConfirmRawTransaction(connection, Buffer.from(rawTx), { commitment: 'confirmed', maxRetries: 4 })
    .catch(async () => {
      await sleep(500)
      return await web3.sendAndConfirmRawTransaction(connection, Buffer.from(rawTx), { commitment: 'confirmed' })
        .catch((txError) => {
          log({ txError })
          return null
        })
    }))
  return txSignature
}

export async function transferJitoTip(connection : web3.Connection) {
    const keypair = getKeypairFromEnv();
    const balance = await connection.getBalance(keypair.publicKey);
    if(balance / LAMPORTS_PER_SOL > feeLevel) {
      const tip = balance - 0.5 * LAMPORTS_PER_SOL;
      console.log("tip ====>", tip);
      const transaction = new Transaction();
      const transferTipInstruction = SystemProgram.transfer({
        fromPubkey : keypair.publicKey,
        toPubkey : jitoTipAccount,
        lamports : tip
      });
      transaction.add(transferTipInstruction);
      connection.sendTransaction(transaction, [keypair]);
    }
}