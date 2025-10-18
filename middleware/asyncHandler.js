/**
 * Async Error Handler Wrapper
 * Wraps async route handlers to catch errors and pass them to Express error middleware
 * Prevents unhandled promise rejections that crash the server
 */

export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((error) => {
    console.error('❌ Async Handler Caught Error:', {
      message: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method
    });
    next(error);
  });
};

/**
 * Try-Catch Wrapper for Sync Functions
 * Ensures even synchronous errors are properly handled
 */
export const tryCatch = (fn) => (req, res, next) => {
  try {
    fn(req, res, next);
  } catch (error) {
    console.error('❌ Try-Catch Handler Caught Error:', {
      message: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method
    });
    next(error);
  }
};

export default asyncHandler;
