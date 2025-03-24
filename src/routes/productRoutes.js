const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");

// Import the S3 upload middleware from the controller
const upload = productController.upload;

// Routes
router.post("/", 
  upload, // Use the S3 upload middleware
  productController.createProduct
);

router.get("/", productController.getAllProducts);
router.get("/discounted", productController.getDiscountedProducts);
router.get("/bestsellers", productController.getBestSellers);
router.get("/nondiscount", productController.getNonDiscountedProducts);
router.get("/:id", productController.getProductById);
router.get("/category/:categoryId", productController.getProductsByCategory);

router.put("/:id", 
  upload, // Use the same S3 upload middleware for updates
  productController.updateProduct
);

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
