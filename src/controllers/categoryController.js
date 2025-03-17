const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const Category = require("../models/Category");

const router = express.Router();

// Ensure 'uploads' directory exists at project root
const uploadDir = path.join(__dirname, "../../uploads/");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Serve static files (images)
router.use("/uploads", express.static(uploadDir));

// Configure Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed!"), false);
    }
    cb(null, true);
  },
});

// ✅ Create a new category (with image upload)
router.post("/categories", upload.single("image"), async (req, res) => {
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

// ✅ Get all categories
router.get("/categories", async (req, res) => {
  try {
    const categories = await Category.find();
    const categoriesWithImageUrl = categories.map((category) => ({
      ...category.toObject(),
      image: category.image ? `${req.protocol}://${req.get("host")}/uploads/${category.image}` : null,
    }));
    res.status(200).json(categoriesWithImageUrl);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ✅ Get a single category by ID
router.get("/categories/:id", async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: "Category not found" });

    category.image = category.image ? `${req.protocol}://${req.get("host")}/uploads/${category.image}` : null;
    res.status(200).json(category);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ✅ Update a category (with image update)
router.put("/categories/:id", upload.single("image"), async (req, res) => {
  try {
    const { name } = req.body;
    const updateData = { name };

    if (req.file) {
      updateData.image = req.file.filename;
    }

    const updatedCategory = await Category.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
    if (!updatedCategory) return res.status(404).json({ message: "Category not found" });

    res.status(200).json({ message: "Category updated successfully", category: updatedCategory });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ✅ Delete a category (including image deletion)
router.delete("/categories/:id", async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: "Category not found" });

    if (category.image) {
      const imagePath = path.join(uploadDir, category.image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await category.deleteOne();
    res.status(200).json({ message: "Category deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
