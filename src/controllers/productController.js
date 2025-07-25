const express = require('express');
const mongoose = require('mongoose');
const Product = require("../models/Product");
const Category = require("../models/Category");
const { Upload } = require("@aws-sdk/lib-storage");
const { S3Client, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const multer = require('multer');
const path = require('path');

// Configure S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.AWS_BUCKET_NAME;

// Configure multer for memory storage (for S3 uploads)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Create a new product with S3 image upload
exports.createProduct = async (req, res) => {
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
      videoLink,
      rating
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

    // Handle image upload to S3
    let imageUrl = null;
    let imageKey = null;

    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map(async (file) => {
        const fileKey = `products/${Date.now()}-${file.originalname}`;
        
        const upload = new Upload({
          client: s3Client,
          params: {
            Bucket: BUCKET_NAME,
            Key: fileKey,
            Body: file.buffer,
            ContentType: file.mimetype,
            ACL: 'public-read'
          },
        });

        const result = await upload.done();
        return {
          url: result.Location,
          key: result.Key
        };
      });

      const uploadedImages = await Promise.all(uploadPromises);
      imageUrl = uploadedImages[0].url;
      imageKey = uploadedImages[0].key;
    }

    // Create a new product
    const newProduct = new Product({
      name: name.trim(),
      price,
      shortDescription,
      fullDescription,
      stockQuantity,
      category,
      images: imageUrl ? [{ url: imageUrl, key: imageKey }] : [],
      discount: hasDiscount === "true" ? discount : 0,
      hasDiscount: hasDiscount === "true",
      videoLink,
      rating
    });

    await newProduct.save();
    res.status(201).json(newProduct);
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(500).json({ 
      message: "Server error", 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Update product
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
      sold,
      videoLink,
      rating
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
    if (videoLink !== undefined) updateData.videoLink = videoLink;
    if (rating !== undefined) updateData.rating = rating;

    // Handle sold count update
    if (sold !== undefined) {
      const newSold = Number(sold);
      if (newSold < product.sold) {
        return res.status(400).json({ message: "Sold count cannot decrease" });
      }

      const increaseInSold = newSold - product.sold;
      if (increaseInSold > 0) {
        const newStockQuantity = product.stockQuantity - increaseInSold;
        if (newStockQuantity < 0) {
          return res.status(400).json({ message: "Not enough stock available" });
        }
        updateData.stockQuantity = newStockQuantity;
      }

      updateData.sold = newSold;
    }

    // Handle stock quantity update
    if (stockQuantity !== undefined) {
      updateData.stockQuantity = Number(stockQuantity);
    }

    // Handle category update
    if (category) {
      const existingCategory = await Category.findById(category);
      if (!existingCategory) return res.status(400).json({ message: "Invalid category ID" });
      updateData.category = category;
    }

    // Handle image upload
    if (req.files && req.files.length > 0) {
      // First delete old images from S3
      if (product.images && product.images.length > 0) {
        const deletePromises = product.images.map(image => {
          const deleteParams = {
            Bucket: BUCKET_NAME,
            Key: image.key
          };
          return s3Client.send(new DeleteObjectCommand(deleteParams));
        });
        await Promise.all(deletePromises);
      }

      // Upload new images
      const uploadPromises = req.files.map(async (file) => {
        const fileKey = `products/${Date.now()}-${file.originalname}`;
        
        const upload = new Upload({
          client: s3Client,
          params: {
            Bucket: BUCKET_NAME,
            Key: fileKey,
            Body: file.buffer,
            ContentType: file.mimetype,
            ACL: 'public-read'
          },
        });

        const result = await upload.done();
        return {
          url: result.Location,
          key: result.Key
        };
      });

      const uploadedImages = await Promise.all(uploadPromises);
      updateData.images = uploadedImages;
    }

    // Update product
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id, 
      updateData, 
      { new: true }
    );

    res.json({ message: "Product updated successfully", product: updatedProduct });
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ 
      message: "Server error", 
      error: error.message 
    });
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
      shortDescription: product.shortDescription, // Include shortDescription
      fullDescription: product.fullDescription, // Include fullDescription
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
      shortDescription: product.shortDescription, // Include shortDescription
      fullDescription: product.fullDescription, // Include fullDescription
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

// Get all products
exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find().populate("category", "name");
    // Add the base URL for the image
    const productsWithImageUrl = products.map(product => ({
      ...product.toObject(),
      shortDescription: product.shortDescription, // Include shortDescription
      fullDescription: product.fullDescription, // Include fullDescription
      photo: product.image ? `${req.protocol}://${req.get("host")}/uploads/${product.image}` : null,
    }));
    res.json(productsWithImageUrl);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get product by ID
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

// Get discounted products
exports.getDiscountedProducts = async (req, res) => {
  try {
    const discountedProducts = await Product.find({
      hasDiscount: true,
      discount: { $gt: 0 },
    }).populate("category", "name");

    const productsWithImageUrl = discountedProducts.map((product) => ({
      _id: product._id,
      name: product.name,
      shortDescription: product.shortDescription, // Include shortDescription
      fullDescription: product.fullDescription, // Include fullDescription
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

// Delete product
exports.deleteProduct = async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);
    if (!deletedProduct) return res.status(404).json({ message: "Product not found" });
    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get products by category
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
      shortDescription: product.shortDescription, // Include shortDescription
      fullDescription: product.fullDescription, // Include fullDescription
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