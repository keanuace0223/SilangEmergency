const { Pool } = require("pg");

// Database configuration
const dbConfig = {
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "SilangEmergency",
  password: process.env.DB_PASSWORD || "kenpogi0223",
  port: process.env.DB_PORT || 5432,
};

// Create and export the connection pool
const pool = new Pool(dbConfig);

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = pool;
