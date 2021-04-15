const router = require("express").Router();
const pool = require("../db");
const auth = require("../middleware/auth");

router.post("/create-app", auth, async (req, res) => {
  try {
    const { app_id } = req.body;

    const newApp = await pool.query(
      "INSERT INTO apps(app_id) " + 
      "VALUES($1) RETURNING *",
      [app_id]
    );

    res.json(newApp.rows[0]);
    
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

router.get("/all-apps", auth, async (req, res) => {
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

module.exports = router;