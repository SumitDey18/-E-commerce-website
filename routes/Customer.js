const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const Razorpay = require("razorpay");

const User = require("../models/User");
const Product = require("../models/Product");
const Order = require("../models/Order");
const { requireRole } = require("../middleware/auth");
const { createOTP, hashOTP, sendOTP } = require("../services/otp");

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

const razorpay = process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
    ? new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET })
    : null;

const CATEGORIES = ["Electronics", "Clothing", "Shoes", "Books", "Home", "Accessories", "Beauty", "Sports", "Other"];

function makeSessionUser(user) {
    return { id: user._id.toString(), name: user.name, role: user.role };
}

function cleanEmail(email) { return String(email || "").trim().toLowerCase(); }
function money(value) { return Math.round(Number(value) * 100) / 100; }
function cartTotal(user) {
    return money(user.cart.reduce((sum, item) => sum + (item.product ? item.product.price * item.quantity : 0), 0));
}

router.get("/register", (req, res) => res.render("customer/register"));

router.post("/register", async (req, res, next) => {
    try {
        const name = String(req.body.name || "").trim();
        const email = cleanEmail(req.body.email);
        const password = String(req.body.password || "");
        if (!name || !email || password.length < 6) return res.status(400).send("Name, valid email and password of at least 6 characters are required.");
        if (await User.findOne({ email })) return res.send("Email already registered. Please login.");
        const otp = createOTP();
        const user = await User.create({
            name,
            email,
            password: await bcrypt.hash(password, 10),
            otpHash: hashOTP(otp),
            otpExpires: new Date(Date.now() + OTP_EXPIRY_MS),
            otpAttempts: 0,
            otpLastSent: new Date()
        });
        await sendOTP(user.email, otp);
        res.redirect("/customer/verify?email=" + encodeURIComponent(email));
    } catch (error) { next(error); }
});

router.get("/verify", (req, res) => res.render("customer/verify", { email: cleanEmail(req.query.email) }));

router.post("/verify", async (req, res, next) => {
    try {
        const email = cleanEmail(req.body.email);
        const otp = String(req.body.otp || "").trim();
        const user = await User.findOne({ email });
        if (!user) return res.status(404).send("User not found.");
        if (user.isVerified) return res.redirect("/customer/login");
        if (!user.otpHash || !user.otpExpires || user.otpExpires < new Date()) return res.status(400).send("OTP expired. Please resend OTP.");
        if ((user.otpAttempts || 0) >= OTP_MAX_ATTEMPTS) return res.status(429).send("Too many incorrect attempts. Please resend OTP.");

        const suppliedHash = hashOTP(otp);
        if (suppliedHash !== user.otpHash) {
            user.otpAttempts = (user.otpAttempts || 0) + 1;
            await user.save();
            const remaining = Math.max(0, OTP_MAX_ATTEMPTS - user.otpAttempts);
            return res.status(400).send(`Wrong OTP. Attempts remaining: ${remaining}`);
        }

        user.isVerified = true;
        user.otpHash = undefined;
        user.otpExpires = undefined;
        user.otpAttempts = 0;
        user.otpLastSent = undefined;
        await user.save();
        res.redirect("/customer/login");
    } catch (error) { next(error); }
});

router.post("/verify/resend", async (req, res, next) => {
    try {
        const email = cleanEmail(req.body.email);
        const user = await User.findOne({ email });
        if (!user) return res.status(404).send("User not found.");
        if (user.isVerified) return res.redirect("/customer/login");

        if (user.otpLastSent && Date.now() - user.otpLastSent.getTime() < OTP_RESEND_COOLDOWN_MS) {
            const wait = Math.ceil((OTP_RESEND_COOLDOWN_MS - (Date.now() - user.otpLastSent.getTime())) / 1000);
            return res.status(429).send(`Please wait ${wait} seconds before requesting another OTP.`);
        }

        const otp = createOTP();
        user.otpHash = hashOTP(otp);
        user.otpExpires = new Date(Date.now() + OTP_EXPIRY_MS);
        user.otpAttempts = 0;
        user.otpLastSent = new Date();
        await user.save();
        await sendOTP(user.email, otp);
        res.redirect("/customer/verify?email=" + encodeURIComponent(email));
    } catch (error) { next(error); }
});

router.get("/forgot-password", (req, res) => {
    res.render("customer/forgot-password", { error: null });
});

