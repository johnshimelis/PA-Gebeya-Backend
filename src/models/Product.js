const mongoose = require("mongoose");


const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  shortDescription: { type: String, required: true },
  fullDescription: { type: String, required: true },
  stockQuantity: { type: Number, required: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
  image: { type: String, required: false } // Store image filename
}, { timestamps: true });

module.exports = mongoose.model("Product", productSchema);
