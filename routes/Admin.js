const express = require("express");
const router = express.Router();
const Razorpay = require("razorpay");

const Product = require("../models/Product");
const User = require("../models/User");
const Order = require("../models/Order");
const { requireRole } = require("../middleware/auth");

const razorpay = process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
    ? new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET })
    : null;

router.get("/", requireRole("admin"), async (req, res, next) => {
    try {
        const [products, orders, users] = await Promise.all([
            Product.find().populate("owner", "name role").sort({ createdAt: -1 }),
            Order.find().populate("user", "name email").sort({ createdAt: -1 }),
            User.find().select("name email role isVerified").sort({ createdAt: -1 })
        ]);

        const stats = {
            users: users.length,
            products: products.length,
            orders: orders.length,
            sales: orders.filter(o => o.paymentStatus === "paid" || o.paymentStatus === "cod").reduce((sum, o) => sum + Number(o.total || 0), 0),
            pending: orders.filter(o => o.status === "pending").length,
            delivered: orders.filter(o => o.status === "delivered").length,
            cancelled: orders.filter(o => o.status === "cancelled").length
        };

        res.render("admin/home", { user: req.currentUser, products, orders, users, stats });
    } catch (error) { next(error); }
});

router.post("/users/:id/role", requireRole("admin"), async (req, res, next) => {
    try {
        const allowed = ["customer", "host", "admin"];
        if (!allowed.includes(req.body.role)) return res.status(400).send("Invalid role.");
        if (req.params.id === req.currentUser._id.toString() && req.body.role !== "admin") return res.send("You cannot remove your own admin role here.");
        await User.findByIdAndUpdate(req.params.id, { role: req.body.role });
        res.redirect("/admin");
    } catch (error) { next(error); }
});

router.post("/orders/:id/status", requireRole("admin"), async (req, res, next) => {
    try {
        const allowed = ["pending", "confirmed", "shipped", "delivered", "cancelled"];
        if (!allowed.includes(req.body.status)) return res.status(400).send("Invalid status.");
        await Order.findByIdAndUpdate(req.params.id, { status: req.body.status });
        res.redirect("/admin");
    } catch (error) { next(error); }
});

router.post("/orders/:id/refund", requireRole("admin"), async (req, res, next) => {
    try {
        if (!razorpay) return res.status(400).send("Razorpay keys are not configured.");
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).send("Order not found.");
        if (order.paymentStatus !== "paid" || !order.razorpayPaymentId) return res.status(400).send("Only a successfully paid Razorpay order can be refunded.");
        if (order.paymentStatus === "refunded" || order.refundId) return res.send("This order is already refunded.");

        const refund = await razorpay.payments.refund(order.razorpayPaymentId, {
            amount: Math.round(order.total * 100),
            speed: "normal",
            notes: { orderId: order._id.toString() }
        });

        order.refundId = refund.id;
        order.paymentStatus = "refunded";
        order.status = "cancelled";
        await order.save();
        res.redirect("/admin");
    } catch (error) {
        console.error("REFUND ERROR:", error);
        res.status(500).send("Refund failed: " + error.message);
    }
});

module.exports = router;
