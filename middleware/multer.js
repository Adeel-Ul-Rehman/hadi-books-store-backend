import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Create uploads directory if it doesn't exist
const uploadsDir = './uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure disk storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + extension);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Images only (jpeg, jpg, png, webp)!'));
    }
  },
  limits: { 
    fileSize: 250 * 1024,
  }
});

// Cleanup function to remove temporary files
export const cleanupTempFiles = async (filePaths) => {
  if (!filePaths) return;
  
  const files = Array.isArray(filePaths) ? filePaths : [filePaths];
  
  for (const filePath of files) {
    if (filePath && typeof filePath === 'string') {
      try {
        await fs.promises.unlink(filePath);
        console.log('Temporary file deleted:', filePath);
      } catch (error) {
        console.error('Error deleting temporary file:', error);
      }
    }
  }
};

export default upload;