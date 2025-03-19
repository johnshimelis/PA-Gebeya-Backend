const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const { upload } = productController; // Import the upload middleware

// Routes
router.post("/", upload.single("image"), productController.createProduct);
router.get("/", productController.getAllProducts);
router.get("/discounted", productController.getDiscountedProducts);
router.get("/bestsellers", productController.getBestSellers);
router.get("/nondiscount", productController.getNonDiscountedProducts);
router.get("/:id", productController.getProductById);
router.get("/category/:categoryId", productController.getProductsByCategory);
router.put("/:id", upload.single("image"), productController.updateProduct);
router.delete("/:id", productController.deleteProduct);

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