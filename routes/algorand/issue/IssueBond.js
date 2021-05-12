import algosdk from 'algosdk';
import fs from 'fs';
import { resolve } from 'path';
import pool from "../../../db.js";
import { algodClient, fundAccount, waitForConfirmation, STABLECOIN_ID } from '../utils/Utils.js';
import { configAsset, createAsset, optIntoAssetFromEscrow, revokeAsset } from '../assets/Asset.js';
import { createStatefulContract, updateStatefulContract } from '../contracts/Stateful.js';
import { compileProgram } from '../contracts/Utils.js';

/**
 * Issue bond
 */
export async function issueBond(
  name,
  description,
  bondName,
  bondUnitName,
  totalIssuance,
  issuerAddr,
  greenVerifierAddr,
  bondLength,
  period,
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
  const fundAccountTxId = await fundAccount(account.addr, 3000000, params);
  await waitForConfirmation(fundAccountTxId);
  console.log("Funded new account");

  // create bond (frozen)
  const bondId = await createAsset(account, totalIssuance, 0, true,
    bondUnitName, bondName, params);

  // create apps
  const mainAppStateStorage = {
    localInts: 1,
    localBytes: 0,
    globalInts: 1,
    globalBytes: 0,
  }
  const manageAppStateStorage = {
    localInts: 0,
    localBytes: 0,
    globalInts: 0,
    globalBytes: 0,
  }
  const appArgs = [];
  const initialApprovalProgram = fs.readFileSync(
    resolve('routes/algorand/teal/initialStateful.teal'), 'utf8')
  const clearProgram = fs.readFileSync(
    resolve('routes/algorand/teal/greenBondClear.teal'), 'utf8');
  const initialApproval = await compileProgram(initialApprovalProgram);
  const clear = await compileProgram(clearProgram);
  const mainAppId = await createStatefulContract(account, initialApproval, clear, 
    mainAppStateStorage, appArgs, params);
  const manageAppId = await createStatefulContract(account, initialApproval, clear, 
    manageAppStateStorage, appArgs, params);

  // Used to construct contracts
  const maturityDate = endBuyDate + (period * bondLength);
  let mapReplace = {
    TMPL_LV: params.lastRound + 500,
    TMPL_MAIN_APP_ID: mainAppId,
    TMPL_MANAGE_APP_ID: manageAppId,
    TMPL_BOND_ID: bondId,
    TMPL_STABLECOIN_ID: STABLECOIN_ID,
    TMPL_ISSUER_ADDR: issuerAddr,
    TMPL_GREEN_VERIFIER_ADDR: greenVerifierAddr,
    TMPL_BOND_LENGTH: bondLength,
    TMPL_PERIOD: period,
    TMPL_START_BUY_DATE: startBuyDate,
    TMPL_END_BUY_DATE: endBuyDate,
    TMPL_MATURITY_DATE: maturityDate,
    TMPL_BOND_COST: bondCost,
    TMPL_BOND_COUPON: bondCoupon,
    TMPL_BOND_PRINCIPAL: bondPrincipal
  }
  const escrowRep = /TMPL_LV|TMPL_MAIN_APP_ID|TMPL_MANAGE_APP_ID|TMPL_BOND_ID|TMPL_STABLECOIN_ID|TMPL_ISSUER_ADDR|TMPL_BOND_LENGTH|TMPL_PERIOD|TMPL_START_BUY_DATE|TMPL_END_BUY_DATE|TMPL_MATURITY_DATE|TMPL_BOND_COST|TMPL_BOND_COUPON|TMPL_BOND_PRINCIPAL/g

  // create escrow address for bond
  const bondEscrowFile = fs.readFileSync(
    resolve('routes/algorand/teal/bondEscrow.teal'), 'utf8');
  const bondEscrowProgram = bondEscrowFile.replace(
    escrowRep,
    function(matched) {
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
    function(matched) {
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

  // update apps
  mapReplace = {
    ...mapReplace,
    TMPL_STABLECOIN_ESCROW_ADDR: stcEscrowAddr,
    TMPL_BOND_ESCROW_ADDR: bondEscrowAddr
  }
  const updateAppRep = /TMPL_LV|TMPL_MAIN_APP_ID|TMPL_MANAGE_APP_ID|TMPL_BOND_ID|TMPL_STABLECOIN_ID|TMPL_ISSUER_ADDR|TMPL_GREEN_VERIFIER_ADDR|TMPL_BOND_LENGTH|TMPL_PERIOD|TMPL_START_BUY_DATE|TMPL_END_BUY_DATE|TMPL_MATURITY_DATE|TMPL_BOND_COST|TMPL_BOND_COUPON|TMPL_BOND_PRINCIPAL|TMPL_STABLECOIN_ESCROW_ADDR|TMPL_BOND_ESCROW_ADDR/g
  
  // update main
  const updateMainAppFile = fs.readFileSync(
    resolve('routes/algorand/teal/greenBondApproval.teal'), 'utf8');
  const updateMainAppProgram = updateMainAppFile.replace(
    updateAppRep,
    function(matched) {
      return mapReplace[matched];
    }
  );
  const updateMainApp = await compileProgram(updateMainAppProgram);
  updateStatefulContract(mainAppId, account, updateMainApp, clear, params);

  // update manage
  const updateManageAppFile = fs.readFileSync(
    resolve('routes/algorand/teal/manageGreenBondApproval.teal'), 'utf8');
  const updateManageAppProgram = updateManageAppFile.replace(
    updateAppRep,
    function(matched) {
      return mapReplace[matched];
    }
  );
  const updateManageApp = await compileProgram(updateManageAppProgram);
  updateStatefulContract(manageAppId, account, updateManageApp, clear, params);

  // insert into apps table
  const newApp = await pool.query(
    "INSERT INTO apps(" + 
      "app_id, manage_app_id, name, description, issuer_address, " + 
      "green_verifier_address, bond_id, bond_escrow_address, " + 
      "bond_escrow_program, stablecoin_escrow_address, " + 
      "stablecoin_escrow_program, bond_length, period, start_buy_date, " + 
      "end_buy_date, maturity_date, bond_cost, bond_coupon, bond_principal" + 
    ")" + 
    "VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19) RETURNING *",
    [mainAppId, manageAppId, name, description, issuerAddr, greenVerifierAddr, 
      bondId, bondEscrowAddr, bondEscrowProgram, stcEscrowAddr, 
      stcEscrowProgram, bondLength, period, startBuyDate, endBuyDate, 
      maturityDate, bondCost, bondCoupon, bondPrincipal]
  );

  return newApp.rows[0];
}
