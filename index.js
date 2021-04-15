const express = require('express');
const app = express();
const cors = require("cors");

app.use(cors());
app.use(express.json()); //req.body

// ROUTES //

// apps routes
app.use("/apps", require("./routes/apps"));

app.get('/approval_program', function(req, res) {
  res.sendFile('./teal/approval_program.teal', { root: __dirname });
});

app.get('/clear_program', function(req, res) {
  res.sendFile('./teal/clear.teal', { root: __dirname });
});

const PORT = process.env.PORT || 5000; // use either the host env var port (PORT) provided by Heroku or the local port (9000) on your machine
app.listen(PORT, () => {
  console.log("Server has started on port", PORT)
});