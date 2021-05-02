import { Router } from 'express';
import { checkJwt } from "../middleware/auth.js";
import { fundAccountWithStablecoin } from './algorand/utils/Utils.js';

const router = Router();

router.post("/", checkJwt, async (req, res) => {
  try {
    const { addr } = req.body;

    const txId = await fundAccountWithStablecoin(addr, 1000e6)

    res.json({ txId });
    
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});


export { router as fundRoute }
