import express from 'express';
import { addReview, getProductReviews } from '../controllers/reviewController.js';
import userAuth from '../middleware/userAuth.js';

const router = express.Router();

router.post('/add', userAuth, addReview);
router.get('/product/:productId', getProductReviews);

export default router;