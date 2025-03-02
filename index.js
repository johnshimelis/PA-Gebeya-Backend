const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const app = express();

// Ensure 'uploads' folder exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log("✅ 'uploads' folder created.");
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Serve static files from 'uploads' folder
app.use("/uploads", (req, res, next) => {
  console.log(`🖼️ Static file request: ${req.url}`);
  next();
}, express.static(uploadsDir));

// Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/pa-gebeya";
mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));

// API Routes
app.get("/", (req, res) => {
  res.send("Welcome to PA-Gebeya API 🚀");
});

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

const uploadRoutes = require("./src/routes/uploadRoutes");
app.use("/api/upload", uploadRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
