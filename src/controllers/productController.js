const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
const s3Client = require('../utils/s3Client');
const Product = require('../models/Product');
const Category = require('../models/Category');
const mongoose = require('mongoose');

const BUCKET_NAME = process.env.AWS_BUCKET_NAME;

// Create a new product with multiple images
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

    // Validation
    if (!name || name.trim() === '') {
      return res.status(400).json({ message: 'Name is required' });
    }

    // Check category exists
    const existingCategory = await Category.findById(category);
    if (!existingCategory) {
      return res.status(400).json({ message: 'Invalid category ID' });
    }

    // Process uploaded images
    const images = req.files?.map(file => ({
      url: file.location,
      key: file.key
    })) || [];

    // Create product
    const newProduct = new Product({
      name: name.trim(),
      price,
      shortDescription,
      fullDescription,
      stockQuantity,
      category,
      images,
      discount: hasDiscount === 'true' ? discount : 0,
      hasDiscount: hasDiscount === 'true',
    });

    await newProduct.save();
    res.status(201).json(newProduct);
  } catch (error) {
    console.error('Create Product Error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
};

// Update product with multiple images
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
      return res.status(404).json({ message: 'Product not found' });
    }

    let updateData = {};

    // Basic field updates
    if (name) updateData.name = name;
    if (price) updateData.price = price;
    if (shortDescription) updateData.shortDescription = shortDescription;
    if (fullDescription) updateData.fullDescription = fullDescription;
    if (discount !== undefined) updateData.discount = hasDiscount === 'true' ? discount : 0;
    if (hasDiscount !== undefined) updateData.hasDiscount = hasDiscount === 'true';

    // Handle sold count
    if (sold !== undefined) {
      const newSold = Number(sold);
      if (newSold < product.sold) {
        return res.status(400).json({ message: 'Sold count cannot decrease' });
      }

      const increaseInSold = newSold - product.sold;
      if (increaseInSold > 0) {
        const newStockQuantity = product.stockQuantity - increaseInSold;
        if (newStockQuantity < 0) {
          return res.status(400).json({ message: 'Not enough stock available' });
        }
        updateData.stockQuantity = newStockQuantity;
      }

      updateData.sold = newSold;
    }

    // Stock quantity update
    if (stockQuantity !== undefined) {
      updateData.stockQuantity = Number(stockQuantity);
    }

    // Category update
    if (category) {
      const existingCategory = await Category.findById(category);
      if (!existingCategory) {
        return res.status(400).json({ message: 'Invalid category ID' });
      }
      updateData.category = category;
    }

    // Handle image updates if new files were uploaded
    if (req.files && req.files.length > 0) {
      // Delete old images from S3
      const deletePromises = product.images.map(image => {
        return s3Client.send(new DeleteObjectCommand({
          Bucket: BUCKET_NAME,
          Key: image.key
        }));
      });

      await Promise.all(deletePromises);

      // Add new images
      updateData.images = req.files.map(file => ({
        url: file.location,
        key: file.key
      }));
    }

    // Update product
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    res.json({ 
      message: 'Product updated successfully', 
      product: updatedProduct 
    });
  } catch (error) {
    console.error('Update Product Error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
};

// Get all products
exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find().populate('category', 'name');
    
    // Transform the products to include imageUrls array
    const transformedProducts = products.map(product => ({
      ...product.toObject(),
      imageUrls: product.images.map(img => img.url)
    }));
    
    res.json(transformedProducts);
  } catch (error) {
    console.error('Get All Products Error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
};
// Get product by ID
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('category', 'name');
      
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    res.json(product);
  } catch (error) {
    console.error('Get Product By ID Error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
};

// Get products by category
exports.getProductsByCategory = async (req, res) => {
  try {
    const categoryId = req.params.categoryId;

    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({ message: 'Invalid category ID' });
    }

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    const products = await Product.find({ category: categoryId })
      .populate('category', 'name');

    res.json(products);
  } catch (error) {
    console.error('Get Products By Category Error:', error);
    res.status(500).json({ 
      message: 'Server error', 
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
      .populate('category', 'name');

    res.json(bestSellers);
  } catch (error) {
    console.error('Get Best Sellers Error:', error);
    res.status(500).json({ 
      message: 'Server error', 
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
    }).populate('category', 'name');

    res.json(discountedProducts);
  } catch (error) {
    console.error('Get Discounted Products Error:', error);
    res.status(500).json({ 
      message: 'Server error', 
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
    }).populate('category', 'name');

    res.json(nonDiscountedProducts);
  } catch (error) {
    console.error('Get Non-Discounted Products Error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
};

// Delete product with all its images
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Delete all images from S3
    const deletePromises = product.images.map(image => {
      return s3Client.send(new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: image.key
      }));
    });

    await Promise.all(deletePromises);
    await Product.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete Product Error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
};

// Add images to existing product (without replacing existing ones)
exports.addProductImages = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No images uploaded' });
    }

    // Add new images to existing ones
    const newImages = req.files.map(file => ({
      url: file.location,
      key: file.key
    }));

    product.images = [...product.images, ...newImages];
    await product.save();

    res.json({ 
      message: 'Images added successfully',
      product
    });
  } catch (error) {
    console.error('Add Product Images Error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
};

// Remove specific image from product
exports.removeProductImage = async (req, res) => {
  try {
    const { productId, imageKey } = req.params;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Find the image to remove
    const imageIndex = product.images.findIndex(img => img.key === imageKey);
    if (imageIndex === -1) {
      return res.status(404).json({ message: 'Image not found' });
    }

    // Delete from S3
    await s3Client.send(new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: imageKey
    }));

    // Remove from array
    product.images.splice(imageIndex, 1);
    await product.save();

    res.json({ 
      message: 'Image removed successfully',
      product
    });
  } catch (error) {
    console.error('Remove Product Image Error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
};