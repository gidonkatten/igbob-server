import algosdk from 'algosdk';
import { algodClient, STABLECOIN_ID } from '../utils/Utils.js';
import { compileProgram } from '../contracts/Utils.js';
import { compilePyTealWithParams } from '../../../utils/Utils.js';

/**
 * Generate trade lsig which can then be signed by bond holder
 */
export async function generateTradeLsig(
  mainAppId,
  bondId, 
  expiry, 
  price
) {
  // Calculate expiry round based on expiry time
  const { currentRound } = await algodClient.supply().do();
  const currentTime = Date.now() / 1000;
  const expiryRound = currentRound + ((expiry - currentTime) / 4.5);

  const args = {
    MAIN_APP_ID: mainAppId,
    BOND_ID: bondId,
    LV: expiryRound,
    STABLECOIN_ID: STABLECOIN_ID,
    TRADE_PRICE: price,
  }

  // create escrow address for bond
  const tradeTeal = compilePyTealWithParams('tradeLsig', args);
  const trade = await compileProgram(tradeTeal);
  const tradeLogSig = algosdk.makeLogicSig(trade);
  const tradeAddress = tradeLogSig.address();

  return tradeAddress;
}
