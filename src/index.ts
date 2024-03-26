import { web3 } from "@project-serum/anchor";
import yargs, { command, option } from 'yargs';
import { hideBin } from 'yargs/helpers';
import { addLiquidity, createAndBuy, createMarket, createPool, createToken, mintTo, removeLiquidity, removeLiquidityFaster, revokeAuthority, swap, unwrapSol } from "./txHandler";
import { getPubkeyFromStr, getSlippage } from "./utils";

const log = console.log;
const delay = (ms: any) => new Promise(resolve => setTimeout(resolve, ms))


const argv = yargs(hideBin(process.argv))
    .usage('Usage: $0 <command> [options]')

    .command('run',
        'run it all',
        yargs => {
            return yargs.option('name', {
                alias: 'n',
                describe: "Token name",
                type: "string",
                demandOption: "Token name is required"
            }).option('symbol', {
                alias: 's',
                describe: "Token symbol",
                type: "string",
            }).option('image', {
                alias: 'i',
                describe: "token image/logo url",
                type: "string",
            }).option('decimals', {
                alias: 'd',
                describe: "token decimals (default: 6)",
                default: 6,
                type: 'number'
            }).option("website", {
                alias: 'w',
                describe: "external website link",
                type: 'string',
                default: ""
            }).option("telegram", {
                alias: 'tg',
                describe: "external telegram link",
                type: 'string',
                default: ""
            }).option("twitter", {
                alias: 'tw',
                describe: "external twitter link",
                type: 'string',
                default: ""
            }).option("description", {
                alias: 'desc',
                describe: "description",
                type: 'string',
                default: ""
            }).option("initial-minting", {
                alias: 'im',
                describe: "How many token you want to mint initially ? (default: 0)",
                type: 'number',
                default: 0
            }).option("url", {
                alias: 'u',
                describe: "network type (devnet/mainnet) default (mainnet)",
                type: 'string',
                default: "mainnet"
            }).option('base-amount', {
                alias: 'ba',
                describe: "Initial base token liquidity",
                type: "number",
                demandOption: "base amount require"
            }).option('quote-amount', {
                alias: 'qa',
                describe: "Initial quote token liquidity",
                type: "number",
                demandOption: "quote amount require"
            }).option('order-size', {
                alias: 'os',
                describe: "Order size used to create market (default: 0.1)",
                type: "number",
                default: 0.1,
            }).option('price-tick', {
                alias: 'pt',
                describe: "Price tick used to create market (default: 0.1)",
                type: "number",
                default: 0.1,
            }).option('delay-seconds', {
                describe: "Time to wait before removing liquidity",
                type: "number",
                default: 0,
            })
        },
        async (argv) => {

            // CREATE TOKEN
            const {
                name,
                symbol,
                image,
                decimals,
                website,
                telegram,
                twitter,
                description,
                url,
                initialMinting,
                delaySeconds
            } = argv
            if (url != 'mainnet' && url != 'devnet') {
                log("Invalid url")
                return
            }

            log({
                name,
                image,
                symbol,
                initialMinting,
                decimals,
                website,
                twitter,
                telegram,
                description,
                url
            })
            log("Creating token ...")
            const createTokenRes = await createToken({
                name,
                symbol,
                url: url as any,
                image,
                decimals,
                website,
                twitter,
                telegram,
                description: "",
                initialMintingAmount: initialMinting,
                revokeAuthorities: true
            }).catch(createTokenError => {
                log({
                    createTokenError
                });
                return null
            })

            if (createTokenRes?.Err) {
                log(createTokenRes.Err)
                return
            }
            if (!createTokenRes || !createTokenRes.Ok) {
                log("failed to create tx")
                return
            }
            if (createTokenRes.Ok) {
                log("---- Token successfully minted ----")
                log("Tx Signature : ", createTokenRes.Ok.txSignature)
                log("Token Address : ", createTokenRes.Ok.tokenId)

                // auto revoke inside the token creation
                // log("Revoking Authorities ...") 
                // const token = getPubkeyFromStr(createTokenRes.Ok.tokenId)
                // await revokeAuthority({
                //     token: token!,
                //     url
                // })

                // CREATE MARKET
                log("creating market")
                await delay(25_000)
                const {
                    orderSize,
                    priceTick
                } = argv
                let baseMint: web3.PublicKey | undefined | null = undefined
                let quoteMint: web3.PublicKey | undefined | null = undefined
                baseMint = getPubkeyFromStr(createTokenRes!.Ok!.tokenId)
                if (!baseMint) {
                    log("Invalid base token address")
                    return
                }
                quoteMint = getPubkeyFromStr("So11111111111111111111111111111111111111112")
                if (!quoteMint) {
                    log("Invalid quote token address")
                    return
                }
                const createMarketRes = await createMarket({
                    baseMint,
                    orderSize,
                    priceTick,
                    quoteMint,
                    url
                }).catch(createMarketError => {
                    log({
                        createMarketError
                    });
                    return null
                })
                if (!createMarketRes) return log("failed to create pool")
                if (createMarketRes.Err) return log({
                    error: createMarketRes.Err
                })
                if (!createMarketRes.Ok) return log("failed to create pool")
                log("Transaction Successfully Executed:")
                log("Transaction Signature: ", createMarketRes.Ok.txSignature)
                log("Market Address: ", createMarketRes.Ok.marketId)


                // // CREATE POOL
                // await delay(2 * 1000)
                // const marketId = createMarketRes!.Ok!.marketId;
                // let {
                //     baseAmount,
                //     quoteAmount
                // } = argv
                // // orderSize = orderSize ?? 0.1;
                // // priceTick = priceTick ?? 0.1;
                // const id = getPubkeyFromStr(marketId)
                // if (!id) {
                //     log("Invalid market id")
                //     return
                // }
                // const createPoolRes = await createPool({
                //     marketId: id,
                //     baseMintAmount: baseAmount,
                //     quoteMintAmount: quoteAmount,
                //     url
                // }).catch(error => {
                //     console.log({
                //         createPoolError: error
                //     });
                //     return null
                // });
                // if (!createPoolRes) return log("failed to create pool")
                // if (createPoolRes.Err) return log({
                //     error: createPoolRes.Err
                // })
                // if (!createPoolRes.Ok) return log("failed to create pool")
                // log("Pool creation transaction successfully:")
                // log("transaction signature: ", createPoolRes.Ok.txSignature)
                // log("pool address: ", createPoolRes.Ok.poolId)
                //
                //
                // console.log("Sleeping ", delaySeconds, " seconds")
                // await delay(delaySeconds * 1000)
                // const amount = -1
                // const poolId = getPubkeyFromStr(createPoolRes!.Ok!.poolId)
                // if (!poolId) {
                //     log("Invalid pool id")
                //     return
                // }
                // const removeLiqRes = await removeLiquidity({
                //     amount,
                //     poolId,
                //     url
                // }).catch(outerRemoveLiquidityError => {
                //     log({
                //         outerRemoveLiquidityError
                //     })
                //     return null
                // })
                // if (!removeLiqRes) return log("failed to send the transaction")
                // if (removeLiqRes.Err) return log({
                //     error: removeLiqRes.Err
                // })
                // if (!removeLiqRes.Ok) return log("failed to send the transaction")
                // log(`Remove liquidity transaction successfull\nTx Signature: ${removeLiqRes.Ok.txSignature}`)
                //
                // await unwrapSol(url)
                // log(`Unwrapped sol`)
            }
        })

    .command('createtoken',
        'token creation',
        yargs => {
            return yargs.option('name', {
                alias: 'n',
                describe: "Token name",
                type: "string",
                demandOption: "Token name is required"
            }).option('symbol', {
                alias: 's',
                describe: "Token symbol",
                type: "string",
            }).option('image', {
                alias: 'i',
                describe: "token image/logo url",
                type: "string",
            }).option('decimals', {
                alias: 'd',
                describe: "token decimals (default: 6)",
                default: 6,
                type: 'number'
            }).option("website", {
                alias: 'w',
                describe: "external website link",
                type: 'string',
                default: ""
            }).option("telegram", {
                alias: 'tg',
                describe: "external telegram link",
                type: 'string',
                default: ""
            }).option("twitter", {
                alias: 'tw',
                describe: "external twitter link",
                type: 'string',
                default: ""
            }).option("description", {
                alias: 'desc',
                describe: "description",
                type: 'string',
                default: ""
            }).option("initial-minting", {
                alias: 'im',
                describe: "How many token you want to mint initially ? (default: 0)",
                type: 'number',
                default: 0
            }).option("url", {
                alias: 'u',
                describe: "network type (devnet/mainnet) default (mainnet)",
                type: 'string',
                default: "mainnet"
            })
        },
        async (argv) => {
            // CREATE TOKEN
            const {
                name,
                symbol,
                image,
                decimals,
                website,
                telegram,
                twitter,
                description,
                url,
                initialMinting
            } = argv
            log({
                name,
                image,
                symbol,
                initialMinting,
                decimals,
                website,
                twitter,
                telegram,
                url,
                description
            })
            log("Creating token ...")
            const createTokenRes = await createToken({
                name,
                symbol,
                url: url as any,
                image,
                decimals,
                website,
                twitter,
                telegram,
                description,
                initialMintingAmount: initialMinting
            }).catch(createTokenError => {
                log({
                    createTokenError
                });
                return null
            })
            if (!createTokenRes) {
                log("failed to create tx")
                return
            }
            if (createTokenRes.Ok) {
                log("---- Token successfully minted ----")
                log("Tx Signature : ", createTokenRes.Ok.txSignature)
                log("Token Address : ", createTokenRes.Ok.tokenId)
            } else if (createTokenRes.Err) {
                log(createTokenRes.Err)
            }
        })

    .command('createmarket',
        'create a market to create a pool',
        yargs => {
            return yargs.option('base', {
                alias: 'b',
                describe: "Base token address",
                type: "string",
                demandOption: "base token address must require"
            }).option('quote', {
                alias: 'q',
                describe: "Quote token address",
                type: "string",
                demandOption: "quore token address must require"
            }).option('order-size', {
                alias: 'os',
                describe: "Order size used to create market (default: 0.1)",
                type: "number",
                default: 0.1,
            }).option('price-tick', {
                alias: 'pt',
                describe: "Price tick used to create market (default: 0.1)",
                type: "number",
                default: 0.1,
            }).option("url", {
                alias: 'u',
                describe: "network type (devnet/mainnet) default (mainnet)",
                type: 'string',
                default: "mainnet"
            })
        },
        async (args) => {
            const {
                orderSize,
                priceTick,
                url
            } = args
            let baseMint: web3.PublicKey | undefined | null = undefined
            let quoteMint: web3.PublicKey | undefined | null = undefined
            if (url != 'mainnet' && url != 'devnet') {
                log("please provide right url value ( 'mainnet' / 'devnet')")
                return
            }
            baseMint = getPubkeyFromStr(args.base)
            if (!baseMint) {
                log("Invalid base token address")
                return
            }
            quoteMint = getPubkeyFromStr(args.quote)
            if (!quoteMint) {
                log("Invalid quote token address")
                return
            }
            const res = await createMarket({
                baseMint,
                orderSize,
                priceTick,
                quoteMint,
                url
            }).catch(createMarketError => {
                log({
                    createMarketError
                });
                return null
            })
            if (!res) return log("failed to create pool")
            if (res.Err) return log({
                error: res.Err
            })
            if (!res.Ok) return log("failed to create pool")
            const {
                marketId,
                txSignature
            } = res.Ok
            log("Transaction Successfully Executed:")
            log("Transaction Signature: ", txSignature)
            log("Market Address: ", marketId)
        })

    .command('createpool',
        'create pool and add liquidity',
        yargs => {
            return yargs.option('market', {
                alias: 'm',
                describe: "Market id",
                type: "string",
                demandOption: "Market id must require"
            }).option('base-amount', {
                alias: 'ba',
                describe: "Initial base token liquidity",
                type: "number",
                demandOption: "base amount require"
            }).option('quote-amount', {
                alias: 'qa',
                describe: "Initial quote token liquidity",
                type: "number",
                demandOption: "quote amount require"
            }).option("url", {
                alias: 'u',
                describe: "network type (devnet/mainnet) default (mainnet)",
                type: 'string',
                default: "mainnet"
            })
        },
        async (args) => {
            let { baseAmount, quoteAmount, orderSize, priceTick, url } = args
            orderSize = orderSize ?? 0.1;
            priceTick = priceTick ?? 0.1;
            let marketId: web3.PublicKey | undefined = undefined
            if (url != 'mainnet' && url != 'devnet') {
                log("Provide right url value ( 'mainnet' / 'devnet')")
                return
            }
            const id = getPubkeyFromStr(args.market)
            if (!id) {
                log("Invalid market id")
                return
            }
            marketId = id
            const res = await createPool({
                marketId,
                baseMintAmount: baseAmount,
                quoteMintAmount: quoteAmount,
                url
            }).catch(error => {
                console.log({
                    createPoolError: error
                });
                return null
            });
            if (!res) return log("failed to create pool")
            if (res.Err) return log({
                error: res.Err
            })
            if (!res.Ok) return log("failed to create pool")
            const {
                poolId,
                txSignature
            } = res.Ok
            log("Pool creation transaction successfully:")
            log("transaction signature: ", txSignature)
            log("pool address: ", poolId)
        })

    .command('buy',
        'buy token from pool',
        yargs => {
            return yargs.option("pool", {
                alias: 'p',
                describe: "Pool id",
                type: "string",
                demandOption: true
            }).option("buy-token", {
                alias: 'b',
                describe: "which token you want to buy (base / quote)",
                type: "string",
                demandOption: true
            }).option("amount", {
                alias: 'a',
                describe: "how many tokens you want to buy",
                type: "string",
                demandOption: true
            }).option("slippage", {
                alias: 's',
                describe: "slippage tolerance (default: 1%)",
                type: "number",
                default: 1
            }).option("url", {
                alias: 'u',
                describe: "solana network type (default: mainnet )(ex: mainnet / devnet)",
                type: "string",
                default: 'mainnet'
            })
        },
        async (args) => {
            args.url = args.url
            args.poolId = args.poolId ?? ''
            const { buyToken, url } = args
            if (url != 'mainnet' && url != 'devnet') return log("please enter valid url value")
            if (buyToken != 'base' && buyToken != 'quote') return log("buyToken args values should be 'base' or 'quote'")
            // const slippageAmount = Number(args.slipapge)
            const slippageAmount = args.slippage
            log({ slippageAmount })
            if (Number.isNaN(slippageAmount)) return log("Please enter valid slippage amount")
            const slippage = getSlippage(slippageAmount)
            const poolId = getPubkeyFromStr(args.pool.trim())
            if (!poolId) return log("Please enter valid pool address")
            const amount = Number((args.amount ?? "").trim())
            if (Number.isNaN(amount)) return log("Please enter valid amount")
            const txRes = await swap({
                amount,
                amountSide: 'receive',
                buyToken,
                poolId,
                slippage,
                url
            }).catch(error => {
                console.log({
                    swapTxError: error
                });
                return null
            })
            if (!txRes) return log("transaction failed")
            if (txRes.Err) return log({
                Error: txRes.Err
            })
            if (!txRes.Ok) return log("transaction failed")
            log("--- Buy transaction successfull ---")
            log("Tx signature : ", txRes.Ok.txSignature)
        })
    .command('sell',
        'sell token from pool',
        yargs => {
            return yargs.option("pool", {
                alias: 'p',
                describe: "Pool id",
                type: "string",
                demandOption: true
            }).option("sell-token", {
                alias: 'st',
                describe: "which token you want to buy (base / quote)",
                type: "string",
                demandOption: true
            }).option("amount", {
                alias: 'a',
                describe: "how many tokens you want to buy",
                type: "string",
                demandOption: true
            }).option("slippage", {
                alias: 's',
                describe: "slippage tolerance (default: 1%)",
                type: "number",
                default: 1
            }).option("url", {
                alias: 'u',
                describe: "solana network type (default: mainnet )(ex: mainnet / devnet)",
                type: "string",
                default: 'mainnet'
            })
        },
        async (args) => {
            args.url = args.url
            args.poolId = args.poolId ?? ''
            console.log("args ====>", args);
            const { sellToken, url } = args
            if (url != 'mainnet' && url != 'devnet') return log("please enter valid url value")
            if (sellToken != 'base' && sellToken != 'quote') return log("buyToken args values should be 'base' or 'quote'")
            // const slippageAmount = Number(args.slipapge)
            const slippageAmount = args.slippage
            log({ slippageAmount })
            if (Number.isNaN(slippageAmount)) return log("Please enter valid slippage amount")
            const slippage = getSlippage(slippageAmount)
            const poolId = getPubkeyFromStr(args.pool.trim())
            if (!poolId) return log("Please enter valid pool address")
            const amount = Number((args.amount ?? "").trim())
            if (Number.isNaN(amount)) return log("Please enter valid amount")
            const txRes = await swap({
                amount,
                amountSide: 'send',
                buyToken: 'base',
                sellToken,
                poolId,
                slippage,
                url
            }).catch(error => {
                console.log({
                    swapTxError: error
                });
                return null
            })
            if (!txRes) return log("transaction failed")
            if (txRes.Err) return log({
                Error: txRes.Err
            })
            if (!txRes.Ok) return log("transaction failed")
            log("--- Sell transaction successfull ---")
            log("Tx signature : ", txRes.Ok.txSignature)
        })

    .command("addliquidity",
        "add liquidity in pool",
        yargs => {
            return yargs.option("pool", {
                alias: 'p',
                describe: "pool address",
                demandOption: "poolId require",
                type: 'string'
            }).option("amount", {
                alias: 'a',
                describe: "how much token you want to add (another token amount calcualted automatically)",
                demandOption: "reqire to enter amount",
                type: 'number'
            }).option("amount-side", {
                alias: 'as',
                describe: "which token amount you want to enter (base/quote)",
                demandOption: "reqire to enter amount size",
                type: 'string'
            }).option("slippage", {
                alias: 's',
                describe: "slippage tolerance",
                type: 'number',
                default: 1,
            }).option("url", {
                alias: 'u',
                describe: "solana network type (default: mainnet )(ex: mainnet / devnet)",
                type: "string",
                default: 'mainnet'
            })
        },
        async (args) => {
            const { amount, amountSide, url } = args
            if (amountSide != 'base' && amountSide != 'quote') {
                return log("invalid amount side value")
            }
            if (url != 'mainnet' && url != 'devnet') {
                return log("invalid url value")
            }
            const poolId = getPubkeyFromStr(args.pool)
            if (!poolId) {
                log("Invalid pool id")
                return
            }
            const slippage = getSlippage(args.slippage)
            const res = await addLiquidity({
                amount,
                amountSide,
                poolId,
                slippage,
                url
            }).catch(outerAddLiquidityError => {
                log({
                    outerAddLiquidityError
                })
                return null
            })
            if (!res) return log("failed to send the transaction")
            if (res.Err) return log({
                error: res.Err
            })
            if (!res.Ok) return log("failed to send the transaction")
            log(`Add liquidity transaction successfull\nTx Signature: ${res.Ok.txSignature}`)
        })

    .command('removeliquidity',
        'remove liquidity from the pool',
        yargs => {
            return yargs.option("pool", {
                alias: 'p',
                describe: "pool address",
                demandOption: "poolId require",
                type: 'string'
            }).option("amount", {
                alias: 'a',
                describe: "amount of lp tokens (enter -1 to remove all liquidity)",
                demandOption: "reqire to enter amount",
                type: 'number'
            }).option("url", {
                alias: 'u',
                describe: "solana network type (default: mainnet )(ex: mainnet / devnet)",
                type: "string",
                default: 'mainnet'
            })
        },
        async (args) => {
            const {
                amount,
                url
            } = args
            if (url != 'mainnet' && url != 'devnet') {
                return log("invalid url value")
            }
            const poolId = getPubkeyFromStr(args.pool)
            if (!poolId) {
                log("Invalid pool id")
                return
            }
            const res = await removeLiquidity({
                amount,
                poolId,
                url
            }).catch(outerRemoveLiquidityError => {
                log({
                    outerRemoveLiquidityError
                })
                return null
            })
            if (!res) return log("failed to send the transaction")
            if (res.Err) return log({
                error: res.Err
            })
            if (!res.Ok) return log("failed to send the transaction")
            log(`Remove liquidity transaction successfull\nTx Signature: ${res.Ok.txSignature}`)
        })

    .command('unwrap',
        'unwrap wrapped sol to normal sol',
        yargs => {
            return yargs.option('url', {
                alias: 'u',
                describe: "solana network type (default: mainnet )(ex: mainnet / devnet)",
                type: "string",
                default: 'mainnet'
            })
        },
        async args => {
            log("unwrapping sol ...")
            const url = args.url
            if (url != 'mainnet' && url != 'devnet') return log("invalid url value")
            await unwrapSol(url)
        })

    .command('minting',
        'token minting',
        yargs => {
            return yargs.option('token', {
                alias: 't',
                describe: "Token address",
                type: "string",
                demandOption: "token address require"
            }).option('amount', {
                alias: 'a',
                describe: "how many tokens to mint",
                type: 'number',
                demandOption: "token address require"
            }).option('url', {
                alias: 'u',
                describe: "solana network type (default: mainnet )(ex: mainnet / devnet)",
                type: "string",
                default: 'mainnet'
            })
        },
        async args => {
            log("token minting ...")
            const url = args.url
            if (url != 'mainnet' && url != 'devnet') return log("invalid url value")
            const token = getPubkeyFromStr(args.token)
            if (!token) return log("Please enter valid token address")
            const amount = args.amount
            await mintTo({
                token,
                amount,
                url
            })
        })

    .command("revokeauth",
        'revoke token authority',
        yargs => {
            return yargs.option('token', {
                alias: 't',
                description: "Token address",
                type: 'string',
                demandOption: "token address must require"
            }).option('url', {
                alias: 'u',
                describe: "solana network type (default: mainnet )(ex: mainnet / devnet)",
                type: "string",
                default: 'mainnet'
            })
        },
        async args => {
            const {
                url
            } = args
            const token = getPubkeyFromStr(args.token)
            if (!token) {
                log("Invalid token address")
                return
            }
            if (url != 'mainnet' && url != 'devnet') {
                log("Invalid url")
                return
            }
            await revokeAuthority({
                token,
                url
            })
        })

    .command('createpool-buy',
        'create pool, bundle buy',
        yargs => {
            return yargs.option('market', {
                alias: 'm',
                describe: "Market id",
                type: "string",
                demandOption: "Market id must require"
            }).option('base-amount', {
                alias: 'ba',
                describe: "Initial base token liquidity",
                type: "number",
                demandOption: "base amount require"
            }).option('quote-amount', {
                alias: 'qa',
                describe: "Initial quote token liquidity",
                type: "number",
                demandOption: "quote amount require"
            }).option("buy-token", {
                alias: 'bt',
                describe: "Which tokne you want to buy (base/quote) ?",
                type: 'string',
                default: "base"
            }).option("buy-amount", {
                describe: "how many token you want to buy instantly",
                type: 'number',
                demandOption: "buy amount require"
            }).option("url", {
                alias: 'u',
                describe: "network type (devnet/mainnet) default (mainnet)",
                type: 'string',
                default: "mainnet"
            })
        },
        async (args) => {
            const {
                baseAmount,
                quoteAmount,
                market,
                buyToken,
                buyAmount,
                url
            } = args
            if (url != 'mainnet' && url != 'devnet') {
                log("Provide right url value ( 'mainnet' / 'devnet')")
                return
            }
            const marketId = getPubkeyFromStr(market)
            if (!marketId) {
                log("Invalid market id")
                return
            }
            if (buyToken != 'base' && buyToken != 'quote') {
                log("invalid buy token value (value should be `base` or `quote`")
                return
            }
            const res = await createAndBuy({
                marketId,
                baseMintAmount: baseAmount,
                quoteMintAmount: quoteAmount,
                buyToken,
                buyAmount,
                url
            }).catch((createAndBuyError) => {
                log({
                    createAndBuyError
                })
                return null
            })
            if (!res) {
                log("Failed to send bundle")
                return
            }
            if (res.Err) {
                const err = res.Err
                console.log({
                    err
                })
                if (typeof err == 'string') return log(err)
                const {
                    bundleId,
                    poolId
                } = err
                log("Unable to verify the bundle transaction")
                log("please check it")
                log("Bundle id: ", bundleId)
                log("poolId: ", poolId)
                log(`Check the bundle here: https://explorer.jito.wtf/bundle/${bundleId}`)
            }
            if (res.Ok) {
                const {
                    bundleId,
                    bundleStatus,
                    buyTxSignature,
                    createPoolTxSignature,
                    poolId
                } = res.Ok
                log("Bundle send successfully")
                log("Bundle id: ", bundleId)
                log("Pool Id: ", poolId)
                log("Create pool transaction signature: ", createPoolTxSignature)
                log("Buy transaction signature: ", buyTxSignature)
                log(`Check the bundle here: https://explorer.jito.wtf/bundle/${bundleId}`)
            }
            return log("Failed to send bundle")
        })

    .command('createpool-buy-remove',
        'create pool, add liq, bundle buy, wait and remove liq',
        yargs => {
            return yargs.option('market', {
                alias: 'm',
                describe: "Market id",
                type: "string",
                demandOption: "Market id must require"
            }).option('base-amount', {
                alias: 'ba',
                describe: "Initial base token liquidity",
                type: "number",
                demandOption: "base amount require"
            }).option('quote-amount', {
                alias: 'qa',
                describe: "Initial quote token liquidity",
                type: "number",
                demandOption: "quote amount require"
            }).option("buy-token", {
                alias: 'bt',
                describe: "Which tokne you want to buy (base/quote) ?",
                type: 'string',
                default: "base"
            }).option("buy-amount", {
                describe: "how many token you want to buy instantly",
                type: 'number',
                demandOption: "buy amount require"
            }).option("url", {
                alias: 'u',
                describe: "network type (devnet/mainnet) default (mainnet)",
                type: 'string',
                default: "mainnet"
            }).option('delay-seconds', {
                describe: "Time to wait before removing liquidity",
                type: "number",
                default: 0,
            })
        },
        async (args) => {
            const {
                baseAmount,
                quoteAmount,
                market,
                buyToken,
                buyAmount,
                url,
                delaySeconds
            } = args
            if (url != 'mainnet' && url != 'devnet') {
                log("Provide right url value ( 'mainnet' / 'devnet')")
                return
            }
            const marketId = getPubkeyFromStr(market)
            if (!marketId) {
                log("Invalid market id")
                return
            }
            if (buyToken != 'base' && buyToken != 'quote') {
                log("invalid buy token value (value should be `base` or `quote`")
                return
            }
            const res = await createAndBuy({
                marketId,
                baseMintAmount: baseAmount,
                quoteMintAmount: quoteAmount,
                buyToken,
                buyAmount,
                url
            }).catch((createAndBuyError) => {
                log({
                    createAndBuyError
                })
                return null
            })
            if (!res) {
                log("Failed to send bundle")
                return
            }
            let removePoolId = null;
            if (res.Err) {
                const err = res.Err
                console.log({ err })
                if (typeof err == 'string') return log(err)
                const { bundleId, poolId } = err
                removePoolId = poolId
                log("Unable to verify the bundle transaction")
                log("please check it")
                log("Bundle id: ", bundleId)
                log("poolId: ", poolId)
                log(`Check the bundle here: https://explorer.jito.wtf/bundle/${bundleId}`)
            }
            if (res.Ok) {
                const {
                    bundleId,
                    bundleStatus,
                    buyTxSignature,
                    createPoolTxSignature,
                    poolId
                } = res.Ok
                removePoolId = poolId
                log("Bundle send successfully")
                log("Bundle id: ", bundleId)
                log("Pool Id: ", poolId)
                log("Create pool transaction signature: ", createPoolTxSignature)
                log("Buy transaction signature: ", buyTxSignature)
                log(`Check the bundle here: https://explorer.jito.wtf/bundle/${bundleId}`)
            }

            await delay(delaySeconds * 1000)

            if (removePoolId != null) {
                const amount = -1
                const poolId = getPubkeyFromStr(removePoolId)
                if (!poolId) {
                    log("Invalid pool id")
                    return
                }
                const removeLiqRes = await removeLiquidity({
                    amount,
                    poolId,
                    url
                }).catch(outerRemoveLiquidityError => {
                    log({ outerRemoveLiquidityError })
                    return null
                })
                if (!removeLiqRes) return log("failed to send the transaction")
                if (removeLiqRes.Err) return log({ error: removeLiqRes.Err })
                if (!removeLiqRes.Ok) return log("failed to send the transaction")
                log(`Remove liquidity transaction successfull\nTx Signature: ${removeLiqRes.Ok.txSignature}`)

                await unwrapSol(url)
                log(`Unwrapped sol`)
            }
        })

    .command('createpool-remove',
        'create pool, add liq, wait and remove liq',
        yargs => {
            return yargs.option('market', {
                alias: 'm',
                describe: "Market id",
                type: "string",
                demandOption: "Market id must require"
            }).option('base-amount', {
                alias: 'ba',
                describe: "Initial base token liquidity",
                type: "number",
                demandOption: "base amount require"
            }).option('quote-amount', {
                alias: 'qa',
                describe: "Initial quote token liquidity",
                type: "number",
                demandOption: "quote amount require"
            }).option("url", {
                alias: 'u',
                describe: "network type (devnet/mainnet) default (mainnet)",
                type: 'string',
                default: "mainnet"
            }).option('delay-seconds', {
                describe: "Time to wait before removing liquidity",
                type: "number",
                default: 0,
            })
        },
        async (args) => {
            let { baseAmount, quoteAmount, orderSize, priceTick, url, delaySeconds } = args
            orderSize = orderSize ?? 0.1;
            priceTick = priceTick ?? 0.1;
            let marketId: web3.PublicKey | undefined = undefined
            if (url != 'mainnet' && url != 'devnet') {
                log("Provide right url value ( 'mainnet' / 'devnet')")
                return
            }
            const id = getPubkeyFromStr(args.market)
            if (!id) {
                log("Invalid market id")
                return
            }
            marketId = id
            const res = await createPool({
                marketId,
                baseMintAmount: baseAmount,
                quoteMintAmount: quoteAmount,
                url
            }).catch(error => {
                console.log({ createPoolError: error });
                return null
            });
            if (!res) return log("failed to create pool")
            if (res.Err) return log({ error: res.Err })
            if (!res.Ok) return log("failed to create pool")
            log("Pool creation transaction successfully:")
            log("transaction signature: ", res.Ok.txSignature)
            log("pool address: ", res.Ok.poolId)

            log("Removing liquidity ...")
            await delay(delaySeconds * 1000)


            const amount = -1
            const poolId = getPubkeyFromStr(res.Ok.poolId)
            if (!poolId) {
                log("Invalid pool id")
                return
            }
            const removeCallback = async () => {
                const { baseAmount, baseDecimals, quoteAmount, quoteDecimals } = res.Ok!
                const bA = Number(baseAmount.toString())
                const qA = Number(quoteAmount.toString())
                const bq = (bA * qA)
                const sbq = Math.sqrt(bq)
                const extr = 10 ** baseDecimals
                const amount = Math.trunc(sbq - extr)
                log({ removeAmount: amount })
                await removeLiquidityFaster({ amount, poolId, url: url as any, unwrapSol: true })
            }
            const rHandler = removeCallback().catch((outerRemoveLiquidityFaster) => {
                log({ outerRemoveLiquidityFaster })
                log("faster remove liquidity faild")
            }).then(() => log('Lightning remove liquidity pass'))

            // can be commented
            const removeCallback2 = async () => {
                const removeLiqRes = await removeLiquidity({
                    amount,
                    poolId,
                    url: url as any,
                    unwrapSol: true
                }).catch(outerRemoveLiquidityError => {
                    log({ outerRemoveLiquidityError })
                    return null
                })
                if (!removeLiqRes) return log("failed to send the transaction")
                if (removeLiqRes.Err) return log({ error: removeLiqRes.Err })
                if (!removeLiqRes.Ok) return log("failed to send the transaction")
                log(`Remove liquidity transaction successfull\nTx Signature: ${removeLiqRes.Ok.txSignature}`)
            }
            const rHandler2 = removeCallback2().catch((outerRemoveLiquidityError2) => {
                log({ outerRemoveLiquidityError2 })
            })

            await rHandler
            await rHandler2
            // log("unwraping sol...")
            // await delay(10_000)
            // await unwrapSol(url)
            // log(`Unwrapped sol`)
        })

    .option('verbose', {
        alias: 'v',
        type: 'boolean',
        description: 'Run with verbose logging'
    })
    .parse();
