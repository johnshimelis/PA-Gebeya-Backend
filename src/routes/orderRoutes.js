const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");

// Use the upload middleware from the orderController
const upload = orderController.upload;

// Create a new order with file uploads to S3
router.post(
  "/",
  upload.fields([
    { name: "avatar", maxCount: 1 }, // Avatar image
    { name: "paymentImage", maxCount: 1 }, // Payment proof image
    { name: "productImages", maxCount: 10 }, // Product images
  ]),
  orderController.createOrder
);

// Get order by order ID and user ID
router.get("/:orderId/:userId", orderController.getOrderByOrderIdAndUserId);

// Get all orders
router.get("/", orderController.getOrders);

// Get order by ID
router.get("/:id", orderController.getOrderById);

// Update order (with optional payment image upload to S3)
router.put(
  "/:id",
  upload.fields([{ name: "paymentImage", maxCount: 1 }]), // Payment proof image
  orderController.updateOrder
);

// Delete order by ID
router.delete("/:id", orderController.deleteOrder);

// Delete all orders
router.delete("/", orderController.deleteAllOrders);

module.exports = router;