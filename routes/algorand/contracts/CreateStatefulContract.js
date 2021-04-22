import algosdk from 'algosdk';
import { algodClient, waitForConfirmation } from '../utils/Utils.js';

/**
 * Create and submit a stateful smart contract from given account
 */
export async function createStatefulContract(
  account,
  approvalProgram,
  clearProgram,
  stateStorage,
  appArgs,
  params
) {
  if (params === undefined) {
    // Get node suggested parameters
    let txParams = await algodClient.getTransactionParams().do();
    txParams.fee = 1000;
    txParams.flatFee = true;
    params = txParams;
  }

  const { localInts, localBytes, globalInts, globalBytes } = stateStorage;
  const onComplete = algosdk.OnApplicationComplete.NoOpOC;

  // Create, sign and send
  const txn = algosdk.makeApplicationCreateTxn(account.addr, params,
    onComplete, approvalProgram, clearProgram, localInts, localBytes, globalInts,
    globalBytes, appArgs);
  const rawSignedTxn = txn.signTxn(account.sk)
  const txResult = await algodClient.sendRawTransaction(rawSignedTxn).do();

  await waitForConfirmation(txResult.txId);

  // Get the new app's id
  const pendingTx = await algodClient.pendingTransactionInformation(txResult.txId).do();
  const appId = pendingTx["application-index"];
  console.log("AppId = " + appId);

  return appId;
}