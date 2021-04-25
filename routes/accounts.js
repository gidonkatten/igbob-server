import { Router } from 'express';
import pool from "../db.js";
import { checkJwt } from "../middleware/auth.js";
import { getUserId } from '../utils/Utils.js';

const router = Router();

router.get("/get-addresses", checkJwt, async (req, res) => {
  try {
    const userId = getUserId(req);

    // update addresses in users table
    const user = await pool.query(
      "SELECT user_id, addresses FROM users " + 
      "WHERE user_id = $1",
      [userId]
    );

    res.json(user.rows[0]);
    
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

router.post("/addresses", checkJwt, async (req, res) => {
  try {
    const { addresses } = req.body;
    const userId = getUserId(req);

    // update addresses in users table
    const user = await pool.query(
      "UPDATE users SET addresses = $1 " + 
      "WHERE user_id = $2 RETURNING *",
      [addresses, userId]
    );

    res.json(user.rows[0]);
    
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

export { router as accountsRoute }
