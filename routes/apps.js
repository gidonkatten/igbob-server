import { Router } from 'express';
import pool from "../db.js";
import { checkJwt } from "../middleware/auth.js";
import { issueBond } from "./algorand/issue/IssueBond.js";

const router = Router();

router.post("/create-app", checkJwt, async (req, res) => {
  try {
    const {
      name, description, bondName, bondUnitName, totalIssuance, issuerAddr,
      greenVerifierAddr, financialRegulatorAddr, bondLength, startBuyDate,
      endBuyDate, maturityDate, bondCost, bondCoupon, bondPrincipal
    } = req.body;

    const currentTime = Date.now() / 1000;

    if(!(
      currentTime < startBuyDate &&
      startBuyDate < endBuyDate &&
      endBuyDate < maturityDate
      )) {
      res.status(400).send("Invalid timings");
      return;
    }

    issueBond(name, description, bondName, bondUnitName, totalIssuance,
      issuerAddr, greenVerifierAddr, financialRegulatorAddr, bondLength,
      startBuyDate, endBuyDate, maturityDate, bondCost, bondCoupon, bondPrincipal);

    res.json('Submitted issue request');

  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

router.get("/app/:app_id", async (req, res) => {
  try {
    const { app_id } = req.params;
    const apps = await pool.query(
      "SELECT * FROM apps WHERE app_id = $1",
      [app_id]
    );

    if (apps.rows.length === 0) res.status(400).send('Cannot find app');
    else res.json(apps.rows[0]);

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


router.get("/financial-regulator-apps/:address", checkJwt, async (req, res) => {
  try {
    const { address } = req.params;

    const apps = await pool.query(
      "SELECT * FROM apps " +
      "WHERE financial_regulator_address = $1",
      [address]
    );

    res.json(apps.rows);

  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

export { router as appsRoute }
