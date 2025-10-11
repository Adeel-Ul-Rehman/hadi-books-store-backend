import express from 'express';
import { calculateCheckout, processCheckout, uploadPaymentProof, uploadGuestPaymentProof ,upload } from '../controllers/checkoutController.js';
import userAuth from '../middleware/userAuth.js';

const router = express.Router();

router.post('/calculate', userAuth, calculateCheckout);
router.post('/process', userAuth, processCheckout);
router.post('/upload-proof', userAuth, upload.fields([{ name: 'proof', maxCount: 1 }]), uploadPaymentProof);
// Guest upload does not require userAuth but requires guestEmail in body to validate
router.post('/guest-upload-proof', upload.fields([{ name: 'proof', maxCount: 1 }]), uploadGuestPaymentProof);

export default router;