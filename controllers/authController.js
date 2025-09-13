import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import validator from "validator";
import transporter from "../config/transporter.js";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import cloudinary from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const prisma = new PrismaClient();

export const register = async (req, res) => {
  try {
    const { name, lastName, email, password, confirmPassword } = req.body;

    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Name, email, password, and confirm password are required",
      });
    }

    if (!validator.isEmail(email)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid email format" });
    }

    if (
      password.length < 8 ||
      !/^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z\d!@#$%^&*]*$/.test(password)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 8 characters and contain at least one letter and one number",
      });
    }

    if (password !== confirmPassword) {
      return res
        .status(400)
        .json({ success: false, message: "Passwords do not match" });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiration = Math.floor(Date.now() / 1000) + 24 * 60 * 60; // 24 hours

    let user;
    let message;

    if (existingUser) {
      if (existingUser.isAccountVerified) {
        return res
          .status(400)
          .json({ success: false, message: "Email already in use" });
      } else {
        // Update existing unverified user with new details and OTP
        const hashedPassword = await bcrypt.hash(password, 10);
        user = await prisma.user.update({
          where: { email },
          data: {
            name,
            lastName,
            password: hashedPassword,
            verifyOtp: otp,
            verifyOtpExpireAt: otpExpiration,
          },
        });
        message =
          "Account exists but is unverified. Details updated and new OTP sent.";
      }
    } else {
      // Create new user with OTP
      const hashedPassword = await bcrypt.hash(password, 10);
      user = await prisma.user.create({
        data: {
          id: uuidv4(), // String UUID
          name,
          lastName,
          email,
          password: hashedPassword,
          isAccountVerified: false,
          verifyOtp: otp,
          verifyOtpExpireAt: otpExpiration,
        },
      });
      message = "Registration successful. OTP sent to your email.";
    }

    // Send email
    const mailOptions = {
      from: process.env.SENDER_EMAIL,
      to: email,
      subject: `Account Verification OTP`,
      html: `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <div style="padding: 30px; border: 2px solid #00308F; border-radius: 12px; background-color: #ffffff;">
        <h1 style="color: #E31837; text-align: center; margin-bottom: 20px; font-size: 28px;">Book Store</h1>
        <p style="font-size: 16px; line-height: 1.5;">Hello <strong>${name}</strong>,</p>
        <p style="font-size: 16px; line-height: 1.5;">Please use the following OTP to verify your Book Store account:</p>
        <div style="background: #f0f4f8; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; border: 1px dashed #00308F;">
          <h3 style="color: #E31837; font-size: 18px; margin-bottom: 10px;">Verification OTP</h3>
          <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #E31837; margin: 0;">${otp}</p>
          <p style="font-size: 14px; color: #555; margin-top: 10px;">This OTP is valid for 24 hours</p>
        </div>
        <p style="font-size: 16px; line-height: 1.5;">Enter this OTP in the app to complete your account verification.</p>
        <p style="font-size: 16px; line-height: 1.5; margin-top: 30px;">Best regards,<br><strong>The Book Store Team</strong></p>
      </div>
    </div>
  `,
      text: `Your OTP for Book Store account verification is ${otp}. Valid for 24 hours.`,
    };

    await transporter.sendMail(mailOptions);

    // For debugging: Log the OTP (remove in production)
    console.log(`OTP sent to ${email}: ${otp}`);

    return res.status(201).json({
      success: true,
      message,
      user: {
        id: user.id,
        name: user.name,
        lastName: user.lastName,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Register Error:", error.message, error.stack);
    return res
      .status(500)
      .json({ success: false, message: "Registration failed" });
  }
};

export const sendVerifyOtp = async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.isAccountVerified) {
      return res.status(400).json({
        success: false,
        message: "Account is already verified",
      });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    await prisma.user.update({
      where: { id: userId },
      data: {
        verifyOtp: otp,
        verifyOtpExpireAt: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
      },
    });

    const mailOptions = {
      from: process.env.SENDER_EMAIL,
      to: user.email,
      subject: `Account Verification OTP`,
      html: `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <div style="padding: 30px; border: 2px solid #00308F; border-radius: 12px; background-color: #ffffff;">
        <h1 style="color: #E31837; text-align: center; margin-bottom: 20px; font-size: 28px;">Book Store</h1>
        <p style="font-size: 16px; line-height: 1.5;">Hello <strong>${user.name}</strong>,</p>
        <p style="font-size: 16px; line-height: 1.5;">Please use the following OTP to verify your Book Store account:</p>
        <div style="background: #f0f4f8; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; border: 1px dashed #00308F;">
          <h3 style="color: #E31837; font-size: 18px; margin-bottom: 10px;">Verification OTP</h3>
          <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #E31837; margin: 0;">${otp}</p>
          <p style="font-size: 14px; color: #555; margin-top: 10px;">This OTP is valid for 24 hours</p>
        </div>
        <p style="font-size: 16px; line-height: 1.5;">Enter this OTP in the app to complete your account verification.</p>
        <p style="font-size: 16px; line-height: 1.5; margin-top: 30px;">Best regards,<br><strong>The Book Store Team</strong></p>
      </div>
    </div>
  `,
      text: `Your OTP for Book Store account verification is ${otp}. Valid for 24 hours.`,
    };

    await transporter.sendMail(mailOptions);

    // For debugging: Log the OTP (remove in production)
    console.log(`Resend OTP sent to ${user.email}: ${otp}`);

    return res.json({
      success: true,
      message: "Verification OTP sent to email",
    });
  } catch (error) {
    console.error("OTP send error:", error.message, error.stack);
    return res.status(500).json({
      success: false,
      message: "Failed to send OTP",
    });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const { otp } = req.body;

    if (!otp) {
      return res.status(400).json({
        success: false,
        message: "OTP is required",
      });
    }

    const user = await prisma.user.findFirst({
      where: {
        verifyOtp: otp,
        verifyOtpExpireAt: { gt: Math.floor(Date.now() / 1000) },
        isAccountVerified: false,
      },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { isAccountVerified: true, verifyOtp: "", verifyOtpExpireAt: 0 },
    });

    return res.json({
      success: true,
      message: "Email verified successfully",
      user: {
        id: user.id,
        name: user.name,
        lastName: user.lastName,
        email: user.email,
        isAccountVerified: true,
      },
    });
  } catch (error) {
    console.error("Verify email error:", error.message, error.stack);
    return res.status(500).json({
      success: false,
      message: "Failed to verify email",
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password, localCart = [], localWishlist = [] } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Email and password are required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    // Sync localCart
    let cartSynced = false;
    if (Array.isArray(localCart) && localCart.length > 0) {
      const cart = await prisma.cart.upsert({
        where: { userId: user.id },
        create: { userId: user.id },
        update: {},
        include: { items: true },
      });

      for (const item of localCart) {
        const { productId, quantity = 1 } = item;
        if (!productId || isNaN(quantity) || quantity < 1) continue;

        const product = await prisma.product.findUnique({
          where: { id: productId },
        });
        if (!product || !product.availability) continue;

        const existingItem = await prisma.cartItem.findUnique({
          where: { cartId_productId: { cartId: cart.id, productId } },
        });

        if (existingItem) {
          await prisma.cartItem.update({
            where: { id: existingItem.id },
            data: { quantity: { increment: parseInt(quantity) } },
          });
        } else {
          await prisma.cartItem.create({
            data: {
              cartId: cart.id,
              productId,
              quantity: parseInt(quantity),
            },
          });
        }
        cartSynced = true;
      }
    }

    // Sync localWishlist
    let wishlistSynced = false;
    if (Array.isArray(localWishlist) && localWishlist.length > 0) {
      const wishlist = await prisma.wishlist.upsert({
        where: { userId: user.id },
        create: { userId: user.id, itemLimit: 10 },
        update: {},
        include: { items: true },
      });

      const remainingSlots = wishlist.itemLimit - wishlist.items.length;
      for (const productId of localWishlist.slice(0, remainingSlots)) {
        if (!productId) continue;
        const product = await prisma.product.findUnique({
          where: { id: productId },
        });
        if (!product) continue;

        try {
          await prisma.wishlistItem.upsert({
            where: {
              wishlistId_productId: { wishlistId: wishlist.id, productId },
            },
            create: { wishlistId: wishlist.id, productId },
            update: {},
          });
          wishlistSynced = true;
        } catch (syncError) {
          console.error(
            "Wishlist sync error for product:",
            productId,
            syncError
          );
        }
      }
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      user: {
        id: user.id,
        name: user.name,
        lastName: user.lastName,
        email: user.email,
        isAccountVerified: user.isAccountVerified,
      },
      wishlistSynced,
      cartSynced,
    });
  } catch (error) {
    console.error("Login Error:", error.message, error.stack);
    return res.status(500).json({ success: false, message: "Login failed" });
  }
};

