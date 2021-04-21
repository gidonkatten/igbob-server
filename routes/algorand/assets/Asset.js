import algosdk from "algosdk";
import { algodClient, waitForConfirmation } from '../utils/Utils.js';


/**
 * Create asset using account
 */
export async function createAsset(
  account,
  totalIssuance,
  assetDecimals,
  defaultFrozen,
  unitName,
  assetName,
  params
) {
  if (params === undefined) {
    // Get node suggested parameters
    let txParams = await algodClient.getTransactionParams().do();
    txParams.fee = 1000;
    txParams.flatFee = true;
    params = txParams;
  }

  // create, sign and submit
  const txn = algosdk.makeAssetCreateTxnWithSuggestedParams(account.addr, undefined,
    totalIssuance, assetDecimals, defaultFrozen, undefined, undefined, undefined,
    undefined, unitName, assetName, undefined, undefined, params);
  const rawSignedTxn = txn.signTxn(account.sk)
  const txResult = (await algodClient.sendRawTransaction(rawSignedTxn).do());

  await waitForConfirmation(txResult.txId);

  // Get the new asset's id
  const pendingTx = await algodClient.pendingTransactionInformation(txResult.txId).do();
  const assetId = pendingTx["asset-index"];
  console.log("AssetId = " + assetId);

  return assetId;
}

/**
 * Opt given contract account into asset using its lsig
 */
export async function optIntoAssetFromEscrow(assetId, addr, lsig, params) {
  if (params === undefined) {
    // Get node suggested parameters
    let txParams = await algodClient.getTransactionParams().do();
    txParams.fee = 1000;
    txParams.flatFee = true;
    params = txParams;
  }

  const txn = algosdk.makeAssetTransferTxnWithSuggestedParams(
    addr, addr, undefined, undefined, 0, undefined, assetId, params);
  const rawSignedTxn = algosdk.signLogicSigTransactionObject(txn, lsig)
  const txResult = (await algodClient.sendRawTransaction(rawSignedTxn.blob).do());

  return txResult.txId;
}

/**
 * Send asset from account to given address
 */
 export async function sendAsset(account, assetId, toAddr, amount, params) {
  if (params === undefined) {
    // Get node suggested parameters
    let txParams = await algodClient.getTransactionParams().do();
    txParams.fee = 1000;
    txParams.flatFee = true;
    params = txParams;
  }

  const txn = algosdk.makeAssetTransferTxnWithSuggestedParams(
    account.addr, toAddr, undefined, undefined, amount, undefined, assetId, params);
    const rawSignedTxn = txn.signTxn(account.sk)
    const txResult = (await algodClient.sendRawTransaction(rawSignedTxn).do());

  return txResult.txId;
}

/**
 * Config asset
 */
 export async function configAsset(
  account,
  assetId,
  manager,
  reserve,
  freeze,
  clawback,
  params
) {
  if (params === undefined) {
    // Get node suggested parameters
    let txParams = await algodClient.getTransactionParams().do();
    txParams.fee = 1000;
    txParams.flatFee = true;
    params = txParams;
  }

  const txn = algosdk.makeAssetConfigTxnWithSuggestedParams(
    account.addr, undefined, assetId, manager, reserve, freeze, clawback, params);
  const rawSignedTxn = txn.signTxn(account.sk)
  const txResult = (await algodClient.sendRawTransaction(rawSignedTxn).do());

  return txResult.txId;
}