const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const UserOrder = require("../models/UserOrder");
const Message = require("../models/Message");
const Notification = require("../models/Notification");

// ===================== CRUD Operations for Orders =====================

// Create Order for a specific user
router.post("/orders", authMiddleware, async (req, res) => {
  const { date, status, total } = req.body;
  try {
    const newOrder = new UserOrder({
      userId: req.userId,
      date,
      status,
      total,
    });
    await newOrder.save();
    res.status(201).json({ message: "Order created successfully", newOrder });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({ message: "Error creating order" });
  }
});

// Fetch User Orders
router.get("/orders", authMiddleware, async (req, res) => {
  try {
    const orders = await UserOrder.find({ userId: req.userId });
    res.json({ orders });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ message: "Error fetching orders" });
  }
});

// Update Order for a specific user
router.put("/orders/:orderId", authMiddleware, async (req, res) => {
  try {
    const { orderId } = req.params;
    const updatedOrder = await UserOrder.findOneAndUpdate(
      { _id: orderId, userId: req.userId }, 
      req.body, 
      { new: true } // Return the updated document
    );
    if (!updatedOrder) {
      return res.status(404).json({ message: "Order not found" });
    }
    res.json({ message: "Order updated successfully", updatedOrder });
  } catch (error) {
    console.error("Error updating order:", error);
    res.status(500).json({ message: "Error updating order" });
  }
});

// Delete Order for a specific user
router.delete("/orders/:orderId", authMiddleware, async (req, res) => {
  try {
    const { orderId } = req.params;
    const deletedOrder = await UserOrder.findOneAndDelete({ _id: orderId, userId: req.userId });
    if (!deletedOrder) {
      return res.status(404).json({ message: "Order not found" });
    }
    res.json({ message: "Order deleted successfully" });
  } catch (error) {
    console.error("Error deleting order:", error);
    res.status(500).json({ message: "Error deleting order" });
  }
});

// ===================== CRUD Operations for Messages =====================

// Create Message for a specific user
router.post("/messages", authMiddleware, async (req, res) => {
  const { from, message } = req.body;
  try {
    const newMessage = new Message({
      userId: req.userId,
      from,
      message,
      read: false,
    });
    await newMessage.save();
    res.status(201).json({ message: "Message sent successfully", newMessage });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ message: "Error sending message" });
  }
});

// Fetch User Messages
router.get("/messages", authMiddleware, async (req, res) => {
  try {
    const messages = await Message.find({ userId: req.userId });
    res.json({ messages });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ message: "Error fetching messages" });
  }
});

// Update Message for a specific user
router.put("/messages/:messageId", authMiddleware, async (req, res) => {
  try {
    const { messageId } = req.params;
    const updatedMessage = await Message.findOneAndUpdate(
      { _id: messageId, userId: req.userId },
      req.body,
      { new: true }
    );
    if (!updatedMessage) {
      return res.status(404).json({ message: "Message not found" });
    }
    res.json({ message: "Message updated successfully", updatedMessage });
  } catch (error) {
    console.error("Error updating message:", error);
    res.status(500).json({ message: "Error updating message" });
  }
});

// Delete Message for a specific user
router.delete("/messages/:messageId", authMiddleware, async (req, res) => {
  try {
    const { messageId } = req.params;
    const deletedMessage = await Message.findOneAndDelete({ _id: messageId, userId: req.userId });
    if (!deletedMessage) {
      return res.status(404).json({ message: "Message not found" });
    }
    res.json({ message: "Message deleted successfully" });
  } catch (error) {
    console.error("Error deleting message:", error);
    res.status(500).json({ message: "Error deleting message" });
  }
});

// ===================== CRUD Operations for Notifications =====================

// Create Notification for a specific user
router.post("/notifications", authMiddleware, async (req, res) => {
  const { message } = req.body;
  try {
    const newNotification = new Notification({
      userId: req.userId,
      message,
    });
    await newNotification.save();
    res.status(201).json({ message: "Notification created successfully", newNotification });
  } catch (error) {
    console.error("Error creating notification:", error);
    res.status(500).json({ message: "Error creating notification" });
  }
});

// Fetch User Notifications
router.get("/notifications", authMiddleware, async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.userId });
    res.json({ notifications });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ message: "Error fetching notifications" });
  }
});

// Update Notification for a specific user
router.put("/notifications/:notificationId", authMiddleware, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const updatedNotification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId: req.userId },
      req.body,
      { new: true }
    );
    if (!updatedNotification) {
      return res.status(404).json({ message: "Notification not found" });
    }
    res.json({ message: "Notification updated successfully", updatedNotification });
  } catch (error) {
    console.error("Error updating notification:", error);
    res.status(500).json({ message: "Error updating notification" });
  }
});

// Delete Notification for a specific user
router.delete("/notifications/:notificationId", authMiddleware, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const deletedNotification = await Notification.findOneAndDelete({ _id: notificationId, userId: req.userId });
    if (!deletedNotification) {
      return res.status(404).json({ message: "Notification not found" });
    }
    res.json({ message: "Notification deleted successfully" });
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(500).json({ message: "Error deleting notification" });
  }
});

module.exports = router;
