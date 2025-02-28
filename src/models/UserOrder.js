const mongoose = require("mongoose");

const userOrderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Link to User
  date: { type: Date, required: true },  // Order date
  status: { type: String, required: true },  // Order status
  total: { type: Number, required: true },  // Total amount for the order
});

module.exports = mongoose.model("UserOrder", userOrderSchema);
