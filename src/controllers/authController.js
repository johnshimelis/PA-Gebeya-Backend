require("dotenv").config();
const User = require("../models/Users");
const UserOrder = require("../models/UserOrder");
const Message = require("../models/Message");
const Notification = require("../models/Notification");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const twilio = require('twilio');

// Initialize Twilio client with Verify service
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

const sendOTP = async (phoneNumber) => {
  try {
    // Start verification using Twilio Verify service
    const verification = await twilioClient.verify.v2.services(verifyServiceSid)
      .verifications
      .create({ to: phoneNumber, channel: 'sms' });

    console.log(`Verification SID: ${verification.sid} sent to ${phoneNumber}`);
    return verification.sid;
  } catch (error) {
    console.error("Error starting verification:", error);
    throw new Error(error.message || "Failed to send OTP");
  }
};

const checkOTP = async (phoneNumber, otpCode) => {
  try {
    // Check verification code using Twilio Verify service
    const verificationCheck = await twilioClient.verify.v2.services(verifyServiceSid)
      .verificationChecks
      .create({ to: phoneNumber, code: otpCode });

    return verificationCheck.status === 'approved';
  } catch (error) {
    console.error("Error checking verification:", error);
    throw new Error(error.message || "Failed to verify OTP");
  }
};

const registerUser = async (req, res) => {
  const { fullName, phoneNumber, email, password } = req.body;

  try {
    // Validate phone number format
    if (!phoneNumber || !phoneNumber.match(/^\+?[1-9]\d{1,14}$/)) {
      return res.status(400).json({ message: "Invalid phone number format. Please include country code." });
    }

    // Check if user exists by phone number or email
    const userExists = await User.findOne({ 
      $or: [{ phoneNumber }, { email }] 
    });
    
    if (userExists) {
      return res.status(400).json({ 
        message: "User with this phone number or email already exists" 
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      fullName,
      phoneNumber,
      email,
      password: hashedPassword,
    });

    await newUser.save();

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ 
      message: error.message || "Server error during registration" 
    });
  }
};

const loginUser = async (req, res) => {
  try {
    const { phone } = req.body;
    
    if (!phone) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    // Validate phone number format
    if (!phone.match(/^\+?[1-9]\d{1,14}$/)) {
      return res.status(400).json({ message: "Invalid phone number format. Please include country code." });
    }

    const user = await User.findOne({ phoneNumber: phone });
    if (!user) {
      return res.status(404).json({ message: "User not found. Please register first." });
    }

    // Start verification process
    const verificationSid = await sendOTP(phone);

    res.status(200).json({ 
      message: "OTP sent to your phone number",
      phoneNumber: phone,
      verificationSid: verificationSid
    });
  } catch (error) {
    console.error("Error in login:", error);
    res.status(500).json({ 
      message: error.message || "Server error during login" 
    });
  }
};

const verifyOTP = async (req, res) => {
  try {
    const { phoneNumber, otp } = req.body;

    if (!phoneNumber || !otp) {
      return res.status(400).json({ message: "Phone number and OTP are required" });
    }

    // First verify the OTP with Twilio
    const isVerified = await checkOTP(phoneNumber, otp);
    if (!isVerified) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // Then find the user
    const user = await User.findOne({ phoneNumber });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "365d",
    });

    // Fetch user data
    const [orders, messages, notifications] = await Promise.all([
      UserOrder.find({ userId: user._id }).select('date status total'),
      Message.find({ userId: user._id }).select('from message read date'),
      Notification.find({ userId: user._id }).select('message date')
    ]);

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        userId: user._id,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
        email: user.email,
        orders,
        messages,
        notifications,
      },
    });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).json({ 
      message: error.message || "Server error during OTP verification" 
    });
  }
};

module.exports = {
  registerUser,
  loginUser,
  verifyOTP,
};