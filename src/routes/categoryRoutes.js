const express = require("express");
const router = express.Router();
const {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  upload
} = require("../controllers/categoryController");
const multer = require("multer");

// Category Routes
router.post("/", upload, createCategory);
router.get("/", getCategories);
router.get("/:id", getCategoryById);
router.put("/:id", upload, updateCategory);
router.delete("/:id", deleteCategory);

// Error Handling Middleware for Multer
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: err.message });
  } else if (err) {
    return res.status(400).json({ message: err.message });
  }
  next();
});

module.exports = router;
