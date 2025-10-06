// Load environment variables first
require('dotenv').config();

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const config = require("./config/config");

const app = express();
  

// middleware
app.use(cors());
app.use(bodyParser.json());

const authRoutes = require("./routes/auth");
const supabaseAuthRoutes = require("./routes/supabase-auth");
const reportsRoutes = require("./routes/reports");
const usersRoutes = require("./routes/users");
const sessionsRoutes = require("./routes/sessions");
const adminRoutes = require("./routes/admin");

app.use("/api/auth", authRoutes);
app.use("/api/supabase-auth", supabaseAuthRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/sessions", sessionsRoutes);
app.use("/api/admin", adminRoutes);



app.listen(config.server.port, config.server.host, () => {
  console.log(`✅ Server running at http://localhost:${config.server.port}`);
  console.log(`✅ Server also accessible at http://192.168.18.57:${config.server.port}`);
});
