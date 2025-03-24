const { S3Client, DeleteObjectCommand } = require("@aws-sdk/client-s3"); // AWS SDK v3
const multerS3 = require("multer-s3");
const path = require("path");
const multer = require("multer");
const { SSM } = require("aws-sdk"); // AWS SDK for fetching parameters
const Order = require("../models/Order");
const Product = require("../models/Product");

// Initialize AWS SSM
const ssm = new SSM({ region: "eu-north-1" }); // Replace with your AWS region

// Function to fetch parameters from AWS Systems Manager
async function getParameter(name, isSecure = false) {
  const param = await ssm
    .getParameter({
      Name: name,
      WithDecryption: isSecure,
    })
    .promise();
  return param.Parameter.Value;
}

// Load AWS environment variables from AWS Systems Manager
async function loadAWSEnv() {
  try {
    process.env.AWS_ACCESS_KEY_ID = await getParameter("/pgebeya-backend/AWS_ACCESS_KEY_ID", true);
    process.env.AWS_SECRET_ACCESS_KEY = await getParameter("/pgebeya-backend/AWS_SECRET_ACCESS_KEY", true);
    process.env.AWS_REGION = await getParameter("/pgebeya-backend/AWS_REGION");
    process.env.AWS_BUCKET_NAME = await getParameter("/pgebeya-backend/AWS_BUCKET_NAME");

    console.log("✅ AWS environment variables loaded successfully");
  } catch (error) {
    console.error("❌ Error loading AWS environment variables:", error);
    process.exit(1); // Exit the process if environment variables fail to load
  }
}

// Configure AWS S3 (SDK v3)
let s3;
let upload;

async function initializeS3() {
  await loadAWSEnv();

  s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  // Multer configuration for S3 (SDK v3)
  upload = multer({
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
      acl: undefined, // Remove ACL configuration
    }),
    fileFilter: (req, file, cb) => {
      const allowedMimeTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/bmp",
        "image/tiff",
        "image/svg+xml",
        "image/avif",
        "application/octet-stream",
      ]; // Add 'application/octet-stream' for AVIF fallback
      const allowedExtensions = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff", ".svg", ".webp", ".avif"];

      const ext = path.extname(file.originalname).toLowerCase();

      if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error(`Unsupported file format: ${file.mimetype} (${ext})`), false);
      }
    },
  });
}

// Helper function to get full image URL
const getImageUrl = (imageName) =>
  imageName ? `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${imageName}` : null;

// ✅ Create New Order
exports.createOrder = async (req, res) => {
  try {
    const cleanedBody = {};
    Object.keys(req.body).forEach((key) => {
      cleanedBody[key.trim()] = req.body[key];
    });

    console.log("📌 Cleaned Request Body:", cleanedBody);
    console.log("📸 Uploaded Files:", req.files);

    const userId = cleanedBody.userId || "Unknown ID";
    const name = cleanedBody.name || "Unknown";
    const amount = cleanedBody.amount ? parseFloat(cleanedBody.amount) : 0;
    const phoneNumber = cleanedBody.phoneNumber || "";
    const deliveryAddress = cleanedBody.deliveryAddress || "";
    const status = cleanedBody.status || "Pending";

    // Upload avatar to S3
    const avatar = req.files["avatar"]
      ? getImageUrl(req.files["avatar"][0].key) // Use S3 key to generate URL
      : getImageUrl("default-avatar.png");

    console.log("🖼️ Avatar Path Saved:", avatar);

    // Upload payment image to S3
    const paymentImage = req.files["paymentImage"]
      ? getImageUrl(req.files["paymentImage"][0].key) // Use S3 key to generate URL
      : null;

    // Upload product images to S3
    const productImages = req.files["productImages"]
      ? req.files["productImages"].map((file) => getImageUrl(file.key)) // Use S3 key to generate URLs
      : [];

    let orderDetails = [];
    if (cleanedBody.orderDetails) {
      try {
        orderDetails = JSON.parse(cleanedBody.orderDetails);

        orderDetails = await Promise.all(
          orderDetails.map(async (item, index) => {
            const product = await Product.findOne({ name: item.product });

            if (!product) {
              console.error(`❌ Product not found: ${item.product}`);
              return null;
            }

            console.log(`✅ Found Product: ${product.name} - ID: ${product._id}`);

            return {
              productId: product._id, // ✅ Store actual product ID
              product: item.product,
              quantity: item.quantity || 1,
              price: item.price || 0,
              productImage: productImages[index] || null, // Use S3 URL
            };
          })
        );

        orderDetails = orderDetails.filter((item) => item !== null); // Remove null values if any
      } catch (error) {
        return res.status(400).json({ error: "Invalid JSON format in orderDetails" });
      }
    }

    console.log("✅ Final Order Details before saving:", orderDetails);

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
      paymentImage,
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

// Initialize S3 and upload middleware
initializeS3();

// Export the upload middleware
module.exports.upload = upload;