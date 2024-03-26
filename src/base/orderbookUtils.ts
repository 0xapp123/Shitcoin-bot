import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

// export const EVENT_QUEUE_LENGTH = 2978;
export const EVENT_QUEUE_LENGTH = 128;
export const EVENT_SIZE = 88;
export const EVENT_QUEUE_HEADER_SIZE = 32;

export const REQUEST_QUEUE_LENGTH = 63;
export const REQUEST_SIZE = 80;
export const REQUEST_QUEUE_HEADER_SIZE = 32;

// export const ORDERBOOK_LENGTH = 909;
export const ORDERBOOK_LENGTH = 201;
export const ORDERBOOK_NODE_SIZE = 72;
export const ORDERBOOK_HEADER_SIZE = 40;

export async function getVaultOwnerAndNonce(
    marketAddress: PublicKey,
    dexAddress: PublicKey
): Promise<[vaultOwner: PublicKey, nonce: BN]> {
    const nonce = new BN(0);
    // eslint-disable-next-line no-constant-condition
    while (true) {
        try {
            const vaultOwner = await PublicKey.createProgramAddress(
                [marketAddress.toBuffer(), nonce.toArrayLike(Buffer, "le", 8)],
                dexAddress
            );
            return [vaultOwner, nonce];
        } catch (e) {
            nonce.iaddn(1);
        }
    }
}

export function calculateTotalAccountSize(
    individualAccountSize: number,
    accountHeaderSize: number,
    length: number
) {
    const accountPadding = 12;
    const minRequiredSize =
        accountPadding + accountHeaderSize + length * individualAccountSize;

    const modulo = minRequiredSize % 8;

    return modulo <= 4
        ? minRequiredSize + (4 - modulo)
        : minRequiredSize + (8 - modulo + 4);
}

export function calculateAccountLength(
    totalAccountSize: number,
    accountHeaderSize: number,
    individualAccountSize: number
) {
    const accountPadding = 12;
    return Math.floor(
        (totalAccountSize - accountPadding - accountHeaderSize) /
        individualAccountSize
    );
}