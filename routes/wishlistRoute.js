import express from 'express';
import { addToWishlist, getWishlist, removeFromWishlist } from '../controllers/wishlistController.js';
import userAuth from '../middleware/userAuth.js';

const router = express.Router();

router.post('/add', userAuth, addToWishlist);
router.get('/get/:userId', userAuth, getWishlist);
router.post('/remove', userAuth, removeFromWishlist);

export default router;