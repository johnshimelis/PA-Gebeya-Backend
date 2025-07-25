const fs = require("fs");
const path = require("path");
const { Upload } = require("@aws-sdk/lib-storage");
const s3Client = require("../utils/s3Client");
const Ad = require("../models/Ad");

const BUCKET_NAME = process.env.AWS_BUCKET_NAME;

// Upload new ad
const uploadAd = async (req, res) => {
  try {
    const { type } = req.params;

    if (!["ads", "banner", "banner1"].includes(type)) {
      return res.status(400).json({ error: "Invalid ad type." });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No images uploaded." });
    }

    const uploadPromises = req.files.map(async (file) => {
      const fileStream = fs.createReadStream(file.path);
      const fileKey = `${type}/${Date.now()}-${file.originalname}`;

      const upload = new Upload({
        client: s3Client,
        params: {
          Bucket: BUCKET_NAME,
          Key: fileKey,
          Body: fileStream,
          ContentType: file.mimetype,
        },
      });

      const result = await upload.done();

      // Clean up local file
      fs.unlinkSync(file.path);

      return result.Key;
    });

    const imageKeys = await Promise.all(uploadPromises);

    const ad = await Ad.create({
      type,
      images: imageKeys,
    });

    res.status(201).json({
      message: `${type} uploaded successfully`,
      ad,
    });
  } catch (error) {
    console.error("Upload Error:", error);
    res.status(500).json({ error: "Failed to upload ad", details: error.message });
  }
};

// Get all ads by type
const getAds = async (req, res) => {
  try {
    const { type } = req.params;
    const ads = await Ad.find({ type });
    res.status(200).json(ads);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch ads" });
  }
};

// Delete ad by ID
const deleteAd = async (req, res) => {
  try {
    const { id } = req.params;
    const ad = await Ad.findByIdAndDelete(id);
    if (!ad) {
      return res.status(404).json({ error: "Ad not found" });
    }
    res.status(200).json({ message: "Ad deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete ad" });
  }
};

// Update ad with new images
const updateAd = async (req, res) => {
  try {
    const { id } = req.params;

    const ad = await Ad.findById(id);
    if (!ad) {
      return res.status(404).json({ error: "Ad not found" });
    }

    let updatedImages = ad.images;

    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map(async (file) => {
        const fileStream = fs.createReadStream(file.path);
        const fileKey = `${ad.type}/${Date.now()}-${file.originalname}`;

        const upload = new Upload({
          client: s3Client,
          params: {
            Bucket: BUCKET_NAME,
            Key: fileKey,
            Body: fileStream,
            ContentType: file.mimetype,
          },
        });

        const result = await upload.done();
        fs.unlinkSync(file.path);
        return result.Key;
      });

      const newImageKeys = await Promise.all(uploadPromises);
      updatedImages = newImageKeys;
    }

    ad.images = updatedImages;
    await ad.save();

    res.status(200).json({ message: "Ad updated successfully", ad });
  } catch (error) {
    console.error("Update Error:", error);
    res.status(500).json({ error: "Failed to update ad", details: error.message });
  }
};

module.exports = {
  uploadAd,
  getAds,
  deleteAd,
  updateAd,
};
