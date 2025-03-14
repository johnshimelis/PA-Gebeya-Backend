const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const axios = require("axios"); // For proxying image requests
require("dotenv").config();

const app = express();

// ✅ CORS Middleware - Allow requests from all origins, including uploads
app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:3001"], // Allowed origins
    credentials: true, // Allow cookies/auth headers
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ✅ Middleware
app.use(express.json()); // Parses JSON requests
app.use(express.urlencoded({ extended: true })); // Parses URL-encoded form data

// ✅ Serve Static Files with CORS Headers
app.use("/uploads", express.static(path.join(__dirname, "uploads"), {
  setHeaders: (res, path, stat) => {
    res.set("Access-Control-Allow-Origin", "*"); // Allow all origins for static files
    res.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }
}));

// ✅ Proxy Route for Images
app.get("/proxy-image", async (req, res) => {
  const imageUrl = req.query.url; // Get the image URL from the query parameter

  try {
    const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
    res.set("Access-Control-Allow-Origin", "*"); // Allow all origins
    res.set("Content-Type", response.headers["content-type"]);
    res.send(response.data);
  } catch (error) {
    console.error("Error proxying image:", error);
    res.status(500).send("Error fetching image");
  }
});

// Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/pa-gebeya";
mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));

// ✅ Default Route
app.get("/", (req, res) => {
  res.send("Welcome to PA-Gebeya API 🚀 (Local Development Mode)");
});

// ✅ Import Routes
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

const userRoutes = require("./src/routes/userRoutes");
app.use("/api/users", userRoutes);

const adsRoutes = require("./src/routes/adsRoutes");
app.use("/api/ads", adsRoutes);

// ✅ Start Server on Port 5000
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));