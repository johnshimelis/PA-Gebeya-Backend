require("dotenv").config();
const User = require("../models/Users");
const UserOrder = require("../models/UserOrder");
const Message = require("../models/Message");
const Notification = require("../models/Notification");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const twilio = require("twilio");

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

// ✅ Normalize phone numbers that start with 09, 07, or +251...
const normalizePhoneNumber = (phone) => {
  if (!phone) return phone;
  phone = phone.trim();

  if (phone.startsWith('0')) {
    return '+251' + phone.substring(1);
  }
  if ((phone.length === 9 && (phone.startsWith('9') || phone.startsWith('7')))) {
    return '+251' + phone;
  }
  if (phone.startsWith('+251')) {
    return phone;
  }

  return phone;
};

// ✅ Send OTP using Twilio
const sendOTP = async (phoneNumber) => {
  try {
    const verification = await twilioClient.verify.v2
      .services(verifyServiceSid)
      .verifications.create({ to: phoneNumber, channel: "sms" });

    console.log(`Verification SID: ${verification.sid} sent to ${phoneNumber}`);
    return verification.sid;
  } catch (error) {
    console.error("Error sending OTP:", error);
    throw new Error(error.message || "Failed to send OTP");
  }
};

// ✅ Check OTP
const checkOTP = async (phoneNumber, otpCode) => {
  try {
    const verificationCheck = await twilioClient.verify.v2
      .services(verifyServiceSid)
      .verificationChecks.create({ to: phoneNumber, code: otpCode });

    return verificationCheck.status === "approved";
  } catch (error) {
    console.error("Error verifying OTP:", error);
    throw new Error(error.message || "OTP verification failed");
  }
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

// ✅ Login User (send OTP to all registered users)
const loginUser = async (req, res) => {
  const { phoneNumber } = req.body;

  try {
    const normalizedPhone = normalizePhoneNumber(phoneNumber);

    const user = await User.findOne({ phoneNumber: normalizedPhone });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const verificationSid = await sendOTP(normalizedPhone);

    res.status(200).json({
      message: "OTP sent to your phone number",
      phoneNumber: normalizedPhone,
      verificationSid,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: error.message || "Login failed" });
  }
};

// ✅ Verify OTP and login user
const verifyOTP = async (req, res) => {
  const { phoneNumber, otp } = req.body;

  try {
    const normalizedPhone = normalizePhoneNumber(phoneNumber);

    const isVerified = await checkOTP(normalizedPhone, otp);
    if (!isVerified) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

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
