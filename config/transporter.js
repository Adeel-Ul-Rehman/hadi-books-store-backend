import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Check if required email environment variables are set
if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
  console.error('❌ Email configuration missing: SMTP_USER or SMTP_PASS not found in environment variables');
  console.error('Please check your .env file configuration');
}

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // TLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Enhanced transporter verification with better error handling
if (process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter.verify((error, success) => {
    if (error) {
      console.error('❌ Email transporter verification failed:', error);
      console.error('Please check your SMTP credentials and ensure:');
      console.error('1. Gmail account has 2-factor authentication disabled');
      console.error('2. App password is generated correctly');
      console.error('3. SMTP_USER and SMTP_PASS are correctly set in .env');
    } else {
      console.log('✅ Email transporter is ready and configured correctly');
      console.log('📧 Emails will be sent from:', process.env.SMTP_USER);
    }
  });
} else {
  console.error('❌ Email credentials missing. Emails will not be sent.');
}

export default transporter;