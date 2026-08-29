const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    name: String,
    price: Number,
    quantity: Number
}, { _id: false });

const addressSchema = new mongoose.Schema({
    name: String,
    phone: String,
    address: String,
    city: String,
    state: String,
    pincode: String,
    latitude: Number,
    longitude: Number
}, { _id: false });

const orderSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    items: [itemSchema],
    total: { type: Number, required: true },
    address: addressSchema,
    paymentMethod: { type: String, enum: ["razorpay", "cod"], default: "razorpay" },
    status: {
        type: String,
        enum: ["pending", "confirmed", "shipped", "delivered", "cancelled"],
        default: "pending"
    },
    paymentStatus: {
        type: String,
        enum: ["pending", "processing", "paid", "failed", "cod", "refunded"],
        default: "pending"
    },
    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpaySignature: String,
    refundId: String
}, { timestamps: true });

module.exports = mongoose.model("Order", orderSchema);