router.post("/forgot-password", async (req, res, next) => {
    try {
        const email = cleanEmail(req.body.email);
        const user = await User.findOne({ email });
        if (!user) return res.render("customer/forgot-password", { error: "No account found with this email." });

        if (user.resetOtpLastSent && Date.now() - user.resetOtpLastSent.getTime() < OTP_RESEND_COOLDOWN_MS) {
            const wait = Math.ceil((OTP_RESEND_COOLDOWN_MS - (Date.now() - user.resetOtpLastSent.getTime())) / 1000);
            return res.render("customer/forgot-password", { error: `Please wait ${wait} seconds before requesting another OTP.` });
        }

        const otp = createOTP();
        user.resetOtpHash = hashOTP(otp);
        user.resetOtpExpires = new Date(Date.now() + OTP_EXPIRY_MS);
        user.resetOtpAttempts = 0;
        user.resetOtpLastSent = new Date();
        await user.save();
        await sendOTP(user.email, otp);
        res.redirect("/customer/reset-password?email=" + encodeURIComponent(email));
    } catch (error) { next(error); }
});

router.get("/reset-password", (req, res) => {
    res.render("customer/reset-password", { email: cleanEmail(req.query.email), error: null });
});

router.post("/reset-password", async (req, res, next) => {
    try {
        const email = cleanEmail(req.body.email);
        const otp = String(req.body.otp || "").trim();
        const password = String(req.body.password || "");
        const confirmPassword = String(req.body.confirmPassword || "");
        const user = await User.findOne({ email });
        if (!user) return res.status(404).send("User not found.");
        if (password.length < 6) return res.render("customer/reset-password", { email, error: "Password must be at least 6 characters." });
        if (password !== confirmPassword) return res.render("customer/reset-password", { email, error: "Passwords do not match." });
        if (!user.resetOtpHash || !user.resetOtpExpires || user.resetOtpExpires < new Date()) return res.render("customer/reset-password", { email, error: "OTP expired. Please request a new OTP." });
        if ((user.resetOtpAttempts || 0) >= OTP_MAX_ATTEMPTS) return res.render("customer/reset-password", { email, error: "Too many incorrect attempts. Please request a new OTP." });

        if (hashOTP(otp) !== user.resetOtpHash) {
            user.resetOtpAttempts = (user.resetOtpAttempts || 0) + 1;
            await user.save();
            const remaining = Math.max(0, OTP_MAX_ATTEMPTS - user.resetOtpAttempts);
            return res.render("customer/reset-password", { email, error: `Wrong OTP. Attempts remaining: ${remaining}` });
        }

        user.password = await bcrypt.hash(password, 10);
        user.resetOtpHash = undefined;
        user.resetOtpExpires = undefined;
        user.resetOtpAttempts = 0;
        user.resetOtpLastSent = undefined;
        await user.save();
        res.redirect("/customer/login?reset=success");
    } catch (error) { next(error); }
});

router.get("/login", (req, res) => res.render("customer/login"));

router.post("/login", async (req, res, next) => {
    try {
        const email = cleanEmail(req.body.email), password = String(req.body.password || "");
        const user = await User.findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).send("Invalid email or password.");
        if (!user.isVerified) return res.redirect("/customer/verify?email=" + encodeURIComponent(user.email));
        req.session.user = makeSessionUser(user);
        if (user.role === "admin") return res.redirect("/admin");
        if (user.role === "host") return res.redirect("/host");
        return res.redirect("/customer/products");
    } catch (error) { next(error); }
});

router.get("/logout", (req, res) => req.session.destroy(() => res.redirect("/")));

router.get("/products", async (req, res, next) => {
    try {
        const search = String(req.query.search || "").trim();
        const category = String(req.query.category || "").trim();
        const min = req.query.minPrice === "" || req.query.minPrice == null ? null : Number(req.query.minPrice);
        const max = req.query.maxPrice === "" || req.query.maxPrice == null ? null : Number(req.query.maxPrice);
        const sort = String(req.query.sort || "newest");
        const query = { quantity: { $gte: 0 } };
        if (search) query.$or = [
            { name: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } },
            { category: { $regex: search, $options: "i" } }
        ];
        if (category && CATEGORIES.includes(category)) query.category = category;
        if (Number.isFinite(min) || Number.isFinite(max)) {
            query.price = {};
            if (Number.isFinite(min)) query.price.$gte = Math.max(0, min);
            if (Number.isFinite(max)) query.price.$lte = Math.max(0, max);
        }
        const sortMap = { low: { price: 1 }, high: { price: -1 }, newest: { createdAt: -1 }, oldest: { createdAt: 1 } };
        const products = await Product.find(query).populate("owner", "name role").sort(sortMap[sort] || sortMap.newest);
        res.render("customer/products", { products, categories: CATEGORIES, filters: { search, category, minPrice: req.query.minPrice || "", maxPrice: req.query.maxPrice || "", sort } });
    } catch (error) { next(error); }
});

