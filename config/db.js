const mysql = require('mysql2');
require('dotenv').config(); // Load environment variables

// Create a connection pool (better for handling multiple requests)
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test database connection
pool.getConnection((err, connection) => {
  if (err) {
    console.error('Database connection failed:', err);
  } else {
    console.log('✅ Connected to MySQL database');
    connection.release();
  }
});

// Export promise-based pool for async queries
module.exports = pool.promise();
