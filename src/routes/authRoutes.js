const express = require("express");
const router = express.Router();
const { registerUser, loginUser, verifyOTP, requestOTP } = require("../controllers/authController");

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/verify-otp", verifyOTP);  
router.post("/request-otp", requestOTP); 

module.exports = router;
