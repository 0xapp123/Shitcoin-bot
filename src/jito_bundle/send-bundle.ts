
import {
    ENV
  } from '../constants';
import {Connection} from "@solana/web3.js"
import {searcherClient} from 'jito-ts/dist/sdk/block-engine/searcher';
import {build_bundle, onBundleResult} from './build-bundle';



export async function bull_dozer(connection : Connection, lp_ix : any,swap_ix : any) {

  const blockEngineUrl = ENV.JITO_BLOCK_ENGINE_URL;
  const jito_auth_keypair = ENV.JITO_AUTH_KEYPAIR;
  console.log('BLOCK_ENGINE_URL:', blockEngineUrl);
  const bundleTransactionLimit = parseInt('3');

  const search = searcherClient(blockEngineUrl, jito_auth_keypair);


  await build_bundle(
    search,
    bundleTransactionLimit,
    lp_ix,
    swap_ix,
    connection
  );
 const bundle_result = await onBundleResult(search)
return bundle_result

// search.onBundleResult(
//   (bundle) => {
//     console.log(`JITO bundle result: ${JSON.stringify(bundle)}`);
//     return true;
//   },
//   (error) => {
//     console.log(`JITO bundle error: ${error}`);
//     return false;
//   }
// );
}

