import { web3 } from "@project-serum/anchor"
import { Percent } from "@raydium-io/raydium-sdk"

export type CreateTokenInput = {
    name: string,
    symbol?: string,
    image?: string
    website?: string
    twitter?: string
    telegram?: string
    description?: string
    decimals: number
    url: 'mainnet' | 'devnet'
    initialMintingAmount: number
    revokeAuthorities?: boolean
}

export type CreateMarketInput = {
    baseMint: web3.PublicKey,
    quoteMint: web3.PublicKey,
    orderSize: number,
    priceTick: number,
    url: 'mainnet' | 'devnet',
}
export type AddLiquidityInput = {
    slippage: Percent,
    poolId: web3.PublicKey,
    amount: number,
    amountSide: 'base' | 'quote',
    url: 'mainnet' | 'devnet',
}
export type RemoveLiquidityInput = {
    poolId: web3.PublicKey,
    amount: number,
    url: 'mainnet' | 'devnet',
    unwrapSol?: boolean
}

export type CreatePoolInput = {
    marketId: web3.PublicKey,
    baseMintAmount: number,
    quoteMintAmount: number,
    url: 'mainnet' | 'devnet',
}

export type SwapInput = {
    poolId: web3.PublicKey
    buyToken: "base" | 'quote',
    sellToken?: 'base' | 'quote',
    amountSide: "send" | 'receive',
    amount: number,
    slippage: Percent,
    url: 'mainnet' | 'devnet',
}

export type CreateAndBuy = {
    //pool
    marketId: web3.PublicKey,
    baseMintAmount: number,
    quoteMintAmount: number,
    url: 'mainnet' | 'devnet',

    //buy
    buyToken: 'base' | 'quote',
    buyAmount: number
}

export type BundleRes = {
    uuid: string;
    timestamp: string;
    validatorIdentity: string;
    transactions: string[];
    slot: number;
    status: number;
    landedTipLamports: number;
    signer: string;
    __typename: string;
}