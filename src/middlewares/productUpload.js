const multer = require('multer');
const multerS3 = require('multer-s3');
const s3Client = require('../utils/s3Client');

const BUCKET_NAME = process.env.AWS_BUCKET_NAME;

// Create the base multer configuration
const s3Storage = multerS3({
  s3: s3Client,
  bucket: BUCKET_NAME,
  acl: 'public-read',
  metadata: function (req, file, cb) {
    cb(null, { fieldName: file.fieldname });
  },
  key: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `products/${uniqueSuffix}-${file.originalname}`);
  }
});

// File filter configuration
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'image/bmp', 'image/tiff', 'image/svg+xml', 'image/avif',
    'application/octet-stream'
  ];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.mimetype}`), false);
  }
};

// Limits configuration
const limits = {
  fileSize: 1024 * 1024 * 5, // 5MB per file
  files: 10 // Maximum 10 images
};

// Create the multer instance
const upload = multer({
  storage: s3Storage,
  fileFilter: fileFilter,
  limits: limits
});

// Export both the middleware and the configured upload instance
module.exports = {
  singleUpload: upload.single('image'), // For single file upload
  arrayUpload: upload.array('images', 10), // For multiple file uploads (max 10)
  fieldsUpload: upload.fields([{ name: 'images', maxCount: 10 }]), // Alternative for multiple files
  rawUpload: upload // Raw multer instance if needed elsewhere
};