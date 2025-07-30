  const express = require("express");
  const router = express.Router();
  const orderController = require("../controllers/orderController");
  const multer = require("multer");

  // Use memory storage for S3 uploads
  const storage = multer.memoryStorage();
  const upload = multer({ storage });

  router.post(
    "/",
    upload.fields([
      { name: "paymentImage", maxCount: 1 }
    ]),
    orderController.createOrder
  );

  // ... rest of your routes ...

  router.put(
    "/:id",
    upload.fields([{ name: "paymentImage", maxCount: 1 }]),
    orderController.updateOrder
  );

  // ... rest of the routes remain the same ...
  router.get("/:orderId/:userId", orderController.getOrderByOrderIdAndUserId);


  router.get("/", orderController.getOrders);
  router.get("/:id", orderController.getOrderById);
  router.put("/:id", upload.fields([{ name: "paymentImage", maxCount: 1 }]), orderController.updateOrder);
  router.delete("/:id", orderController.deleteOrder);
  router.delete("/", orderController.deleteAllOrders);

  module.exports = router;
