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

    // Send email with enhanced error handling
    try {
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
      console.log(`✅ OTP email sent successfully to ${email}: ${otp}`);
    } catch (emailError) {
      console.error('❌ Failed to send OTP email:', emailError.message);
      console.error('Email error details:', emailError);
      // Don't fail the registration if email fails, but log it
      console.log(`📝 OTP for ${email} (not sent via email): ${otp}`);
      // Still return success but with a warning about email
      message += " However, email delivery failed. Please try resending OTP.";
    }

    // For debugging: Log the OTP (remove in production)
    console.log(`OTP generated for ${email}: ${otp}`);

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

    // Send email with enhanced error handling
    try {
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
      console.log(`✅ Resend OTP email sent successfully to ${user.email}: ${otp}`);

      // For debugging: Log the OTP (remove in production)
      console.log(`Resend OTP generated for ${user.email}: ${otp}`);

      return res.json({
        success: true,
        message: "Verification OTP sent to email",
      });
    } catch (emailError) {
      console.error('❌ Failed to resend OTP email:', emailError.message);
      console.error('Email error details:', emailError);
      return res.status(500).json({
        success: false,
        message: "Failed to send OTP email. Please try again.",
      });
    }
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

export const syncCartAndWishlist = async (userId, localCart, localWishlist) => {
  // Sync localCart with per-item error handling
  let cartSynced = false;
  let cartSyncErrors = [];
  if (Array.isArray(localCart) && localCart.length > 0) {
    try {
      const cart = await prisma.cart.upsert({
        where: { userId: userId },
        create: { userId: userId },
        update: {},
        include: { items: true },
      });

      let allCartItemsSynced = true;
      for (const item of localCart) {
        try {
          const { productId, quantity = 1 } = item;
          if (!productId || isNaN(quantity) || quantity < 1) {
            cartSyncErrors.push(`Invalid productId or quantity for item: ${JSON.stringify(item)}`);
            allCartItemsSynced = false;
            continue;
          }

          const product = await prisma.product.findUnique({
            where: { id: productId },
          });
          if (!product || !product.availability) {
            cartSyncErrors.push(`Product not found or unavailable: ${productId}`);
            allCartItemsSynced = false;
            continue;
          }

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
        } catch (itemError) {
          console.error(`Cart sync item error for product ${item.productId}:`, itemError.message);
          cartSyncErrors.push(`Error syncing cart item ${item.productId}: ${itemError.message}`);
          allCartItemsSynced = false;
        }
      }

      if (allCartItemsSynced) {
        cartSynced = true;
        console.log(`Cart sync successful for user ${userId}`);
      } else {
        console.log(`Partial cart sync failure for user ${userId}:`, cartSyncErrors);
      }
    } catch (syncError) {
      console.error("Cart sync error:", syncError.message, syncError.stack);
      cartSyncErrors.push(`Cart sync failed: ${syncError.message}`);
    }
  } else {
    cartSynced = true; // No items to sync, consider successful
  }

  // Sync localWishlist with per-item error handling
  let wishlistSynced = false;
  let wishlistSyncErrors = [];
  if (Array.isArray(localWishlist) && localWishlist.length > 0) {
    try {
      const wishlist = await prisma.wishlist.upsert({
        where: { userId: userId },
        create: { userId: userId, itemLimit: 10 },
        update: {},
        include: { items: true },
      });

      let allWishlistItemsSynced = true;
      const remainingSlots = wishlist.itemLimit - wishlist.items.length;
      for (const productId of localWishlist.slice(0, remainingSlots)) {
        try {
          if (!productId) {
            wishlistSyncErrors.push(`Invalid productId: ${productId}`);
            allWishlistItemsSynced = false;
            continue;
          }
          const product = await prisma.product.findUnique({
            where: { id: productId },
          });
          if (!product) {
            wishlistSyncErrors.push(`Product not found: ${productId}`);
            allWishlistItemsSynced = false;
            continue;
          }

          await prisma.wishlistItem.upsert({
            where: {
              wishlistId_productId: { wishlistId: wishlist.id, productId },
            },
            create: { wishlistId: wishlist.id, productId },
            update: {},
          });
        } catch (itemError) {
          console.error(`Wishlist sync item error for product ${productId}:`, itemError.message);
          wishlistSyncErrors.push(`Error syncing wishlist item ${productId}: ${itemError.message}`);
          allWishlistItemsSynced = false;
        }
      }

      if (allWishlistItemsSynced) {
        wishlistSynced = true;
        console.log(`Wishlist sync successful for user ${userId}`);
      } else {
        console.log(`Partial wishlist sync failure for user ${userId}:`, wishlistSyncErrors);
      }
    } catch (syncError) {
      console.error("Wishlist sync error:", syncError.message, syncError.stack);
      wishlistSyncErrors.push(`Wishlist sync failed: ${syncError.message}`);
    }
  } else {
    wishlistSynced = true; // No items to sync, consider successful
  }

  return {
    wishlistSynced,
    cartSynced,
    syncErrors: [...cartSyncErrors, ...wishlistSyncErrors]
  };
};

