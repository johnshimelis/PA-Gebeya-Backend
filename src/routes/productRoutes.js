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

// Product Creation & Update (with images)
router.post('/', arrayUpload, createProduct);
router.put('/:id', arrayUpload, updateProduct);

// Special Product Routes (must come before :id route)
router.get('/bestsellers', getBestSellers);
router.get('/discounted', getDiscountedProducts);
router.get('/non-discounted', getNonDiscountedProducts);

// Product Information Routes
router.get('/', getAllProducts);
router.get('/category/:categoryId', getProductsByCategory);
router.get('/:id', getProductById);  // Keep this LAST

// Image Management Routes
router.post('/:id/images', arrayUpload, addProductImages);
router.delete('/:productId/images/:imageKey', removeProductImage);

// Product Deletion
router.delete('/:id', deleteProduct);

module.exports = router;