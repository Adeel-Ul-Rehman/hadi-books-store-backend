import express from 'express';
import {
  getHeroImages
} from '../controllers/heroController.js';

const router = express.Router();

// Public routes
router.get('/', getHeroImages);

export default router;