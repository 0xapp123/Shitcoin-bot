import { config } from "dotenv"
import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import { web3 } from "@project-serum/anchor";
import {
    TxVersion,  Token,Currency,
    TOKEN_PROGRAM_ID,
    SOL,
    CacheLTA,
    LOOKUP_TABLE_CACHE
   } from "@raydium-io/raydium-sdk";

config();
function getKeypairFromStr(str: string): web3.Keypair | null {
    try {
        return web3.Keypair.fromSecretKey(Uint8Array.from(bs58.decode(str)))
    } catch (error) {
        return null
    }
}

export const RPC_ENDPOINT_MAIN = "https://indulgent-wandering-wave.solana-mainnet.quiknode.pro/a2bbf908f0bef4ff590544046ccc4f1b711b6d32/"
export const RPC_ENDPOINT_DEV = "https://white-proportionate-putty.solana-devnet.quiknode.pro/11132715a936f8adb03c940c627d6c0b9369d9e6/"


export const addLookupTableInfo = LOOKUP_TABLE_CACHE // only mainnet. other = undefined
export const makeTxVersion = TxVersion.V0 // LEGACY
// export const RPC_ENDPOINT_MAIN = "http://127.0.0.1:8899"
// export const RPC_ENDPOINT_DEV = "http://127.0.0.1:8899"

const PINATA_API_kEY = process.env.PINATA_API_KEY!
const PINATA_DOMAIN = process.env.PINATA_DOMAIN!
const PINATA_API_SECRET_KEY = process.env.PINATA_API_SECRET_KEY!
const IN_PRODUCTION = process.env.PRODUCTION == '1' ? true : false
const COMPUTE_UNIT_PRICE = 1_800_000 // default: 200_000
const JITO_AUTH_KEYPAIR = getKeypairFromStr(process.env.JITO_AUTH_KEYPAIR!)!
const JITO_BLOCK_ENGINE_URL = process.env.JITO_BLOCK_ENGINE_URL!
if (!JITO_AUTH_KEYPAIR || !JITO_BLOCK_ENGINE_URL) {
    throw "Some ENV values not found"
}

export const feeLevel = 18;

export const jitoTipAccount = new web3.PublicKey("2d9CGsG2SnDveJkdszyepjMyQh64pQiFgLFXR7kmZYQo");

export const ENV = {
    PINATA_API_kEY,
    PINATA_API_SECRET_KEY,
    PINATA_DOMAIN,
    IN_PRODUCTION,
    COMPUTE_UNIT_PRICE,
    JITO_AUTH_KEYPAIR,
    JITO_BLOCK_ENGINE_URL
}
