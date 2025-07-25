const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  shortDescription: String,
  fullDescription: String,
  stockQuantity: { type: Number, default: 0 },
  sold: { type: Number, default: 0 },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  images: [{
    url: String,  // S3 URL
    key: String   // S3 object key
  }],
  discount: { type: Number, default: 0 },
  hasDiscount: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);