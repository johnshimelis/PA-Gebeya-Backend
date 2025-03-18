const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3"); // AWS SDK v3
const multerS3 = require("multer-s3");
const path = require("path");
const multer = require("multer");

// Configure AWS S3 (SDK v3)
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Multer configuration for S3 (SDK v3)
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_BUCKET_NAME,
    acl: "public-read", // Make files publicly accessible
    metadata: (req, file, cb) => {
      cb(null, { fieldName: file.fieldname });
    },
    key: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const fileName = `${Date.now()}${ext}`;
      cb(null, fileName);
    },
  }),
  fileFilter: (req, file, cb) => {
    file.mimetype.startsWith("image/") ? cb(null, true) : cb(new Error("Only image files are allowed!"), false);
  },
});

// Helper function to get full image URL
const getImageUrl = (imageName) =>
  imageName ? `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${imageName}` : null;

// Create a new category
const createCategory = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Category name is required" });

    const imageKey = req.file ? req.file.key : null;
    const newCategory = await Category.create({ name, image: imageKey });

    res.status(201).json({ message: "Category created successfully", category: newCategory });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get all categories
const getCategories = async (req, res) => {
  try {
    const categories = await Category.find();
    res.status(200).json(
      categories.map((category) => ({ ...category.toObject(), image: getImageUrl(category.image) }))
    );
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get a single category by ID
const getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: "Category not found" });

    res.status(200).json({ ...category.toObject(), image: getImageUrl(category.image) });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update a category
const updateCategory = async (req, res) => {
  try {
    const { name } = req.body;
    const updateData = { name };
    if (req.file) {
      // Delete the old image from S3 if it exists
      const oldCategory = await Category.findById(req.params.id);
      if (oldCategory.image) {
        await s3.send(new DeleteObjectCommand({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: oldCategory.image
        }));
      }
      updateData.image = req.file.key;
    }

    const updatedCategory = await Category.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
    if (!updatedCategory) return res.status(404).json({ message: "Category not found" });

    res.status(200).json({ message: "Category updated successfully", category: updatedCategory });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Delete a category
const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: "Category not found" });

    if (category.image) {
      // Delete the image from S3
      await s3.send(new DeleteObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: category.image
      }));
    }

    await category.deleteOne();
    res.status(200).json({ message: "Category deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  upload,
};