const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
const PORT = 4001;

const pool = new Pool({
    user: "postgres", // default user
    host: "localhost", // or 127.0.0.1
    database: "SilangEmergency", // name ng DB mo
    password: "kenpogi0223", // ito dapat match sa pgAdmin password
    port: 5432,
  });
  

// middleware
app.use(cors());
app.use(bodyParser.json());

const authRoutes = require("./routes/auth");
const reportsRoutes = require("./routes/reports");

app.use("/api/auth", authRoutes);
app.use("/api/reports", reportsRoutes);



app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
  console.log(`✅ Server also accessible at http://192.168.18.57:${PORT}`);
});
