const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Category = require('../models/Category');

const app = express();

// Serve static files (images) from the 'uploads' directory located at the project root
const uploadDir = path.join(__dirname, '../../uploads/');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

// Configure Multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir); // Store images in 'uploads' at project root
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // Unique filename
  },
});

const upload = multer({
  storage,
  fileFilter: function (req, file, cb) {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed!"), false);
    }
    cb(null, true);
  },
});

// ✅ Create a new category (with image upload)
exports.createCategory = async (req, res) => {
  upload.single("image")(req, res, async function (err) {
    if (err) return res.status(400).json({ error: err.message });

    try {
      const { name } = req.body;
      if (!name) return res.status(400).json({ error: "Category name is required" });

      const imagePath = req.file ? req.file.filename : null;
      const newCategory = new Category({ name, image: imagePath });
      await newCategory.save();
      
      res.status(201).json({ message: "Category created successfully", category: newCategory });
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  });
};

// ✅ Get all categories
exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find();
    const categoriesWithImageUrl = categories.map(category => ({
      ...category.toObject(),
      image: category.image ? `${req.protocol}://${req.get("host")}/uploads/${category.image}` : null,
    }));
    res.status(200).json(categoriesWithImageUrl);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


// ✅ Get a single category by ID
exports.getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: "Category not found" });
    category.image = category.image ? `${req.protocol}://${req.get("host")}/uploads/${category.image}` : null;
    res.status(200).json(category);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ Update a category (with image update)
exports.updateCategory = async (req, res) => {
  upload.single("image")(req, res, async function (err) {
    if (err) return res.status(400).json({ error: err.message });

    try {
      const { name } = req.body;
      const updateData = { name };

      if (req.file) {
        updateData.image = req.file.filename;
      }

      const updatedCategory = await Category.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      );
      
      if (!updatedCategory) return res.status(404).json({ message: "Category not found" });
      res.status(200).json({ message: "Category updated successfully", category: updatedCategory });
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  });
};

// ✅ Delete a category (including image deletion)
exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: "Category not found" });

    // Delete category from database
    await category.deleteOne();
    res.status(200).json({ message: "Category deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
