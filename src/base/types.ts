import { web3 } from "@project-serum/anchor"
import { RawMint } from "@solana/spl-token"

export type BaseRayInput = {
    rpcEndpointUrl: string
}
export type Result<T, E = any> = {
    Ok?: T,
    Err?: E
}
export type MPLTokenInfo = {
    address: web3.PublicKey
    mintInfo: RawMint,
    metadata: any
}