import { PrismaClient } from '@prisma/client';
import resend from '../config/resend.js';
import validator from 'validator';

const prisma = new PrismaClient();

const sendEmailsInBackground = async (guestOrder, calculatedSubtotal) => {
  console.time('sendEmails');
  
  const itemDetailsHTML = guestOrder.items
    .map((item) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #eeeeee; color: #333333; font-size: 14px;">
          ${item.product?.name || 'Unknown Product'}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #eeeeee; color: #666666; font-size: 14px; text-align: center;">
          ${item.quantity}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #eeeeee; color: #333333; font-size: 14px; text-align: right;">
          PKR ${Number(item.price).toFixed(2)}
        </td>
      </tr>
    `)
    .join('');

  const itemDetailsText = guestOrder.items
    .map((item) => `• ${item.product?.name || 'Unknown Product'} - Qty: ${item.quantity} - Price: PKR ${Number(item.price).toFixed(2)}`)
    .join('\n');

  // Run email sending in background
  setTimeout(async () => {
    try {
      const guestEmailResult = await resend.emails.send({
        from: 'Hadi Books Store <noreply@hadibookstore.shop>',
        to: guestOrder.guestEmail,
        subject: `Order Confirmation #${guestOrder.id.substring(0, 8)} - Hadi Books Store`,
        replyTo: 'hadibooksstore01@gmail.com',
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
                        <h2 style="margin: 0 0 10px 0; color: #333333; font-size: 24px;">Thank you, ${guestOrder.guestName}!</h2>
                        <p style="margin: 0 0 30px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                          Your order has been confirmed and will be processed soon. We'll contact you via email or phone regarding your order status.
                        </p>
                        
                        <!-- Order Details -->
                        <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 0 0 25px 0; background-color: #f9f9f9; border-radius: 8px;">
                          <tr>
                            <td style="padding: 25px;">
                              <h3 style="margin: 0 0 15px 0; color: #00308F; font-size: 18px;">Order Details</h3>
                              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                                <tr>
                                  <td style="padding: 8px 0; color: #666666; font-size: 14px;"><strong>Order ID:</strong></td>
                                  <td style="padding: 8px 0; color: #333333; font-size: 14px; text-align: right;">#${guestOrder.id.substring(0, 8)}</td>
                                </tr>
                                <tr>
                                  <td style="padding: 8px 0; color: #666666; font-size: 14px;"><strong>Email:</strong></td>
                                  <td style="padding: 8px 0; color: #333333; font-size: 14px; text-align: right;">${guestOrder.guestEmail}</td>
                                </tr>
                                <tr>
                                  <td style="padding: 8px 0; color: #666666; font-size: 14px;"><strong>Phone:</strong></td>
                                  <td style="padding: 8px 0; color: #333333; font-size: 14px; text-align: right;">${guestOrder.guestPhone || 'Not provided'}</td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                        
                        <!-- Shipping Address -->
                        <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 0 0 25px 0; background-color: #f9f9f9; border-radius: 8px;">
                          <tr>
                            <td style="padding: 25px;">
                              <h3 style="margin: 0 0 15px 0; color: #00308F; font-size: 18px;">Shipping Address</h3>
                              <p style="margin: 0; color: #333333; font-size: 14px; line-height: 1.6;">
                                ${guestOrder.shippingAddress}<br>
                                ${guestOrder.city ? guestOrder.city + ', ' : ''}${guestOrder.postCode ? guestOrder.postCode + ', ' : ''}${guestOrder.country || ''}
                              </p>
                            </td>
                          </tr>
                        </table>
                        
                        <!-- Items -->
                        <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 0 0 25px 0;">
                          <tr>
                            <td colspan="3" style="padding: 15px 0; border-bottom: 2px solid #00308F;">
                              <h3 style="margin: 0; color: #00308F; font-size: 18px;">Order Items</h3>
                            </td>
                          </tr>
                          <tr style="background-color: #f9f9f9;">
                            <th style="padding: 12px; text-align: left; color: #666666; font-size: 12px; font-weight: bold; text-transform: uppercase;">Item</th>
                            <th style="padding: 12px; text-align: center; color: #666666; font-size: 12px; font-weight: bold; text-transform: uppercase;">Qty</th>
                            <th style="padding: 12px; text-align: right; color: #666666; font-size: 12px; font-weight: bold; text-transform: uppercase;">Price</th>
                          </tr>
                          ${itemDetailsHTML}
                        </table>
                        
                        <!-- Order Total -->
                        <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 0 0 25px 0; background-color: #f9f9f9; border-radius: 8px;">
                          <tr>
                            <td style="padding: 25px;">
                              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                                <tr>
                                  <td style="padding: 8px 0; color: #666666; font-size: 14px;">Subtotal:</td>
                                  <td style="padding: 8px 0; color: #333333; font-size: 14px; text-align: right;">PKR ${calculatedSubtotal.toFixed(2)}</td>
                                </tr>
                                <tr>
                                  <td style="padding: 8px 0; color: #666666; font-size: 14px;">Taxes:</td>
                                  <td style="padding: 8px 0; color: #333333; font-size: 14px; text-align: right;">PKR ${guestOrder.taxes.toFixed(2)}</td>
                                </tr>
                                <tr>
                                  <td style="padding: 8px 0; color: #666666; font-size: 14px;">Shipping Fee:</td>
                                  <td style="padding: 8px 0; color: #333333; font-size: 14px; text-align: right;">PKR ${guestOrder.shippingFee.toFixed(2)}</td>
                                </tr>
                                <tr style="border-top: 2px solid #00308F;">
                                  <td style="padding: 15px 0 0 0; color: #00308F; font-size: 16px; font-weight: bold;">Total:</td>
                                  <td style="padding: 15px 0 0 0; color: #E31837; font-size: 20px; font-weight: bold; text-align: right;">PKR ${guestOrder.totalPrice.toFixed(2)}</td>
                                </tr>
                                <tr>
                                  <td colspan="2" style="padding: 10px 0 0 0; color: #666666; font-size: 14px;">Payment Method: ${guestOrder.paymentMethod === 'cod' ? 'Cash on Delivery' : guestOrder.paymentMethod}</td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
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
        text: `Hello ${guestOrder.guestName},\n\nThank you for your order at Hadi Books Store!\n\nOrder ID: #${guestOrder.id.substring(0, 8)}\nEmail: ${guestOrder.guestEmail}\nPhone: ${guestOrder.guestPhone || 'Not provided'}\n\nShipping Address:\n${guestOrder.shippingAddress}\n${guestOrder.city ? guestOrder.city + ', ' : ''}${guestOrder.postCode ? guestOrder.postCode + ', ' : ''}${guestOrder.country || ''}\n\nOrder Items:\n${itemDetailsText}\n\nOrder Total:\nSubtotal: PKR ${calculatedSubtotal.toFixed(2)}\nTaxes: PKR ${guestOrder.taxes.toFixed(2)}\nShipping Fee: PKR ${guestOrder.shippingFee.toFixed(2)}\nTotal: PKR ${guestOrder.totalPrice.toFixed(2)}\n\nPayment Method: ${guestOrder.paymentMethod === 'cod' ? 'Cash on Delivery' : guestOrder.paymentMethod}\n\nWe will contact you via email or phone regarding your order status.\n\nThank you for shopping with us!\nHadi Books Store Team`,
        headers: {
          'X-Entity-Ref-ID': `guest-order-${guestOrder.id}`,
        },
      });
      
      console.log('📬 Guest email Resend response:', JSON.stringify(guestEmailResult, null, 2));
      
      if (guestEmailResult.error) {
        console.error('❌ Failed to send guest confirmation email:', guestEmailResult.error);
      } else {
        console.log('✅ Guest order confirmation email sent to:', guestOrder.guestEmail, '| ID:', guestEmailResult.data?.id);
      }
    } catch (emailErr) {
      console.error('❌ Exception sending guest confirmation email:', emailErr);
    }

    try {
      const adminEmailResult = await resend.emails.send({
        from: 'Hadi Books Store <noreply@hadibookstore.shop>',
        to: 'hadibooksstore01@gmail.com',
        subject: `[GUEST ORDER] New Order #${guestOrder.id.substring(0, 8)} - Hadi Books Store`,
        text: `NEW GUEST ORDER PLACED\n──────────────────────\nOrder ID: ${guestOrder.id}\nOrder Date: ${guestOrder.createdAt.toISOString()}\n\nGuest Details:\n──────────────\nName: ${guestOrder.guestName}\nEmail: ${guestOrder.guestEmail}\nPhone: ${guestOrder.guestPhone || 'Not provided'}\n\nShipping Address:\n────────────────\n${guestOrder.shippingAddress}\n${guestOrder.city ? guestOrder.city + ', ' : ''}${guestOrder.postCode ? guestOrder.postCode + ', ' : ''}${guestOrder.country || ''}\n\nOrder Items:\n${itemDetailsText}\n\nOrder Total:\n────────────\nSubtotal: PKR ${calculatedSubtotal.toFixed(2)}\nTaxes: PKR ${guestOrder.taxes.toFixed(2)}\nShipping Fee: PKR ${guestOrder.shippingFee.toFixed(2)}\nTotal: PKR ${guestOrder.totalPrice.toFixed(2)}\n\nPayment Method: ${guestOrder.paymentMethod === 'cod' ? 'Cash on Delivery' : guestOrder.paymentMethod}\nPayment Status: ${guestOrder.paymentStatus}`,
        headers: {
          'X-Entity-Ref-ID': `admin-guest-order-${guestOrder.id}`,
        },
      });
      
      console.log('📬 Admin email Resend response:', JSON.stringify(adminEmailResult, null, 2));
      
      if (adminEmailResult.error) {
        console.error('❌ Failed to send admin notification:', adminEmailResult.error);
      } else {
        console.log('✅ Admin notification email sent for guest order:', guestOrder.id, '| ID:', adminEmailResult.data?.id);
      }
    } catch (emailErr) {
      console.error('❌ Exception sending admin notification:', emailErr);
    }
    console.timeEnd('sendEmails');
  }, 0);
};