router.post("/cart/add/:id", requireRole("customer"), async (req, res, next) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).send("Product not found.");
        const qty = Number(req.body.quantity || 1);
        if (!Number.isInteger(qty) || qty < 1) return res.status(400).send("Invalid quantity.");
        const item = req.currentUser.cart.find(x => x.product && x.product.toString() === product._id.toString());
        const newQty = item ? item.quantity + qty : qty;
        if (newQty > product.quantity) return res.send("Not enough stock.");
        if (item) item.quantity = newQty; else req.currentUser.cart.push({ product: product._id, quantity: qty });
        await req.currentUser.save();
        res.redirect("/customer/cart");
    } catch (error) { next(error); }
});

router.post("/cart/update/:id", requireRole("customer"), async (req, res, next) => {
    try {
        const qty = Number(req.body.quantity);
        const item = req.currentUser.cart.find(x => x.product && x.product.toString() === req.params.id);
        if (!item) return res.status(404).send("Cart item not found.");
        if (!Number.isInteger(qty) || qty < 1) {
            req.currentUser.cart = req.currentUser.cart.filter(x => x.product.toString() !== req.params.id);
            await req.currentUser.save();
            return res.redirect("/customer/cart");
        }
        const product = await Product.findById(req.params.id);
        if (!product) {
            req.currentUser.cart = req.currentUser.cart.filter(x => x.product.toString() !== req.params.id);
            await req.currentUser.save();
            return res.redirect("/customer/cart");
        }
        if (qty > product.quantity) return res.status(400).send(`Only ${product.quantity} item(s) are available for ${product.name}.`);
        item.quantity = qty;
        await req.currentUser.save();
        res.redirect("/customer/cart");
    } catch (error) { next(error); }
});

router.post("/cart/remove/:id", requireRole("customer"), async (req, res, next) => {
    try {
        req.currentUser.cart = req.currentUser.cart.filter(item => !item.product || item.product.toString() !== req.params.id);
        await req.currentUser.save();
        res.redirect("/customer/cart");
    } catch (error) { next(error); }
});

async function loadCart(user) {
    await user.populate("cart.product");
    user.cart = user.cart.filter(item => item.product);
    for (const item of user.cart) if (item.quantity > item.product.quantity) item.quantity = item.product.quantity;
    user.cart = user.cart.filter(item => item.quantity > 0);
    await user.save();
}

router.get("/cart", requireRole("customer"), async (req, res, next) => {
    try { await loadCart(req.currentUser); res.render("customer/cart", { user: req.currentUser, total: cartTotal(req.currentUser) }); }
    catch (error) { next(error); }
});

router.get("/checkout", requireRole("customer"), async (req, res, next) => {
    try {
        await loadCart(req.currentUser);
        if (!req.currentUser.cart.length) return res.redirect("/customer/products");
        res.render("customer/checkout", { total: cartTotal(req.currentUser) });
    } catch (error) { next(error); }
});

async function reduceStock(items) {
    const changed = [];
    for (const item of items) {
        const result = await Product.updateOne({ _id: item.product, quantity: { $gte: item.quantity } }, { $inc: { quantity: -item.quantity } });
        if (result.modifiedCount !== 1) {
            for (const previous of changed) await Product.updateOne({ _id: previous.product }, { $inc: { quantity: previous.quantity } });
            return false;
        }
        changed.push(item);
    }
    return true;
}

