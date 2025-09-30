// Application configuration
module.exports = {
  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || "supersecretkey", // Use environment variable in production
    expiresIn: process.env.JWT_EXPIRES_IN || "1h"
  },
  
  // Server Configuration
  server: {
    port: process.env.PORT || 4001,
    host: process.env.HOST || '0.0.0.0'
  },
  
  // Security Configuration
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 10
  }
};
