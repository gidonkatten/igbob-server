import algosdk from 'algosdk';
import { Router } from 'express';
import pool from "../db.js";
import { checkJwt } from "../middleware/auth.js";
import { generateTradeLsig } from "./algorand/trade/tradeBond.js";
import { getUserId } from '../utils/Utils.js';

const router = Router();

router.post("/generate-trade", checkJwt, async (req, res) => {
  try {
    const userId = getUserId(req);
    const { userAddress, mainAppId, bondId, price } = req.body;

    const contractAddress = generateTradeLsig(mainAppId)

    // insert into trades table
    await pool.query(
      "INSERT INTO trades(user_id, user_address, bond_id, expiry_round, price)" + 
      "VALUES($1, $2, $3, $4, $5) RETURNING *",
      [userAddress, userId, bondId, expiry, price]
    );

    res.json(contractAddress);
    
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
      "WHERE trade_id = $2 AND user_id = $3 RETURNING *" + 
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

    
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

router.get("/my-live-trades", checkJwt, async (req, res) => {
  try {
    const userId = getUserId(req);

    
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

router.get("/my-expired-trades", checkJwt, async (req, res) => {
  try {
    const userId = getUserId(req);

    
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

router.get("/live-trades", checkJwt, async (req, res) => {
  try {
    const apps = await pool.query(
      "SELECT * FROM apps"
    );

    res.json(apps.rows);
    
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

router.get("/expired-trades", checkJwt, async (req, res) => {
  try {
    const apps = await pool.query(
      "SELECT * FROM apps"
    );

    res.json(apps.rows);
    
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

router.get("/all-trades", checkJwt, async (req, res) => {
  try {
    const apps = await pool.query(
      "SELECT * FROM apps"
    );

    res.json(apps.rows);
    
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

export { router as tradeRoute }
