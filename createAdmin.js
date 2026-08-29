require("dotenv").config();
const readline = require("readline");
const bcrypt = require("bcryptjs");
const connectDB = require("./config/db");
const User = require("./models/User");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function ask(question) {
    return new Promise(resolve => rl.question(question, resolve));
}

async function main() {
    try {
        await connectDB();

        const name = await ask("Admin name: ");
        const email = (await ask("Admin email: ")).trim().toLowerCase();
        const password = await ask("Admin password: ");

        if (!name || !email || !password) {
            throw new Error("Name, email and password are required.");
        }

        const hash = await bcrypt.hash(password, 10);
        const existing = await User.findOne({ email });

        if (existing) {
            existing.name = name;
            existing.password = hash;
            existing.role = "admin";
            existing.isVerified = true;
            existing.otp = undefined;
            existing.otpExpires = undefined;
            await existing.save();
            console.log("Existing user is now ADMIN and VERIFIED.");
        } else {
            await User.create({
                name,
                email,
                password: hash,
                role: "admin",
                isVerified: true
            });
            console.log("Admin created successfully.");
        }

        console.log("Login: http://localhost:3000/customer/login");
    } catch (error) {
        console.error("CREATE ADMIN ERROR:", error.message);
    } finally {
        rl.close();
        process.exit();
    }
}

main();
