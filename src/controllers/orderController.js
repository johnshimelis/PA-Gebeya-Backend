const Order = require("../models/Order");
const Product = require("../models/Product");
const multer = require("multer");
const { uploadToS3 } = require("../utils/s3Uploader"); // Import your S3 upload utility

// Use memory storage for S3 uploads
const storage = multer.memoryStorage();
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

    const userId = cleanedBody.userId || "Unknown ID";
    const name = cleanedBody.name || "Unknown";
    const amount = cleanedBody.amount ? parseFloat(cleanedBody.amount) : 0;
    const phoneNumber = cleanedBody.phoneNumber || "";
    const deliveryAddress = cleanedBody.deliveryAddress || "";
    const status = cleanedBody.status || "Pending";

    // NEW: read optional payment method/text (kept optional to preserve old behavior)
    const rawPaymentMethod = (cleanedBody.paymentMethod || "").toString().trim();
    const normalizedPaymentMethod = rawPaymentMethod.toUpperCase();
    const incomingPaymentText =
      cleanedBody.paymentText && cleanedBody.paymentText.toString
        ? cleanedBody.paymentText.toString().trim()
        : null;

    // Default avatar (can be updated to use S3 if needed)
    const avatar = "/uploads/default-avatar.png";

    // Handle payment:
    // - If COD (or paymentText provided), accept text and skip image upload.
    // - Else keep existing image upload logic.
    let paymentImageUrl = null;
    let paymentText = null;
    let paymentMethod = rawPaymentMethod || null;

    const wantsCOD =
      normalizedPaymentMethod === "COD" || (!!incomingPaymentText && !rawPaymentMethod);

    if (wantsCOD) {
      paymentMethod = "COD";
      paymentText = incomingPaymentText || "Cash on Delivery";
      // No image upload for COD path
    } else if (req.files && req.files["paymentImage"]) {
      const paymentImageFile = req.files["paymentImage"][0];
      try {
        // Upload to S3 with the same logic as product images
        const s3Response = await uploadToS3({
          fileBuffer: paymentImageFile.buffer,
          fileName: `payment-${Date.now()}-${paymentImageFile.originalname}`,
          fileType: paymentImageFile.mimetype,
          folder: "payments", // Different folder than products
        });
        paymentImageUrl = s3Response.Location;
        console.log("🖼️ Payment Image uploaded to S3:", paymentImageUrl);

        // If no explicit paymentMethod provided, keep old behavior but you can mark it as 'IMAGE' or leave null.
        if (!paymentMethod) paymentMethod = "IMAGE";
      } catch (s3Error) {
        console.error("❌ S3 Upload Error:", s3Error);
        return res
          .status(500)
          .json({ error: "Failed to upload payment image to S3" });
      }
    }

    let orderDetails = [];
    if (cleanedBody.orderDetails) {
      try {
        orderDetails = JSON.parse(cleanedBody.orderDetails);
        orderDetails = orderDetails.map((item) => ({
          productId: item.productId,
          product: item.product,
          quantity: item.quantity || 1,
          price: item.price || 0,
          productImage: item.productImage || null,
        }));
      } catch (error) {
        return res
          .status(400)
          .json({ error: "Invalid JSON format in orderDetails" });
      }
    }

    const lastOrder = await Order.findOne().sort({ id: -1 });
    const newId = lastOrder ? lastOrder.id + 1 : 1;

    const newOrder = new Order({
      id: newId,
      userId,
      name,
      amount,
      status,
      phoneNumber,
      deliveryAddress,
      avatar,
      paymentImage: paymentImageUrl, // S3 URL (if provided)
      // NEW: persist method/text (harmless if schema already has these fields)
      paymentMethod: paymentMethod || null,
      paymentText: paymentText || null,
      orderDetails,
      createdAt: new Date(),
    });

    await newOrder.save();
    res.status(201).json(newOrder);
  } catch (error) {
    console.error("❌ Error creating order:", error.message);
    res.status(500).json({ error: error.message });
  }
};

// ... rest of your controller methods ...

// ✅ Update Order
exports.updateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // NEW: allow updating COD text or switching method
    // If caller sets paymentMethod=COD or provides paymentText, accept the text.
    const bodyPaymentMethod =
      updates.paymentMethod && updates.paymentMethod.toString
        ? updates.paymentMethod.toString().trim().toUpperCase()
        : null;
    const bodyPaymentText =
      updates.paymentText && updates.paymentText.toString
        ? updates.paymentText.toString().trim()
        : null;

    if (bodyPaymentMethod === "COD" || bodyPaymentText) {
      updates.paymentMethod = "COD";
      updates.paymentText = bodyPaymentText || "Cash on Delivery";
      // Optional: If switching to COD explicitly and no new image uploaded, clear image.
      if (!(req.files && req.files["paymentImage"])) {
        updates.paymentImage = null;
      }
    }

    // Handle payment image update to S3 (kept as-is)
    if (req.files && req.files["paymentImage"]) {
      const paymentImageFile = req.files["paymentImage"][0];
      try {
        const s3Response = await uploadFileToS3({
          file: paymentImageFile,
          folder: "payments",
        });
        updates.paymentImage = s3Response.Location;
        // If uploading an image, and no method specified, mark method accordingly without breaking old behavior
        if (!updates.paymentMethod) updates.paymentMethod = "IMAGE";
        // Clear any previous paymentText if moving away from COD (optional—remove if you prefer to keep it)
        if (!bodyPaymentMethod || bodyPaymentMethod !== "COD") {
          // leave paymentText as-is unless you want to explicitly clear it
        }
      } catch (error) {
        console.error("❌ Payment Image S3 Upload Error:", error);
        return res
          .status(500)
          .json({ error: "Failed to upload payment image" });
      }
    }

    const order = await Order.findOneAndUpdate(
      { id: parseInt(id) },
      updates,
      {
        new: true,
      }
    );

    if (!order) {
      return res.status(404).json({ error: "Order not found!" });
    }

    if (updates.status === "Delivered") {
      for (const item of order.orderDetails) {
        const product = await Product.findById(item.productId);
        if (product) {
          product.sold += item.quantity;
          product.stockQuantity -= item.quantity;
          await product.save();
        }
      }
    }

    res.status(200).json(order);
  } catch (error) {
    console.error("❌ Error updating order:", error.message);
    res.status(500).json({ error: "Failed to update order." });
  }
};

// ... rest of the controller remains the same ...

// ✅ Get all Orders
exports.getOrders = async (req, res) => {
  try {
    const orders = await Order.find().select(
      "id userId name avatar amount status phoneNumber deliveryAddress paymentImage paymentMethod paymentText orderDetails createdAt"
    );

    console.log(
      "📤 Orders Fetched from Database:",
      JSON.stringify(orders, null, 2)
    );

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
      "id userId name avatar amount status phoneNumber deliveryAddress paymentImage paymentMethod paymentText orderDetails createdAt"
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
    if (!deletedOrder)
      return res.status(404).json({ message: "Order not found" });
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
  console.log("Fetching order for:", orderId, userId); // Log the parameters

  try {
    const order = await Order.findOne({ id: orderId, userId: userId });

    if (!order) {
      console.log(
        `No order found for orderId: ${orderId} and userId: ${userId}`
      );
      return res.status(404).json({ message: "Order not found" });
    }

    res.json({ order });
  } catch (error) {
    console.error("Error retrieving order details:", error);
    res.status(500).json({ message: "Error retrieving order details" });
  }
};
