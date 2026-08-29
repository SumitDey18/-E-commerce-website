require("dotenv").config();

const express = require("express");
const session = require("express-session");
const path = require("path");
const connectDB = require("./config/db");
const seedDemoProducts = require("./services/demoSeed");

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use(session({
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24
    }
}));

app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

app.use("/customer", require("./routes/Customer"));
app.use("/host", require("./routes/Host"));
app.use("/admin", require("./routes/Admin"));

app.get("/", (req, res) => res.render("home"));

app.use((req, res) => {
    res.status(404).render("404");
});

app.use((err, req, res, next) => {
    console.error("SERVER ERROR:", err);
    res.status(500).render("error", {
        error: err.message || "Something went wrong"
    });
});

async function start() {
    try {
        await connectDB();
        await seedDemoProducts();
        app.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("Server was not started because MongoDB is not connected.");
        process.exit(1);
    }
}

start();
