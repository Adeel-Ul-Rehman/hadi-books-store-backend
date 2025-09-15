import express from 'express';
import { addToCart, getCart, updateCartItem, removeCartItem } from '../controllers/cartController.js';
import userAuth from '../middleware/userAuth.js';

const router = express.Router();

router.post('/add', userAuth, addToCart);
router.get('/get/:userId', userAuth, getCart);
router.put('/update', userAuth, updateCartItem);
router.delete('/remove', userAuth, removeCartItem);

export default router;