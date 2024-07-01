--base-amount is initial base token liquidity

--quote-amount  is initial quote token liquidity

--buy-token which token you want to buy (ans in base or quote)

--buy-amount for how many token instantly you want to buy just after the pool creation




### Market creation
```cmd
node ./dist/index.js createmarket --base J1bREnQ2HPHkVuiKgGeGCmdW6P3SPvPgCvj5ii4oYHJg --quote So11111111111111111111111111111111111111112 --order-size 0.01 --price-tick 0.01 --url mainnet
```

### Create Pool And Buy:
```cmd
node ./dist/index.js create-and-buy --market "C5XyB8Jb6wNoyPDFkFoFzsJEojPwK1cRHzjs6bwTmi3C" --base-amount 1000000000 --quote-amount 8 --buy-token "base" --buy-amount 480000000
```

### Remove Liquidity
```cmd
node ./dist/index.js removeliquidity --pool 2MMjLmVMBWChxfWT3baZ3Xq57c1Z3UyVoQUZKuz7B6BC --amount -1 --url mainnet
```

### creates pool, adds liq, removes liq:
```cmd
node ./dist/index.js createpool-remove --market "FLxNH1ciyL1LNfbWm9aMBS235K9ti2iyGd9SNdwECkzU" --base-amount 850000000 --quote-amount 8 --delay-seconds 0
```

### creates pool, adds liq, removes liq ncludes bundle buys:
```cmd
node ./dist/index.js createpool-buy-remove --market "48YUgRMkxk7fGSVdxMWzJVgoBJ1jDtp9nvkPgHXCo7RE" --base-amount 850000000 --quote-amount 8 --buy-token "base" --buy-amount 350000000 --delay-seconds 1
```

### Unwrap Sol:
```cmd
node ./dist/index.js unwrap --url mainnet
```






### Token creation
```cmd
export NODE_PATH=./dist && node ./dist/index.js createtoken --name "TOKEN_NAME" --symbol "TOKEN_SYMBOL" --image "TOKEN_IMAGE_LINK" --decimals 5 --website "web_link" --initial-minting 10000 --url devnet
```

### Market creation
```cmd
export NODE_PATH=./dist && node ./dist/index.js createmarket --base BASE_TOKEN_ADDRESS --quote QUOTE_TOKEN_ADDRESS --order-size 0.01 --price-tick 0.1 --url devnet
```

### Pool creation
```cmd
export NODE_PATH=./dist && node ./dist/index.js createpool --market MAREKET_ID --baseAmount 100 --quoteAmount 1 --url devnet
```

### Buy
```cmd
export NODE_PATH=./dist && node ./dist/index.js buy --pool POOL_ID --buy-token 'base' --amount 100
```

### Sell
```cmd
export NODE_PATH=./dist && node ./dist/index.js buy --pool POOL_ID --sell-token 'base' --amount 100
```

### Add Liquidity
```cmd
export NODE_PATH=./dist && node ./dist/index.js addliquidity --pool POOL_ID --amount 100 --amount-side 'base'
```

### Remove Liquidity
```cmd
export NODE_PATH=./dist && node ./dist/index.js removeliquidity --pool POOL_ID --amount -1 --url 'devnet'
```

### DEVELOPMENT
```
export NODE_PATH=./dist
node ./dist/index.js createtoken --name "NAME" --symbol "SYMBOL" --decimals 5 --image "https://www.google.com" --website "https://www.google.com" --initial-minting 10000 --url devnet
node ./dist/index.js createmarket --order-size 0.01 --price-tick 0.1 --url devnet --quote "So11111111111111111111111111111111111111112" --base ""
node ./dist/index.js createpool --baseAmount 10000 --quoteAmount 1 --url devnet --market ""
node ./dist/index.js removeliquidity --amount -1 --url devnet --pool ""
```

