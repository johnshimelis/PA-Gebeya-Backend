const express = require('express');
const path = require('path');
const app = express();
const multer = require('multer');
const mongoose = require('mongoose');
const Product = require("../models/Product");
const Category = require("../models/Category");
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");

// Configure S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.AWS_BUCKET_NAME;

// Set up multer for memory storage (for S3 uploads)
const storage = multer.memoryStorage();

const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 
  'image/bmp', 'image/tiff', 'image/svg+xml', 'image/avif', 
  'application/octet-stream'];

const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.svg', '.webp', '.avif'];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file format: ${file.mimetype} (${ext})`), false);
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// Helper function to upload image to S3
const uploadToS3 = async (file) => {
  const fileKey = `products/${Date.now()}-${file.originalname}`;
  
  const uploadParams = {
    Bucket: BUCKET_NAME,
    Key: fileKey,
    Body: file.buffer,
    ContentType: file.mimetype,
    ACL: 'public-read'
  };

  await s3Client.send(new PutObjectCommand(uploadParams));
  return {
    url: `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}`,
    key: fileKey
  };
};

// Create a new product
exports.createProduct = async (req, res) => {
  console.log("📝 Raw Request Body:", req.body);
  console.log("📸 Uploaded Files:", req.files);

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

    // Process images
    const images = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const uploadedImage = await uploadToS3(file);
          images.push(uploadedImage);
        } catch (uploadError) {
          console.error('Error uploading to S3:', uploadError);
          return res.status(500).json({ message: "Failed to upload images to S3" });
        }
      }
    }

    // Create a new product with optional discount
    const newProduct = new Product({
      name: name.trim(),
      price,
      shortDescription,
      fullDescription,
      stockQuantity,
      category,
      images, // Now using array of image objects with url and key
      discount: hasDiscount === "true" ? discount : 0,
      hasDiscount: hasDiscount === "true",
      videoLink,
      rating
    });

    await newProduct.save();
    res.status(201).json(newProduct);
  } catch (error) {
    console.error("Error creating product:", error);
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

    // Check if sold increased
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
        return await uploadToS3(file);
      });
      updateData.images = await Promise.all(uploadPromises);
    }

    // Update product
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id, 
      updateData, 
      { new: true }
    );

    if (!updatedProduct) return res.status(404).json({ message: "Product not found" });

    res.json({ message: "Product updated successfully", product: updatedProduct });
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get top 5 best-selling products
exports.getBestSellers = async (req, res) => {
  try {
    const bestSellers = await Product.find()
      .sort({ sold: -1 })
      .limit(5)
      .populate("category", "name");

    const productsWithRanking = bestSellers.map((product, index) => ({
      rank: index + 1,
      _id: product._id,
      name: product.name,
      shortDescription: product.shortDescription,
      fullDescription: product.fullDescription,
      category: product.category ? product.category.name : "Uncategorized",
      price: product.price,
      sold: product.sold,
      stockQuantity: product.stockQuantity,
      // Updated to use S3 URLs from images array
      image: product.images && product.images.length > 0 ? product.images[0].url : null,
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
      shortDescription: product.shortDescription,
      fullDescription: product.fullDescription,
      category: product.category ? product.category.name : "Uncategorized",
      price: product.price,
      hasDiscount: product.hasDiscount,
      discount: product.discount,
      // Updated to use S3 URLs from images array
      image: product.images && product.images.length > 0 ? product.images[0].url : null,
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
    const productsWithImageUrl = products.map(product => ({
      ...product.toObject(),
      shortDescription: product.shortDescription,
      fullDescription: product.fullDescription,
      // Updated to use S3 URLs from images array
      photo: product.images && product.images.length > 0 ? product.images[0].url : null,
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
    // Updated to use S3 URLs from images array
    product.image = product.images && product.images.length > 0 ? product.images[0].url : null;
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
      shortDescription: product.shortDescription,
      fullDescription: product.fullDescription,
      category: product.category ? product.category.name : "Uncategorized",
      price: product.price,
      discount: product.discount,
      originalPrice: product.price,
      calculatedPrice: product.price - (product.price * product.discount) / 100,
      hasDiscount: product.hasDiscount,
      // Updated to use S3 URLs from images array
      image: product.images && product.images.length > 0 ? product.images[0].url : null,
    }));

    res.json(productsWithImageUrl);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Delete product
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    // Delete images from S3
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

    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get products by category
exports.getProductsByCategory = async (req, res) => {
  try {
    const categoryId = req.params.categoryId;

    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({ message: "Invalid category ID" });
    }

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    const products = await Product.find({ category: categoryId }).populate("category", "name");

    const productsWithImageUrl = products.map((product) => ({
      _id: product._id,
      name: product.name,
      shortDescription: product.shortDescription,
      fullDescription: product.fullDescription,
      category: product.category ? product.category.name : "Uncategorized",
      price: product.price,
      discount: product.discount,
      hasDiscount: product.hasDiscount,
      // Updated to use S3 URLs from images array
      image: product.images && product.images.length > 0 ? product.images[0].url : null,
    }));

    res.json(productsWithImageUrl);
  } catch (error) {
    console.error("Error fetching products by category:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};