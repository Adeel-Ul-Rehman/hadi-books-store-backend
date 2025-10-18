import resend from '../config/resend.js';

/**
 * Send email with timeout protection using Resend API
 * @param {Object} emailOptions - Resend email options {from, to, subject, html, text}
 * @param {number} timeout - timeout in milliseconds (default 15000ms = 15s)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const sendEmailWithTimeout = async (emailOptions, timeout = 15000) => {
  console.log('📤 Attempting to send email to:', emailOptions.to);
  console.log('📧 From:', emailOptions.from);
  console.log('📋 Subject:', emailOptions.subject);
  
  return Promise.race([
    // Email sending promise
    resend.emails.send(emailOptions)
      .then((response) => {
        console.log('📬 Resend API Response:', JSON.stringify(response, null, 2));
        
        if (response.error) {
          console.error('❌ Resend API error:', response.error);
          return { success: false, error: response.error.message || 'Email sending failed' };
        }
        
        if (response.data && response.data.id) {
          console.log('✅ Email sent successfully via Resend. ID:', response.data.id);
          return { success: true, emailId: response.data.id };
        }
        
        console.warn('⚠️ Unexpected Resend response format:', response);
        return { success: true };
      })
      .catch((error) => {
        console.error('❌ Resend API exception:', error);
        console.error('❌ Error details:', error.message);
        return { 
          success: false, 
          error: error.message || 'Email sending failed' 
        };
      }),
    
    // Timeout promise
    new Promise((resolve) => 
      setTimeout(() => {
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
    verification: 'Account Verification OTP - Hadi Books Store',
    reset: 'Password Reset OTP - Hadi Books Store',
  };

  const emailOptions = {
    from: 'Hadi Books Store <noreply@hadibookstore.shop>',
    to: email,
    subject: subjects[type] || 'OTP Verification - Hadi Books Store',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <!-- Header -->
                <tr>
                  <td style="padding: 40px 30px; text-align: center; background: linear-gradient(135deg, #00308F 0%, #E31837 100%); border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">Hadi Books Store</h1>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 24px;">Hello ${name}!</h2>
                    <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                      ${type === 'reset' ? 'You requested to reset your password.' : 'Thank you for registering with Hadi Books Store!'}
                      Please use the following One-Time Password (OTP) to ${type === 'reset' ? 'reset your password' : 'verify your account'}:
                    </p>
                    
                    <!-- OTP Box -->
                    <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0;">
                      <tr>
                        <td align="center" style="padding: 30px; background-color: #f0f4f8; border-radius: 8px; border: 2px dashed #00308F;">
                          <p style="margin: 0 0 10px 0; color: #00308F; font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">
                            ${type === 'reset' ? 'Password Reset OTP' : 'Verification OTP'}
                          </p>
                          <p style="margin: 0; color: #E31837; font-size: 36px; font-weight: bold; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                            ${otp}
                          </p>
                          <p style="margin: 15px 0 0 0; color: #666666; font-size: 14px;">
                            Valid for 24 hours
                          </p>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="margin: 20px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                      Enter this OTP to complete the ${type === 'reset' ? 'password reset' : 'verification'} process.
                    </p>
                    
                    ${type === 'reset' ? '<p style="margin: 20px 0; color: #999999; font-size: 14px; line-height: 1.6;"><strong>Note:</strong> If you did not request a password reset, please ignore this email and your password will remain unchanged.</p>' : ''}
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="padding: 30px; background-color: #f9f9f9; border-radius: 0 0 8px 8px; border-top: 1px solid #eeeeee;">
                    <p style="margin: 0 0 10px 0; color: #666666; font-size: 14px; text-align: center;">
                      Best regards,<br>
                      <strong>Hadi Books Store Team</strong>
                    </p>
                    <p style="margin: 15px 0 0 0; color: #999999; font-size: 12px; text-align: center; line-height: 1.5;">
                      This is an automated email. Please do not reply to this message.<br>
                      © ${new Date().getFullYear()} Hadi Books Store. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `Hello ${name},\n\n${type === 'reset' ? 'You requested to reset your password.' : 'Thank you for registering with Hadi Books Store!'}\n\nYour OTP is: ${otp}\n\nThis OTP is valid for 24 hours.\n\nBest regards,\nHadi Books Store Team`,
    headers: {
      'X-Entity-Ref-ID': `otp-${type}-${Date.now()}`,
    },
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
    from: 'Hadi Books Store <noreply@hadibookstore.shop>',
    to: email,
    subject: `Order Confirmation #${orderDetails.orderId} - Hadi Books Store`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <!-- Header -->
                <tr>
                  <td style="padding: 40px 30px; text-align: center; background: linear-gradient(135deg, #00308F 0%, #E31837 100%); border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">Hadi Books Store</h1>
                    <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 16px;">Order Confirmation</p>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <h2 style="margin: 0 0 10px 0; color: #333333; font-size: 24px;">Thank you, ${name}!</h2>
                    <p style="margin: 0 0 30px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                      Your order has been confirmed and will be processed soon.
                    </p>
                    
                    <!-- Order Details Box -->
                    <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 0 0 30px 0; background-color: #f9f9f9; border-radius: 8px;">
                      <tr>
                        <td style="padding: 25px;">
                          <h3 style="margin: 0 0 15px 0; color: #00308F; font-size: 18px;">Order Details</h3>
                          <table role="presentation" style="width: 100%; border-collapse: collapse;">
                            <tr>
                              <td style="padding: 8px 0; color: #666666; font-size: 14px;"><strong>Order ID:</strong></td>
                              <td style="padding: 8px 0; color: #333333; font-size: 14px; text-align: right;">#${orderDetails.orderId}</td>
                            </tr>
                            <tr>
                              <td style="padding: 8px 0; color: #666666; font-size: 14px;"><strong>Total Amount:</strong></td>
                              <td style="padding: 8px 0; color: #E31837; font-size: 18px; font-weight: bold; text-align: right;">Rs. ${orderDetails.totalAmount}</td>
                            </tr>
                            <tr>
                              <td style="padding: 8px 0; color: #666666; font-size: 14px;"><strong>Payment Method:</strong></td>
                              <td style="padding: 8px 0; color: #333333; font-size: 14px; text-align: right;">${orderDetails.paymentMethod}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                      We'll notify you once your order is shipped. You can track your order status by logging into your account.
                    </p>
                    
                    <p style="margin: 20px 0; color: #666666; font-size: 14px; line-height: 1.6;">
                      If you have any questions about your order, feel free to contact us.
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="padding: 30px; background-color: #f9f9f9; border-radius: 0 0 8px 8px; border-top: 1px solid #eeeeee;">
                    <p style="margin: 0 0 10px 0; color: #666666; font-size: 14px; text-align: center;">
                      Thank you for shopping with us!<br>
                      <strong>Hadi Books Store Team</strong>
                    </p>
                    <p style="margin: 15px 0 0 0; color: #999999; font-size: 12px; text-align: center; line-height: 1.5;">
                      This is an automated email. Please do not reply to this message.<br>
                      © ${new Date().getFullYear()} Hadi Books Store. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `Hello ${name},\n\nThank you for your order!\n\nOrder ID: #${orderDetails.orderId}\nTotal Amount: Rs. ${orderDetails.totalAmount}\nPayment Method: ${orderDetails.paymentMethod}\n\nWe'll notify you once your order is shipped.\n\nBest regards,\nHadi Books Store Team`,
    headers: {
      'X-Entity-Ref-ID': `order-${orderDetails.orderId}`,
    },
  };

  const result = await sendEmailWithTimeout(emailOptions);
  
  if (result.success) {
    console.log(`✅ Order confirmation email sent successfully to ${email}`);
  } else {
    console.error(`❌ Failed to send order confirmation email to ${email}:`, result.error);
  }

  return result;
};
