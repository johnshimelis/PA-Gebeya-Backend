const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const UserOrder = require("../models/UserOrder");
const Message = require("../models/Message");
const Notification = require("../models/Notification");

// ===================== CRUD Operations for Orders =====================

// Create Order
router.post("/orders", authMiddleware, async (req, res) => {
  const { userId, date, status, total } = req.body;
  if (!userId || !date || !status || total === undefined) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const newOrder = new UserOrder({ userId, date, status, total });
    await newOrder.save();
    res.status(201).json({ message: "Order created successfully", newOrder });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({ message: "Error creating order" });
  }
});

// Fetch All Orders
router.get("/orders", authMiddleware, async (req, res) => {
  try {
    const orders = await UserOrder.find();
    res.json({ orders });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ message: "Error fetching orders" });
  }
});

// Fetch Orders by User ID
router.get("/orders/:userId", authMiddleware, async (req, res) => {
  try {
    const orders = await UserOrder.find({ userId: req.params.userId });
    res.json({ orders });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ message: "Error fetching orders" });
  }
});

// Update Order
router.put("/orders/:orderId", authMiddleware, async (req, res) => {
  try {
    const updatedOrder = await UserOrder.findByIdAndUpdate(
      req.params.orderId,
      req.body,
      { new: true }
    );
    if (!updatedOrder) return res.status(404).json({ message: "Order not found" });
    res.json({ message: "Order updated successfully", updatedOrder });
  } catch (error) {
    res.status(500).json({ message: "Error updating order" });
  }
});

// Delete Order
router.delete("/orders/:orderId", authMiddleware, async (req, res) => {
  try {
    const deletedOrder = await UserOrder.findByIdAndDelete(req.params.orderId);
    if (!deletedOrder) return res.status(404).json({ message: "Order not found" });
    res.json({ message: "Order deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting order" });
  }
});

// ===================== CRUD Operations for Messages =====================

// Create Message
router.post("/messages", authMiddleware, async (req, res) => {
  const { userId, from, message } = req.body;

  if (!userId || !from || !message) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const newMessage = new Message({ userId, from, message, read: false });
    await newMessage.save();
    res.status(201).json({ message: "Message sent successfully", newMessage });
  } catch (error) {
    res.status(500).json({ message: "Error sending message" });
  }
});

// Fetch All Messages
router.get("/messages", authMiddleware, async (req, res) => {
  try {
    const messages = await Message.find();
    res.json({ messages });
  } catch (error) {
    res.status(500).json({ message: "Error fetching messages" });
  }
});

// Fetch Messages by User ID
router.get("/messages/:userId", authMiddleware, async (req, res) => {
  try {
    const messages = await Message.find({ userId: req.params.userId });
    res.json({ messages });
  } catch (error) {
    res.status(500).json({ message: "Error fetching messages" });
  }
});

// Update Message
router.put("/messages/:messageId", authMiddleware, async (req, res) => {
  try {
    const updatedMessage = await Message.findByIdAndUpdate(
      req.params.messageId,
      req.body,
      { new: true }
    );
    if (!updatedMessage) return res.status(404).json({ message: "Message not found" });
    res.json({ message: "Message updated successfully", updatedMessage });
  } catch (error) {
    res.status(500).json({ message: "Error updating message" });
  }
});

// Delete Message
router.delete("/messages/:messageId", authMiddleware, async (req, res) => {
  try {
    const deletedMessage = await Message.findByIdAndDelete(req.params.messageId);
    if (!deletedMessage) return res.status(404).json({ message: "Message not found" });
    res.json({ message: "Message deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting message" });
  }
});

// ===================== CRUD Operations for Notifications =====================

// Create Notification
router.post("/notifications", authMiddleware, async (req, res) => {
  const { userId, message } = req.body;

  if (!userId || !message) {
    return res.status(400).json({ message: "User ID and message are required" });
  }

  try {
    const newNotification = new Notification({ userId, message });
    await newNotification.save();
    res.status(201).json({ message: "Notification created successfully", newNotification });
  } catch (error) {
    console.error("Error creating notification:", error);
    res.status(500).json({ message: "Error creating notification" });
  }
});

// Fetch All Notifications
router.get("/notifications", authMiddleware, async (req, res) => {
  try {
    const notifications = await Notification.find();
    res.json({ notifications });
  } catch (error) {
    res.status(500).json({ message: "Error fetching notifications" });
  }
});

// Fetch Notifications by User ID
router.get("/notifications/:userId", authMiddleware, async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.params.userId });
    res.json({ notifications });
  } catch (error) {
    res.status(500).json({ message: "Error fetching notifications" });
  }
});

// Update Notification
router.put("/notifications/:notificationId", authMiddleware, async (req, res) => {
  try {
    const updatedNotification = await Notification.findByIdAndUpdate(
      req.params.notificationId,
      req.body,
      { new: true }
    );
    if (!updatedNotification) return res.status(404).json({ message: "Notification not found" });
    res.json({ message: "Notification updated successfully", updatedNotification });
  } catch (error) {
    res.status(500).json({ message: "Error updating notification" });
  }
});

// Delete Notification
router.delete("/notifications/:notificationId", authMiddleware, async (req, res) => {
  try {
    const deletedNotification = await Notification.findByIdAndDelete(req.params.notificationId);
    if (!deletedNotification) return res.status(404).json({ message: "Notification not found" });
    res.json({ message: "Notification deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting notification" });
  }
});

module.exports = router;