export const syncAfterGoogleLogin = async (req, res) => {
  try {
    const { localCart = [], localWishlist = [] } = req.body;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const syncResult = await syncCartAndWishlist(userId, localCart, localWishlist);

    return res.status(200).json({
      success: true,
      message: "Sync successful after Google login",
      wishlistSynced: syncResult.wishlistSynced,
      cartSynced: syncResult.cartSynced,
      syncErrors: syncResult.syncErrors,
    });
  } catch (error) {
    console.error("Sync After Google Login Error:", error.message, error.stack);
    return res.status(500).json({ success: false, message: "Sync failed after Google login" });
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

    const syncResult = await syncCartAndWishlist(user.id, localCart, localWishlist);

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    // Cookie options for cross-origin compatibility - FIXED
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction, // Use secure cookies in production
      sameSite: isProduction ? 'none' : 'lax', // Allow cross-origin in production
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    };

    res.cookie("token", token, cookieOptions);

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
      wishlistSynced: syncResult.wishlistSynced,
      cartSynced: syncResult.cartSynced,
      syncErrors: syncResult.syncErrors, // Return errors for debugging
    });
  } catch (error) {
    console.error("Login Error:", error.message, error.stack);
    return res.status(500).json({ success: false, message: "Login failed" });
  }
};

export const syncAfterLogin = async (req, res) => {
  try {
    const { localCart = [], localWishlist = [] } = req.body;
    const userId = req.userId; // From userAuth middleware

    if (!userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const syncResult = await syncCartAndWishlist(userId, localCart, localWishlist);

    return res.status(200).json({
      success: true,
      message: "Sync successful",
      wishlistSynced: syncResult.wishlistSynced,
      cartSynced: syncResult.cartSynced,
      syncErrors: syncResult.syncErrors,
    });
  } catch (error) {
    console.error("Sync After Login Error:", error.message, error.stack);
    return res.status(500).json({ success: false, message: "Sync failed" });
  }
};

export const logout = async (req, res) => {
  try {
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
    };

    res.clearCookie("token", cookieOptions);
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
    // If no userId (not authenticated), return not authenticated
    if (!req.userId) {
      return res.status(200).json({
        success: false,
        message: "Not authenticated",
        user: null
      });
    }

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
      return res.status(200).json({
        success: false,
        message: "User not found",
        user: null
      });
    }
    
    return res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Auth check error:", error.message);
    return res.status(200).json({
      success: false,
      message: "Authentication check failed",
      user: null
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

    // Send email with enhanced error handling
    try {
      const mailOptions = {
        from: process.env.SENDER_EMAIL,
        to: email,
        subject: `🔐 Book Store Password Reset Verification`,
        html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <div style="padding: 30px; border: 2px solid #00308F; border-radius: 12px; background-color: #ffffff;">
          <h1 style="color: #E31837; text-align: center; margin-bottom: 20px; font-size: 28px;">Book Store</h1>
          <p style="font-size: 16px; line-height: 1.5;">Hello <strong>${user.name} ${user.lastName || ""}</strong>,</p>
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
      console.log(`✅ Password reset OTP email sent successfully to ${email}: ${otp}`);
      
      return res.json({
        success: true,
        message: "Password reset OTP sent to email",
      });
    } catch (emailError) {
      console.error('❌ Failed to send password reset OTP email:', emailError.message);
      console.error('Email error details:', emailError);
      return res.status(500).json({
        success: false,
        message: "Failed to send reset OTP email. Please try again.",
      });
    }
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

    if (!email || !otp || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, OTP, new password, and confirm password are required",
      });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: "OTP must be a 6-digit number",
      });
    }

    if (
      newPassword.length < 8 ||
      !/^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z\d!@#$%^&*]*$/.test(newPassword)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 8 characters and contain at least one letter and one number",
      });
    }

    if (newPassword !== confirmPassword) {
      return res
        .status(400)
        .json({ success: false, message: "Passwords do not match" });
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

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { email },
      data: {
        password: hashedPassword,
        resetOtp: "",
        resetOtpExpireAt: 0,
      },
    });

    return res.json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Reset Password Error:", error.message, error.stack);
    return res.status(500).json({
      success: false,
      message: "Failed to reset password",
    });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const userId = req.userId;

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

    if (req.file) {
      try {
        const fileBuffer = fs.readFileSync(req.file.path);

        if (user.profilePicture) {
          await cloudinary.uploader.destroy(`user-profiles/profile_${userId}`);
        }

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

        fs.unlinkSync(req.file.path);
      } catch (uploadError) {
        console.error("Cloudinary upload error:", uploadError);
        if (req.file && req.file.path) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(500).json({
          success: false,
          message: "Failed to upload profile picture",
        });
      }
    }

    if (!hasChanges) {
      return res.status(400).json({
        success: false,
        message: "No changes provided to update",
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
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Update Profile Error:", error.message, error.stack);
    if (req.file && req.file.path) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(500).json({
      success: false,
      message: "Failed to update profile",
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

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.email !== email) {
      return res.status(400).json({
        success: false,
        message: "Email does not match",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid password",
      });
    }

    if (user.profilePicture) {
      await cloudinary.uploader.destroy(`user-profiles/profile_${userId}`);
    }

    await prisma.user.delete({ where: { id: userId } });

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" && !req.headers.origin.includes('localhost'),
      sameSite: req.headers.origin.includes('localhost') ? 'none' : 'lax',
    };

    res.clearCookie("token", cookieOptions);

    return res.json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error) {
    console.error("Delete Account Error:", error.message, error.stack);
    return res.status(500).json({
      success: false,
      message: "Failed to delete account",
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

    await cloudinary.uploader.destroy(`user-profiles/profile_${userId}`);

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
    console.error("Remove Profile Picture Error:", error.message, error.stack);
    return res.status(500).json({
      success: false,
      message: "Failed to remove profile picture",
    });
  }
};