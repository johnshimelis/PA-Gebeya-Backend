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

// Updated Multer configuration for multiple files
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_BUCKET_NAME,
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      const ext = path.extname(file.originalname);
      const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      cb(null, fileName);
    }
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
}).array('images', 10); // Handle up to 10 files in the 'images' field

// Helper function to get full image URL
const getImageUrl = (imageName) =>
  imageName ? `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${imageName}` : null;

// Create a new product (updated for multiple images)
exports.createProduct = async (req, res) => {
  try {
    // First handle the file upload
    upload(req, res, async function (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ message: "File upload error", error: err.message });
      } else if (err) {
        return res.status(500).json({ message: "Server error", error: err.message });
      }

      // Now process the product creation with all fields from your screenshot
      const {
        name,
        price,
        shortDescription,
        fullDescription,
        stockQuantity,
        category,
        discount = 0, // Default to 0 if not provided
        hasDiscount = "false", // Default to false if not provided
        videoLink,
        rating,
      } = req.body;

      // Validation for required fields
      if (!name || name.trim() === "") {
        return res.status(400).json({ message: "Name is required" });
      }

      if (!price) {
        return res.status(400).json({ message: "Price is required" });
      }

      if (!category) {
        return res.status(400).json({ message: "Category is required" });
      }

      const existingCategory = await Category.findById(category);
      if (!existingCategory) {
        return res.status(400).json({ message: "Invalid category ID" });
      }

      // Get the uploaded files
      const images = req.files ? req.files.map(file => file.key) : [];

      const newProduct = new Product({
        name: name.trim(),
        price: Number(price),
        shortDescription: shortDescription || "",
        fullDescription: fullDescription || "",
        stockQuantity: stockQuantity ? Number(stockQuantity) : 0,
        category,
        images,
        discount: hasDiscount === "true" ? Number(discount) : 0,
        hasDiscount: hasDiscount === "true",
        videoLink: videoLink || "",
        rating: rating ? Number(rating) : 0,
      });

      await newProduct.save();
      const populatedProduct = await Product.findById(newProduct._id).populate("category", "name");

      const responseProduct = {
        ...populatedProduct.toObject(),
        images: populatedProduct.images.map(image => getImageUrl(image)),
      };

      res.status(201).json(responseProduct);
    });
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// [Keep all your other controller methods exactly as they were]

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
      videoLink, // New field for video link
      rating, // New field for star rating
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
    if (videoLink) updateData.videoLink = videoLink; // Update video link
    if (rating) updateData.rating = rating; // Update star rating

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
    if (req.files && req.files.length > 0) {
      // Delete the old images from S3 if they exist
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
      updateData.images = req.files.map((file) => file.key); // Store the new S3 keys
    }

    // Update product
    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true });

    if (!updatedProduct) return res.status(404).json({ message: "Product not found" });

    // Include the full image URLs in the response
    const responseProduct = {
      ...updatedProduct.toObject(),
      images: updatedProduct.images.map((image) => getImageUrl(image)), // Generate full URLs for all images
    };

    res.json({ message: "Product updated successfully", product: responseProduct });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get all products
exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find().populate("category", "name");
    // Add the base URL for the images
    const productsWithImageUrl = products.map((product) => ({
      ...product.toObject(),
      images: product.images.map((image) => getImageUrl(image)), // Generate full URLs for all images
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
    // Add the base URL for the images
    const responseProduct = {
      ...product.toObject(),
      images: product.images.map((image) => getImageUrl(image)), // Generate full URLs for all images
    };
    res.json(responseProduct);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Delete product
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    // Delete the images from S3 if they exist
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
      images: product.images.map((image) => getImageUrl(image)), // Generate full URLs for all images
      videoLink: product.videoLink, // Include video link
      rating: product.rating, // Include star rating
    }));

    res.json(productsWithImageUrl);
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
      shortDescription: product.shortDescription,
      fullDescription: product.fullDescription,
      category: product.category ? product.category.name : "Uncategorized",
      price: product.price,
      sold: product.sold,
      stockQuantity: product.stockQuantity,
      images: product.images.map((image) => getImageUrl(image)), // Generate full URLs for all images
      videoLink: product.videoLink, // Include video link
      rating: product.rating, // Include star rating
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
      images: product.images.map((image) => getImageUrl(image)), // Generate full URLs for all images
      videoLink: product.videoLink, // Include video link
      rating: product.rating, // Include star rating
    }));

    res.json(productsWithImageUrl);
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

    // Add the base URL for the images
    const productsWithImageUrl = products.map((product) => ({
      _id: product._id,
      name: product.name,
      shortDescription: product.shortDescription,
      fullDescription: product.fullDescription,
      category: product.category ? product.category.name : "Uncategorized",
      price: product.price,
      discount: product.discount,
      hasDiscount: product.hasDiscount,
      images: product.images.map((image) => getImageUrl(image)), // Generate full URLs for all images
      videoLink: product.videoLink, // Include video link
      rating: product.rating, // Include star rating
    }));

    res.json(productsWithImageUrl);
  } catch (error) {
    console.error("Error fetching products by category:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Export the upload middleware
module.exports.upload = upload;
