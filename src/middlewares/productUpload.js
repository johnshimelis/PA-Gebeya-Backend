const multer = require('multer');
const multerS3 = require('multer-s3');
const s3Client = require('../utils/s3Client');

const BUCKET_NAME = process.env.AWS_BUCKET_NAME;

const upload = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: BUCKET_NAME,
    acl: 'public-read',
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      cb(null, `products/${Date.now().toString()}-${file.originalname}`);
    }
  }),
  fileFilter: (req, file, cb) => {
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
  },
  limits: {
    fileSize: 1024 * 1024 * 5, // 5MB per file
    files: 10 // Maximum 10 images per product
  }
});

module.exports = upload.array('images'); // Field name is 'images' for multiple uploads