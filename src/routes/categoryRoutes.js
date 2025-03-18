const express = require("express");
const router = express.Router();
const {
  createCategory,
  getCategories,
  getCategoryById,
  getCategoryIdByName, // Import the new function
  updateCategory,
  deleteCategory,
  upload, // Import the upload middleware
} = require("../controllers/categoryController");

// Category Routes

// Create a new category with image upload
router.post("/", upload.single("image"), createCategory);

// Get all categories
router.get("/", getCategories);

// Get a single category by ID
router.get("/:id", getCategoryById);

// Get category ID by name
router.get("/name/:name", getCategoryIdByName);

// Update a category with optional image upload
router.put("/:id", upload.single("image"), updateCategory);

// Delete a category
router.delete("/:id", deleteCategory);

module.exports = router;
