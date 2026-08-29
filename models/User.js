const mongoose = require("mongoose");

const cartItemSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true
    },
    quantity: {
        type: Number,
        min: 1,
        default: 1
    }
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

const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: {
        type: String,
        enum: ["customer", "host", "admin"],
        default: "customer"
    },
    isVerified: { type: Boolean, default: false },
    otpHash: String,
    otpExpires: Date,
    otpAttempts: { type: Number, default: 0 },
    otpLastSent: Date,
    resetOtpHash: String,
    resetOtpExpires: Date,
    resetOtpAttempts: { type: Number, default: 0 },
    resetOtpLastSent: Date,
    cart: [cartItemSchema],
    addresses: [addressSchema]
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
