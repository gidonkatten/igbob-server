import { Router } from 'express';
import pool from "../db.js";
import { checkJwt } from "../middleware/auth.js";
import { issueBond } from "./algorand/issue/IssueBond.js";

const router = Router();

router.post("/create-app", checkJwt, async (req, res) => {
  try {
    const { 
      name, description, bondName, bondUnitName, totalIssuance, issuerAddr, 
      bondLength, startBuyDate, endBuyDate, bondCost, bondCoupon, bondPrincipal
    } = req.body;

    issueBond(name, description, bondName, bondUnitName, totalIssuance, 
      issuerAddr, bondLength, startBuyDate, endBuyDate, bondCost, bondCoupon, 
      bondPrincipal);

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

export { router as appsRoute }
