import { Router } from 'express';
import pool from "../db.js";
import { checkJwt } from "../middleware/auth.js";
import { issueBond } from "./algorand/issue/IssueBond.js";

const router = Router();

router.post("/create-app", checkJwt, async (req, res) => {
  try {
    const { 
      name, description, bondName, bondUnitName, totalIssuance, issuerAddr, 
      greenVerifierAddr, bondLength, period, startBuyDate, endBuyDate, 
      bondCost, bondCoupon, bondPrincipal
    } = req.body;

    issueBond(name, description, bondName, bondUnitName, totalIssuance, 
      issuerAddr, greenVerifierAddr, bondLength, period, startBuyDate, 
      endBuyDate, bondCost, bondCoupon, bondPrincipal);

    res.json('Submitted issue request');
    
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

router.get("/all-apps", checkJwt, async (req, res) => {
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

router.get("/upcoming-apps", checkJwt, async (req, res) => {
  try {
    const currentTime = parseInt(Date.now() / 1000);

    const apps = await pool.query(
      "SELECT * FROM apps " + 
      "WHERE start_buy_date > $1",
      [currentTime]
    );

    res.json(apps.rows);
    
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

router.get("/sale-apps", checkJwt, async (req, res) => {
  try {
    const currentTime = parseInt(Date.now() / 1000);

    const apps = await pool.query(
      "SELECT * FROM apps " + 
      "WHERE start_buy_date <= $1 AND end_buy_date >= $1",
      [currentTime]
    );

    res.json(apps.rows);
    
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

router.get("/live-apps", checkJwt, async (req, res) => {
  try {
    const currentTime = parseInt(Date.now() / 1000);

    const apps = await pool.query(
      "SELECT * FROM apps " + 
      "WHERE end_buy_date < $1 AND maturity_date > $1",
      [currentTime]
    );

    res.json(apps.rows);
    
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

router.get("/expired-apps", checkJwt, async (req, res) => {
  try {
    const currentTime = parseInt(Date.now() / 1000);

    const apps = await pool.query(
      "SELECT * FROM apps " + 
      "WHERE maturity_date <= $1",
      [currentTime]
    );

    res.json(apps.rows);
    
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});


router.get("/issuer-apps/:address", checkJwt, async (req, res) => {
  try {
    const { address } = req.params;

    const apps = await pool.query(
      "SELECT * FROM apps " + 
      "WHERE issuer_address = $1",
      [address]
    );

    res.json(apps.rows);
    
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

router.get("/green-verifier-apps/:address", checkJwt, async (req, res) => {
  try {
    const { address } = req.params;

    const apps = await pool.query(
      "SELECT * FROM apps " + 
      "WHERE green_verifier_address = $1",
      [address]
    );

    res.json(apps.rows);
    
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

export { router as appsRoute }
