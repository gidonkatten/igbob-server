import { Router } from 'express';
import pool from "../db.js";
import { checkJwt, checkIssueScope } from "../middleware/auth.js";
import { issueBond } from "./algorand/issue/IssueBond.js";

const router = Router();

router.post("/create-app", checkJwt, checkIssueScope, async (req, res) => {
  try {
    const { 
      totalIssuance, bondUnitName, bondName, issuerAddr, startBuyDate, 
      endBuyDate, maturityDate, bondCost, bondCouponPaymentVal, 
      bondCouponInstallments, bondPrincipal
    } = req.body;

    const newApp = await issueBond(totalIssuance, bondUnitName, bondName, 
      issuerAddr, startBuyDate, endBuyDate, maturityDate, bondCost, 
      bondCouponPaymentVal, bondCouponInstallments, bondPrincipal);

    res.json(newApp);
    
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

router.get("/all-apps", checkJwt, checkIssueScope, async (req, res) => {
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

export { router as appRoute }
