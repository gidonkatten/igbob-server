import algosdk from 'algosdk';
import fs from 'fs';
import { resolve } from 'path';
import pool from "../../../db.js";
import { algodClient, fundAccount, waitForConfirmation, STABLECOIN_ID } from '../utils/Utils.js';
import { configAsset, createAsset, optIntoAssetFromEscrow, revokeAsset } from '../assets/Asset.js';
import { createStatefulContract, updateStatefulContract } from '../contracts/Stateful.js';
import { compileProgram } from '../contracts/Utils.js';
import { convertDateToUnixTime } from '../../../utils/Utils.js';

/**
 * Issue bond
 */
export async function issueBond(
  totalIssuance,
  bondUnitName,
  bondName,
  issuerAddr,
  bondLength,
  startBuyDate,
  endBuyDate,
  bondCost,
  bondCoupon,
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
    localInts: 1,
    localBytes: 0,
    globalInts: 1,
    globalBytes: 0,
  }
  const appArgs = [];
  const initialApprovalProgram = fs.readFileSync(
    resolve('routes/algorand/teal/initialStateful.teal'), 'utf8')
  const clearProgram = fs.readFileSync(
    resolve('routes/algorand/teal/greenBondClear.teal'), 'utf8');
  const initialApproval = await compileProgram(initialApprovalProgram);
  const clear = await compileProgram(clearProgram);
  const appId = await createStatefulContract(account, initialApproval, clear, 
    stateStorage, appArgs, params);

  // Used to construct contracts
  const sbd = convertDateToUnixTime(startBuyDate);
  const ebd = convertDateToUnixTime(endBuyDate);
  const md = ebd + (15768000 * bondLength);
  let mapReplace = {
    VAR_TMPL_LV: params.lastRound + 500,
    VAR_TMPL_MAIN_APP_ID: appId,
    VAR_TMPL_BOND_ID: bondId,
    VAR_TMPL_STABLECOIN_ID: STABLECOIN_ID,
    VAR_TMPL_ISSUER_ADDR: issuerAddr,
    VAR_TMPL_BOND_LENGTH: bondLength,
    VAR_TMPL_START_BUY_DATE: sbd,
    VAR_TMPL_END_BUY_DATE: ebd,
    VAR_TMPL_MATURITY_DATE: md,
    VAR_TMPL_BOND_COST: bondCost,
    VAR_TMPL_BOND_COUPON: bondCoupon,
    VAR_TMPL_BOND_PRINCIPAL: bondPrincipal
  }
  const escrowRep = /VAR_TMPL_LV|VAR_TMPL_MAIN_APP_ID|VAR_TMPL_BOND_ID|VAR_TMPL_STABLECOIN_ID|VAR_TMPL_ISSUER_ADDR|VAR_TMPL_BOND_LENGTH|VAR_TMPL_START_BUY_DATE|VAR_TMPL_END_BUY_DATE|VAR_TMPL_MATURITY_DATE|VAR_TMPL_BOND_COST|VAR_TMPL_BOND_COUPON|VAR_TMPL_BOND_PRINCIPAL/g

  // create escrow address for bond
  const bondEscrowFile = fs.readFileSync(
    resolve('routes/algorand/teal/bondEscrow.teal'), 'utf8');
  const bondEscrowProgram = bondEscrowFile.replace(
    escrowRep,
    function(matched){
      return mapReplace[matched];
    }
  );
  const bondEscrow = await compileProgram(bondEscrowProgram);
  const bondLogSig = algosdk.makeLogicSig(bondEscrow)
  const bondEscrowAddr = bondLogSig.address();

  // create escrow address for stablecoin
  const stcEscrowFile = fs.readFileSync(
    resolve('routes/algorand/teal/stablecoinEscrow.teal'), 'utf8');
  const stcEscrowProgram = stcEscrowFile.replace(
    escrowRep,
    function(matched){
      return mapReplace[matched];
    }
  );
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

  // update app
  mapReplace = {
    ...mapReplace,
    VAR_TMPL_STABLECOIN_ESCROW_ADDR: stcEscrowAddr,
    VAR_TMPL_BOND_ESCROW_ADDR: bondEscrowAddr
  }
  const updateAppRep = /VAR_TMPL_LV|VAR_TMPL_MAIN_APP_ID|VAR_TMPL_BOND_ID|VAR_TMPL_STABLECOIN_ID|VAR_TMPL_ISSUER_ADDR|VAR_TMPL_BOND_LENGTH|VAR_TMPL_START_BUY_DATE|VAR_TMPL_END_BUY_DATE|VAR_TMPL_MATURITY_DATE|VAR_TMPL_BOND_COST|VAR_TMPL_BOND_COUPON|VAR_TMPL_BOND_PRINCIPAL|VAR_TMPL_STABLECOIN_ESCROW_ADDR|VAR_TMPL_BOND_ESCROW_ADDR/g
  const updateAppFile = fs.readFileSync(
    resolve('routes/algorand/teal/greenBondApproval.teal'), 'utf8');
  const updateAppProgram = updateAppFile.replace(
    updateAppRep,
    function(matched){
      return mapReplace[matched];
    }
  );
  const updateApp = await compileProgram(updateAppProgram);
  updateStatefulContract(appId, account, updateApp, clear, params);

  // insert into apps table
  const newApp = await pool.query(
    "INSERT INTO apps(app_id, bond_id, bond_escrow_address, " + 
    "bond_escrow_program, stablecoin_escrow_address, stablecoin_escrow_program) " + 
    "VALUES($1, $2, $3, $4, $5, $6) RETURNING *",
    [appId, bondId, bondEscrowAddr, bondEscrowProgram, stcEscrowAddr, stcEscrowProgram]
  );

  return newApp.rows[0];
}
