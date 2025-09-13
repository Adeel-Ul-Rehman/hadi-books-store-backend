import express from 'express';
import { getProducts, singleProduct } from '../controllers/productController.js';

const router = express.Router();

// Public routes
router.get('/get', getProducts);
router.get('/:id', singleProduct);

export default router;