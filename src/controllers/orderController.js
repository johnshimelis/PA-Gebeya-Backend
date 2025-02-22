const Order = require("../models/Order");
const multer = require("multer");
const path = require("path");

// Set up file storage for images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// Create an order

exports.createOrder = async (req, res) => {
    try {
      console.log("📌 Full Request Body:", req.body);
      console.log("📌 Uploaded File:", req.file);
  
      // Trim all keys to remove unwanted spaces
      const cleanedBody = {};
      Object.keys(req.body).forEach((key) => {
        cleanedBody[key.trim()] = typeof req.body[key] === "string" ? req.body[key].trim() : req.body[key];
      });
  
      // Extract and parse data
      const { avatar, name, amount, phoneNumber, deliveryAddress } = cleanedBody;
      const status = cleanedBody.status?.trim() || "Pending"; // Trim status
  
      // 🔍 Parse `orderDetails` properly
      let orderDetails = [];
      if (cleanedBody.orderDetails) {
        try {
          orderDetails = JSON.parse(cleanedBody.orderDetails);
        } catch (error) {
          console.error("❌ Order Details Parsing Error:", error.message);
          return res.status(400).json({ error: "Invalid JSON format in orderDetails" });
        }
      }
  
      // 🔢 Auto-increment ID
      const lastOrder = await Order.findOne().sort({ id: -1 });
      const newId = lastOrder ? lastOrder.id + 1 : 1;
  
      // Handle file upload
      const paymentImage = req.file ? `/uploads/${req.file.filename}` : null;
  
      // Ensure `amount` is stored as a number
      const numericAmount = parseFloat(amount);
      if (isNaN(numericAmount)) {
        return res.status(400).json({ error: "Invalid amount. Must be a number." });
      }
  
      // Create the order
      const newOrder = new Order({
        id: newId,
        avatar,
        name,
        amount: numericAmount,
        status,
        phoneNumber,
        deliveryAddress,
        paymentImage,
        orderDetails,
      });
  
      await newOrder.save();
      res.status(201).json(newOrder);
    } catch (error) {
      console.error("❌ Error Creating Order:", error.message);
      res.status(500).json({ error: error.message });
    }
  };
  // Delete all orders
exports.deleteAllOrders = async (req, res) => {
    try {
      await Order.deleteMany({});
      res.json({ message: "All orders deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
  

// Get all orders
exports.getOrders = async (req, res) => {
  try {
    const orders = await Order.find();
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get order by ID
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findOne({ id: req.params.id });
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update an order
exports.updateOrder = async (req, res) => {
  try {
    const { status, phoneNumber, deliveryAddress } = req.body;
    const paymentImage = req.file ? `/uploads/${req.file.filename}` : req.body.paymentImage;

    const updatedOrder = await Order.findOneAndUpdate(
      { id: req.params.id },
      { status, paymentImage, phoneNumber, deliveryAddress },
      { new: true }
    );

    if (!updatedOrder) return res.status(404).json({ message: "Order not found" });
    res.json(updatedOrder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete an order
exports.deleteOrder = async (req, res) => {
  try {
    const deletedOrder = await Order.findOneAndDelete({ id: req.params.id });
    if (!deletedOrder) return res.status(404).json({ message: "Order not found" });
    res.json({ message: "Order deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
