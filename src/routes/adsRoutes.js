const express = require("express");
const router = express.Router();
const upload = require("../middlewares/upload");

const {
  uploadAd,
  getAds,
  deleteAd,
  updateAd,
} = require("../controllers/adsController");

// Upload ads: max 5 images per request, field name "images"
router.post("/:type", upload.array("images", 5), uploadAd);

// Get ads by type
router.get("/:type", getAds);

// Delete ad by ID
router.delete("/:id", deleteAd);

// Update ad by ID (replace all images)
router.put("/:id", upload.array("images", 5), updateAd);

module.exports = router;