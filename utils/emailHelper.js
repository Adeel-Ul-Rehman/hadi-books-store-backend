import resend from '../config/resend.js';

/**
 * Send email with timeout protection using Resend API
 * @param {Object} emailOptions - Resend email options {from, to, subject, html, text}
 * @param {number} timeout - timeout in milliseconds (default 15000ms = 15s)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const sendEmailWithTimeout = async (emailOptions, timeout = 15000) => {
  return Promise.race([
    // Email sending promise
    resend.emails.send(emailOptions)
      .then((response) => {
        if (response.error) {
          console.error('❌ Resend API error:', response.error);
          return { success: false, error: response.error.message || 'Email sending failed' };
        }
        console.log('✅ Email sent successfully via Resend:', response.data?.id);
        return { success: true };
      })
      .catch((error) => {
        console.error('❌ Resend API exception:', error.message);
        return { 
          success: false, 
          error: error.message || 'Email sending failed' 
        };
      }),
    
    // Timeout promise
    new Promise((resolve) => 
      setTimeout(() => {
        console.warn('⏰ Email sending timeout (15s exceeded)');
        return resolve({ 
          success: false, 
          error: 'Email sending timeout (15s exceeded)' 
        });
      }, timeout)
    ),
  ]);
};

/**
 * Send OTP email (non-blocking)
 * If email fails, log the OTP instead of failing the request
 */
export const sendOTPEmail = async (email, name, otp, type = 'verification') => {
  const subjects = {
    verification: 'Account Verification OTP',
    reset: 'Password Reset OTP',
  };

  const emailOptions = {
    from: 'Hadi Books Store <noreply@send.hadibookstore.shop>',
    to: email,
    subject: subjects[type] || 'OTP Verification',
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <div style="padding: 30px; border: 2px solid #00308F; border-radius: 12px; background-color: #ffffff;">
          <h1 style="color: #E31837; text-align: center; margin-bottom: 20px; font-size: 28px;">Book Store</h1>
          <p style="font-size: 16px; line-height: 1.5;">Hello <strong>${name}</strong>,</p>
          <p style="font-size: 16px; line-height: 1.5;">Please use the following OTP to ${type === 'reset' ? 'reset your password' : 'verify your account'}:</p>
          <div style="background: #f0f4f8; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; border: 1px dashed #00308F;">
            <h3 style="color: #E31837; font-size: 18px; margin-bottom: 10px;">${type === 'reset' ? 'Password Reset' : 'Verification'} OTP</h3>
            <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #E31837; margin: 0;">${otp}</p>
            <p style="font-size: 14px; color: #555; margin-top: 10px;">This OTP is valid for 24 hours</p>
          </div>
          <p style="font-size: 16px; line-height: 1.5;">Enter this OTP to complete the process.</p>
          <p style="font-size: 16px; line-height: 1.5; margin-top: 30px;">Best regards,<br><strong>The Book Store Team</strong></p>
        </div>
      </div>
    `,
    text: `Your OTP for Book Store ${type} is ${otp}. Valid for 24 hours.`,
  };

  const result = await sendEmailWithTimeout(emailOptions);
  
  if (result.success) {
    console.log(`✅ ${type} OTP email sent successfully to ${email}`);
  } else {
    console.error(`❌ Failed to send ${type} OTP email to ${email}:`, result.error);
    console.log(`📝 OTP for ${email} (not sent via email): ${otp}`);
  }

  return result;
};

/**
 * Send order confirmation email (non-blocking)
 */
export const sendOrderConfirmationEmail = async (email, name, orderDetails) => {
  const emailOptions = {
    from: 'Hadi Books Store <noreply@send.hadibookstore.shop>',
    to: email,
    subject: 'Order Confirmation - Book Store',
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <div style="padding: 30px; border: 2px solid #00308F; border-radius: 12px; background-color: #ffffff;">
          <h1 style="color: #E31837; text-align: center; margin-bottom: 20px; font-size: 28px;">Book Store</h1>
          <p style="font-size: 16px; line-height: 1.5;">Hello <strong>${name}</strong>,</p>
          <p style="font-size: 16px; line-height: 1.5;">Thank you for your order! Your order has been confirmed.</p>
          <div style="background: #f0f4f8; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #E31837; font-size: 18px; margin-bottom: 10px;">Order Details</h3>
            <p><strong>Order ID:</strong> ${orderDetails.orderId}</p>
            <p><strong>Total Amount:</strong> Rs. ${orderDetails.totalAmount}</p>
            <p><strong>Payment Method:</strong> ${orderDetails.paymentMethod}</p>
          </div>
          <p style="font-size: 16px; line-height: 1.5;">We'll notify you once your order is shipped.</p>
          <p style="font-size: 16px; line-height: 1.5; margin-top: 30px;">Best regards,<br><strong>The Book Store Team</strong></p>
        </div>
      </div>
    `,
    text: `Your order (ID: ${orderDetails.orderId}) has been confirmed. Total: Rs. ${orderDetails.totalAmount}`,
  };

  const result = await sendEmailWithTimeout(emailOptions);
  
  if (result.success) {
    console.log(`✅ Order confirmation email sent successfully to ${email}`);
  } else {
    console.error(`❌ Failed to send order confirmation email to ${email}:`, result.error);
  }

  return result;
};
