import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

const configureCloudinary = () => {
  try {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    // Test authentication (non-blocking)
    cloudinary.api
      .resources({ max_results: 1 })
      .then((result) => console.log('Cloudinary configured and authenticated successfully'))
      .catch((error) => {
      });
  } catch (error) {
    return cloudinary;
  }

  return cloudinary;
};

// Initialize and export the configured Cloudinary instance
const cloudinaryInstance = configureCloudinary();
export default cloudinaryInstance;