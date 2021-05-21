import { Router } from 'express';
import pool from "../db.js";
import { checkJwt } from "../middleware/auth.js";
import { issueBond } from "./algorand/issue/IssueBond.js";
import { spawnSync } from "child_process"
import YAML from 'yaml'

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

router.get("/test", async (req, res) => {
  try {

    const pythonProcess = spawnSync(
      'python3', 
      [
        "routes/algorand/teal/test.py",
        YAML.stringify({
          ARG_INT: 3
        })
      ]
    );
    if (pythonProcess.stderr) console.log(pythonProcess.stderr.toString());
    console.log(pythonProcess.stdout.toString());
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

export { router as appsRoute }
