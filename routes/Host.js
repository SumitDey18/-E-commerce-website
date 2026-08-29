const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const Product = require("../models/Product");

const CATEGORIES = ["Electronics", "Clothing", "Shoes", "Books", "Home", "Accessories", "Beauty", "Sports", "Other"];
const { requireRole } = require("../middleware/auth");

const uploadFolder = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadFolder)) fs.mkdirSync(uploadFolder, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadFolder),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${Date.now()}-${Math.round(Math.random() * 1000000)}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
        if (allowed.includes(file.mimetype)) return cb(null, true);
        cb(new Error("Only JPG, JPEG, PNG and WEBP images are allowed."));
    }
});

const canManageProducts = requireRole("host", "admin");

router.get("/", canManageProducts, (req, res) => {
    res.render("host/dashboard", { user: req.currentUser });
});

router.get("/upload", canManageProducts, (req, res) => {
    res.render("host/upload", { categories: CATEGORIES });
});

router.post("/upload", canManageProducts, upload.single("image"), async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).send("Product image is required.");

        const price = Number(req.body.price);
        const quantity = Number(req.body.quantity);

        if (!req.body.name || !Number.isFinite(price) || price < 0 ||
            !Number.isInteger(quantity) || quantity < 0) {
            fs.unlinkSync(req.file.path);
            return res.status(400).send("Invalid product data.");
        }

        await Product.create({
            name: req.body.name.trim(),
            price,
            category: CATEGORIES.includes(req.body.category) ? req.body.category : "Other",
            description: req.body.description || "",
            quantity,
            image: "/uploads/" + req.file.filename,
            owner: req.currentUser._id
        });

        res.redirect(req.currentUser.role === "admin" ? "/admin" : "/host/products");
    } catch (error) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        next(error);
    }
});

router.get("/products", canManageProducts, async (req, res, next) => {
    try {
        const products = req.currentUser.role === "admin"
            ? await Product.find().populate("owner", "name role").sort({ createdAt: -1 })
            : await Product.find({ owner: req.currentUser._id }).sort({ createdAt: -1 });

        res.render("host/products", {
            user: req.currentUser,
            products
        });
    } catch (error) {
        next(error);
    }
});

router.get("/products/:id/update", canManageProducts, async (req, res, next) => {
    try {
        const filter = req.currentUser.role === "admin"
            ? { _id: req.params.id }
            : { _id: req.params.id, owner: req.currentUser._id };

        const product = await Product.findOne(filter);
        if (!product) return res.status(403).send("Product not found or access denied.");

        res.render("host/update", { product, categories: CATEGORIES });
    } catch (error) {
        next(error);
    }
});

router.post("/products/:id/update", canManageProducts, async (req, res, next) => {
    try {
        const filter = req.currentUser.role === "admin"
            ? { _id: req.params.id }
            : { _id: req.params.id, owner: req.currentUser._id };

        const product = await Product.findOne(filter);
        if (!product) return res.status(403).send("Product not found or access denied.");

        const price = Number(req.body.price);
        const quantity = Number(req.body.quantity);
        if (!req.body.name || !Number.isFinite(price) || price < 0 ||
            !Number.isInteger(quantity) || quantity < 0) {
            return res.status(400).send("Invalid product data.");
        }

        product.name = req.body.name.trim();
        product.price = price;
        product.category = CATEGORIES.includes(req.body.category) ? req.body.category : "Other";
        product.description = req.body.description || "";
        product.quantity = quantity;
        await product.save();

        res.redirect("/host/products");
    } catch (error) {
        next(error);
    }
});

router.post("/products/:id/delete", canManageProducts, async (req, res, next) => {
    try {
        const filter = req.currentUser.role === "admin"
            ? { _id: req.params.id }
            : { _id: req.params.id, owner: req.currentUser._id };

        const product = await Product.findOne(filter);
        if (!product) return res.status(403).send("Product not found or access denied.");

        if (product.image) {
            const imageName = path.basename(product.image);
            const imageFile = path.join(uploadFolder, imageName);
            if (fs.existsSync(imageFile)) fs.unlinkSync(imageFile);
        }

        await product.deleteOne();
        res.redirect("/host/products");
    } catch (error) {
        next(error);
    }
});

module.exports = router;
