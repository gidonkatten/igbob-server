import { Router } from 'express';
import pool from "../db.js";
import { checkJwt } from "../middleware/auth.js";
import { calculateExpiryRound, generateTrade } from "./algorand/trade/tradeBond.js";
import { getUserId } from '../utils/Utils.js';

const router = Router();

router.post("/generate-trade", checkJwt, async (req, res) => {
  try {
    const userId = getUserId(req);
    const { userAddress, mainAppId, bondId, expiry, price } = req.body;

    const expiryRound = await calculateExpiryRound(expiry);

    const program = await generateTrade(
      mainAppId, bondId, expiryRound, price
    );

    // insert into trades table
    const newTrade = await pool.query(
      "INSERT INTO trades(user_id, seller_address, bond_id, expiry_date, expiry_round, price)" + 
      "VALUES($1, $2, $3, $4, $5) RETURNING *",
      [userId, userAddress, bondId, expiry, expiryRound, price]
    );

    res.json({
      tradeId: newTrade.rows[0].trade_id,
      program,
    });
    
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

router.post("/add-trade-lsig", checkJwt, async (req, res) => {
  try {
    const userId = getUserId(req);
    const { tradeId, lsig } = req.body;

    // insert into trades table
     const trade = await pool.query(
      "UPDATE trades SET lsig = $1 " + 
      "WHERE trade_id = $2 AND user_id = $3 RETURNING *",
      [lsig, tradeId, userId]
    );

    res.json(trade.rows[0]);
    
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

router.get("/my-all-trades", checkJwt, async (req, res) => {
  try {
    const userId = getUserId(req);

    const trades = await pool.query(
      "SELECT trade_id, app_id, bond_id, bond_escrow_address, " + 
      "bond_escrow_program, name, expiry, expiry_round, price, seller_address" + 
      "lsig, bond_length, maturity_date, bond_coupon, bond_principal " + 
      "FROM trades NATURAL JOIN apps " + 
      "WHERE user_id = $2",
      [userId]
    );

    res.json(trades.rows);

  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

router.get("/my-live-trades", checkJwt, async (req, res) => {
  try {
    const userId = getUserId(req);
    const currentTime = parseInt(Date.now() / 1000);

    const trades = await pool.query(
      "SELECT trade_id, app_id, bond_id, bond_escrow_address, " + 
      "bond_escrow_program, name, expiry, expiry_round, price, seller_address" + 
      "lsig, bond_length, maturity_date, bond_coupon, bond_principal " + 
      "FROM trades NATURAL JOIN apps " + 
      "WHERE expiry < $1 AND user_id = $2",
      [currentTime, userId]
    );

    res.json(trades.rows);
    
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

router.get("/my-expired-trades", checkJwt, async (req, res) => {
  try {
    const userId = getUserId(req);
    const currentTime = parseInt(Date.now() / 1000);

    const trades = await pool.query(
      "SELECT trade_id, app_id, bond_id, bond_escrow_address, " + 
      "bond_escrow_program, name, expiry, expiry_round, price, seller_address" + 
      "lsig, bond_length, maturity_date, bond_coupon, bond_principal " +  
      "FROM trades NATURAL JOIN apps " + 
      "WHERE expiry >= $1 AND user_id = $2",
      [currentTime, userId]
    );

    res.json(trades.rows);

  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

router.get("/all-trades", checkJwt, async (req, res) => {
  try {
    const trades = await pool.query(
      "SELECT trade_id, app_id, bond_id, bond_escrow_address, " + 
      "bond_escrow_program, name, expiry, expiry_round, price, seller_address" + 
      "lsig, bond_length, maturity_date, bond_coupon, bond_principal " + 
      "FROM trades NATURAL JOIN apps"
    );

    res.json(trades.rows);
    
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

router.get("/live-trades", checkJwt, async (req, res) => {
  try {
    const currentTime = parseInt(Date.now() / 1000);

    const trades = await pool.query(
      "SELECT trade_id, app_id, bond_id, bond_escrow_address, " + 
      "bond_escrow_program, name, expiry, expiry_round, price, seller_address" + 
      "lsig, bond_length, maturity_date, bond_coupon, bond_principal " + 
      "FROM trades NATURAL JOIN apps " + 
      "WHERE expiry > $1",
      [currentTime]
    );

  res.json(trades.rows);
    
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

router.get("/expired-trades", checkJwt, async (req, res) => {
  try {
    const currentTime = parseInt(Date.now() / 1000);

    const trades = await pool.query(
      "SELECT trade_id, app_id, bond_id, bond_escrow_address, " + 
      "bond_escrow_program, name, expiry, expiry_round, price, seller_address" + 
      "lsig, bond_length, maturity_date, bond_coupon, bond_principal " + 
      "FROM trades NATURAL JOIN apps " + 
      "WHERE expiry >= $1",
      [currentTime]
    );

    res.json(trades.rows);
    
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

export { router as tradeRoute }
