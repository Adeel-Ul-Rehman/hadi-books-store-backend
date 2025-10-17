import { Resend } from 'resend';
import dotenv from 'dotenv';
import readline from 'readline';

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('═══════════════════════════════════════════════════');
console.log('📧 Resend Email Test Tool - Hadi Books Store');
console.log('═══════════════════════════════════════════════════\n');

// Function to validate email
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Function to send test email
async function sendTestEmail(recipientEmail) {
  console.log('\n⏳ Sending test email...\n');
  
  try {
    const { data, error } = await resend.emails.send({
      from: 'Hadi Books Store <onboarding@resend.dev>',
      to: recipientEmail,
      subject: '✅ Test Email from Hadi Books Store',
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
          <div style="background-color: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h1 style="color: #E31837; text-align: center; margin-bottom: 20px;">📧 Test Email Success!</h1>
            
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="color: white; font-size: 18px; margin: 0; text-align: center;">
                ✅ Your Resend configuration is working perfectly!
              </p>
            </div>
            
            <div style="background-color: #f0f4f8; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #00308F; margin-top: 0;">📋 Email Details:</h3>
              <p><strong>Sent to:</strong> ${recipientEmail}</p>
              <p><strong>From:</strong> Hadi Books Store (onboarding@resend.dev)</p>
              <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
              <p><strong>Status:</strong> ✅ Delivered Successfully</p>
            </div>
            
            <div style="background-color: #e8f5e9; padding: 15px; border-left: 4px solid #4caf50; margin: 20px 0;">
              <p style="margin: 0; color: #2e7d32;">
                <strong>✅ What this means:</strong><br>
                Your email service is configured correctly and ready to send:
              </p>
              <ul style="color: #2e7d32; margin: 10px 0;">
                <li>Account verification OTPs</li>
                <li>Password reset codes</li>
                <li>Order confirmations</li>
                <li>Customer notifications</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #eee;">
              <p style="color: #666; font-size: 14px;">
                <strong>Hadi Books Store</strong><br>
                Your trusted online bookstore
              </p>
              <p style="color: #999; font-size: 12px; margin-top: 10px;">
                This is a test email sent from your backend server
              </p>
            </div>
          </div>
        </div>
      `,
      text: `
Test Email Success!
═══════════════════

✅ Your Resend configuration is working perfectly!

Email Details:
- Sent to: ${recipientEmail}
- From: Hadi Books Store (onboarding@resend.dev)
- Date: ${new Date().toLocaleString()}
- Status: Delivered Successfully

This means your email service is ready to send:
• Account verification OTPs
• Password reset codes
• Order confirmations
• Customer notifications

---
Hadi Books Store
Your trusted online bookstore
      `
    });

    if (error) {
      console.error('❌ FAILED TO SEND EMAIL');
      console.error('═══════════════════════════════════════════════════');
      console.error('Error Details:', JSON.stringify(error, null, 2));
      console.error('═══════════════════════════════════════════════════\n');
      
      // Common error explanations
      if (error.message && error.message.includes('API key')) {
        console.log('💡 TIP: Check your RESEND_API_KEY in .env file');
      } else if (error.message && error.message.includes('domain')) {
        console.log('💡 TIP: For free tier, use "onboarding@resend.dev" as sender');
      }
      
      return false;
    }

    console.log('✅ EMAIL SENT SUCCESSFULLY!');
    console.log('═══════════════════════════════════════════════════');
    console.log('📬 Email ID:', data.id);
    console.log('📧 Sent to:', recipientEmail);
    console.log('📤 From: Hadi Books Store <onboarding@resend.dev>');
    console.log('⏰ Time:', new Date().toLocaleString());
    console.log('═══════════════════════════════════════════════════');
    console.log('\n✅ Check your inbox (and spam folder)!\n');
    
    return true;
    
  } catch (exception) {
    console.error('❌ EXCEPTION OCCURRED');
    console.error('═══════════════════════════════════════════════════');
    console.error('Exception:', exception.message);
    console.error('Stack:', exception.stack);
    console.error('═══════════════════════════════════════════════════\n');
    return false;
  }
}

// Main function
async function main() {
  rl.question('📧 Enter recipient email address: ', async (email) => {
    const trimmedEmail = email.trim();
    
    if (!trimmedEmail) {
      console.log('❌ Email cannot be empty!');
      rl.close();
      return;
    }
    
    if (!isValidEmail(trimmedEmail)) {
      console.log('❌ Invalid email format! Please enter a valid email address.');
      rl.close();
      return;
    }
    
    console.log(`\n✅ Valid email: ${trimmedEmail}`);
    
    const success = await sendTestEmail(trimmedEmail);
    
    if (success) {
      console.log('🎉 Test completed successfully!');
      console.log('💡 You can now use this email service in your application.\n');
    } else {
      console.log('❌ Test failed. Please check the error details above.\n');
    }
    
    rl.close();
  });
}

// Check API key before starting
if (!process.env.RESEND_API_KEY) {
  console.error('❌ ERROR: RESEND_API_KEY not found in .env file!');
  console.error('Please add: RESEND_API_KEY=your_api_key_here\n');
  process.exit(1);
}

console.log('✅ API Key found');
console.log('✅ Resend SDK initialized\n');

// Start the program
main();
