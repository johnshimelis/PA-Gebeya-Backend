const { S3Client, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const multerS3 = require("multer-s3");
const path = require("path");
const multer = require("multer");
const mongoose = require("mongoose");
const Product = require("../models/Product");
const Category = require("../models/Category");

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
    metadata: (req, file, cb) => cb(null, { fieldName: file.fieldname }),
    key: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      cb(null, fileName);
    },
  }),
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 
      'image/bmp', 'image/tiff', 'image/svg+xml', 'image/avif', 
      'application/octet-stream'];
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.svg', '.webp', '.avif'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file format: ${file.mimetype} (${ext})`), false);
    }
  },
});

// Helper function to safely get image URL
const getImageUrl = (imageName) => {
  if (!imageName) return null;
  return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${imageName}`;
};

// Helper function to safely map images
const mapImages = (images) => {
  return Array.isArray(images) ? images.map(image => getImageUrl(image)) : [];
};

// Create a new product
exports.createProduct = async (req, res) => {
  try {
    const { name, price, shortDescription, fullDescription, stockQuantity, category, 
            discount, hasDiscount, videoLink, rating } = req.body;

    if (!name || !name.trim()) {
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
      images: req.files ? req.files.map(file => file.key) : [],
      discount: hasDiscount === "true" ? discount : 0,
      hasDiscount: hasDiscount === "true",
      videoLink,
      rating: rating || 0,
    });

    await newProduct.save();
    const populatedProduct = await Product.findById(newProduct._id).populate("category", "name");

    res.status(201).json({
      ...populatedProduct.toObject(),
      images: mapImages(populatedProduct.images)
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update product
exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const updateData = {};
    const { name, price, shortDescription, fullDescription, stockQuantity, 
           category, discount, hasDiscount, sold, videoLink, rating } = req.body;

    // Basic field updates
    if (name) updateData.name = name;
    if (price) updateData.price = price;
    if (shortDescription) updateData.shortDescription = shortDescription;
    if (fullDescription) updateData.fullDescription = fullDescription;
    if (discount !== undefined) updateData.discount = hasDiscount === "true" ? discount : 0;
    if (hasDiscount !== undefined) updateData.hasDiscount = hasDiscount === "true";
    if (videoLink) updateData.videoLink = videoLink;
    if (rating) updateData.rating = rating;

    // Handle sold count
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

    // Handle stock quantity
    if (stockQuantity !== undefined) {
      updateData.stockQuantity = Number(stockQuantity);
    }

    // Handle category update
    if (category) {
      const existingCategory = await Category.findById(category);
      if (!existingCategory) return res.status(400).json({ message: "Invalid category ID" });
      updateData.category = category;
    }

    // Handle image updates
    if (req.files?.length > 0) {
      // Delete old images
      if (product.images?.length > 0) {
        await Promise.all(product.images.map(async (imageKey) => {
          try {
            await s3.send(new DeleteObjectCommand({
              Bucket: process.env.AWS_BUCKET_NAME,
              Key: imageKey,
            }));
          } catch (error) {
            console.error("Error deleting old image:", error);
          }
        }));
      }
      updateData.images = req.files.map(file => file.key);
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id, 
      updateData, 
      { new: true }
    ).populate("category", "name");

    res.json({
      message: "Product updated successfully",
      product: {
        ...updatedProduct.toObject(),
        images: mapImages(updatedProduct.images)
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get all products
exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find().populate("category", "name");
    res.json(products.map(product => ({
      ...product.toObject(),
      images: mapImages(product.images)
    })));
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get product by ID
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate("category", "name");
    if (!product) return res.status(404).json({ message: "Product not found" });
    
    res.json({
      ...product.toObject(),
      images: mapImages(product.images)
    });
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
    if (product.images?.length > 0) {
      await Promise.all(product.images.map(async (imageKey) => {
        try {
          await s3.send(new DeleteObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: imageKey,
          }));
        } catch (error) {
          console.error("Error deleting image:", error);
        }
      }));
    }

    await product.deleteOne();
    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get discounted products
exports.getDiscountedProducts = async (req, res) => {
  try {
    const products = await Product.find({
      hasDiscount: true,
      discount: { $gt: 0 }
    }).populate("category", "name");

    res.json(products.map(product => ({
      ...product.toObject(),
      images: mapImages(product.images),
      originalPrice: product.price,
      calculatedPrice: product.price - (product.price * product.discount) / 100
    })));
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get best sellers
exports.getBestSellers = async (req, res) => {
  try {
    const products = await Product.find()
      .sort({ sold: -1 })
      .limit(5)
      .populate("category", "name");

    res.json(products.map((product, index) => ({
      ...product.toObject(),
      images: mapImages(product.images),
      rank: index + 1
    })));
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get non-discounted products
exports.getNonDiscountedProducts = async (req, res) => {
  try {
    const products = await Product.find({
      hasDiscount: false,
      discount: 0
    }).populate("category", "name");

    res.json(products.map(product => ({
      ...product.toObject(),
      images: mapImages(product.images)
    })));
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
    if (!category) return res.status(404).json({ message: "Category not found" });

    const products = await Product.find({ category: categoryId }).populate("category", "name");

    res.json(products.map(product => ({
      ...product.toObject(),
      images: mapImages(product.images),
      category: product.category?.name || "Uncategorized"
    })));
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports.upload = upload;
