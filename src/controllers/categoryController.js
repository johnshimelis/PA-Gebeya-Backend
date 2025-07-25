const { S3Client } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");
const multer = require("multer");
const path = require("path");
const Category = require("../models/Category"); // Adjust path if needed

// AWS S3 client using SDK v3
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Multer setup to read file into memory
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed!"), false);
  },
});

// Upload image to S3
const uploadToS3 = async (file) => {
  const ext = path.extname(file.originalname);
  const fileName = `${Date.now()}${ext}`;
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: "public-read",
    },
  });

  const result = await upload.done();
  return { key: fileName, url: result.Location };
};

// Construct image URL
const getImageUrl = (key) =>
  key
    ? `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`
    : null;

// Create category
const createCategory = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Category name is required" });

    let imageKey = null;
    if (req.file) {
      const uploadResult = await uploadToS3(req.file);
      imageKey = uploadResult.key;
    }

    const newCategory = await Category.create({ name, image: imageKey });
    res.status(201).json({ message: "Category created", category: newCategory });
  } catch (error) {
    res.status(500).json({ message: "Upload error", error: error.message });
  }
};

// Get all categories
const getCategories = async (req, res) => {
  try {
    const categories = await Category.find();
    res.status(200).json(
      categories.map((c) => ({
        ...c.toObject(),
        image: getImageUrl(c.image),
      }))
    );
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get one category
const getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: "Not found" });

    res.status(200).json({
      ...category.toObject(),
      image: getImageUrl(category.image),
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update category
const updateCategory = async (req, res) => {
  try {
    const { name } = req.body;
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: "Not found" });

    if (req.file) {
      const uploadResult = await uploadToS3(req.file);
      category.image = uploadResult.key;
    }

    category.name = name || category.name;
    await category.save();

    res.status(200).json({ message: "Category updated", category });
  } catch (error) {
    res.status(500).json({ message: "Update error", error: error.message });
  }
};

// Delete category
const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: "Not found" });

    // Delete image from S3 if it exists
    if (category.image) {
      await s3Client.send({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: category.image,
      });
    }

    await category.deleteOne();
    res.status(200).json({ message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Delete error", error: error.message });
  }
};

module.exports = {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  upload, // export multer middleware
};
