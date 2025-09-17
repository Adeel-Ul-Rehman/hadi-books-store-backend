import jwt from 'jsonwebtoken';

const userAuth = async (req, res, next) => {
  try {
    // Prioritize cookie-based token as per backend configuration
    const token = req.cookies.token;
    
    // If no token, proceed without auth (for optional checks like is-auth)
    if (!token) {
      req.userId = null;
      return next();
    }

    // Verify token with JWT_SECRET
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.id) {
      return res.status(401).json({ success: false, message: 'Invalid token: User ID not found' });
    }

    // Set userId for downstream controllers
    req.userId = decoded.id;
    next();
  } catch (error) {
    console.error('Authentication error:', error.message, error.stack);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Authentication token has expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid authentication token' });
    }
    return res.status(401).json({ success: false, message: 'Authentication failed' });
  }
};

export default userAuth;