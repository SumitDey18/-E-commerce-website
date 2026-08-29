const mongoose = require("mongoose");

async function connectDB() {
    const url = process.env.MONGO_URL || "mongodb://127.0.0.1:27017/shoppingDB";

    try {
        await mongoose.connect(url, {
            serverSelectionTimeoutMS: 5000
        });
        console.log("MongoDB Connected");
    } catch (error) {
        console.error("MongoDB Connection Error:", error.message);
        throw error;
    }
}

module.exports = connectDB;