export const logout = async (req, res) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    });
    return res
      .status(200)
      .json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout Error:", error.message, error.stack);
    return res.status(500).json({ success: false, message: "Logout failed" });
  }
};

export const isAuthenticated = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        name: true,
        lastName: true,
        email: true,
        isAccountVerified: true,
        address: true,
        postCode: true,
        city: true,
        country: true,
        shippingAddress: true,
        mobileNumber: true,
        profilePicture: true,
      },
    });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    return res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Auth check error:", error.message, error.stack);
    return res.status(500).json({
      success: false,
      message: "Authentication check failed",
    });
  }
};

export const sendResetOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !validator.isEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Valid email is required",
      });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.isAccountVerified) {
      return res.status(401).json({
        success: false,
        message: "Please verify your email first",
      });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpExpiration = Math.floor(Date.now() / 1000) + 600; // 10 minutes
    try {
      await prisma.user.update({
        where: { email },
        data: {
          resetOtp: otp,
          resetOtpExpireAt: otpExpiration,
        },
      });
    } catch (dbError) {
      console.error("Database error during OTP update:", dbError.message);
      return res.status(500).json({
        success: false,
        message: "Failed to update OTP",
      });
    }

    const mailOptions = {
      from: process.env.SENDER_EMAIL,
      to: email,
      subject: `🔐 Book Store Password Reset Verification`,
      html: `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <div style="padding: 30px; border: 2px solid #00308F; border-radius: 12px; background-color: #ffffff;">
        <h1 style="color: #E31837; text-align: center; margin-bottom: 20px; font-size: 28px;">Book Store</h1>
        <p style="font-size: 16px; line-height: 1.5;">Hello <strong>${
          user.name
        } ${user.lastName || ""}</strong>,</p>
        <p style="font-size: 16px; line-height: 1.5;">We received a request to reset your password for your Book Store account with email: <strong>${email}</strong>.</p>
        <div style="background: #f0f4f8; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; border: 1px dashed #00308F;">
          <h3 style="color: #E31837; font-size: 18px; margin-bottom: 10px;">Password Reset OTP</h3>
          <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #E31837; margin: 0;">${otp}</p>
          <p style="font-size: 14px; color: #555; margin-top: 10px;">This OTP is valid for 10 minutes</p>
        </div>
        <p style="font-size: 16px; line-height: 1.5;">Please enter this OTP in the app to proceed with resetting your password.</p>
        <p style="font-size: 16px; line-height: 1.5; margin-top: 30px;">Best regards,<br><strong>The Book Store Team</strong></p>
      </div>
    </div>
  `,
      text: `Book Store - Password Reset
Dear ${user.name} ${user.lastName || ""},
We received a request to reset your password for your Book Store account with email: ${email}.
Password Reset OTP: ${otp}
This OTP is valid for 10 minutes.
Please enter this OTP in the app to proceed with resetting your password.
Best regards,
The Book Store Team`,
    };

    await transporter.sendMail(mailOptions);

    return res.json({
      success: true,
      message: "Password reset OTP sent to email",
    });
  } catch (error) {
    console.error("Reset OTP error:", error.message, error.stack);
    return res.status(500).json({
      success: false,
      message: "Failed to send reset OTP",
    });
  }
};

