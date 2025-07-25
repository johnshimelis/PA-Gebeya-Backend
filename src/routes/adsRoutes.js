const express = require("express");
const router = express.Router();
const adsController = require("../controllers/adsController");

// Routes using S3 upload middleware
router.post("/:type", adsController.upload.array("images", 5), adsController.uploadAd);
router.get("/:type", adsController.getAds);
router.delete("/:id", adsController.deleteAd);
router.put("/:id", adsController.upload.array("images", 5), adsController.updateAd);

module.exports = router;
