const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true },
    shortDescription: { type: String, required: true },
    fullDescription: { type: String, required: true },
    stockQuantity: { type: Number, required: true },
    sold: { type: Number, required: false, default: 0 },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    image: { type: String, required: false },
    discount: { type: Number, required: false, default: 0 },
    hasDiscount: { type: Boolean, required: false, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);