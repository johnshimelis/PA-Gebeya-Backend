const { SSM } = require("aws-sdk"); // AWS SDK for fetching parameters
const User = require("../models/Users");
const UserOrder = require("../models/UserOrder");
const Message = require("../models/Message");
const Notification = require("../models/Notification");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

// Initialize AWS SSM
const ssm = new SSM({ region: "eu-north-1" }); // Replace with your AWS region

// Function to fetch parameters from AWS Systems Manager
async function getParameter(name, isSecure = false) {
  const param = await ssm
    .getParameter({
      Name: name,
      WithDecryption: isSecure,
    })
    .promise();
  return param.Parameter.Value;
}

// Load environment variables from AWS Systems Manager
async function loadEnv() {
  try {
    process.env.EMAIL_HOST = await getParameter("/pgebeya-backend/EMAIL_HOST");
    process.env.EMAIL_PORT = await getParameter("/pgebeya-backend/EMAIL_PORT");
    process.env.EMAIL_USER = await getParameter("/pgebeya-backend/EMAIL_USER");
    process.env.EMAIL_PASS = await getParameter("/pgebeya-backend/EMAIL_PASS", true);
    process.env.JWT_SECRET = await getParameter("/pgebeya-backend/JWT_SECRET", true);

    console.log("✅ Environment variables loaded successfully");
  } catch (error) {
    console.error("❌ Error loading environment variables:", error);
    process.exit(1); // Exit the process if environment variables fail to load
  }
}

// Initialize environment variables
loadEnv();

// Function to send OTP via email
const sendOTP = async (email, otp) => {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: process.env.EMAIL_PORT || 465,
    secure: true, // Use true for port 465 (SSL)
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: `"Support Team" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Your OTP for login",
    text: `Your OTP is: ${otp}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("OTP email sent successfully");
  } catch (error) {
    console.error("Error sending OTP email:", error);
    throw new Error("Failed to send OTP email");
  }
};

// Register a new user
const registerUser = async (req, res) => {
  const { fullName, phoneNumber, email, password } = req.body;

  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
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
    res.status(500).json({ message: "Server error" });
  }
};

// Login user and send OTP
const loginUser = async (req, res) => {
  const { phoneNumber } = req.body;

  try {
    const user = await User.findOne({ phoneNumber });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000);
    const otpExpiry = Date.now() + 10 * 60 * 1000; // OTP valid for 10 minutes

    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    await sendOTP(user.email, otp);

    res.status(200).json({ message: "OTP sent to email" });
  } catch (error) {
    console.error("Error logging in user:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Verify OTP and generate JWT token
const verifyOTP = async (req, res) => {
  const { phoneNumber, otp } = req.body;

  try {
    const user = await User.findOne({ phoneNumber });
    if (!user || user.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (Date.now() > user.otpExpiry) {
      return res.status(400).json({ message: "OTP expired" });
    }

    // Generate a JWT token for the user
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "365d",
    });

    // Fetch the user's personalized data
    const orders = await UserOrder.find({ userId: user._id }).select("date status total");
    const messages = await Message.find({ userId: user._id }).select("from message read date");
    const notifications = await Notification.find({ userId: user._id }).select("message date");

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        userId: user._id, // Include the userId in the response
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
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  registerUser,
  loginUser,
  verifyOTP,
};