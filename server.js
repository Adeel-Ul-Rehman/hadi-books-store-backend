import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { PrismaClient } from '@prisma/client';
import userRoutes from './routes/userRoute.js';
import adminRoutes from './routes/adminRoute.js';
import authRoutes from './routes/authRoute.js';
import cartRoutes from './routes/cartRoute.js';
import orderRoutes from './routes/orderRoute.js';
import productRoutes from './routes/productRoute.js';
import reviewRoutes from './routes/reviewRoute.js';
import wishlistRoutes from './routes/wishlistRoute.js';
import checkoutRoutes from './routes/checkoutRoute.js';
import heroRoutes from './routes/heroRoute.js';

dotenv.config();
const app = express();
const prisma = new PrismaClient();

// ✅ Updated CORS configuration for Vercel dynamic origins
const isProduction = process.env.NODE_ENV === 'production';

const allowedOrigins = isProduction 
  ? [
      'https://hadi-books-store-frontend.vercel.app',
      // Allow Vercel preview/staging subdomains (e.g., git branches)
      /^https:\/\/hadi-books-store-frontend(-.*)?\.vercel\.app$/,
      // Optionally: Allow all subdomains for flexibility (remove if too broad)
      // /^https:\/\/.*\.vercel\.app$/,
    ]
  : ['http://localhost:5173', 'http://localhost:3000'];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman, etc.)
      if (!origin) return callback(null, true);

      if (isProduction) {
        // In production, allow if origin matches the regex or exact Vercel domain
        const regexMatch = allowedOrigins.slice(1).some(regex => 
          origin.match(regex)
        );
        if (allowedOrigins[0] === origin || regexMatch) {
          return callback(null, true);
        }
      } else {
        // In dev, allow localhost
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
      }

      console.warn(`CORS blocked origin: ${origin}`); // Log blocked origins for debugging
      return callback(new Error(`Not allowed by CORS: ${origin}`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Set-Cookie'],
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/adminCtrl', adminRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/products', productRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/hero', heroRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Server is running' });
});

app.get('/', (req, res) => {
  res.send('Backend is running');
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: 'API endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, async () => {
  try {
    await prisma.$connect();
    console.log(`✅ Server running on port ${PORT}`);
    console.log('✅ Connected to Neon PostgreSQL database');
  } catch (error) {
    console.error('❌ Database connection error:', error);
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down server...');
  await prisma.$disconnect();
  process.exit(0);
});