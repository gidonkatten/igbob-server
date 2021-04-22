import algosdk from 'algosdk';
import fs from 'fs';
import { resolve } from 'path';
import pool from "../../../db.js";
import { algodClient, fundAccount, waitForConfirmation } from '../utils/Utils.js';
import { configAsset, createAsset, optIntoAssetFromEscrow, revokeAsset } from '../assets/Asset.js';
import { createStatefulContract } from '../contracts/CreateStatefulContract.js';
import { compileProgram, encodeUint64, stringToUint64 } from '../contracts/Utils.js';
import { convertDateToUnixTime } from '../../../utils/Utils.js';

const STABLECOIN_ID = 15435388;

/**
 * Issue bond
 */
export async function issueBond(
  totalIssuance,
  bondUnitName,
  bondName,
  issuerAddr,
  startBuyDate,
  endBuyDate,
  maturityDate,
  bondCost,
  bondCouponPaymentVal,
  bondCouponInstallments,
  bondPrincipal,
) {
  // Get node suggested parameters
  let params = await algodClient.getTransactionParams().do();
  params.fee = 1000;
  params.flatFee = true;

  // new algo account which will create bond + contract
  const account = algosdk.generateAccount();
  console.log("New account " + account.addr);

  // fund account with min balance needed
  const fundAccountTxId = await fundAccount(account.addr, 2000000, params);
  await waitForConfirmation(fundAccountTxId);
  console.log("Funded new account");

  // create bond (frozen)
  const bondId = await createAsset(account, totalIssuance, 0, true,
    bondUnitName, bondName, params);

  // create app
  const stateStorage = {
    localInts: 2,
    localBytes: 0,
    globalInts: 8,
    globalBytes: 2,
  }

  const ia = stringToUint64(issuerAddr);
  const sbd = encodeUint64(convertDateToUnixTime(startBuyDate));
  const ebd = encodeUint64(convertDateToUnixTime(endBuyDate));
  const md = encodeUint64(convertDateToUnixTime(maturityDate));
  const bid = encodeUint64(bondId);
  const bc = encodeUint64(bondCost);
  const bcpv = encodeUint64(bondCouponPaymentVal);
  const bci = encodeUint64(bondCouponInstallments);
  const bp = encodeUint64(bondPrincipal);
  const appArgs = [ia, sbd, ebd, md, bid, bc, bcpv, bci, bp];
  
  const approvalProgram = fs.readFileSync(
    resolve('routes/algorand/teal/greenBondApproval.teal'), 'utf8')
  const clearProgram = fs.readFileSync(
    resolve('routes/algorand/teal/greenBondClear.teal'), 'utf8');
  const approval = await compileProgram(approvalProgram);
  const clear = await compileProgram(clearProgram);
  
  const appId = await createStatefulContract(account, approval, clear, 
    stateStorage, appArgs, params);

  // create escrow addresses for bond and stablecoin
  const bondEscrowFile = fs.readFileSync(
    resolve('routes/algorand/teal/bondEscrow.teal'), 'utf8');
  const bondEscrowProgram = bondEscrowFile.
    replace(/VAR_TMPL_APP_ID/g, appId.toString()).
    replace(/VAR_TMPL_BOND_ID/g, bondId.toString()).
    replace(/VAR_TMPL_LV/g, params.lastRound + 500);
  const bondEscrow = await compileProgram(bondEscrowProgram);
  const bondLogSig = algosdk.makeLogicSig(bondEscrow)
  const bondEscrowAddr = bondLogSig.address();

  const stcEscrowFile = fs.readFileSync(
    resolve('routes/algorand/teal/stablecoinEscrow.teal'), 'utf8');
  const stcEscrowProgram = stcEscrowFile.
    replace(/VAR_TMPL_APP_ID/g, appId.toString()).
    replace(/VAR_TMPL_LV/g, params.lastRound + 500);
  const stcEscrow = await compileProgram(stcEscrowProgram);
  const stcLogSig = algosdk.makeLogicSig(stcEscrow)
  const stcEscrowAddr = stcLogSig.address();

  // fund escrow addresses with some algo to get going (must be initialised with > 0.1 algos)
  const fundBondEscrowTxId = await fundAccount(bondEscrowAddr, 500000, params);
  await waitForConfirmation(fundBondEscrowTxId);
  console.log("Funded bond escrow");
  const fundStcEscrowTxId = await fundAccount(stcEscrowAddr, 500000, params);
  await waitForConfirmation(fundStcEscrowTxId);
  console.log("Funded stablecoin escrow");

  // opt in escrow addresses to bond and stablecoin respectively
  const optTxId = await optIntoAssetFromEscrow(bondId, bondEscrowAddr, bondLogSig, params);
  await waitForConfirmation(optTxId);
  console.log("Bond escrow opted into bond");
  optIntoAssetFromEscrow(STABLECOIN_ID, stcEscrowAddr, stcLogSig, params); // no need to wait for confirmation

  // send bonds to 'bondEscrowAddr'
  const bondTransferTxId = await revokeAsset(account, account.addr, bondEscrowAddr, bondId, totalIssuance, params);
  await waitForConfirmation(bondTransferTxId);
  console.log("Bond escrow received bond");

  // set bond clawback to 'bondEscrowAddr' + lock bond by clearing the freezer and manager
  configAsset(account, bondId, undefined, account.addr, undefined, bondEscrowAddr, params);

  // insert into apps table
  const newApp = await pool.query(
    "INSERT INTO apps(app_id, bond_id, bond_escrow_address, " + 
    "bond_escrow_program, stablecoin_escrow_address, stablecoin_escrow_program) " + 
    "VALUES($1, $2, $3, $4, $5, $6) RETURNING *",
    [appId, bondId, bondEscrowAddr, bondEscrowProgram, stcEscrowAddr, stcEscrowProgram]
  );

  return newApp.rows[0];
}