### RUNNING FOR REAL
```
export NODE_PATH=./dist
node ./dist/index.js createtoken --name "SideEyeDog" --symbol "SID" --decimals 5 --initial-minting 1000000000 --image "https://i.kym-cdn.com/photos/images/newsfeed/002/418/775/f5d.jpeg" --website "https://knowyourmeme.com/memes/side-eye-dog" --twitter "" --telegram "" --description ""
node ./dist/index.js createmarket --order-size 0.01 --price-tick 0.1 --quote "So11111111111111111111111111111111111111112" --base ""
node ./dist/index.js revokeauth --token ""
node ./dist/index.js createpool --baseAmount 300000000 --quoteAmount 10 --market ""
node ./dist/index.js removeliquidity --amount -1 --pool ""
node ./dist/index.js unwrap
```

### COOKS
```
export NODE_PATH=./dist

node ./dist/index.js createtoken --name "dogwifcrown" --symbol "WIC" --decimals 5 --image "https://pbs.twimg.com/media/GHtutvaWMAAhujZ?format=jpg&name=small" --website "" --twitter "https://twitter.com/blknoiz06/status/1764125414815842519" --telegram "" --description "" --initial-minting 1000000000

node ./dist/index.js createtoken --name "SideEyeDog" --symbol "SED" --decimals 5 --initial-minting 1000000000 --image "https://i.kym-cdn.com/photos/images/newsfeed/002/418/775/f5d.jpeg" --website "https://knowyourmeme.com/memes/side-eye-dog" --twitter "" --telegram "" --description ""

node ./dist/index.js createtoken --name "Shiba Inu" --symbol "SHIB" --decimals 5 --image "https://pbs.twimg.com/profile_images/1764023553505054720/u3Gy4BZd_400x400.jpg" --website "" --twitter "https://twitter.com/shibainucoinsol" --telegram "http://t.me/ShibaInuCoinSol" --description "" --initial-minting 1000000000

node ./dist/index.js createtoken --name "MAGA" --symbol "TRUMP" --decimals 5 --initial-minting 1000000000 --image "" --website "" --twitter "" --telegram "" --description ""

node ./dist/index.js createtoken --name "bellgetes" --symbol "getes" --decimals 5 --initial-minting 1000000000 --image "https://bellgetes.xyz/images/DDDTT.jpg" --website "https://bellgetes.xyz/" --twitter "" --telegram "" --description ""  

node ./dist/index.js createtoken --name "waranboofut" --symbol "boofut" --decimals 5 --initial-minting 1000000000 --image "https://waranboofut.xyz/images/1.jpg" --website "https://waranboofut.xyz/" --twitter "" --telegram "" --description ""  

node ./dist/index.js createtoken --name "dagecoin" --symbol "dagecoin" --decimals 5 --initial-minting 1000000000 --image "https://dagecoin.xyz/assets/images/logo-coin.PNG" --website "https://dagecoin.xyz/" --twitter "" --telegram "" --description ""  

node ./dist/index.js createtoken --name "keawnu weeves" --symbol "neow" --decimals 5 --initial-minting 1000000000 --image "https://neow.fun/assets/images/logo-coin.PNG" --website "https://neow.fun/" --twitter "" --telegram "" --description ""  

```

export NODE_PATH=./dist && node ./dist/index.js createmarket --order-size 0.01 --price-tick 0.1 --quote "So11111111111111111111111111111111111111112" --base ""
export NODE_PATH=./dist && node ./dist/index.js revokeauth --token "E89PFXFkxAyXhdocLszAxVS35jERhMqDyDjsZiFsbgi"
export NODE_PATH=./dist && node ./dist/index.js createpool --baseAmount 850000000 --quoteAmount 20 --market ""
export NODE_PATH=./dist && node ./dist/index.js removeliquidity --amount -1 --pool ""
export NODE_PATH=./dist && node ./dist/index.js unwrap


