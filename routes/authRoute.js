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
} from '../controllers/authController.js';
import userAuth from '../middleware/userAuth.js';
import upload from '../middleware/multer.js';

const authRouter = express.Router();

authRouter.post('/register', register);
authRouter.post('/login', login);
authRouter.post('/logout', logout);
authRouter.post('/send-verify-otp', sendVerifyOtp); // Removed userAuth to make public
authRouter.post('/verify-account', verifyEmail); // Removed userAuth to make public
authRouter.post('/is-auth', userAuth, isAuthenticated);
authRouter.post('/send-reset-otp', sendResetOtp);
authRouter.post('/verify-reset-otp', verifyResetOtp);
authRouter.post('/reset-password', resetPassword);
authRouter.put('/update-profile', userAuth, upload.single('file'), updateProfile);
authRouter.delete('/delete-account', userAuth, deleteAccount);
authRouter.delete('/remove-profile-picture', userAuth, removeProfilePicture);

export default authRouter;