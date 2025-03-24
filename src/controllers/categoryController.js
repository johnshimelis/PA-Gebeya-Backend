const { S3Client, DeleteObjectCommand } = require("@aws-sdk/client-s3"); // AWS SDK v3
const multerS3 = require("multer-s3");
const path = require("path");
const multer = require("multer");
const { SSM } = require("aws-sdk"); // AWS SDK for fetching parameters
const Category = require("../models/Category"); // Import the Category model

// Initialize AWS SSM
const ssm = new SSM({ region: "eu-north-1" }); // Replace with your AWS region

// Function to fetch parameters from AWS Systems Manager
async function getParameter(name, isSecure = false) {
  const param = await ssm
    .getParameter({
      Name: name,
      WithDecryption: isSecure,
    })
    .promise();
  return param.Parameter.Value;
}

// Load AWS environment variables from AWS Systems Manager
async function loadAWSEnv() {
  try {
    process.env.AWS_ACCESS_KEY_ID = await getParameter("/pgebeya-backend/AWS_ACCESS_KEY_ID", true);
    process.env.AWS_SECRET_ACCESS_KEY = await getParameter("/pgebeya-backend/AWS_SECRET_ACCESS_KEY", true);
    process.env.AWS_REGION = await getParameter("/pgebeya-backend/AWS_REGION");
    process.env.AWS_BUCKET_NAME = await getParameter("/pgebeya-backend/AWS_BUCKET_NAME");

    console.log("✅ AWS environment variables loaded successfully");
  } catch (error) {
    console.error("❌ Error loading AWS environment variables:", error);
    process.exit(1); // Exit the process if environment variables fail to load
  }
}

// Configure AWS S3 (SDK v3)
let s3;
let upload;

async function initializeS3() {
  await loadAWSEnv();

  s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  // Multer configuration for S3 (SDK v3)
  upload = multer({
    storage: multerS3({
      s3: s3,
      bucket: process.env.AWS_BUCKET_NAME,
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
}

// Helper function to get full image URL
const getImageUrl = (imageName) =>
  imageName ? `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${imageName}` : null;

// Create a new category
const createCategory = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Category name is required" });

    console.log("Category name:", name);

    const imageKey = req.file ? req.file.key : null;
    console.log("Image key:", imageKey);

    const newCategory = await Category.create({ name, image: imageKey });
    console.log("Created Category:", newCategory);

    res.status(201).json({ message: "Category created successfully", category: newCategory });
  } catch (error) {
    console.error("Error creating category:", error);
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
    console.error("Error fetching categories:", error);
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
    console.error("Error fetching category:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get category ID by name
const getCategoryIdByName = async (req, res) => {
  try {
    const { name } = req.params;
    if (!name) return res.status(400).json({ error: "Category name is required" });

    const category = await Category.findOne({ name });
    if (!category) return res.status(404).json();

    res.status(200).json({ categoryId: category._id });
  } catch (error) {
    console.error("Error fetching category ID by name:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update a category
const updateCategory = async (req, res) => {
  try {
    const { name } = req.body;
    const updateData = { name };

    if (req.file) {
      const oldCategory = await Category.findById(req.params.id);
      if (oldCategory.image) {
        await s3.send(new DeleteObjectCommand({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: oldCategory.image,
        }));
      }
      updateData.image = req.file.key;
    }

    const updatedCategory = await Category.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
    if (!updatedCategory) return res.status(404).json({ message: "Category not found" });

    res.status(200).json({ message: "Category updated successfully", category: updatedCategory });
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Delete a category
const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: "Category not found" });

    if (category.image) {
      await s3.send(new DeleteObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: category.image,
      }));
    }

    await category.deleteOne();
    res.status(200).json({ message: "Category deleted successfully" });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Initialize S3 and upload middleware
initializeS3();

module.exports = {
  createCategory,
  getCategories,
  getCategoryById,
  getCategoryIdByName, // Export the new function
  updateCategory,
  deleteCategory,
  upload,
};