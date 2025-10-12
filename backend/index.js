// Load environment variables first
require('dotenv').config();

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const config = require("./config/config");

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' })); // Add size limit for file uploads
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Route handlers
const supabaseAuthRoutes = require("./routes/supabase-auth");
const reportsRoutes = require("./routes/reports");
const usersRoutes = require("./routes/users");
const sessionsRoutes = require("./routes/sessions");
const adminRoutes = require("./routes/admin");

app.use("/api/supabase-auth", supabaseAuthRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/sessions", sessionsRoutes);
app.use("/api/admin", adminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = config.server.port;
const HOST = config.server.host;

app.listen(PORT, HOST, () => {
  console.log(`✅ Server running on ${HOST}:${PORT}`);
  if (HOST === '0.0.0.0') {
    console.log(`   Access via http://localhost:${PORT} or your local IP`);
  }
});
