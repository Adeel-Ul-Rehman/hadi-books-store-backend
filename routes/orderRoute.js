import express from 'express';
import { createOrder, getUserOrders } from '../controllers/orderController.js';
import userAuth from '../middleware/userAuth.js';

const router = express.Router();

router.post('/create', userAuth, createOrder);
router.get('/get', userAuth, getUserOrders);

export default router;