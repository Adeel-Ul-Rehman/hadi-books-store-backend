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
authRouter.post('/send-verify-otp', sendVerifyOtp);
authRouter.post('/verify-account', verifyEmail);
authRouter.get('/is-auth', userAuth, isAuthenticated); // Changed from POST to GET
authRouter.post('/send-reset-otp', sendResetOtp);
authRouter.post('/verify-reset-otp', verifyResetOtp);
authRouter.post('/reset-password', resetPassword);
authRouter.put('/update-profile', userAuth, upload.single('file'), updateProfile);
authRouter.delete('/delete-account', userAuth, deleteAccount);
authRouter.delete('/remove-profile-picture', userAuth, removeProfilePicture);

export default authRouter;