router.post("/checkout", requireRole("customer"), async (req, res, next) => {
    try {
        await loadCart(req.currentUser);
        if (!req.currentUser.cart.length) return res.send("Cart is empty.");
        const { name, phone, address, city, state, pincode, latitude, longitude, paymentMethod } = req.body;
        if (!name || !phone || !address || !city || !state || !pincode) return res.status(400).send("Please fill all delivery fields.");
        if (!['razorpay', 'cod'].includes(paymentMethod)) return res.status(400).send("Invalid payment method.");
        for (const item of req.currentUser.cart) if (item.product.quantity < item.quantity) return res.send(`Not enough stock for ${item.product.name}.`);
        const items = req.currentUser.cart.map(item => ({ product: item.product._id, name: item.product.name, price: item.product.price, quantity: item.quantity }));
        const deliveryAddress = { name, phone, address, city, state, pincode, latitude: latitude ? Number(latitude) : undefined, longitude: longitude ? Number(longitude) : undefined };
        const order = await Order.create({ user: req.currentUser._id, items, total: cartTotal(req.currentUser), address: deliveryAddress, paymentMethod });
        req.currentUser.addresses.push(deliveryAddress); await req.currentUser.save();

        if (paymentMethod === "cod") {
            if (!await reduceStock(order.items)) { order.status = "cancelled"; order.paymentStatus = "failed"; await order.save(); return res.send("Stock changed while placing the order. Please try again."); }
            order.status = "confirmed"; order.paymentStatus = "cod"; await order.save();
            req.currentUser.cart = []; await req.currentUser.save();
            return res.redirect("/customer/orders");
        }

        if (!razorpay) return res.render("customer/payment", { order, razorpayOrder: null, key: null, reason: "Razorpay TEST keys are not configured." });
        try {
            const razorpayOrder = await razorpay.orders.create({ amount: Math.round(order.total * 100), currency: "INR", receipt: order._id.toString() });
            order.razorpayOrderId = razorpayOrder.id; await order.save();
            res.render("customer/payment", { order, razorpayOrder, key: process.env.RAZORPAY_KEY_ID, reason: null });
        } catch (error) {
            order.paymentStatus = "failed"; await order.save();
            next(error);
        }
    } catch (error) { next(error); }
});

router.post("/payment/verify", requireRole("customer"), async (req, res, next) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) return res.json({ success: false, message: "Payment response is incomplete." });
        const order = await Order.findOne({ razorpayOrderId: razorpay_order_id, user: req.currentUser._id });
        if (!order) return res.json({ success: false, message: "Order not found." });
        if (order.paymentStatus === "paid") return res.json({ success: true, message: "Payment already verified." });
        if (order.paymentStatus === "refunded") return res.json({ success: false, message: "This payment was refunded." });
        if (!process.env.RAZORPAY_KEY_SECRET) return res.json({ success: false, message: "Razorpay secret is missing." });
        const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex");
        if (expected.length !== razorpay_signature.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(razorpay_signature))) {
            order.paymentStatus = "failed"; await order.save(); return res.json({ success: false, message: "Invalid payment signature." });
        }
        const locked = await Order.findOneAndUpdate({ _id: order._id, paymentStatus: "pending" }, { $set: { paymentStatus: "processing" } }, { new: true });
        if (!locked) return res.json({ success: false, message: "Payment is already being processed. Refresh orders shortly." });
        const stockUpdated = await reduceStock(locked.items);
        locked.razorpayPaymentId = razorpay_payment_id;
        locked.razorpaySignature = razorpay_signature;
        if (!stockUpdated) {
            locked.paymentStatus = "refunded";
            locked.status = "cancelled";
            if (razorpay) {
                try {
                    const refund = await razorpay.payments.refund(razorpay_payment_id, { amount: Math.round(locked.total * 100), speed: "normal", notes: { orderId: locked._id.toString(), reason: "Stock unavailable" } });
                    locked.refundId = refund.id;
                } catch (refundError) { console.error("REFUND ERROR:", refundError.message); locked.paymentStatus = "paid"; locked.status = "pending"; await locked.save(); return res.json({ success: false, message: "Payment verified, but stock changed. Automatic refund could not be completed; contact admin." }); }
            }
            await locked.save();
            return res.json({ success: false, message: "Payment was verified but stock changed. The payment has been refunded." });
        }
        locked.paymentStatus = "paid"; locked.status = "confirmed"; await locked.save();
        req.currentUser.cart = []; await req.currentUser.save();
        res.json({ success: true });
    } catch (error) { next(error); }
});

router.post("/payment/failed", requireRole("customer"), async (req, res, next) => {
    try {
        const order = await Order.findOne({ razorpayOrderId: req.body.razorpay_order_id, user: req.currentUser._id, paymentStatus: { $in: ["pending", "processing"] } });
        if (order) { order.paymentStatus = "failed"; await order.save(); }
        res.json({ success: true });
    } catch (error) { next(error); }
});

router.get("/payment/cancel/:id", requireRole("customer"), async (req, res, next) => {
    try {
        const order = await Order.findOne({ _id: req.params.id, user: req.currentUser._id, paymentStatus: { $in: ["pending", "processing"] } });
        if (order) { order.paymentStatus = "failed"; await order.save(); }
        res.redirect("/customer/orders");
    } catch (error) { next(error); }
});

router.get("/orders", requireRole("customer"), async (req, res, next) => {
    try { const orders = await Order.find({ user: req.currentUser._id }).sort({ createdAt: -1 }); res.render("customer/orders", { orders }); }
    catch (error) { next(error); }
});

module.exports = router;
