const mongoose = require("mongoose");
const AutoIncrement = require("mongoose-sequence")(mongoose);

const OrderSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true }, // Auto-incremented Order ID
    avatar: String, // Client avatar
    name: String, // Client name
    amount: Number, // Total order amount
    status: {
      type: String,
      enum: ["Pending", "Un-paid", "Paid", "Delivered", "Processing", "Approved", "Cancelled"],
      default: "Pending",
    },
    date: { type: Date, default: Date.now }, // Order date
    paymentImage: String, // Payment proof image
    phoneNumber: String,
    deliveryAddress: String,
    orderDetails: [
      {
        product: String,
        quantity: Number,
        price: Number,
        productImage: String,
      },
    ],
  },
  { timestamps: true }
);

// Auto-increment the `id` field
OrderSchema.plugin(AutoIncrement, { inc_field: "id" });

module.exports = mongoose.model("Order", OrderSchema);
