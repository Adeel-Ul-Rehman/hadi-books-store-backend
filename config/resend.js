import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

// Check if required email environment variables are set
if (!process.env.RESEND_API_KEY) {
  console.error('❌ Email configuration missing: RESEND_API_KEY not found in environment variables');
  console.error('Please add RESEND_API_KEY to your .env file');
} else {
  console.log('✅ Resend API configured successfully');
  console.log('📬 Emails will be sent from: Hadi Books Store <onboarding@resend.dev>');
  console.log('📧 Free tier: 100 emails/day, 3,000 emails/month');
}

// Initialize Resend with API key
const resend = new Resend(process.env.RESEND_API_KEY);

export default resend;
