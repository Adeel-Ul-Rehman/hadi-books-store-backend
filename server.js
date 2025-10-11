import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session'; // ADD THIS IMPORT
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
import passport from './middleware/passport.js';

dotenv.config();
const app = express();
const prisma = new PrismaClient();

// When deployed behind a proxy (Vercel, Cloudflare, Heroku), enable trust proxy
if (process.env.NODE_ENV === 'production') {
  // trust first proxy
  app.set('trust proxy', 1);
}

// ✅ Updated CORS configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://www.hadibookstore.shop',
  'https://hadi-books-store-frontend.vercel.app',
  'https://admin-panel-alpha-five.vercel.app',
  'https://www.hadibookstore.shop'
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g., mobile apps, Postman)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log('CORS blocked for origin:', origin);
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Cookie'],
    exposedHeaders: ['Set-Cookie'],
    preflightContinue: false,
    optionsSuccessStatus: 204, // Ensure proper response for preflight requests
  })
);

// ✅ ADD SESSION MIDDLEWARE FOR GOOGLE OAUTH
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-key-for-development',
  resave: false,
  saveUninitialized: false,
  cookie: (function() {
    const cookieCfg = {
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 10 * 60 * 1000, // 10 minutes - enough for OAuth flow
    };
    if (process.env.COOKIE_DOMAIN) {
      cookieCfg.domain = process.env.COOKIE_DOMAIN;
    }
    return cookieCfg;
  })(),
}));

// Explicitly handle OPTIONS requests for all routes
app.options('*', cors());

app.use(passport.initialize());

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
    console.log('✅ Session middleware configured for Google OAuth');
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
