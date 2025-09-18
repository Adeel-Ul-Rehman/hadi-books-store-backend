import jwt from "jsonwebtoken";

const adminAuth = async (req, res, next) => {
  let token = req.cookies.token;

  // If no cookie token, check Authorization header
  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Not authorized - Please login first",
    });
  }

  try {
    const tokenDecode = jwt.verify(token, process.env.JWT_SECRET);

    // Verify token has required fields
    if (!tokenDecode?.id) {
      return res.status(401).json({
        success: false,
        message: "Invalid token format",
      });
    }

    // Attach to req.user and req.userId
    req.user = { id: tokenDecode.id };
    req.userId = tokenDecode.id;

    next();
  } catch (error) {
    console.error("JWT Verification Error:", error.message);
    return res.status(401).json({
      success: false,
      message: "Session expired - Please login again",
    });
  }
};

export default adminAuth;