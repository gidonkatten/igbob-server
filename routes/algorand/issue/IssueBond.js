import algosdk from 'algosdk';
import pool from "../../../db.js";
import { algodClient, fundAccount, waitForConfirmation, STABLECOIN_ID } from '../utils/Utils.js';
import { configAsset, createAsset, optIntoAssetFromEscrow, revokeAsset } from '../assets/Asset.js';
import { createStatefulContract, updateStatefulContract } from '../contracts/Stateful.js';
import { compileProgram } from '../contracts/Utils.js';
import { compilePyTeal } from '../../../utils/Utils.js';

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
  financialRegulatorAddr,
  bondLength,
  startBuyDate,
  endBuyDate,
  maturityDate,
  bondCost,
  bondCoupon,
  bondPrincipal,
) {
  // Get node suggested parameters
  let params = await algodClient.getTransactionParams().do();
  params.fee = 1000;
  params.flatFee = true;
  const lv = params.lastRound + 500;

  // new algo account which will create bond + contract
  const account = algosdk.generateAccount();
  console.log("New account " + account.addr);

  // fund account with min balance needed
  const fundAccountTxId = await fundAccount(account.addr, 3000000, params);
  await waitForConfirmation(fundAccountTxId);
  console.log("Funded new account");

  // create bond (frozen)
  const bondId = await createAsset(account, totalIssuance, 6, true,
    bondUnitName, bondName, params);

  // create apps
  const appStateStorage = {
    localInts: 3,
    localBytes: 0,
    globalInts: 11,
    globalBytes: 6,
  }
  const enc = new TextEncoder();
  let appArgs = [
    algosdk.encodeUint64(startBuyDate),
    algosdk.encodeUint64(endBuyDate),
    algosdk.encodeUint64(maturityDate),
    algosdk.encodeUint64(bondId),
    algosdk.encodeUint64(bondCoupon),
    algosdk.encodeUint64(bondPrincipal),
    algosdk.encodeUint64(bondLength),
    algosdk.encodeUint64(bondCost),
    enc.encode(issuerAddr),
    enc.encode(financialRegulatorAddr),
    enc.encode(greenVerifierAddr),
  ];
  const initialApprovalTeal = compilePyTeal('initial');
  const clearTeal = compilePyTeal('clear');
  const initialApproval = await compileProgram(initialApprovalTeal);
  const clear = await compileProgram(clearTeal);
  const appId = await createStatefulContract(account, initialApproval, clear,
    appStateStorage, appArgs, 1, params);

  // create escrow address for bond
  const bondEscrowTeal = compilePyTeal('bondEscrow', appId, bondId, lv);
  const bondEscrow = await compileProgram(bondEscrowTeal);
  const bondLogSig = algosdk.makeLogicSig(bondEscrow)
  const bondEscrowAddr = bondLogSig.address();

  // create escrow address for stablecoin
  const stcEscrowTeal = compilePyTeal('stablecoinEscrow', appId, STABLECOIN_ID, lv);
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

  // update main
  appArgs = [
    enc.encode(stcEscrowAddr),
    enc.encode(bondEscrowAddr),
  ]
  const updateAppTeal = compilePyTeal('stateful');
  const updateApp = await compileProgram(updateAppTeal);
  updateStatefulContract(appId, account, updateApp, clear, appArgs, params);

  // insert into apps table
  const period = bondLength === 0 ?
    (maturityDate - endBuyDate) :
    Math.round((maturityDate - endBuyDate) / bondLength);
  const newApp = await pool.query(
    "INSERT INTO apps(" +
      "app_id, name, description, issuer_address, " +
      "green_verifier_address, financial_regulator_address, bond_id, " +
      "bond_escrow_address, bond_escrow_program, stablecoin_escrow_address, " +
      "stablecoin_escrow_program, bond_length, period, start_buy_date, " +
      "end_buy_date, maturity_date, bond_cost, bond_coupon, bond_principal" +
    ")" +
    "VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19) RETURNING *",
    [appId, name, description, issuerAddr, greenVerifierAddr,
      financialRegulatorAddr, bondId, bondEscrowAddr, bondEscrowTeal,
      stcEscrowAddr, stcEscrowTeal, bondLength, period, startBuyDate,
      endBuyDate, maturityDate, bondCost, bondCoupon, bondPrincipal]
  );

  return newApp.rows[0];
}
