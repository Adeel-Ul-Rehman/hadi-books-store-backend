import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import passport from "passport";
import { syncCartAndWishlist } from "./authController.js";

const prisma = new PrismaClient();

// Helper function to get frontend URL based on environment
const getFrontendUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    return 'https://www.hadibookstore.shop';
  } else {
    return 'http://localhost:3000';
  }
};

// Helper function to get cookie domain based on environment
const getCookieDomain = () => {
  if (process.env.NODE_ENV === 'production') {
    return '.hadibookstore.shop';
  } else {
    return undefined;
  }
};

export const googleAuth = (req, res, next) => {
  console.log('🔐 Starting Google OAuth flow');
  
  // Store local cart/wishlist in session for sync after login
  const { localCart, localWishlist } = req.query;
  if (localCart || localWishlist) {
    try {
      req.session.localCart = localCart ? JSON.parse(localCart) : [];
    } catch (e) {
      console.warn('Failed to parse localCart query param, falling back to empty array', e);
      req.session.localCart = [];
    }
    try {
      req.session.localWishlist = localWishlist ? JSON.parse(localWishlist) : [];
    } catch (e) {
      console.warn('Failed to parse localWishlist query param, falling back to empty array', e);
      req.session.localWishlist = [];
    }
    console.log('📦 Stored local data for sync after Google login');

    // Save session explicitly before redirecting to Google to avoid race conditions
    req.session.save((err) => {
      if (err) console.warn('Failed to save session before Google redirect:', err);
      passport.authenticate('google', {
        scope: ['profile', 'email'],
        session: false
      })(req, res, next);
    });
    return;
  }

  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false
  })(req, res, next);
};

export const googleCallback = (req, res, next) => {
  console.log('🔄 Google OAuth callback received');
  
  passport.authenticate('google', { session: false }, async (err, user, info) => {
    console.log('🔍 Passport authentication completed');
    
    const frontendUrl = getFrontendUrl();
    
    if (err) {
      console.error('❌ Google callback error:', err);
      return res.redirect(`${frontendUrl}/login?error=auth_failed`);
    }

    if (!user) {
      console.error('❌ No user returned from Google OAuth');
      return res.redirect(`${frontendUrl}/login?error=no_user`);
    }

    try {
      console.log('✅ Google OAuth successful for user:', user.email);
      
      // Generate JWT token
      const token = jwt.sign({ 
        id: user.id,
        email: user.email,
        name: user.name 
      }, process.env.JWT_SECRET, {
        expiresIn: "7d",
      });

      console.log('🔑 JWT Token generated for user:', user.id);

      // Set cookie with proper settings
      const isProduction = process.env.NODE_ENV === 'production';
      
      const cookieOptions = {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
      };
      
      if (process.env.COOKIE_DOMAIN) {
        cookieOptions.domain = process.env.COOKIE_DOMAIN;
      }
      
      console.log('🍪 Setting token cookie');
      res.cookie("token", token, cookieOptions);

        // Get stored local cart/wishlist from session
        const localCart = req.session?.localCart || [];
        const localWishlist = req.session?.localWishlist || [];

        // Clear session data
        if (req.session) {
          req.session.localCart = null;
          req.session.localWishlist = null;
        }

        console.log('📦 Local data for sync:', { 
          cartItems: localCart.length, 
          wishlistItems: localWishlist.length 
        });

        // Attempt server-side sync using the same method as normal login
        let syncResult = { wishlistSynced: true, cartSynced: true, syncErrors: [] };
        try {
          syncResult = await syncCartAndWishlist(user.id, localCart, localWishlist);
          console.log('\u2705 Server-side sync after Google login result:', syncResult);
        } catch (syncErr) {
          console.error('\u274c Server-side sync after Google login failed:', syncErr);
          syncResult = { wishlistSynced: false, cartSynced: false, syncErrors: [syncErr.message || String(syncErr)] };
        }

        // Redirect with sync data as URL parameters (include sync status)
        const syncParams = new URLSearchParams({
          login: 'success',
          source: 'google',
          user: user.name || '',
          hasLocalData: (localCart.length > 0 || localWishlist.length > 0).toString(),
          cartCount: localCart.length.toString(),
          wishlistCount: localWishlist.length.toString(),
          cartSynced: syncResult.cartSynced ? 'true' : 'false',
          wishlistSynced: syncResult.wishlistSynced ? 'true' : 'false'
        });

        if (syncResult.syncErrors && syncResult.syncErrors.length > 0) {
          syncParams.append('syncErrors', JSON.stringify(syncResult.syncErrors));
        }

        // Keep original local payloads for client if needed (optional)
        if (localCart.length > 0) {
          syncParams.append('localCart', JSON.stringify(localCart));
        }
        if (localWishlist.length > 0) {
          syncParams.append('localWishlist', JSON.stringify(localWishlist));
        }

        console.log('🔄 Redirecting to account page with sync data...');
        res.redirect(`${frontendUrl}/account?${syncParams.toString()}`);
      
    } catch (error) {
      console.error('❌ Token generation error:', error);
      res.redirect(`${frontendUrl}/login?error=token_error`);
    }
  })(req, res, next);
};

export const googleAuthSuccess = async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        name: true,
        lastName: true,
        email: true,
        isAccountVerified: true,
        authProvider: true,
        profilePicture: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.json({
      success: true,
      message: "Google authentication successful",
      user,
    });
  } catch (error) {
    console.error("Google auth success error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get user data",
    });
  }
};