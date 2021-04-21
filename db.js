import pg from 'pg';
import { config } from 'dotenv'

config(); // allows us to access env variables

export default new pg.Pool({
    user: process.env.user,
    password: process.env.password,
    host: process.env.host,
    port: (process.env.port),
    database: process.env.database,
    ssl: true
})
