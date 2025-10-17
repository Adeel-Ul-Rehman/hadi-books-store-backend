import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Gmail SMTP Configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
  // Timeout settings to prevent hanging
  connectionTimeout: 10000, // 10 seconds
  greetingTimeout: 10000,
  socketTimeout: 10000,
});

// Verify transporter (non-blocking)
if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
  transporter.verify((error, success) => {
    if (error) {
      console.error('❌ Gmail SMTP verification failed:', error.message);
      console.error('Please check:');
      console.error('1. GMAIL_USER is set in .env');
      console.error('2. GMAIL_APP_PASSWORD is a valid app password (not regular password)');
      console.error('3. 2-factor authentication is enabled on Gmail');
    } else {
      console.log('✅ Gmail SMTP configured successfully');
      console.log(`📬 Emails will be sent from: ${process.env.GMAIL_USER}`);
    }
  });
} else {
  console.error('❌ Email configuration missing: GMAIL_USER or GMAIL_APP_PASSWORD not found');
}

export default transporter;
