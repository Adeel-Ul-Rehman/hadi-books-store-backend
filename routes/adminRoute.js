import express from 'express';
import upload from '../middleware/multer.js';
import { 
  addProduct,
  listProducts, 
  updateProduct, 
  removeProduct, 
  singleProduct, 
  toggleAvailability, 
  toggleBestseller,
  updateOrderStatus,
  getOrders,
  getOrderStats,
  getAllHeroImages,
  addHeroImage,
  updateHeroImage,
  toggleHeroImageAvailability,
  deleteHeroImage
} from '../controllers/adminController.js';
import adminAuth from '../middleware/adminAuth.js';

const router = express.Router();

router.get('/single/:id', singleProduct); 

// Admin routes
router.get('/list', adminAuth, listProducts);
router.post('/add', adminAuth, upload.fields([{ name: 'image', maxCount: 1 }]), addProduct);
router.put('/update/:id', adminAuth, upload.fields([{ name: 'image', maxCount: 1 }]), updateProduct);
router.delete('/remove/:id', adminAuth, removeProduct);
router.patch('/toggle-availability/:id', adminAuth, toggleAvailability);
router.patch('/toggle-bestseller/:id', adminAuth, toggleBestseller);

// Admin orders route
router.put('/status/:id', adminAuth, updateOrderStatus);
router.get('/all', adminAuth, getOrders);
router.get('/order-stats', adminAuth, getOrderStats);

// Hero image routes
router.get('/hero/all', adminAuth, getAllHeroImages);
router.post('/hero/add', adminAuth, upload.fields([{ name: 'image', maxCount: 1 }]), addHeroImage);
router.put('/hero/update/:id', adminAuth, upload.fields([{ name: 'image', maxCount: 1 }]), updateHeroImage);
router.patch('/hero/toggle-availability/:id', adminAuth, toggleHeroImageAvailability);
router.delete('/hero/delete/:id', adminAuth, deleteHeroImage);

export default router;