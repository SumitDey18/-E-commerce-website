require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const seedDemoProducts = require("./services/demoSeed");

(async () => {
  try {
    await connectDB();
    await seedDemoProducts();
  } catch (error) {
    console.error("SEED ERROR:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
})();
