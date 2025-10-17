import { PrismaClient } from '@prisma/client';
import cloudinary from '../config/cloudinary.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import transporter from '../config/emailTransporter.js';
import fs from 'fs/promises';

const prisma = new PrismaClient();

const getAdminProfile = async (req, res) => {
  try {
    const admin = await prisma.admin.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        profilePicture: true,
      },
    });

    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Admin profile retrieved',
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        profilePicture: admin.profilePicture,
      },
    });
  } catch (error) {
    console.error('Get admin profile error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve admin profile' });
  }
};

const updateAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password } = req.body;

    console.log('Updating admin ID:', id);
    console.log('Request body:', { name, email, password: password ? '[REDACTED]' : 'not provided' });
    console.log('Request files:', req.files);

    // Ensure authenticated admin is updating their own profile
    if (parseInt(id) !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized: Can only update own profile' });
    }

    let profilePicture = null;
    if (req.files?.profilePicture?.[0]) {
      console.log('Uploading file to Cloudinary');
      const file = req.files.profilePicture[0];
      
      try {
        // Upload to Cloudinary
        const result = await cloudinary.uploader.upload(file.path, {
          folder: 'hadi_books_store/admins',
          public_id: `admin_${name?.replace(/\s+/g, '_') || 'profile'}_${Date.now()}`,
        });
        
        console.log('Cloudinary upload success:', result.secure_url);
        profilePicture = result.secure_url;
        
        // Delete temporary file
        try {
          await fs.unlink(file.path);
          console.log('Temporary file deleted:', file.path);
        } catch (unlinkError) {
          console.error('Failed to delete temp file:', unlinkError);
        }
      } catch (uploadError) {
        console.error('Cloudinary upload error:', uploadError);
        // Delete temporary file even if upload fails
        try {
          await fs.unlink(file.path);
        } catch (unlinkError) {
          console.error('Failed to delete temp file after upload error:', unlinkError);
        }
        throw new Error('Failed to upload profile picture');
      }
    }

    // Prepare update data
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }
    if (profilePicture) updateData.profilePicture = profilePicture;

    console.log('Update data for Prisma:', updateData);

    // Update admin in database
    const updatedAdmin = await prisma.admin.update({
      where: { id: parseInt(id) },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        profilePicture: true,
      }
    });

    console.log('Updated admin:', updatedAdmin);

    return res.status(200).json({
      success: true,
      message: 'Admin profile updated',
      admin: updatedAdmin,
    });
  } catch (error) {
    console.error('Profile update error:', error);
    
    // Clean up uploaded files if any error occurs
    if (req.files?.profilePicture?.[0]?.path) {
      try {
        await fs.unlink(req.files.profilePicture[0].path);
      } catch (unlinkError) {
        console.error('Failed to delete temp file during error cleanup:', unlinkError);
      }
    }
    
    if (error.code === 'P2002' && error.meta?.target.includes('email')) {
      return res.status(400).json({ success: false, message: 'Email already in use' });
    }
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }
    return res.status(500).json({ 
      success: false, 
      message: `Failed to update admin profile: ${error.message}` 
    });
  }
};

