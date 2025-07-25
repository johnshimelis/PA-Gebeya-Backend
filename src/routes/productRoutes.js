const express = require("express");
const productController = require("../controllers/productController");
const upload = require("../middlewares/upload"); // Using your S3 upload middleware

const router = express.Router();

// Routes
router.post("/", upload.array("images", 5), productController.createProduct);
router.get("/", productController.getAllProducts);
router.get("/discounted", productController.getDiscountedProducts);
router.get("/bestsellers", productController.getBestSellers);
router.get("/nondiscount", productController.getNonDiscountedProducts);
router.get("/:id", productController.getProductById);
router.get("/category/:categoryId", productController.getProductsByCategory);
router.put("/:id", upload.array("images", 5), productController.updateProduct);
router.delete("/:id", productController.deleteProduct);

// Error Handling Middleware for Multer
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ 
      success: false,
      message: err.message 
    });
  } else if (err) {
    return res.status(400).json({ 
      success: false,
      message: err.message 
    });
  }
  next();
});

module.exports = router;