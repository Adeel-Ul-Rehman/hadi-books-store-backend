import jwt from 'jsonwebtoken';

const userAuth = async (req, res, next) => {
  try {
    // Prioritize cookie-based token as per backend configuration
    const token = req.cookies.token;
    
    if (!token) {
      // No token found - continue without authentication (public access)
      req.userId = null;
      return next();
    }

    // Verify token with JWT_SECRET
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.id) {
      // Invalid token but continue as public user
      req.userId = null;
      return next();
    }

    // Set userId for downstream controllers
    req.userId = decoded.id;
    next();
  } catch (error) {
    console.error('Authentication error:', error.message);
    // Continue without authentication on error
    req.userId = null;
    next();
  }
};

export default userAuth;