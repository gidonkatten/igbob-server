import express from 'express';
import cors from "cors";
import { appsRoute } from "./routes/apps.js"
import { accountsRoute } from "./routes/accounts.js"
import { fundRoute } from "./routes/fund.js"

const app = express();
app.use(cors());
app.use(express.json()); //req.body

// ROUTES //

// apps routes
app.use("/apps", appsRoute);
app.use("/accounts", accountsRoute);
app.use("/fund", fundRoute)

const PORT = process.env.PORT || 5000; // use either the host env var port (PORT) provided by Heroku or the local port (9000) on your machine
app.listen(PORT, () => {
  console.log("Server has started on port", PORT)
});
