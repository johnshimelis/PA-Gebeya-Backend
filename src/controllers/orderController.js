const { S3Client } = require("@aws-sdk/client-s3");
const multerS3 = require("multer-s3");
const path = require("path");
const multer = require("multer");
const Order = require("../models/Order");
const Product = require("../models/Product");

// Configure AWS S3
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Multer configuration for S3
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_BUCKET_NAME,
    metadata: (req, file, cb) => {
      cb(null, { fieldName: file.fieldname });
    },
    key: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const fileName = `${Date.now()}${ext}`;
      cb(null, fileName);
    },
  }),
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/tiff', 'image/svg+xml', 'image/avif', 'application/octet-stream'];
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.svg', '.webp', '.avif'];

    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file format: ${file.mimetype} (${ext})`), false);
    }
  },
});

// Helper function to get full image URL
const getImageUrl = (imageName) =>
  imageName ? `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${imageName}` : null;

// ✅ Create New Order (Updated to handle both JSON and form-data)
exports.createOrder = async (req, res) => {
  try {
    let orderData = {};
    
    // Check if request is JSON (from cash on delivery)
    if (req.headers['content-type']?.includes('application/json')) {
      orderData = req.body;
    } 
    // Otherwise handle as multipart form (existing flow)
    else {
      // Process form-data fields
      orderData = {
        userId: req.body.userId,
        name: req.body.name,
        amount: req.body.amount,
        phoneNumber: req.body.phoneNumber,
        deliveryAddress: req.body.deliveryAddress,
        status: req.body.status || "Pending",
        paymentMethod: req.body.paymentMethod,
        orderDetails: req.body.orderDetails ? JSON.parse(req.body.orderDetails) : [],
        avatar: req.files["avatar"] ? getImageUrl(req.files["avatar"][0].key) : getImageUrl("default-avatar.png"),
        paymentImage: req.files["paymentImage"] ? getImageUrl(req.files["paymentImage"][0].key) : null
      };
    }

    console.log("📌 Processing Order Data:", orderData);

    // Common processing for both flows
    const userId = orderData.userId || "Unknown ID";
    const name = orderData.name || "Unknown";
    const amount = orderData.amount ? parseFloat(orderData.amount) : 0;
    const phoneNumber = orderData.phoneNumber || "";
    const deliveryAddress = orderData.deliveryAddress || "";
    const status = orderData.status || "Pending";
    const paymentMethod = orderData.paymentMethod || "Cash On Delivery";
    const avatar = orderData.avatar || getImageUrl("default-avatar.png");

    // Process order details - FIXED VERSION
    let orderDetails = [];
    if (orderData.orderDetails) {
      // Handle both stringified JSON and direct array
      const details = typeof orderData.orderDetails === 'string' 
        ? JSON.parse(orderData.orderDetails)
        : orderData.orderDetails;

      orderDetails = await Promise.all(
        details.map(async (item) => {
          try {
            // Handle both product object and direct productId
            const productId = item.product?._id || item.productId;
            const product = await Product.findById(productId);

            if (!product) {
              console.error(`❌ Product not found for ID: ${productId}`);
              return null;
            }

            return {
              productId: product._id,
              product: product.name,
              quantity: item.quantity || 1,
              price: item.price || product.price || 0,
              productImage: item.product?.images?.[0] || product.images?.[0] || null,
            };
          } catch (error) {
            console.error(`❌ Error processing order item:`, error);
            return null;
          }
        })
      );

      // Remove any null items from failed processing
      orderDetails = orderDetails.filter(item => item !== null);
    }

    console.log("✅ Final Order Details:", orderDetails);

    // Create new order
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
      paymentMethod,
      paymentImage: orderData.paymentImage || null,
      orderDetails,
      createdAt: new Date(),
    });

    await newOrder.save();
    res.status(201).json(newOrder);
  } catch (error) {
    console.error("❌ Error creating order:", error);
    res.status(500).json({ 
      error: "Failed to create order",
      details: error.message 
    });
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

// ✅ Get Order By Order ID and User ID
exports.getOrderByOrderIdAndUserId = async (req, res) => {
  const { orderId, userId } = req.params;
  console.log("Fetching order for:", orderId, userId); // Log the parameters

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

// Export the upload middleware
module.exports.upload = upload;
