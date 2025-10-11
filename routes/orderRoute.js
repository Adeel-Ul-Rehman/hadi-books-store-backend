import express from 'express';
import { createOrder, getUserOrders } from '../controllers/orderController.js';
import { createGuestOrder } from '../controllers/guestOrderController.js';
import userAuth from '../middleware/userAuth.js';

const router = express.Router();

router.post('/create', userAuth, createOrder);
router.get('/get', userAuth, getUserOrders);

// Guest order endpoint (no auth required)
router.post('/guest-create', createGuestOrder);

export default router;