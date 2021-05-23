import algosdk from 'algosdk';
import fs from 'fs';
import { resolve } from 'path';
import pool from "../../../db.js";
import { algodClient, fundAccount, waitForConfirmation, STABLECOIN_ID } from '../utils/Utils.js';
import { configAsset, createAsset, optIntoAssetFromEscrow, revokeAsset } from '../assets/Asset.js';
import { createStatefulContract, updateStatefulContract } from '../contracts/Stateful.js';
import { compileProgram } from '../contracts/Utils.js';
import { compilePyTeal, compilePyTealWithParams } from '../../../utils/Utils.js';

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
    localInts: 1, // CouponsPayed
    localBytes: 0,
    globalInts: 3, // BondsSold, CouponsPayed, Reserve
    globalBytes: 0,
  }
  const manageAppStateStorage = {
    localInts: 0,
    localBytes: 0,
    globalInts: 0,
    globalBytes: Math.ceil((bondLength + 1) / 8), // <rating-array>
  }
  const appArgs = [];
  const initialApprovalTeal = compilePyTeal('initialStateful');
  const clearTeal = compilePyTeal('clearStateful');
  const initialApproval = await compileProgram(initialApprovalTeal);
  const clear = await compileProgram(clearTeal);
  const mainAppId = await createStatefulContract(account, initialApproval, clear, 
    mainAppStateStorage, appArgs, params);
  const manageAppId = await createStatefulContract(account, initialApproval, clear, 
    manageAppStateStorage, appArgs, params);

  // Used to construct contracts
  const maturityDate = endBuyDate + (period * bondLength);
  let args = {
    LV: params.lastRound + 500,
    MAIN_APP_ID: mainAppId,
    MANAGE_APP_ID: manageAppId,
    BOND_ID: bondId,
    STABLECOIN_ID: STABLECOIN_ID,
    ISSUER_ADDR: issuerAddr,
    GREEN_VERIFIER_ADDR: greenVerifierAddr,
    BOND_LENGTH: bondLength,
    PERIOD: period,
    START_BUY_DATE: startBuyDate,
    END_BUY_DATE: endBuyDate,
    MATURITY_DATE: maturityDate,
    BOND_COST: bondCost,
    BOND_COUPON: bondCoupon,
    BOND_PRINCIPAL: bondPrincipal
  }

  // create escrow address for bond
  const bondEscrowTeal = compilePyTealWithParams('bondEscrow', args);
  const bondEscrow = await compileProgram(bondEscrowTeal);
  const bondLogSig = algosdk.makeLogicSig(bondEscrow)
  const bondEscrowAddr = bondLogSig.address();

  // create escrow address for stablecoin
  const stcEscrowTeal = compilePyTealWithParams('stablecoinEscrow', args);
  const stcEscrow = await compileProgram(stcEscrowTeal);
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
  args = {
    ...args,
    STABLECOIN_ESCROW_ADDR: stcEscrowAddr,
    BOND_ESCROW_ADDR: bondEscrowAddr
  }
  
  // update main
  const updateMainAppTeal = compilePyTealWithParams('greenBondApproval', args);
  const updateMainApp = await compileProgram(updateMainAppTeal);
  updateStatefulContract(mainAppId, account, updateMainApp, clear, params);

  // update manage
  const updateManageAppTeal = compilePyTealWithParams('manageGreenBondApproval', args);
  const updateManageApp = await compileProgram(updateManageAppTeal);
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
      bondId, bondEscrowAddr, bondEscrowTeal, stcEscrowAddr, 
      stcEscrowTeal, bondLength, period, startBuyDate, endBuyDate, 
      maturityDate, bondCost, bondCoupon, bondPrincipal]
  );

  return newApp.rows[0];
}
