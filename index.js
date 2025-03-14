const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();

// ✅ CORS Middleware - Allow requests from any domain
app.use(cors({
    origin: "*", // Allow requests from any domain
    credentials: true, // Allow credentials like cookies & authentication headers
    methods: ["GET", "POST", "PUT", "DELETE"], // Allowed HTTP methods
    allowedHeaders: ["Content-Type", "Authorization"], // Allowed headers
}));

// ✅ Middleware
app.use(express.json()); // Parses JSON requests
app.use(express.urlencoded({ extended: true })); // Parses URL-encoded form data
app.use("/uploads", express.static(path.join(__dirname, "uploads"))); // Serve static files

// Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/pa-gebeya";
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
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
