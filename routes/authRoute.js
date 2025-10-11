import express from 'express';
import {
  register,
  login,
  logout,
  verifyEmail,
  sendVerifyOtp,
  isAuthenticated,
  sendResetOtp,
  verifyResetOtp,
  resetPassword,
  updateProfile,
  deleteAccount,
  removeProfilePicture,
  syncAfterLogin,
  syncAfterGoogleLogin, // ADD THIS IMPORT
} from '../controllers/authController.js';
import {
  googleAuth,
  googleCallback,
  googleAuthSuccess
} from '../controllers/googleAuthController.js';
import userAuth from '../middleware/userAuth.js';
import upload from '../middleware/multer.js';

const authRouter = express.Router();

// Google OAuth routes
authRouter.get('/google', googleAuth);
authRouter.get('/google/callback', googleCallback);
authRouter.get('/google/success', userAuth, googleAuthSuccess);

// ✅ ADD THIS NEW ROUTE FOR GOOGLE SYNC
authRouter.post('/google-sync', userAuth, syncAfterGoogleLogin);

// ✅ ADD THIS TEST ROUTE - Temporary for debugging
authRouter.get('/test-google', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Google auth test endpoint working',
    callbackURL: process.env.NODE_ENV === 'production' 
      ? 'https://api.hadibookstore.shop/api/auth/google/callback'
      : 'http://localhost:4000/api/auth/google/callback',
    environment: process.env.NODE_ENV || 'development',
    googleClientId: process.env.GOOGLE_CLIENT_ID ? 'Set' : 'Not Set'
  });
});

// Existing routes
authRouter.post('/register', register);
authRouter.post('/login', login);
authRouter.post('/logout', logout);
authRouter.post('/send-verify-otp', sendVerifyOtp);
authRouter.post('/verify-account', verifyEmail);
authRouter.get('/is-auth', userAuth, isAuthenticated);
authRouter.post('/send-reset-otp', sendResetOtp);
authRouter.post('/verify-reset-otp', verifyResetOtp);
authRouter.post('/reset-password', resetPassword);
authRouter.put('/update-profile', userAuth, upload.single('file'), updateProfile);
authRouter.delete('/delete-account', userAuth, deleteAccount);
authRouter.delete('/remove-profile-picture', userAuth, removeProfilePicture);
authRouter.post('/sync', userAuth, syncAfterLogin);

export default authRouter;