export const createGuestOrder = async (req, res) => {
  console.time('createGuestOrder');
  try {
    const {
      guestName,
      guestEmail,
      guestPhone,
      shippingAddress,
      city,
      postCode,
      country,
      items,
      totalPrice,
      paymentMethod,
      onlinePaymentOption,
      taxes = 0,
      shippingFee = 0,
    } = req.body;

    console.log('📦 Guest order request received:', {
      guestEmail,
      itemCount: items?.length,
      paymentMethod,
      onlinePaymentOption,
    });

    // Enhanced validation
    console.time('validateInput');
    if (!guestName || !guestEmail || !shippingAddress || !items || !Array.isArray(items) || items.length === 0 || !totalPrice) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, email, shipping address, items, and total price are required',
      });
    }

    if (!validator.isEmail(guestEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format',
      });
    }
    console.timeEnd('validateInput');

    // Validate items and product availability
    console.time('validateItems');
    const productIds = items.map((it) => it.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));

    for (const item of items) {
      if (!item.productId || !item.quantity || isNaN(item.quantity) || item.quantity < 1 || item.price == null) {
        return res.status(400).json({
          success: false,
          message: 'Invalid item data: productId, quantity, and price are required',
        });
      }

      const product = productMap.get(item.productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product ${item.productId} not found`,
        });
      }

      if (product.availability === false) {
        return res.status(400).json({
          success: false,
          message: `Product "${product.name}" is not available`,
        });
      }

      // Allow minor floating point differences (0.01 tolerance)
      if (Math.abs(item.price - product.price) > 0.01) {
        return res.status(400).json({
          success: false,
          message: `Price mismatch for product "${product.name}". Expected: ${product.price}, Received: ${item.price}`,
        });
      }
    }
    console.timeEnd('validateItems');

    // Validate total price
    console.time('validateTotal');
    const calculatedSubtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const calculatedTotal = calculatedSubtotal + taxes + shippingFee;

    if (Math.abs(calculatedTotal - totalPrice) > 0.01) {
      return res.status(400).json({
        success: false,
        message: `Total price mismatch. Calculated: ${calculatedTotal.toFixed(2)}, Received: ${totalPrice}`,
      });
    }
    console.timeEnd('validateTotal');

    // Validate payment method
    console.time('validatePayment');
    let storedPaymentMethod = null;
    if (paymentMethod === 'online') {
      const allowedOnlineOptions = ['JazzCash', 'EasyPaisa', 'BankTransfer'];
      if (!onlinePaymentOption || !allowedOnlineOptions.includes(onlinePaymentOption)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid online payment option. Must be one of: JazzCash, EasyPaisa, BankTransfer',
        });
      }
      storedPaymentMethod = onlinePaymentOption;
    } else if (paymentMethod === 'cod') {
      storedPaymentMethod = 'cod';
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment method. Must be "cod" or "online"',
      });
    }
    console.timeEnd('validatePayment');

    // Create guest order
    console.time('createOrder');
    const guestOrder = await prisma.guestOrder.create({
      data: {
        guestEmail: guestEmail.toLowerCase().trim(),
        guestName: guestName.trim(),
        guestPhone: guestPhone ? guestPhone.trim() : null,
        shippingAddress: shippingAddress.trim(),
        city: city ? city.trim() : null,
        postCode: postCode ? postCode.trim() : null,
        country: country ? country.trim() : null,
        totalPrice,
        paymentMethod: storedPaymentMethod,
        taxes,
        shippingFee,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
          })),
        },
      },
    });
    console.timeEnd('createOrder');

    // Create payment record for online payments
    console.time('createPayment');
    if (storedPaymentMethod && storedPaymentMethod !== 'cod') {
      await prisma.guestPayment.create({
        data: {
          orderId: guestOrder.id,
          paymentMethod: storedPaymentMethod,
          amount: guestOrder.totalPrice,
          status: 'pending',
        },
      });
      console.log('✅ Guest payment record created for online payment');
    }
    console.timeEnd('createPayment');

    // Fetch full order details
    console.time('fetchFullOrder');
    const fullOrder = await prisma.guestOrder.findUnique({
      where: { id: guestOrder.id },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                image: true,
                price: true,
              },
            },
          },
        },
        payment: true,
      },
    });
    console.timeEnd('fetchFullOrder');

    console.log('✅ Guest order created:', guestOrder.id);

    // Send emails in background
    await sendEmailsInBackground(fullOrder, calculatedSubtotal);

    console.timeEnd('createGuestOrder');

    return res.status(201).json({
      success: true,
      message: 'Guest order placed successfully',
      order: {
        id: fullOrder.id,
        guestEmail: fullOrder.guestEmail,
        guestName: fullOrder.guestName,
        guestPhone: fullOrder.guestPhone,
        totalPrice: fullOrder.totalPrice,
        status: fullOrder.status,
        paymentStatus: fullOrder.paymentStatus,
        shippingAddress: fullOrder.shippingAddress,
        city: fullOrder.city,
        postCode: fullOrder.postCode,
        country: fullOrder.country,
        paymentMethod: fullOrder.paymentMethod,
        taxes: fullOrder.taxes,
        shippingFee: fullOrder.shippingFee,
        createdAt: fullOrder.createdAt,
        items: fullOrder.items.map((item) => ({
          id: item.id,
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          product: {
            id: item.product.id,
            name: item.product.name,
            image: item.product.image,
          },
        })),
      },
    });
  } catch (error) {
    console.error('❌ Create Guest Order Error:', error);
    console.timeEnd('createGuestOrder');

    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: 'Order creation failed due to duplicate entry',
      });
    }

    if (error.message.includes('connect')) {
      return res.status(500).json({
        success: false,
        message: 'Database connection error. Please try again.',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to place guest order. Please try again.',
    });
  }
};
