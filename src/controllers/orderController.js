const Order = require("../models/Order");
const multer = require("multer");
const path = require("path");

// ✅ Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Ensure this folder exists
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });

// ✅ Create New Order
exports.createOrder = async (req, res) => {
  try {
    const cleanedBody = {};
    Object.keys(req.body).forEach((key) => {
      cleanedBody[key.trim()] = req.body[key];
    });

    console.log("📌 Cleaned Request Body:", cleanedBody);
    console.log("📌 Uploaded Files:", req.files);

    const name = cleanedBody.name || "Unknown";
    const amount = cleanedBody.amount ? parseFloat(cleanedBody.amount) : 0;
    const phoneNumber = cleanedBody.phoneNumber || "";
    const deliveryAddress = cleanedBody.deliveryAddress || "";
    const status = cleanedBody.status || "Pending";

    // ✅ Handle avatar upload (Ensuring correct file path)
    const avatar = req.files["avatar"]
      ? `/uploads/${req.files["avatar"][0].filename}`
      : "/uploads/default-avatar.png";

    console.log("🖼️ Avatar Path Saved:", avatar);

    // ✅ Handle payment image upload
    const paymentImage = req.files["paymentImage"]
      ? `/uploads/${req.files["paymentImage"][0].filename}`
      : null;

    // ✅ Handle product images upload
    const productImages = req.files["productImages"]
      ? req.files["productImages"].map((file) => `/uploads/${file.filename}`)
      : [];

    // ✅ Parse `orderDetails`
    let orderDetails = [];
    if (cleanedBody.orderDetails) {
      try {
        orderDetails = JSON.parse(cleanedBody.orderDetails);
        orderDetails = orderDetails.map((item, index) => ({
          product: item.product || "Unknown",
          quantity: item.quantity || 1,
          price: item.price || 0,
          productImage: productImages[index] || null,
        }));
      } catch (error) {
        return res.status(400).json({ error: "Invalid JSON format in orderDetails" });
      }
    }

    // ✅ Auto-increment ID
    const lastOrder = await Order.findOne().sort({ id: -1 });
    const newId = lastOrder ? lastOrder.id + 1 : 1;

    // ✅ Create new order with avatar & date
    const newOrder = new Order({
      id: newId,
      name,
      amount,
      status,
      phoneNumber,
      deliveryAddress,
      avatar, // ✅ Store avatar correctly
      paymentImage,
      orderDetails,
      createdAt: new Date(), // ✅ Ensure date is stored
    });

    await newOrder.save();
    res.status(201).json(newOrder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✅ Update Order
exports.updateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body; // Get updates dynamically

    console.log("🔄 Updating Order:", updates);

    // Ensure ID is a valid number
    const order = await Order.findOneAndUpdate({ id: parseInt(id) }, updates, { new: true });

    if (!order) {
      return res.status(404).json({ error: "Order not found!" });
    }

    res.status(200).json(order);
  } catch (error) {
    console.error("❌ Error updating order:", error.message);
    res.status(500).json({ error: "Failed to update order." });
  }
};

// ✅ Get all Orders (Include Avatar & Date)
exports.getOrders = async (req, res) => {
  try {
    const orders = await Order.find().select(
      "id name avatar amount status phoneNumber deliveryAddress paymentImage orderDetails createdAt"
    );

    console.log("📤 Orders Fetched from Database:", JSON.stringify(orders, null, 2)); // 🔍 Debug log

    res.json(orders);
  } catch (error) {
    console.error("❌ Error fetching orders:", error.message);
    res.status(500).json({ error: error.message });
  }
};


// ✅ Get Order by ID
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findOne({ id: req.params.id }).select(
      "id name avatar amount status phoneNumber deliveryAddress paymentImage orderDetails createdAt"
    );
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✅ Delete Order
exports.deleteOrder = async (req, res) => {
  try {
    const deletedOrder = await Order.findOneAndDelete({ id: req.params.id });
    if (!deletedOrder) return res.status(404).json({ message: "Order not found" });
    res.json({ message: "Order deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✅ Delete All Orders
exports.deleteAllOrders = async (req, res) => {
  try {
    await Order.deleteMany({});
    res.json({ message: "All orders deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
