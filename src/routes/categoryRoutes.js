const express = require("express");
const router = express.Router();
const {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
} = require("../controllers/categoryController");

// Category Routes
router.post("/", createCategory); // Create category with image upload
router.get("/", getCategories); // Get all categories
router.get("/:id", getCategoryById); // Get a single category
router.put("/:id", updateCategory); // Update category with optional image
router.delete("/:id", deleteCategory); // Delete category

module.exports = router;
