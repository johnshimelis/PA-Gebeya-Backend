const express = require("express");
const router = express.Router();
const upload = require("../middlewares/upload");

const {
  uploadAd,
  getAds,
  deleteAd,
  updateAd,
} = require("../controllers/adsController");

router.post("/:type", upload.array("images", 5), uploadAd);
router.get("/:type", getAds);
router.delete("/:id", deleteAd);
router.put("/:id", upload.array("images", 5), updateAd);

module.exports = router;
