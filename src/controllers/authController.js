require("dotenv").config();
const User = require("../models/Users");
const UserOrder = require("../models/UserOrder");
const Message = require("../models/Message");
const Notification = require("../models/Notification");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const africastalking = require("africastalking")({
  apiKey: process.env.AT_API_KEY,
  username: process.env.AT_USERNAME,
});

const OTP_EXPIRATION_MINUTES = parseInt(process.env.OTP_EXPIRATION || "5", 10);

// Temporary OTP store (replace with DB in production)
const otpStore = new Map();

// ✅ Normalize phone number (09, 07, +251...)
const normalizePhoneNumber = (phone) => {
  if (!phone) return null;
  phone = phone.trim();

  if (phone.startsWith("0")) return "+251" + phone.slice(1);
  if ((phone.length === 9 && (phone.startsWith("9") || phone.startsWith("7"))))
    return "+251" + phone;
  if (phone.startsWith("+251")) return phone;

  return phone;
};

// ✅ Generate 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// ✅ Send OTP with Africa's Talking
const sendOTP = async (phoneNumber, otp) => {
  const sms = africastalking.SMS;
  const response = await sms.send({
    to: [phoneNumber],
    message: `Your PA Gebeya OTP code is: ${otp}`,
    from: "AFRICASTKNG", // Only valid if you’ve applied for sender ID
  });

  console.log(`OTP sent to ${phoneNumber}`, response);
};

// ✅ Register User
const registerUser = async (req, res) => {
  const { fullName, phoneNumber, email, password } = req.body;

  try {
    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    const userExists = await User.findOne({
      $or: [{ phoneNumber: normalizedPhone }, { email }],
    });

    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      fullName,
      phoneNumber: normalizedPhone,
      email,
      password: hashedPassword,
    });

    await newUser.save();

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: error.message || "Registration failed" });
  }
};

// ✅ Login User with OTP
const loginUser = async (req, res) => {
  const { phoneNumber } = req.body;

  try {
    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    const user = await User.findOne({ phoneNumber: normalizedPhone });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const otp = generateOTP();
    const expiresAt = Date.now() + OTP_EXPIRATION_MINUTES * 60 * 1000;

    otpStore.set(normalizedPhone, { otp, expiresAt });

    await sendOTP(normalizedPhone, otp);

    res.status(200).json({
      message: "OTP sent to your phone number",
      phoneNumber: normalizedPhone,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: error.message || "Login failed" });
  }
};

// ✅ Verify OTP and Log In
const verifyOTP = async (req, res) => {
  const { phoneNumber, otp } = req.body;

  try {
    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    const entry = otpStore.get(normalizedPhone);

    if (!entry) {
      return res.status(400).json({ message: "OTP not found" });
    }

    if (Date.now() > entry.expiresAt) {
      otpStore.delete(normalizedPhone);
      return res.status(400).json({ message: "OTP expired" });
    }

    if (entry.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    otpStore.delete(normalizedPhone);

    const user = await User.findOne({ phoneNumber: normalizedPhone });
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
    console.error("OTP verification error:", error);
    res.status(500).json({ message: error.message || "OTP verification failed" });
  }
};

module.exports = {
  registerUser,
  loginUser,
  verifyOTP,
};
