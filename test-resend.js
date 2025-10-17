import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

async function testResendEmail() {
  console.log('🧪 Testing Resend Email Sending...');
  console.log('API Key:', process.env.RESEND_API_KEY ? 'Found ✅' : 'Missing ❌');
  console.log('Sender Email:', process.env.SENDER_EMAIL);
  
  try {
    const { data, error } = await resend.emails.send({
      from: 'onboarding@resend.dev', // Use Resend's test domain
      to: 'hadibooksstore01@gmail.com', // Your email
      subject: 'Test Email from Hadi Books Store',
      html: '<h1>Test Email</h1><p>If you receive this, Resend is working!</p>',
    });

    if (error) {
      console.error('❌ Resend Error:', error);
      return;
    }

    console.log('✅ Email sent successfully!');
    console.log('Response data:', data);
  } catch (err) {
    console.error('❌ Exception:', err);
  }
}

testResendEmail();
