import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Check if required email environment variables are set
if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
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

// Only verify transporter if credentials are provided
if (process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter.verify((error, success) => {
    if (error) {
    } else {
      console.log('Email transporter is ready');
    }
  });
}

export default transporter;