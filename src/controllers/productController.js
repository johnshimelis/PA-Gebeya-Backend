const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
const s3Client = require("../utils/s3Client");
const Product = require("../models/Product");
const Category = require("../models/Category");
const BUCKET_NAME = process.env.AWS_BUCKET_NAME;

// Create a new product
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
      image: req.file ? {
        url: req.file.location,  // S3 public URL
        key: req.file.key        // S3 object key
      } : null,
      discount: hasDiscount === "true" ? discount : 0,
      hasDiscount: hasDiscount === "true",
    });

    await newProduct.save();
    res.status(201).json(newProduct);
  } catch (error) {
    console.error("Create Product Error:", error);
    res.status(500).json({ 
      message: "Server error", 
      error: error.message 
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
    } = req.body;

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    let updateData = {};

    if (name) updateData.name = name;
    if (price) updateData.price = price;
    if (shortDescription) updateData.shortDescription = shortDescription;
    if (fullDescription) updateData.fullDescription = fullDescription;
    if (discount !== undefined) updateData.discount = hasDiscount === "true" ? discount : 0;
    if (hasDiscount !== undefined) updateData.hasDiscount = hasDiscount === "true";

    // Handle sold count and stock quantity
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
      const existingCategory = await Category.findById(category);
      if (!existingCategory) {
        return res.status(400).json({ message: "Invalid category ID" });
      }
      updateData.category = category;
    }

    // Handle image upload
    if (req.file) {
      // Delete old image from S3 if exists
      if (product.image?.key) {
        await s3Client.send(new DeleteObjectCommand({
          Bucket: BUCKET_NAME,
          Key: product.image.key
        }));
      }
      
      updateData.image = {
        url: req.file.location,
        key: req.file.key
      };
    }

    // Update product
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    res.json({ 
      message: "Product updated successfully", 
      product: updatedProduct 
    });
  } catch (error) {
    console.error("Update Product Error:", error);
    res.status(500).json({ 
      message: "Server error", 
      error: error.message 
    });
  }
};

// Delete product
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Delete image from S3 if exists
    if (product.image?.key) {
      await s3Client.send(new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: product.image.key
      }));
    }

    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Delete Product Error:", error);
    res.status(500).json({ 
      message: "Server error", 
      error: error.message 
    });
  }
};

// Get all products
exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find().populate("category", "name");
    res.json(products);
  } catch (error) {
    console.error("Get Products Error:", error);
    res.status(500).json({ 
      message: "Server error", 
      error: error.message 
    });
  }
};

// Get product by ID
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate("category", "name");
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json(product);
  } catch (error) {
    console.error("Get Product Error:", error);
    res.status(500).json({ 
      message: "Server error", 
      error: error.message 
    });
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

    const products = await Product.find({ category: categoryId })
      .populate("category", "name");

    res.json(products);
  } catch (error) {
    console.error("Get Products by Category Error:", error);
    res.status(500).json({ 
      message: "Server error", 
      error: error.message 
    });
  }
};

// Get discounted products
exports.getDiscountedProducts = async (req, res) => {
  try {
    const discountedProducts = await Product.find({
      hasDiscount: true,
      discount: { $gt: 0 },
    }).populate("category", "name");

    res.json(discountedProducts);
  } catch (error) {
    console.error("Get Discounted Products Error:", error);
    res.status(500).json({ 
      message: "Server error", 
      error: error.message 
    });
  }
};

// Get non-discounted products
exports.getNonDiscountedProducts = async (req, res) => {
  try {
    const nonDiscountedProducts = await Product.find({
      hasDiscount: false,
      discount: 0,
    }).populate("category", "name");

    res.json(nonDiscountedProducts);
  } catch (error) {
    console.error("Get Non-Discounted Products Error:", error);
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
      .sort({ sold: -1 })
      .limit(5)
      .populate("category", "name");

    res.json(bestSellers);
  } catch (error) {
    console.error("Get Best Sellers Error:", error);
    res.status(500).json({ 
      message: "Server error", 
      error: error.message 
    });
  }
};