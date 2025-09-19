import express from 'express';
import upload from '../middleware/multer.js';
import { updateAdmin, adminLogin, forgotPassword, verifyOtp, resetPassword, getAdminProfile, adminLogout, removeProfilePicture } from '../controllers/userController.js';
import adminAuth from '../middleware/adminAuth.js';

const router = express.Router();

router.post('/admin', adminLogin);
router.get('/me', adminAuth, getAdminProfile);
router.put('/update/:id', adminAuth, upload.fields([{ name: 'profilePicture', maxCount: 1 }]), updateAdmin);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password', resetPassword);
router.delete('/remove-profile-picture/:id', adminAuth, removeProfilePicture);
router.post('/logout', adminAuth, adminLogout);

export default router;