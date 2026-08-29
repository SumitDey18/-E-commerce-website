const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true, default: "Other" },
    price: { type: Number, required: true, min: 0 },
    description: { type: String, trim: true },
    quantity: { type: Number, default: 0, min: 0 },
    image: String,
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model("Product", productSchema);
