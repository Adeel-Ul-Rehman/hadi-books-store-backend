import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { PrismaClient } from '@prisma/client';
import session from 'express-session';

const prisma = new PrismaClient();

// Dynamic callback URL for both environments
const getCallbackURL = () => {
  if (process.env.NODE_ENV === 'production') {
    return 'https://api.hadibookstore.shop/api/auth/google/callback';
  } else {
    return 'http://localhost:4000/api/auth/google/callback';
  }
};

console.log('🌍 Environment:', process.env.NODE_ENV || 'development');
console.log('📍 Google OAuth Callback URL:', getCallbackURL());

// Configure session for storing local cart/wishlist during OAuth flow
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: getCallbackURL(),
  passReqToCallback: true // Important: pass req to callback for session access
}, async (req, accessToken, refreshToken, profile, done) => {
  try {
    console.log('🔍 Google OAuth profile received for:', profile.emails[0].value);
    console.log('👤 Profile name:', profile.name.givenName, profile.name.familyName);
    console.log('🌍 Environment during OAuth:', process.env.NODE_ENV);
    
    // Check if user exists with this googleId
    let user = await prisma.user.findUnique({
      where: { googleId: profile.id }
    });

    if (user) {
      console.log('✅ Existing Google user found:', user.email);
      return done(null, user);
    }

    // Check if user exists with this email
    user = await prisma.user.findUnique({
      where: { email: profile.emails[0].value }
    });

    if (user) {
      console.log('🔄 Existing email user found, updating with Google ID:', user.email);
      // Update existing user with googleId
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: profile.id,
          authProvider: 'google',
          emailVerified: true,
          isAccountVerified: true
        }
      });
      return done(null, user);
    }

    console.log('🆕 Creating new Google user:', profile.emails[0].value);
    // Create new user
    user = await prisma.user.create({
      data: {
        name: profile.name.givenName,
        lastName: profile.name.familyName || '',
        email: profile.emails[0].value,
        googleId: profile.id,
        authProvider: 'google',
        emailVerified: true,
        isAccountVerified: true,
        profilePicture: profile.photos[0]?.value || null
      }
    });

    console.log('🎉 New Google user created:', user.email);
    console.log('📊 User ID:', user.id);
    return done(null, user);
  } catch (error) {
    console.error('❌ Google OAuth Error:', error);
    return done(error, null);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport;