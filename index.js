import express from 'express';
import cors from "cors";
import { appRoute } from "./routes/apps.js"

const app = express();
// const corsOptions =  {
//   origin: 'http://localhost:3000'
// };
// app.use(cors(corsOptions));
app.use(cors());
app.use(express.json()); //req.body

// ROUTES //

// apps routes
app.use("/apps", appRoute);

const PORT = process.env.PORT || 5000; // use either the host env var port (PORT) provided by Heroku or the local port (9000) on your machine
app.listen(PORT, () => {
  console.log("Server has started on port", PORT)
});
