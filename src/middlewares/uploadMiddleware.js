const path = require("path");
const multer = require("multer");
const fs = require("fs");

// Ensure 'uploads' folder exists
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    if (!file) {
      return cb(new Error("❌ No file provided"), null);
    }
    const uniqueName = Date.now() + "-" + file.originalname.replace(/\s+/g, "_"); // Remove spaces
    cb(null, uniqueName);
  },
});

// Allow only images
const fileFilter = (req, file, cb) => {
  if (!file) {
    return cb(new Error("❌ No file uploaded"), false);
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("❌ Invalid file type. Only JPG, PNG, WEBP, and AVIF allowed."), false);
  }
};

// Upload limits
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// Middleware to handle single file upload
const uploadImage = (req, res, next) => {
  upload.single("image")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `❌ Multer error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: `❌ File upload error: ${err.message}` });
    }
    console.log("✅ File uploaded:", req.file.path);
    next();
  });
};

module.exports = { uploadImage };
