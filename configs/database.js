const { Pool } = require('pg')
const dotenv = require("dotenv");
dotenv.config()

// psql Database credentials
const credentials = {
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT,
};

const client = new Pool(credentials);

module.exports = client;