const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find admin by email
    const admin = await prisma.admin.findUnique({
      where: { email },
      select: { id: true, email: true, password: true, name: true, profilePicture: true },
    });

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid admin credentials',
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid admin credentials',
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: admin.id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Set token as cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 3600000, // 1 hour
      sameSite: 'none'
    });

    return res.status(200).json({
      success: true,
      message: 'Admin login successful',
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        profilePicture: admin.profilePicture,
      },
      token, // Also send token in response for frontend to store
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Failed to login as admin',
    });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { adminEmail, sharedEmail } = req.body;

    // Validate inputs
    if (!adminEmail || !sharedEmail) {
      return res.status(400).json({
        success: false,
        message: 'Both admin email and recovery email are required',
      });
    }

    // Verify shared email
    if (sharedEmail !== 'ajadeel229@gmail.com') {
      return res.status(400).json({
        success: false,
        message: 'Invalid recovery email',
      });
    }

    // Find admin by adminEmail
    const admin = await prisma.admin.findUnique({
      where: { email: adminEmail },
      select: { id: true },
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found',
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpireAt = Math.floor(Date.now() / 1000) + 10 * 60; // 10 minutes expiry

    // Update admin with OTP
    await prisma.admin.update({
      where: { id: admin.id },
      data: { resetOtp: otp, resetOtpExpireAt: otpExpireAt },
    });

    // Send OTP email to sharedEmail
    const mailOptions = {
      from: `"Hadi Books Store" <${process.env.GMAIL_USER}>`,
      to: sharedEmail,
      subject: 'Password Reset OTP - Hadi Books Store Admin',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto; background: linear-gradient(to bottom, #000000, #1f2937); border: 1px solid #f97316; border-radius: 12px; padding: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.5);">
          <div style="text-align: center; margin-bottom: 12px;">
            <h2 style="color: #e0f2fe; font-size: 18px; font-weight: bold; margin: 0;">Hadi Books Store Admin</h2>
            <p style="color: #f97316; font-size: 12px; margin: 4px 0;">Password Reset Request</p>
          </div>
          <div style="color: #ffffff; font-size: 14px; text-align: center;">
            <p style="margin: 0 0 8px;">Your OTP for password reset is:</p>
            <p style="font-size: 24px; font-weight: bold; color: #f97316; letter-spacing: 4px; margin: 12px 0;">${otp}</p>
            <p style="margin: 0 0 8px;">This OTP is valid for 10 minutes.</p>
            <p style="font-size: 12px; color: #ffffff; margin: 8px 0 0;">If you did not request a password reset, please ignore this email.</p>
          </div>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log('✅ OTP email sent to:', sharedEmail);
    } catch (emailError) {
      console.error('❌ Failed to send OTP email:', emailError.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP email',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'OTP sent to recovery email',
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send OTP',
    });
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Find admin by email
    const admin = await prisma.admin.findUnique({
      where: { email },
      select: { id: true, resetOtp: true, resetOtpExpireAt: true },
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found',
      });
    }

    // Check OTP validity
    if (admin.resetOtp !== otp || admin.resetOtpExpireAt < Math.floor(Date.now() / 1000)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'OTP verified successfully',
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify OTP',
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    // Find admin by email
    const admin = await prisma.admin.findUnique({
      where: { email },
      select: { id: true, resetOtp: true, resetOtpExpireAt: true },
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found',
      });
    }

    // Check OTP validity
    if (admin.resetOtp !== otp || admin.resetOtpExpireAt < Math.floor(Date.now() / 1000)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP',
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password and clear OTP
    await prisma.admin.update({
      where: { id: admin.id },
      data: {
        password: hashedPassword,
        resetOtp: '',
        resetOtpExpireAt: 0,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reset password',
    });
  }
};

const removeProfilePicture = async (req, res) => {
  try {
    const { id } = req.params;

    // Ensure authenticated admin is removing their own profile picture
    if (parseInt(id) !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized: Can only remove own profile picture' });
    }

    // Find the admin
    const admin = await prisma.admin.findUnique({
      where: { id: parseInt(id) },
      select: { id: true, profilePicture: true },
    });

    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    // Delete image from Cloudinary if it exists
    if (admin.profilePicture) {
      try {
        // Extract public_id from the URL
        const urlParts = admin.profilePicture.split('/');
        const publicIdWithExtension = urlParts[urlParts.length - 1];
        const publicId = publicIdWithExtension.split('.')[0];
        
        // Extract folder name from the URL
        const folderIndex = urlParts.indexOf('upload') + 1;
        const folderPath = urlParts.slice(folderIndex, -1).join('/');
        
        const fullPublicId = folderPath ? `${folderPath}/${publicId}` : publicId;
        
        await cloudinary.uploader.destroy(fullPublicId);
        console.log('Cloudinary image deleted:', fullPublicId);
      } catch (cloudinaryError) {
        console.error('Cloudinary deletion error:', cloudinaryError);
        // Continue with database update even if Cloudinary deletion fails
      }
    }

    // Update admin to remove profile picture
    const updatedAdmin = await prisma.admin.update({
      where: { id: parseInt(id) },
      data: { profilePicture: null },
      select: { id: true, name: true, email: true, profilePicture: true },
    });

    return res.status(200).json({
      success: true,
      message: 'Profile picture removed successfully',
      admin: {
        id: updatedAdmin.id,
        name: updatedAdmin.name,
        email: updatedAdmin.email,
        profilePicture: updatedAdmin.profilePicture,
      },
    });
  } catch (error) {
    console.error('Remove profile picture error:', error);
    return res.status(500).json({ success: false, message: 'Failed to remove profile picture' });
  }
};

const adminLogout = async (req, res) => {
  try {
    // Clear the token cookie
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none'
    });

    return res.status(200).json({
      success: true,
      message: 'Admin logged out successfully',
    });
  } catch (error) {
    console.error('Admin logout error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to logout admin',
    });
  }
};

export { getAdminProfile, updateAdmin, adminLogin, adminLogout, forgotPassword, verifyOtp, resetPassword, removeProfilePicture };