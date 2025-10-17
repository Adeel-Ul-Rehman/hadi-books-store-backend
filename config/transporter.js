import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Check if required email environment variables are set
if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
  console.error('❌ Email configuration missing: SMTP_USER or SMTP_PASS not found in environment variables');
  console.error('Please check your .env file configuration');
}

// Determine which SMTP service to use based on SMTP_USER
const isResend = process.env.SMTP_USER === 'resend';

const smtpConfig = isResend ? {
  // Resend configuration (FREE - 100 emails/day)
  host: 'smtp.resend.com',
  port: 587,
  secure: false, // Use TLS
  auth: {
    user: 'resend',
    pass: process.env.SMTP_PASS, // Resend API key
  },
} : {
  // Gmail configuration (for local development)
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // Use SSL
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  requireTLS: false,
  tls: {
    rejectUnauthorized: false,
  },
};

const transporter = nodemailer.createTransport({
  ...smtpConfig,
  // Common timeout configuration
  connectionTimeout: 10000, // 10 seconds
  greetingTimeout: 10000, // 10 seconds
  socketTimeout: 10000, // 10 seconds
  // Add retry configuration
  pool: false, // Disable connection pooling
  maxConnections: 1,
  rateDelta: 1000,
  rateLimit: 5,
});

// Enhanced transporter verification with better error handling
if (process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter.verify((error, success) => {
    if (error) {
      console.error('❌ Email transporter verification failed:', error);
      console.error('Please check your SMTP credentials and ensure:');
      if (process.env.SMTP_USER === 'resend') {
        console.error('1. Resend API key is correct (starts with re_)');
        console.error('2. Sender email is verified in Resend dashboard');
        console.error('3. SMTP_USER is set to "resend" in .env');
      } else {
        console.error('1. Gmail account has 2-factor authentication enabled');
        console.error('2. App password is generated correctly');
        console.error('3. SMTP_USER and SMTP_PASS are correctly set in .env');
      }
    } else {
      console.log('✅ Email transporter is ready and configured correctly');
      const service = process.env.SMTP_USER === 'resend' ? 'Resend' : 'Gmail';
      console.log(`📧 Using ${service} for email delivery`);
      console.log('� Emails will be sent from:', process.env.SENDER_EMAIL || process.env.SMTP_USER);
    }
  });
} else {
  console.error('❌ Email credentials missing. Emails will not be sent.');
}

export default transporter;