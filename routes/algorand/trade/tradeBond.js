import { algodClient, STABLECOIN_ID } from '../utils/Utils.js';
import { compileProgram } from '../contracts/Utils.js';
import { compilePyTealWithParams } from '../../../utils/Utils.js';

/**
 * Calculate expiry round based on expiry time
 */
export async function calculateExpiryRound(expiry) {
  const supply = await algodClient.supply().do();
  const currentTime = Date.now() / 1000;
  return Math.floor(supply.current_round + ((expiry - currentTime) / 4.4));
}

/**
 * Generate trade teal to use for delegated signature
 */
export async function generateTrade(
  mainAppId,
  bondId, 
  expiryRound, 
  price
) {
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
  return {
    lsigProgram: tradeTeal,
    lsig: trade
  };
}