export const verifyResetOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.resetOtp || user.resetOtp !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    if (
      !user.resetOtpExpireAt ||
      user.resetOtpExpireAt < Math.floor(Date.now() / 1000)
    ) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired",
      });
    }

    return res.json({
      success: true,
      message: "OTP verified successfully",
    });
  } catch (error) {
    console.error("OTP verification error:", error.message, error.stack);
    return res.status(500).json({
      success: false,
      message: "Failed to verify OTP",
    });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword, confirmPassword } = req.body;
    console.log("resetPassword input:", {
      email,
      otp,
      newPassword: "***",
      confirmPassword: "***",
    }); // Debug log, hide passwords

    // Validate input fields
    if (!email || !otp || !newPassword || !confirmPassword) {
      console.log("Missing required fields");
      return res.status(400).json({
        success: false,
        message: "Email, OTP, new password, and confirm password are required",
      });
    }

    // Validate email format
    if (!validator.isEmail(email)) {
      console.log("Invalid email format:", email);
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    // Validate OTP format (6-digit number)
    if (!/^\d{6}$/.test(otp)) {
      console.log("Invalid OTP format:", otp);
      return res.status(400).json({
        success: false,
        message: "OTP must be a 6-digit number",
      });
    }

    // Validate password requirements
    if (
      newPassword.length < 8 ||
      !/^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z\d!@#$%^&*]*$/.test(newPassword)
    ) {
      console.log("Invalid password format");
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 8 characters and contain at least one letter and one number",
      });
    }

    // Validate password match
    if (newPassword !== confirmPassword) {
      console.log("Passwords do not match");
      return res.status(400).json({
        success: false,
        message: "Passwords do not match",
      });
    }

    // Validate password length
    if (newPassword.length > 50) {
      console.log("Password exceeds 50 characters");
      return res.status(400).json({
        success: false,
        message: "Password cannot exceed 50 characters",
      });
    }

    // Find user
    let user;
    try {
      user = await prisma.user.findUnique({ where: { email } });
    } catch (dbError) {
      console.error("Database error during user lookup:", dbError.message);
      return res.status(500).json({
        success: false,
        message: "Database error while finding user",
      });
    }

    if (!user) {
      console.log("User not found for email:", email);
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if account is verified
    if (!user.isAccountVerified) {
      console.log("User email not verified:", email);
      return res.status(401).json({
        success: false,
        message: "Please verify your email first",
      });
    }

    // Validate OTP
    if (!user.resetOtp || user.resetOtp !== otp) {
      console.log("Invalid OTP for user:", email);
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    // Validate OTP expiration
    if (
      !user.resetOtpExpireAt ||
      user.resetOtpExpireAt < Math.floor(Date.now() / 1000)
    ) {
      console.log("OTP expired for user:", email);
      return res.status(400).json({
        success: false,
        message: "OTP has expired",
      });
    }

    // Hash new password
    let hashedPassword;
    try {
      hashedPassword = await bcrypt.hash(newPassword, 10);
    } catch (bcryptError) {
      console.error(
        "Bcrypt error during password hashing:",
        bcryptError.message
      );
      return res.status(500).json({
        success: false,
        message: "Failed to process password",
      });
    }

    // Update user password and clear OTP fields
    try {
      console.log("Updating user with data:", {
        password: "***",
        resetOtp: "",
        resetOtpExpireAt: 0,
      });
      await prisma.user.update({
        where: { email },
        data: {
          password: hashedPassword,
          resetOtp: "", // Use empty string instead of null
          resetOtpExpireAt: 0, // Use 0 instead of null
        },
      });
    } catch (dbError) {
      console.error("Database error during user update:", dbError.message);
      return res.status(500).json({
        success: false,
        message: "Database error while updating password",
      });
    }

    console.log("Password reset successful for user:", email);
    return res.json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Password reset error:", error.message, error.stack);
    return res.status(500).json({
      success: false,
      message: "Failed to reset password",
    });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const userId = req.userId;

    // Handle multipart/form-data
    const {
      name,
      lastName,
      email,
      address,
      postCode,
      city,
      country,
      shippingAddress,
      mobileNumber,
      oldPassword,
      newPassword,
    } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const updateData = {};
    let hasChanges = false;

    // Basic profile validation - check if values are provided and different from current
    if (
      name !== undefined &&
      name !== null &&
      name !== "" &&
      name !== user.name
    ) {
      if (name.length > 20) {
        return res.status(400).json({
          success: false,
          message: "Name must be 20 characters or less",
        });
      }
      updateData.name = name;
      hasChanges = true;
    }

    if (
      lastName !== undefined &&
      lastName !== null &&
      lastName !== "" &&
      lastName !== user.lastName
    ) {
      if (lastName.length > 20) {
        return res.status(400).json({
          success: false,
          message: "Last name must be 20 characters or less",
        });
      }
      updateData.lastName = lastName;
      hasChanges = true;
    }

    if (
      email !== undefined &&
      email !== null &&
      email !== "" &&
      email !== user.email
    ) {
      if (!validator.isEmail(email)) {
        return res.status(400).json({
          success: false,
          message: "Invalid email format",
        });
      }
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser && existingUser.id !== userId) {
        return res.status(400).json({
          success: false,
          message: "Email already in use",
        });
      }
      updateData.email = email;
      hasChanges = true;
    }

    if (address !== undefined && address !== null && address !== user.address) {
      updateData.address = address;
      hasChanges = true;
    }

    if (
      postCode !== undefined &&
      postCode !== null &&
      postCode !== user.postCode
    ) {
      updateData.postCode = postCode;
      hasChanges = true;
    }

    if (city !== undefined && city !== null && city !== user.city) {
      updateData.city = city;
      hasChanges = true;
    }

    if (country !== undefined && country !== null && country !== user.country) {
      updateData.country = country;
      hasChanges = true;
    }

    if (
      shippingAddress !== undefined &&
      shippingAddress !== null &&
      shippingAddress !== user.shippingAddress
    ) {
      updateData.shippingAddress = shippingAddress;
      hasChanges = true;
    }

    if (
      mobileNumber !== undefined &&
      mobileNumber !== null &&
      mobileNumber !== user.mobileNumber
    ) {
      updateData.mobileNumber = mobileNumber;
      hasChanges = true;
    }

    // Password change logic
    if (newPassword && newPassword !== "") {
      if (!oldPassword) {
        return res.status(400).json({
          success: false,
          message: "Current password is required to set new password",
        });
      }

      const isMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: "Current password is incorrect",
        });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          message: "New password must be at least 8 characters",
        });
      }

      if (!/^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z\d!@#$%^&*]*$/.test(newPassword)) {
        return res.status(400).json({
          success: false,
          message:
            "New password must contain at least one letter and one number",
        });
      }

      updateData.password = await bcrypt.hash(newPassword, 10);
      hasChanges = true;
    }

    // Profile picture handling
    if (req.file) {
      try {
        // Read the uploaded file from disk
        const fileBuffer = fs.readFileSync(req.file.path);

        // Delete old profile picture if exists
        if (user.profilePicture) {
          await cloudinary.uploader.destroy(`user-profiles/profile_${userId}`);
        }

        // Upload new profile picture to Cloudinary
        const uploadResult = await cloudinary.uploader.upload(
          `data:${req.file.mimetype};base64,${fileBuffer.toString("base64")}`,
          {
            folder: "user-profiles",
            public_id: `profile_${userId}`,
            overwrite: true,
            transformation: [
              { width: 200, height: 200, crop: "fill" },
              { quality: "auto" },
              { format: "auto" },
            ],
          }
        );

        updateData.profilePicture = uploadResult.secure_url;
        hasChanges = true;

        // Clean up the temporary file
        fs.unlinkSync(req.file.path);
      } catch (uploadError) {
        console.error("Cloudinary upload error:", uploadError);
        // Clean up the temporary file even if upload fails
        if (req.file && req.file.path) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(500).json({
          success: false,
          message: "Failed to upload profile picture",
        });
      }
    }

    // Debug log to see what changes were detected
    console.log("Update data:", updateData);
    console.log("Has changes:", hasChanges);

    if (!hasChanges) {
      // Clean up the temporary file if no changes
      if (req.file && req.file.path) {
        fs.unlinkSync(req.file.path);
      }

      return res.status(400).json({
        success: false,
        message: "No valid changes provided",
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        lastName: true,
        email: true,
        address: true,
        postCode: true,
        city: true,
        country: true,
        shippingAddress: true,
        mobileNumber: true,
        profilePicture: true,
        isAccountVerified: true,
      },
    });

    return res.json({
      success: true,
      user: updatedUser,
    });
  } catch (error) {
    // Clean up the temporary file in case of error
    if (req.file && req.file.path) {
      fs.unlinkSync(req.file.path);
    }

    console.error("Profile update error:", error.message, error.stack);
    return res.status(500).json({
      success: false,
      message: "Failed to update profile",
    });
  }
};

