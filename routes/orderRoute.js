import express from 'express';
import { createOrder, getUserOrders } from '../controllers/orderController.js';
import { createGuestOrder } from '../controllers/guestOrderController.js';
import userAuth from '../middleware/userAuth.js';

const router = express.Router();

// User orders (require authentication)
router.post('/create', userAuth, createOrder);
router.get('/get', userAuth, getUserOrders);

// Guest orders (no authentication required)
router.post('/guest-create', createGuestOrder);

export default router;