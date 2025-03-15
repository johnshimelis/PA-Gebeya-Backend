const express = require('express');
const path = require('path');
const app = express();
const multer = require('multer');


// Set up multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 
  'image/bmp', 'image/tiff', 'image/svg+xml', 'image/avif', 
  'application/octet-stream']; // Add 'application/octet-stream' for AVIF fallback

const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.svg', '.webp', '.avif'];

const fileFilter = (req, file, cb) => {
const ext = path.extname(file.originalname).toLowerCase();

if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
cb(null, true);
} else {
cb(new Error(`Unsupported file format: ${file.mimetype} (${ext})`), false);
}
};


const upload = multer({ storage, fileFilter });

// Serve static files (images) from the 'uploads' directory

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
const Product = require("../models/Product");
const Category = require("../models/Category");


exports.createProduct = async (req, res) => {
  console.log("📝 Raw Request Body:", req.body);
  console.log("📸 Uploaded File:", req.file);

  try {
    const {
      name,
      price,
      shortDescription,
      fullDescription,
      stockQuantity,
      category,
      discount,
      hasDiscount,
    } = req.body;

    // Validation for required fields
    if (!name || name.trim() === "") {
      return res.status(400).json({ message: "Name is required" });
    }

    // Check if the category exists
    const existingCategory = await Category.findById(category);
    if (!existingCategory) {
      return res.status(400).json({ message: "Invalid category ID" });
    }

    // Create a new product with optional discount
    const newProduct = new Product({
      name: name.trim(),
      price,
      shortDescription,
      fullDescription,
      stockQuantity,
      category,
      image: req.file ? req.file.filename : null,
      discount: hasDiscount === "true" ? discount : 0, // Only apply discount if `hasDiscount` is true
      hasDiscount: hasDiscount === "true", // Convert to boolean
    });

    await newProduct.save();
    res.status(201).json(newProduct);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update product with sold count and adjust stock
exports.updateProduct = async (req, res) => {
  try {
    const {
      name,
      price,
      shortDescription,
      fullDescription,
      stockQuantity,
      category,
      discount,
      hasDiscount,
      sold, // User-provided sold count
    } = req.body;

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    let updateData = {};

    if (name) updateData.name = name;
    if (price) updateData.price = price;
    if (shortDescription) updateData.shortDescription = shortDescription;
    if (fullDescription) updateData.fullDescription = fullDescription;
    if (discount !== undefined) updateData.discount = hasDiscount === "true" ? discount : 0;
    if (hasDiscount !== undefined) updateData.hasDiscount = hasDiscount === "true";

    // ✅ Check if sold increased
    if (sold !== undefined) {
      const newSold = Number(sold);
      if (newSold < product.sold) {
        return res.status(400).json({ message: "Sold count cannot decrease" });
      }

      const increaseInSold = newSold - product.sold;
      if (increaseInSold > 0) {
        // ✅ Reduce stockQuantity accordingly
        const newStockQuantity = product.stockQuantity - increaseInSold;
        if (newStockQuantity < 0) {
          return res.status(400).json({ message: "Not enough stock available" });
        }
        updateData.stockQuantity = newStockQuantity;
      }

      updateData.sold = newSold;
    }

    // ✅ Allow stockQuantity to be updated only if provided
    if (stockQuantity !== undefined) {
      updateData.stockQuantity = Number(stockQuantity);
    }

    // Validate and update category
    if (category) {
      try {
        const existingCategory = await Category.findById(category);
        if (!existingCategory) return res.status(400).json({ message: "Invalid category ID" });
        updateData.category = category;
      } catch (error) {
        return res.status(400).json({ message: "Invalid category format" });
      }
    }

    // Handle image upload
    if (req.file) {
      updateData.image = req.file.filename;
    }

    // Update product
    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true });

    if (!updatedProduct) return res.status(404).json({ message: "Product not found" });

    res.json({ message: "Product updated successfully", product: updatedProduct });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};



// Get top 5 best-selling products
exports.getBestSellers = async (req, res) => {
  try {
    const bestSellers = await Product.find()
      .sort({ sold: -1 }) // Sort by highest sold first
      .limit(5)
      .populate("category", "name");

    const productsWithRanking = bestSellers.map((product, index) => ({
      rank: index + 1, // Assign rank from 1 to 5
      _id: product._id,
      name: product.name,
      category: product.category ? product.category.name : "Uncategorized",
      price: product.price,
      sold: product.sold,
      stockQuantity: product.stockQuantity,
      image: product.image
        ? `${req.protocol}://${req.get("host")}/uploads/${product.image}`
        : null,
    }));

    res.json(productsWithRanking);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get products with no discount
exports.getNonDiscountedProducts = async (req, res) => {
  try {
    const nonDiscountedProducts = await Product.find({
      hasDiscount: false,
      discount: 0,
    }).populate("category", "name");

    const productsWithImageUrl = nonDiscountedProducts.map((product) => ({
      _id: product._id,
      name: product.name,
      category: product.category ? product.category.name : "Uncategorized",
      price: product.price,
      hasDiscount: product.hasDiscount,
      discount: product.discount,
      image: product.image
        ? `${req.protocol}://${req.get("host")}/uploads/${product.image}`
        : null,
    }));

    res.json(productsWithImageUrl);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};




exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find().populate("category", "name");
    // Add the base URL for the image
    const productsWithImageUrl = products.map(product => ({
      ...product.toObject(),
      photo: product.image ? `${req.protocol}://${req.get("host")}/uploads/${product.image}` : null,
    }));
    res.json(productsWithImageUrl);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate("category", "name");
    if (!product) return res.status(404).json({ message: "Product not found" });
    // Add the base URL for the image
    product.image = product.image ? `${req.protocol}://${req.get("host")}/uploads/${product.image}` : null;
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getDiscountedProducts = async (req, res) => {
  try {
    const discountedProducts = await Product.find({
      hasDiscount: true,
      discount: { $gt: 0 },
    }).populate("category", "name");

    const productsWithImageUrl = discountedProducts.map((product) => ({
      _id: product._id,
      name: product.name,
      category: product.category ? product.category.name : "Uncategorized",
      price: product.price,
      discount: product.discount,
      originalPrice: product.price,
      calculatedPrice: product.price - (product.price * product.discount) / 100,
      hasDiscount: product.hasDiscount,
      image: product.image
        ? `${req.protocol}://${req.get("host")}/uploads/${product.image}`
        : null,
    }));

    res.json(productsWithImageUrl);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};



exports.deleteProduct = async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);
    if (!deletedProduct) return res.status(404).json({ message: "Product not found" });
    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const mongoose = require("mongoose");

exports.getProductsByCategory = async (req, res) => {
  try {
    const categoryId = req.params.categoryId;

    // Validate category ID
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({ message: "Invalid category ID" });
    }

    // Check if the category exists
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    // Fetch products by category
    const products = await Product.find({ category: categoryId }).populate("category", "name");

    // Add the base URL for the image
    const productsWithImageUrl = products.map((product) => ({
      _id: product._id,
      name: product.name,
      category: product.category ? product.category.name : "Uncategorized",
      price: product.price,
      discount: product.discount,
      hasDiscount: product.hasDiscount,
      image: product.image
        ? `${req.protocol}://${req.get("host")}/uploads/${product.image}`
        : null,
    }));

    res.json(productsWithImageUrl);
  } catch (error) {
    console.error("Error fetching products by category:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};