const { S3Client, DeleteObjectCommand } = require("@aws-sdk/client-s3"); // AWS SDK v3
const multerS3 = require("multer-s3");
const path = require("path");
const multer = require("multer");
const mongoose = require("mongoose");
const Product = require("../models/Product");
const Category = require("../models/Category");

// Configure AWS S3 (SDK v3)
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Multer configuration for S3 (SDK v3)
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_BUCKET_NAME,
    metadata: (req, file, cb) => {
      cb(null, { fieldName: file.fieldname });
    },
    key: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`; // Unique filename
      cb(null, fileName);
    },
  }),
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 
      'image/bmp', 'image/tiff', 'image/svg+xml', 'image/avif', 
      'application/octet-stream']; // Add 'application/octet-stream' for AVIF fallback
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.svg', '.webp', '.avif'];

    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file format: ${file.mimetype} (${ext})`), false);
    }
  },
});

// Helper function to get full image URL
const getImageUrl = (imageName) =>
  imageName ? `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${imageName}` : null;

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
      rating,
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
      images: req.files ? req.files.map((file) => file.key) : [],
      discount: hasDiscount === "true" ? discount : 0,
      hasDiscount: hasDiscount === "true",
      videoLink,
      rating: rating || 0,
    });

    await newProduct.save();

    // Populate the category field
    const populatedProduct = await Product.findById(newProduct._id).populate("category", "name");

    // Include the full image URLs in the response
    const responseProduct = {
      ...populatedProduct.toObject(),
      images: (populatedProduct.images || []).map((image) => getImageUrl(image)),
    };

    res.status(201).json(responseProduct);
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
      rating,
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
    if (videoLink) updateData.videoLink = videoLink;
    if (rating) updateData.rating = rating;

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

    if (category) {
      try {
        const existingCategory = await Category.findById(category);
        if (!existingCategory) return res.status(400).json({ message: "Invalid category ID" });
        updateData.category = category;
      } catch (error) {
        return res.status(400).json({ message: "Invalid category format" });
      }
    }

    if (req.files && req.files.length > 0) {
      if (product.images && product.images.length > 0) {
        for (const imageKey of product.images) {
          try {
            await s3.send(new DeleteObjectCommand({
              Bucket: process.env.AWS_BUCKET_NAME,
              Key: imageKey,
            }));
            console.log("Old image deleted from S3:", imageKey);
          } catch (error) {
            console.error("Error deleting old image from S3:", error);
          }
        }
      }
      updateData.images = req.files.map((file) => file.key);
    }

    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true });

    if (!updatedProduct) return res.status(404).json({ message: "Product not found" });

    const responseProduct = {
      ...updatedProduct.toObject(),
      images: (updatedProduct.images || []).map((image) => getImageUrl(image)),
    };

    res.json({ message: "Product updated successfully", product: responseProduct });
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get all products
exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find().populate("category", "name");
    const productsWithImageUrl = products.map((product) => ({
      ...product.toObject(),
      images: (product.images || []).map((image) => getImageUrl(image)),
    }));
    res.json(productsWithImageUrl);
  } catch (error) {
    console.error("Error fetching all products:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get product by ID
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate("category", "name");
    if (!product) return res.status(404).json({ message: "Product not found" });
    const responseProduct = {
      ...product.toObject(),
      images: (product.images || []).map((image) => getImageUrl(image)),
    };
    res.json(responseProduct);
  } catch (error) {
    console.error("Error fetching product by ID:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Delete product
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    if (product.images && product.images.length > 0) {
      for (const imageKey of product.images) {
        try {
          await s3.send(new DeleteObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: imageKey,
          }));
          console.log("Image deleted from S3:", imageKey);
        } catch (error) {
          console.error("Error deleting image from S3:", error);
        }
      }
    }

    await product.deleteOne();
    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Error deleting product:", error);
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
      images: (product.images || []).map((image) => getImageUrl(image)),
      videoLink: product.videoLink,
      rating: product.rating,
    }));

    res.json(productsWithImageUrl);
  } catch (error) {
    console.error("Error fetching discounted products:", error);
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
      images: (product.images || []).map((image) => getImageUrl(image)),
      videoLink: product.videoLink,
      rating: product.rating,
    }));

    res.json(productsWithRanking);
  } catch (error) {
    console.error("Error fetching best sellers:", error);
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
      images: (product.images || []).map((image) => getImageUrl(image)),
      videoLink: product.videoLink,
      rating: product.rating,
    }));

    res.json(productsWithImageUrl);
  } catch (error) {
    console.error("Error fetching non-discounted products:", error);
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
      images: (product.images || []).map((image) => getImageUrl(image)),
      videoLink: product.videoLink,
      rating: product.rating,
    }));

    res.json(productsWithImageUrl);
  } catch (error) {
    console.error("Error fetching products by category:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Export the upload middleware
module.exports.upload = upload;
