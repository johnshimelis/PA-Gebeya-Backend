const Ad = require("../models/Ad");
const AWS = require("aws-sdk");
const multer = require("multer");
const multerS3 = require("multer-s3");
const path = require("path");

// AWS S3 Configuration
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// Multer S3 storage configuration
const upload = multer({
  storage: multerS3({
    s3,
    bucket: process.env.AWS_BUCKET_NAME,
    acl: "public-read",
    metadata: (req, file, cb) => {
      cb(null, { fieldName: file.fieldname });
    },
    key: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const filename = `${Date.now()}${ext}`;
      cb(null, filename);
    },
  }),
  fileFilter: (req, file, cb) => {
    file.mimetype.startsWith("image/")
      ? cb(null, true)
      : cb(new Error("Only image files are allowed!"), false);
  },
});

// Helper to generate full S3 URL
const getImageUrl = (key) =>
  key
    ? `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`
    : null;

// Upload Ads, Banners, or Banner1
const uploadAd = async (req, res) => {
  try {
    const { type } = req.params;
    if (!["ads", "banner", "banner1"].includes(type)) {
      return res.status(400).json({ error: "Invalid type" });
    }

    const imageKeys = req.files.map((file) => file.key);
    const ad = await Ad.create({ type, images: imageKeys });

    res.status(201).json({
      message: `${type} uploaded successfully!`,
      ad,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to upload images", details: error.message });
  }
};

// Fetch Ads, Banners, or Banner1
const getAds = async (req, res) => {
  try {
    const { type } = req.params;
    const ads = await Ad.find({ type });
    const adsWithUrls = ads.map((ad) => ({
      ...ad.toObject(),
      images: ad.images.map(getImageUrl),
    }));
    res.status(200).json(adsWithUrls);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch ads", details: error.message });
  }
};

// Delete Ad
const deleteAd = async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.id);
    if (!ad) return res.status(404).json({ message: "Ad not found" });

    // Delete images from S3
    for (const key of ad.images) {
      await s3.deleteObject({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
      }).promise();
    }

    await ad.deleteOne();
    res.status(200).json({ message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete ad", details: error.message });
  }
};

// Update Ad
const updateAd = async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.id);
    if (!ad) return res.status(404).json({ message: "Ad not found" });

    // Delete old images from S3
    for (const key of ad.images) {
      await s3.deleteObject({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
      }).promise();
    }

    const newImageKeys = req.files.map((file) => file.key);
    ad.images = newImageKeys;
    const updatedAd = await ad.save();

    res.status(200).json({
      message: "Updated successfully",
      ad: updatedAd,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to update ad", details: error.message });
  }
};

module.exports = {
  uploadAd,
  getAds,
  deleteAd,
  updateAd,
  upload, // Export multer upload for routes
};
