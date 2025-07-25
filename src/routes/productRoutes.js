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
  getNonDiscountedProducts
} = require('../controllers/productController');

// Create product with multiple images
router.post('/', upload, createProduct);

// Update product with multiple images (replaces all existing images)
router.put('/:id', upload, updateProduct);

// Other routes remain the same
router.get('/', getAllProducts);
router.get('/:id', getProductById);
router.get('/category/:categoryId', getProductsByCategory);
router.get('/bestsellers', getBestSellers);
router.get('/discounted', getDiscountedProducts);
router.get('/non-discounted', getNonDiscountedProducts);
router.delete('/:id', deleteProduct);

module.exports = router;