export const removeProfilePicture = async (req, res) => {
  try {
    const userId = req.userId;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.profilePicture) {
      return res.status(400).json({
        success: false,
        message: "No profile picture to remove",
      });
    }

    try {
      // Delete from Cloudinary
      await cloudinary.uploader.destroy(`user-profiles/profile_${userId}`);
    } catch (cloudinaryError) {
      console.error("Cloudinary deletion error:", cloudinaryError);
      // Continue with database update even if Cloudinary deletion fails
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { profilePicture: null },
      select: {
        id: true,
        name: true,
        lastName: true,
        email: true,
        address: true,
        postCode: true,
        city: true,
        country: true,
        shippingAddress: true,
        mobileNumber: true,
        profilePicture: true,
        isAccountVerified: true,
      },
    });

    return res.json({
      success: true,
      message: "Profile picture removed successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Profile picture removal error:", error.message, error.stack);
    return res.status(500).json({
      success: false,
      message: "Failed to remove profile picture",
    });
  }
};

export const deleteAccount = async (req, res) => {
  try {
    const { email, password } = req.body;
    const userId = req.userId;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        reviews: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.email !== email) {
      return res.status(401).json({
        success: false,
        message: "Email does not match your account",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Incorrect password",
      });
    }

    // Use transaction to ensure all operations succeed or fail together
    await prisma.$transaction(async (tx) => {
      // 1. Delete all reviews by this user first
      if (user.reviews.length > 0) {
        await tx.review.deleteMany({
          where: { userId: userId },
        });
      }

      // 2. Delete profile picture from Cloudinary if exists
      if (user.profilePicture) {
        await cloudinary.uploader.destroy(`user-profiles/profile_${userId}`);
      }

      // 3. Delete the user
      await tx.user.delete({ where: { id: userId } });
    });

    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    });

    return res.json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error) {
    console.error("Account deletion error:", error.message, error.stack);
    return res.status(500).json({
      success: false,
      message: "Failed to delete account",
    });
  }
};
