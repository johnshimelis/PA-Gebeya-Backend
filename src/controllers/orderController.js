const Order = require("../models/Order");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads/";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
}).fields([
  { name: "paymentImage", maxCount: 1 },
  { name: "avatar", maxCount: 1 }
]);

// Middleware to handle file uploads
exports.uploadFiles = (req, res, next) => {
  upload(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

// Create New Order
exports.createOrder = async (req, res) => {
  try {
    // Clean request body
    const cleanedBody = {};
    Object.keys(req.body).forEach((key) => {
      cleanedBody[key.trim()] = req.body[key];
    });

    // Extract required fields
    const userId = cleanedBody.userId || "Unknown ID";
    const name = cleanedBody.name || "Unknown";
    const amount = parseFloat(cleanedBody.amount) || 0;
    const phoneNumber = cleanedBody.phoneNumber || "";
    const deliveryAddress = cleanedBody.deliveryAddress || "";
    const status = "Pending"; // Default status

    // Handle avatar image
    const avatar = req.files["avatar"]?.[0]
      ? `/uploads/${req.files["avatar"][0].filename}`
      : "/uploads/default-avatar.png";

    // Handle payment image
    const paymentImage = req.files["paymentImage"]?.[0]
      ? `/uploads/${req.files["paymentImage"][0].filename}`
      : null;

    // Parse and validate order details
    let orderDetails = [];
    if (cleanedBody.orderDetails) {
      try {
        orderDetails = JSON.parse(cleanedBody.orderDetails).map(item => ({
          productId: item.productId,
          product: item.product,
          quantity: parseInt(item.quantity) || 1,
          price: parseFloat(item.price) || 0,
          productImage: item.productImage || null,
        }));
      } catch (error) {
        return res.status(400).json({ error: "Invalid order details format" });
      }
    }

    // Generate new order ID
    const lastOrder = await Order.findOne().sort({ id: -1 });
    const newId = lastOrder ? lastOrder.id + 1 : 1;

    // Create new order document
    const newOrder = new Order({
      id: newId,
      userId,
      name,
      amount,
      status,
      phoneNumber,
      deliveryAddress,
      avatar,
      paymentImage,
      orderDetails,
      createdAt: new Date(),
    });

    // Save to database
    await newOrder.save();
    res.status(201).json(newOrder);
  } catch (error) {
    console.error("Order creation error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Update Order
exports.updateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const order = await Order.findOneAndUpdate(
      { id: parseInt(id) },
      updates,
      { new: true, runValidators: true }
    );

    if (!order) {
      return res.status(404).json({ error: "Order not found!" });
    }

    res.status(200).json(order);
  } catch (error) {
    console.error("Order update error:", error);
    res.status(500).json({ error: "Failed to update order" });
  }
};

// Get all Orders
exports.getOrders = async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error("Fetch orders error:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
};

// Get Order By ID
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findOne({ id: req.params.id });
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    res.json(order);
  } catch (error) {
    console.error("Fetch order error:", error);
    res.status(500).json({ error: "Failed to fetch order" });
  }
};

// Delete Order
exports.deleteOrder = async (req, res) => {
  try {
    const deletedOrder = await Order.findOneAndDelete({ id: req.params.id });
    if (!deletedOrder) {
      return res.status(404).json({ message: "Order not found" });
    }
    
    // Clean up associated files
    if (deletedOrder.paymentImage && deletedOrder.paymentImage !== "/uploads/default-payment.jpg") {
      const filePath = `uploads/${path.basename(deletedOrder.paymentImage)}`;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
    res.json({ message: "Order deleted successfully" });
  } catch (error) {
    console.error("Delete order error:", error);
    res.status(500).json({ error: "Failed to delete order" });
  }
};

// Get Order by Order ID and User ID
exports.getOrderByOrderIdAndUserId = async (req, res) => {
  const { orderId, userId } = req.params;

  try {
    const order = await Order.findOne({ id: orderId, userId: userId });
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    res.json(order);
  } catch (error) {
    console.error("Fetch order error:", error);
    res.status(500).json({ message: "Error retrieving order details" });
  }
};