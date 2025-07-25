const mongoose = require("mongoose");

const adSchema = new mongoose.Schema({
  images: [{
    url: { type: String, required: true },
    key: { type: String, required: true } // S3 object key
  }],
  type: { 
    type: String, 
    required: true, 
    enum: ["ads", "banner", "banner1"] 
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Ad", adSchema);