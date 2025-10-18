import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
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

// Enable trust proxy for production (e.g., Vercel, Cloudflare)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Consolidated CORS configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5174',
  'https://hadibookstore.shop',
  'https://www.hadibookstore.shop',
  'https://hadi-books-store-frontend.vercel.app',
  'https://admin-panel-alpha-five.vercel.app',
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g., Postman, mobile apps)
    if (!origin) return callback(null, true);

    // Allow exact matches from our list
    if (allowedOrigins.includes(origin)) return callback(null, true);

    // Allow any subdomain of hadibookstore.shop
    try {
      const url = new URL(origin);
      if (url.hostname && url.hostname.endsWith('.hadibookstore.shop')) {
        return callback(null, true);
      }
    } catch (e) {
      // Fall through to block
    }

    console.warn('CORS blocked for origin:', origin);
    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Cookie'],
  exposedHeaders: ['Set-Cookie'],
  preflightContinue: false,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

// Handle OPTIONS requests for all routes
app.options('*', cors(corsOptions));

// Session middleware for Google OAuth
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-key-for-development',
    resave: false,
    saveUninitialized: false,
    cookie: (function () {
      const cookieCfg = {
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 10 * 60 * 1000, // 10 minutes
      };
      if (process.env.COOKIE_DOMAIN) {
        cookieCfg.domain = process.env.COOKIE_DOMAIN;
      }
      return cookieCfg;
    })(),
  })
);

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

// Error handler - Enhanced with detailed logging and safe error responses
app.use((err, req, res, next) => {
  console.error('❌ Global Error Handler Caught:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    timestamp: new Date().toISOString()
  });
  
  // Don't crash the server, always respond
  if (!res.headersSent) {
    res.status(err.status || 500).json({ 
      success: false, 
      message: err.message || 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  }
});

// Start server
const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, async () => {
  try {
    await prisma.$connect();
    console.log(`✅ Server running on port ${PORT}`);
    console.log('✅ Connected to Neon PostgreSQL database');
    console.log('✅ Session middleware configured for Google OAuth');
  } catch (error) {
    console.error('❌ Database connection error:', error);
    // Don't exit immediately, try to reconnect
    console.log('⚠️ Retrying database connection in 5 seconds...');
    setTimeout(async () => {
      try {
        await prisma.$connect();
        console.log('✅ Database reconnected successfully');
      } catch (retryError) {
        console.error('❌ Database reconnection failed:', retryError);
        process.exit(1);
      }
    }, 5000);
  }
});

// Handle server errors
server.on('error', (error) => {
  console.error('❌ Server error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
    process.exit(1);
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't crash the server, just log it
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  // Log but don't crash - PM2 will restart if needed
  console.log('⚠️ Server continuing despite uncaught exception...');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('📴 SIGTERM signal received: closing HTTP server');
  server.close(async () => {
    console.log('📴 HTTP server closed');
    await prisma.$disconnect();
    console.log('📴 Database connection closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('📴 SIGINT signal received: closing HTTP server');
  server.close(async () => {
    console.log('📴 HTTP server closed');
    await prisma.$disconnect();
    console.log('📴 Database connection closed');
    process.exit(0);
  });
});
