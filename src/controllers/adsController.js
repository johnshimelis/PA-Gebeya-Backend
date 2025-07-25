const Ad = require("../models/Ad");

// Upload Ads, Banners, or Banner1
exports.uploadAd = async (req, res) => {
  try {
    const { type } = req.params;
    if (!["ads", "banner", "banner1"].includes(type)) {
      return res.status(400).json({ error: "Invalid type" });
    }

    const imagePaths = req.files.map((file) => `uploads/${file.filename}`);
    const ad = new Ad({ images: imagePaths, type });
    await ad.save();

    res.json({ message: `${type} uploaded successfully!`, ad });
  } catch (error) {
    res.status(500).json({ error: "Failed to upload image." });
  }
};

// Fetch Ads, Banners, or Banner1
exports.getAds = async (req, res) => {
  try {
    const { type } = req.params;
    const ads = await Ad.find({ type });
    res.json(ads);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch ads." });
  }
};

// Delete an Ad, Banner, or Banner1
exports.deleteAd = async (req, res) => {
  try {
    await Ad.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted successfully!" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete ad." });
  }
};

// Update an Ad, Banner, or Banner1
exports.updateAd = async (req, res) => {
  try {
    const imagePaths = req.files.map((file) => `uploads/${file.filename}`);
    const updatedAd = await Ad.findByIdAndUpdate(
      req.params.id,
      { images: imagePaths },
      { new: true }
    );
    res.json({ message: "Updated successfully!", updatedAd });
  } catch (error) {
    res.status(500).json({ error: "Failed to update ad." });
  }
};
