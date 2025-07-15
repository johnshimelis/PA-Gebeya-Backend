require("dotenv").config();
const User = require("../models/Users");
const UserOrder = require("../models/UserOrder");
const Message = require("../models/Message");
const Notification = require("../models/Notification");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const twilio = require("twilio");

// Twilio setup
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

// Send OTP via Twilio
const sendOTP = async (phoneNumber) => {
  try {
    const verification = await twilioClient.verify.v2
      .services(verifyServiceSid)
      .verifications.create({ to: phoneNumber, channel: "sms" });

    console.log(`Verification SID: ${verification.sid} sent to ${phoneNumber}`);
    return verification.sid;
  } catch (error) {
    console.error("Error starting verification:", error);
    throw new Error(error.message || "Failed to send OTP");
  }
};

// Check OTP via Twilio
const checkOTP = async (phoneNumber, otpCode) => {
  try {
    const verificationCheck = await twilioClient.verify.v2
      .services(verifyServiceSid)
      .verificationChecks.create({ to: phoneNumber, code: otpCode });

    return verificationCheck.status === "approved";
  } catch (error) {
    console.error("Error checking verification:", error);
    throw new Error(error.message || "Failed to verify OTP");
  }
};

// Register a new user
const registerUser = async (req, res) => {
  const { fullName, phoneNumber, email, password } = req.body;

  try {
    if (!phoneNumber || !phoneNumber.match(/^\+?[1-9]\d{1,14}$/)) {
      return res.status(400).json({ message: "Invalid phone number format. Please include country code." });
    }

    const userExists = await User.findOne({ $or: [{ phoneNumber }, { email }] });
    if (userExists) {
      return res.status(400).json({ message: "User with this phone number or email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({ fullName, phoneNumber, email, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ message: error.message || "Server error during registration" });
  }
};

// Login and send OTP
const loginUser = async (req, res) => {
  const { phoneNumber } = req.body;

  try {
    if (!phoneNumber) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    if (!phoneNumber.match(/^\+?[1-9]\d{1,14}$/)) {
      return res.status(400).json({ message: "Invalid phone number format. Please include country code." });
    }

    const user = await User.findOne({ phoneNumber });
    if (!user) {
      return res.status(404).json({ message: "User not found. Please register first." });
    }

    const verificationSid = await sendOTP(phoneNumber);

    res.status(200).json({
      message: "OTP sent to your phone number",
      phoneNumber,
      verificationSid,
    });
  } catch (error) {
    console.error("Error in login:", error);
    res.status(500).json({ message: error.message || "Server error during login" });
  }
};

// Verify OTP and return user data
const verifyOTP = async (req, res) => {
  const { phoneNumber, otp } = req.body;

  try {
    if (!phoneNumber || !otp) {
      return res.status(400).json({ message: "Phone number and OTP are required" });
    }

    const isVerified = await checkOTP(phoneNumber, otp);
    if (!isVerified) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    const user = await User.findOne({ phoneNumber });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "365d",
    });

    const [orders, messages, notifications] = await Promise.all([
      UserOrder.find({ userId: user._id }).select("date status total"),
      Message.find({ userId: user._id }).select("from message read date"),
      Notification.find({ userId: user._id }).select("message date"),
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
    res.status(500).json({ message: error.message || "Server error during OTP verification" });
  }
};

module.exports = {
  registerUser,
  loginUser,
  verifyOTP,
};
