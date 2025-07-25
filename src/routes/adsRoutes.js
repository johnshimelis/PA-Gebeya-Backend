const express = require("express");
const router = express.Router();
const {
  uploadAd,
  getAds,
  deleteAd,
  updateAd,
  upload, // Multer-S3 middleware
} = require("../controllers/adsController");

// Ads Routes
router.post("/:type", upload.array("images", 5), uploadAd);     // Upload new ad
router.get("/:type", getAds);                                   // Fetch ads of a specific type
router.delete("/:id", deleteAd);                                // Delete ad and images
router.put("/:id", upload.array("images", 5), updateAd);        // Update ad with new images

module.exports = router;
