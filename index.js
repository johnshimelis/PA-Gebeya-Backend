const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const { SSM } = require("aws-sdk"); // AWS SDK for fetching parameters

const app = express();

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

// Load environment variables from AWS Systems Manager
async function loadEnv() {
  try {
    process.env.PORT = await getParameter("/pgebeya-backend/PORT");
    process.env.MONGO_URI = await getParameter("/pgebeya-backend/MONGO_URI", true);
    process.env.JWT_SECRET = await getParameter("/pgebeya-backend/JWT_SECRET", true);
    process.env.EMAIL_USER = await getParameter("/pgebeya-backend/EMAIL_USER");
    process.env.EMAIL_PASS = await getParameter("/pgebeya-backend/EMAIL_PASS", true);
    process.env.EMAIL_HOST = await getParameter("/pgebeya-backend/EMAIL_HOST");
    process.env.EMAIL_PORT = await getParameter("/pgebeya-backend/EMAIL_PORT");
    process.env.OTP_EXPIRATION = await getParameter("/pgebeya-backend/OTP_EXPIRATION");
    process.env.AWS_ACCESS_KEY_ID = await getParameter("/pgebeya-backend/AWS_ACCESS_KEY_ID", true);
    process.env.AWS_SECRET_ACCESS_KEY = await getParameter("/pgebeya-backend/AWS_SECRET_ACCESS_KEY", true);
    process.env.AWS_REGION = await getParameter("/pgebeya-backend/AWS_REGION");
    process.env.AWS_BUCKET_NAME = await getParameter("/pgebeya-backend/AWS_BUCKET_NAME");

    console.log("✅ Environment variables loaded successfully");
  } catch (error) {
    console.error("❌ Error loading environment variables:", error);
    process.exit(1); // Exit the process if environment variables fail to load
  }
}

// Allowed origins
const allowedOrigins = [
  "https://sprightly-sawine-43e5c3.netlify.app",
  "https://chimerical-lebkuchen-58351a.netlify.app",
  "https://pgebeya.netlify.app",
  "https://pgebeya.netlify.app",
  "http://localhost:3000", // Add localhost:3000
  "http://localhost:3001", // Add localhost:3001
  "http://localhost:3002", // Add localhost:3001
];

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: allowedOrigins, // Allow both Netlify frontends and localhost
    credentials: true, // Allow cookies and authentication headers
    methods: ["GET", "POST", "PUT", "DELETE"], // Allowed HTTP methods
    allowedHeaders: ["Content-Type", "Authorization"], // Allowed headers
  })
);

// Manually set CORS headers for all responses
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  }
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");
  next();
});

app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.urlencoded({ extended: true })); // Parses URL-encoded form data

// Connect to MongoDB
async function connectToMongoDB() {
  const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/pa-gebeya";
  try {
    await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log("✅ MongoDB Connected");
  } catch (err) {
    console.error("❌ MongoDB Connection Error:", err);
    process.exit(1); // Exit the process if MongoDB connection fails
  }
}

// Import Routes
const authRoutes = require("./src/routes/authRoutes");
app.use("/api/auth", authRoutes);

const categoryRoutes = require("./src/routes/categoryRoutes");
app.use("/api/categories", categoryRoutes);

const productRoutes = require("./src/routes/productRoutes");
app.use("/api/products", productRoutes);

const orderRoutes = require("./src/routes/orderRoutes");
app.use("/api/orders", orderRoutes);

const cartRoutes = require("./src/routes/cartRoutes");
app.use("/api/cart", cartRoutes);

const userRoute = require("./src/routes/userRoutes");
app.use("/api/users", userRoute);

const adsRoutes = require("./src/routes/adsRoutes");
app.use("/api/ads", adsRoutes);

app.get("/", (req, res) => {
  res.send("Welcome to PA-Gebeya API 🚀");
});

// Start the server after loading environment variables and connecting to MongoDB
async function startServer() {
  await loadEnv();
  await connectToMongoDB();

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
}

startServer();