const express = require('express');
const router = express.Router();
const upload = require('../middlewares/productUpload');
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
router.post('/', upload.array('images', 10), createProduct);

// Update product with multiple images (replaces all existing images)
router.put('/:id', upload.array('images', 10), updateProduct);

// Product routes
router.get('/', getAllProducts);
router.get('/:id', getProductById);
router.get('/category/:categoryId', getProductsByCategory);

// Updated bestsellers and discounted routes
router.get('/features/bestsellers', getBestSellers);
router.get('/features/discounted', getDiscountedProducts);
router.get('/features/non-discounted', getNonDiscountedProducts);

// Image management routes
router.post('/:id/images', upload.array('images', 10), addProductImages);
router.delete('/:productId/images/:imageKey', removeProductImage);

// Delete product
router.delete('/:id', deleteProduct);

module.exports = router;