### RUN ALLS
```
node ./dist/index.js run --name "dogwifcrown" --symbol "WIC" --decimals 5 --initial-minting 1000000000 --image "https://pbs.twimg.com/media/GHtutvaWMAAhujZ?format=jpg&name=small" --website "" --twitter "https://twitter.com/blknoiz06/status/1764125414815842519" --telegram "" --description "" --order-size 0.01 --price-tick 0.1 --baseAmount 850000000 --quoteAmount 8

node ./dist/index.js run --name "SideEyeDog" --symbol "SIDEEYEDOG" --decimals 5 --initial-minting 1000000000 --image "https://i.kym-cdn.com/photos/images/newsfeed/002/418/775/f5d.jpeg" --website https://knowyourmeme.com"/memes/side-eye-dog" --twitter "" --telegram "" --description "" --order-size 0.01 --price-tick 0.1 --baseAmount 850000000 --quoteAmount 8

node ./dist/index.js run --name "bellgetes" --symbol "getes" --decimals 5 --initial-minting 1000000000 --image "https://bellgetes.xyz/images/DDDTT.jpg" --website "https://bellgetes.xyz/" --twitter "https://twitter.com/BellGetesSol" --telegram "" --description "" --order-size 0.01 --price-tick 0.1 --baseAmount 850000000 --quoteAmount 8

node ./dist/index.js run --name "waranboofut" --symbol "boofut" --decimals 5 --initial-minting 1000000000 --image "https://waranboofut.xyz/images/1.jpg" --website "https://waranboofut.xyz/" --twitter "https://x.com/waranbufoofut?s=21&t=U_NbbXAlEnKwM5KHqJxJ9w" --telegram "https://t.me/waranboofut" --description "" --order-size 0.01 --price-tick 0.1 --baseAmount 850000000 --quoteAmount 8

node ./dist/index.js run --name "dagecoin" --symbol "https://neow.fun/" --decimals 5 --initial-minting 1000000000 --image "https://dagecoin.xyz/assets/images/logo-coin.PNG" --website "https://dagecoin.xyz/" --twitter "https://twitter.com/DageCoinOnSol" --telegram "https://t.me/dagecoinchat" --description "" --order-size 0.01 --price-tick 0.1 --baseAmount 850000000 --quoteAmount 8

node ./dist/index.js run --name "dagecoin" --symbol "dagecoin" --decimals 5 --initial-minting 1000000000 --image "https://dagecoin.xyz/assets/images/logo-coin.PNG" --website "https://dagecoin.xyz/" --twitter "https://twitter.com/DageCoinOnSol" --telegram "https://t.me/dagecoinchat" --description "" --order-size 0.01 --price-tick 0.1 --baseAmount 850000000 --quoteAmount 8

node ./dist/index.js run --name "dagecoin" --symbol "dagecoin" --decimals 5 --initial-minting 1000000000 --image "https://dagecoin.xyz/assets/images/logo-coin.PNG" --website "https://dagecoin.xyz/" --twitter "https://twitter.com/DageCoinOnSol" --telegram "https://t.me/dagecoinchat" --description "" --order-size 0.01 --price-tick 0.1 --baseAmount 850000000 --quoteAmount 8

node ./dist/index.js run --name "dagecoin" --symbol "dagecoin" --decimals 5 --initial-minting 1000000000 --image "https://dagecoin.xyz/assets/images/logo-coin.PNG" --website "https://dagecoin.xyz/" --twitter "https://twitter.com/DageCoinOnSol" --telegram "https://t.me/dagecoinchat" --description "" --order-size 0.01 --price-tick 0.1 --baseAmount 850000000 --quoteAmount 8

node ./dist/index.js run --name "dagecoin" --symbol "dagecoin" --decimals 5 --initial-minting 1000000000 --image "https://dagecoin.xyz/assets/images/logo-coin.PNG" --website "https://dagecoin.xyz/" --twitter "https://twitter.com/DageCoinOnSol" --telegram "https://t.me/dagecoinchat" --description "" --order-size 0.01 --price-tick 0.1 --baseAmount 850000000 --quoteAmount 8

https://www.solanabag.net/ BAG BAG
```
