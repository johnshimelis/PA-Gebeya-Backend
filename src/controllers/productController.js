const express = require('express');
const path = require('path');
const app = express();

// Serve static files (images) from the 'uploads' directory

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
const Product = require("../models/Product");
const Category = require("../models/Category");


exports.createProduct = async (req, res) => {
  console.log("📝 Raw Request Body:", req.body);
  console.log("📸 Uploaded File:", req.file);
  
  try {
    const { name, price, shortDescription, fullDescription, stockQuantity, category } = req.body;
    
    if (!name || name.trim() === "") {
      return res.status(400).json({ message: "Name is required" });
    }

    const existingCategory = await Category.findById(category);
    if (!existingCategory) {
      return res.status(400).json({ message: "Invalid category ID" });
    }

    const newProduct = new Product({
      name: name.trim(),
      price,
      shortDescription,
      fullDescription,
      stockQuantity,
      category,
      image: req.file ? req.file.filename : null
    });

    await newProduct.save();
    res.status(201).json(newProduct);
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

exports.updateProduct = async (req, res) => {
  try {
    const { name, price, shortDescription, fullDescription, stockQuantity, category } = req.body;
    const updateData = { name, price, shortDescription, fullDescription, stockQuantity };

    if (category) {
      const existingCategory = await Category.findById(category);
      if (!existingCategory) return res.status(400).json({ message: "Invalid category ID" });
      updateData.category = category;
    }

    if (req.file) {
      updateData.image = req.file.filename;
    }

    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!updatedProduct) return res.status(404).json({ message: "Product not found" });

    res.json({ message: "Product updated successfully", product: updatedProduct });
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
