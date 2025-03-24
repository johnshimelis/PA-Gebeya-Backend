const express = require("express");
const productController = require("../controllers/productController");

const router = express.Router();

// Import the upload middleware from productController
const { upload } = productController;

// Routes
router.post("/", upload.array("images", 10), productController.createProduct); // Allow up to 10 images
router.get("/", productController.getAllProducts);
router.get("/discounted", productController.getDiscountedProducts);
router.get("/bestsellers", productController.getBestSellers);
router.get("/nondiscount", productController.getNonDiscountedProducts);
router.get("/:id", productController.getProductById);
router.get("/category/:categoryId", productController.getProductsByCategory);
router.put("/:id", upload.array("images", 10), productController.updateProduct); // Allow up to 10 images
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