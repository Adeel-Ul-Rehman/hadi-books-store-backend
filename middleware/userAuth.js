import jwt from 'jsonwebtoken';

const userAuth = async (req, res, next) => {
  try {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.id) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    req.userId = decoded.id; // Set userId for controllers
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }
};

export default userAuth;