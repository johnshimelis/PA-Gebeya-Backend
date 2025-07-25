const express = require('express');
const router = express.Router();
const { arrayUpload } = require('../middlewares/productUpload');
const {
  createProduct,
  updateProduct,
  deleteProduct,
  getAllProducts,
  getProductById,
  getProductsByCategory,
  getBestSellers,
  getDiscountedProducts,
  getNonDiscountedProducts,
  addProductImages,
  removeProductImage
} = require('../controllers/productController');

// Create product with multiple images
router.post('/', arrayUpload, createProduct);

// Update product with multiple images (replaces all existing images)
router.put('/:id', arrayUpload, updateProduct);

// Add images to existing product (without replacing existing ones)
router.post('/:id/images', arrayUpload, addProductImages);

// Product information routes
router.get('/', getAllProducts);
router.get('/:id', getProductById);
router.get('/category/:categoryId', getProductsByCategory);

// Special product routes
router.get('/features/bestsellers', getBestSellers);
router.get('/features/discounted', getDiscountedProducts);
router.get('/features/non-discounted', getNonDiscountedProducts);

// Image management routes
router.delete('/:productId/images/:imageKey', removeProductImage);

// Product deletion
router.delete('/:id', deleteProduct);

module.exports = router;