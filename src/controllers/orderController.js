const Order = require("../models/Order");
const Product = require("../models/Product");

// ✅ Create New Order (S3 version)
exports.createOrder = async (req, res) => {
  try {
    // Directly access the JSON body
    const { 
      userId, 
      name, 
      amount, 
      status, 
      phoneNumber, 
      deliveryAddress, 
      orderDetails, 
      paymentImage // S3 URL
    } = req.body;

    console.log("📦 Received order data:", req.body);

    // Validate required fields
    if (!userId || !name || !amount || !paymentImage) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Parse order details if needed
    let parsedOrderDetails = [];
    try {
      parsedOrderDetails = Array.isArray(orderDetails) 
        ? orderDetails 
        : JSON.parse(orderDetails || '[]');
    } catch (parseError) {
      return res.status(400).json({ error: "Invalid orderDetails format" });
    }

    // Generate new order ID
    const lastOrder = await Order.findOne().sort({ id: -1 });
    const newId = lastOrder ? lastOrder.id + 1 : 1;

    // Create new order
    const newOrder = new Order({
      id: newId,
      userId,
      name,
      amount: parseFloat(amount),
      status: status || "Pending",
      phoneNumber,
      deliveryAddress,
      paymentImage, // Directly use the S3 URL
      avatar: "/uploads/default-avatar.png",
      orderDetails: parsedOrderDetails,
      createdAt: new Date(),
    });

    await newOrder.save();
    res.status(201).json(newOrder);
    
  } catch (error) {
    console.error("❌ Error creating order:", error.message);
    res.status(500).json({ error: error.message });
  }
};

// ✅ Update Order (Now Updates Product Stock & Sold when Delivered)
exports.updateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    console.log("🔄 Updating Order:", updates);

    const order = await Order.findOneAndUpdate({ id: parseInt(id) }, updates, { new: true });

    if (!order) {
      return res.status(404).json({ error: "Order not found!" });
    }

    // ✅ If status is "Delivered", update product stock & sold values
    if (updates.status === "Delivered") {
      for (const item of order.orderDetails) {
        const product = await Product.findById(item.productId);

        if (product) {
          product.sold += item.quantity;
          product.stockQuantity -= item.quantity;
          await product.save();
        } else {
          console.error(`❌ Product not found for ID: ${item.productId}`);
        }
      }
    }

    res.status(200).json(order);
  } catch (error) {
    console.error("❌ Error updating order:", error.message);
    res.status(500).json({ error: "Failed to update order." });
  }
};

// ✅ Get all Orders
exports.getOrders = async (req, res) => {
  try {
    const orders = await Order.find().select(
      "id userId name avatar amount status phoneNumber deliveryAddress paymentImage orderDetails createdAt"
    );

    console.log("📤 Orders Fetched from Database:", JSON.stringify(orders, null, 2));

    res.json(orders);
  } catch (error) {
    console.error("❌ Error fetching orders:", error.message);
    res.status(500).json({ error: error.message });
  }
};

// ✅ Get Order By ID
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findOne({ id: req.params.id }).select(
      "id userId name avatar amount status phoneNumber deliveryAddress paymentImage orderDetails createdAt"
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

exports.getOrderByOrderIdAndUserId = async (req, res) => {
  const { orderId, userId } = req.params;
  console.log("Fetching order for:", orderId, userId);

  try {
    const order = await Order.findOne({ id: orderId, userId: userId });

    if (!order) {
      console.log(`No order found for orderId: ${orderId} and userId: ${userId}`);
      return res.status(404).json({ message: "Order not found" });
    }

    res.json({ order });
  } catch (error) {
    console.error("Error retrieving order details:", error);
    res.status(500).json({ message: "Error retrieving order details" });
  }
};