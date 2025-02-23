const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true },
    name: { type: String, required: true },
    amount: { type: Number, required: true },
    status: { type: String, default: "Pending" },
    phoneNumber: { type: String },
    deliveryAddress: { type: String },
    paymentImage: { type: String },
    avatar: { type: String, default: "/uploads/default-avatar.png" }, // ✅ Ensure avatar is stored
    orderDetails: [
      {
        product: { type: String, required: true },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true },
        productImage: { type: String },
      },
    ],
  },
  { timestamps: true } // ✅ Automatically adds `createdAt` field
);

module.exports = mongoose.model("Order", OrderSchema);
