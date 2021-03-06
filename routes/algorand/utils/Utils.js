import algosdk from 'algosdk';

const algodServer = 'https://testnet.algoexplorerapi.io/'
const port = 443;
export const algodClient = new algosdk.Algodv2('', algodServer, port);

export const STABLECOIN_ID = 15435388;

/**
 * utility function to wait on a transaction to be confirmed
 * the timeout parameter indicates how many rounds do you wish to check pending transactions for
 */
export const waitForConfirmation = async function (txId, timeout = 1000) {
  // Wait until the transaction is confirmed or rejected, or until 'timeout'
  // number of rounds have passed.
  //     Args:
  // txId(str): the transaction to wait for
  // timeout(int): maximum number of rounds to wait
  // Returns:
  // pending transaction information, or throws an error if the transaction
  // is not confirmed or rejected in the next timeout rounds
  if (algodClient == null || txId == null || timeout < 0) {
    throw "Bad arguments.";
  }
  let status = (await algodClient.status().do());
  if (status == undefined) throw new Error("Unable to get node status");
  let startround = status["last-round"] + 1;
  let currentround = startround;

  while (currentround < (startround + timeout)) {
    let pendingInfo = await algodClient.pendingTransactionInformation(txId).do();
    if (pendingInfo != undefined) {
      if (pendingInfo["confirmed-round"] !== null && pendingInfo["confirmed-round"] > 0) {
        //Got the completed Transaction
        return pendingInfo;
      }
      else {
        if (pendingInfo["pool-error"] != null && pendingInfo["pool-error"].length > 0) {
          // If there was a pool error, then the transaction has been rejected!
          throw new Error("Transaction Rejected" + " pool error" + pendingInfo["pool-error"]);
        }
      }
    }
    await algodClient.statusAfterBlock(currentround).do();
    currentround++;
  }
  throw new Error("Transaction not confirmed after " + timeout + " rounds!");
};

export const masterAccount = algosdk.mnemonicToSecretKey(process.env.ALGOD_ACCOUNT_MNEMONIC);

/**
 * Fund given account with algo using master account
 */
export async function fundAccount(address, amount, params) {
  if (params === undefined) {
    // Get node suggested parameters
    let txParams = await algodClient.getTransactionParams().do();
    txParams.fee = 1000;
    txParams.flatFee = true;
    params = txParams;
  }

  // create, sign and submit
  const txn = algosdk.makePaymentTxnWithSuggestedParams(masterAccount.addr, address, 
    amount, undefined, undefined, params);
  const rawSignedTxn = txn.signTxn(masterAccount.sk)
  const txResult = (await algodClient.sendRawTransaction(rawSignedTxn).do());

  return txResult.txId;
}

/**
 * Fund given account with stablecoin using master account
 */
 export async function fundAccountWithStablecoin(address, amount, params) {
  if (params === undefined) {
    // Get node suggested parameters
    let txParams = await algodClient.getTransactionParams().do();
    txParams.fee = 1000;
    txParams.flatFee = true;
    params = txParams;
  }

  const txn = algosdk.makeAssetTransferTxnWithSuggestedParams(
    masterAccount.addr, address, undefined, undefined, amount, undefined, STABLECOIN_ID, params);
    const rawSignedTxn = txn.signTxn(masterAccount.sk)
    const txResult = await algodClient.sendRawTransaction(rawSignedTxn).do();

  return txResult.txId;
}
