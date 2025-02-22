const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const multer = require("multer");

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });

// Use `upload.single("paymentImage")` only for file uploads
router.post("/", upload.single("paymentImage"), orderController.createOrder);
router.get("/", orderController.getOrders);
router.get("/:id", orderController.getOrderById);
router.put("/:id", upload.single("paymentImage"), orderController.updateOrder);
router.delete("/:id", orderController.deleteOrder);
router.delete("/", orderController.deleteAllOrders);


module.exports = router;
