const Pool = require("pg").Pool;
require("dotenv").config(); // allows us to access env variables

const pool = new Pool({
    user: process.env.user,
    password: process.env.password,
    host: process.env.host,
    port: process.env.port,
    database: process.env.database,
    ssl: true
})

module.exports = pool;