const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
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

    // Files are already uploaded to S3 by multer-s3, just save the references
    const images = req.files.map(file => ({
      url: file.location,  // Public URL from S3
      key: file.key        // S3 object key
    }));

    const ad = await Ad.create({
      type,
      images
    });

    res.status(201).json({
      message: `${type} uploaded successfully`,
      ad
    });
  } catch (error) {
    console.error("Upload Error:", error);
    res.status(500).json({ 
      error: "Failed to upload ad", 
      details: error.message 
    });
  }
};

// Get all ads by type
const getAds = async (req, res) => {
  try {
    const { type } = req.params;
    const ads = await Ad.find({ type }).sort({ createdAt: -1 });
    
    res.status(200).json(ads);
  } catch (error) {
    res.status(500).json({ 
      error: "Failed to fetch ads",
      details: error.message
    });
  }
};

// Delete ad by ID
const deleteAd = async (req, res) => {
  try {
    const { id } = req.params;
    const ad = await Ad.findById(id);
    
    if (!ad) {
      return res.status(404).json({ error: "Ad not found" });
    }

    // Delete all images from S3
    const deletePromises = ad.images.map(image => {
      const deleteParams = {
        Bucket: BUCKET_NAME,
        Key: image.key
      };
      return s3Client.send(new DeleteObjectCommand(deleteParams));
    });

    await Promise.all(deletePromises);
    await Ad.findByIdAndDelete(id);

    res.status(200).json({ message: "Ad deleted successfully" });
  } catch (error) {
    console.error("Delete Error:", error);
    res.status(500).json({ 
      error: "Failed to delete ad",
      details: error.message
    });
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

    // If new files were uploaded
    if (req.files && req.files.length > 0) {
      // First delete old images from S3
      const deletePromises = ad.images.map(image => {
        const deleteParams = {
          Bucket: BUCKET_NAME,
          Key: image.key
        };
        return s3Client.send(new DeleteObjectCommand(deleteParams));
      });

      await Promise.all(deletePromises);

      // Then save new images
      ad.images = req.files.map(file => ({
        url: file.location,
        key: file.key
      }));
      
      await ad.save();
    }

    res.status(200).json({ 
      message: "Ad updated successfully", 
      ad 
    });
  } catch (error) {
    console.error("Update Error:", error);
    res.status(500).json({ 
      error: "Failed to update ad", 
      details: error.message 
    });
  }
};

module.exports = {
  uploadAd,
  getAds,
  deleteAd,
  updateAd,
};