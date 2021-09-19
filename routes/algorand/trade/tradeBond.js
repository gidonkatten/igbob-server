import { algodClient, STABLECOIN_ID } from '../utils/Utils.js';
import { compileProgram } from '../contracts/Utils.js';
import { compilePyTeal } from '../../../utils/Utils.js';

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
  appId,
  bondId,
  expiryRound,
  price
) {
  // create escrow address for bond
  const tradeTeal = compilePyTeal('tradeLsig', appId, STABLECOIN_ID, bondId, expiryRound, price);
  const trade = await compileProgram(tradeTeal);
  return {
    lsigProgram: tradeTeal,
    lsig: trade
  };
}
