// import { PrismaClient } from '@prisma/client';
// import transporter from '../config/transporter.js';
// import validator from 'validator';

// const prisma = new PrismaClient();

// const sendEmailsInBackground = async (guestOrder, calculatedSubtotal) => {
//   console.time('sendEmails');
//   const itemDetails = guestOrder.items
//     .map((item) => `• ${item.product?.name || 'Unknown Product'} - Qty: ${item.quantity} - Price: PKR ${Number(item.price).toFixed(2)}`)
//     .join('\n');

//   const emailContentGuest = `
// Thank you for your order at Hadi Books Store!

// Order Summary:
// ──────────────
// Order ID: ${guestOrder.id}
// Name: ${guestOrder.guestName}
// Email: ${guestOrder.guestEmail}
// Phone: ${guestOrder.guestPhone || 'Not provided'}

// Shipping Address:
// ${guestOrder.shippingAddress}
// ${guestOrder.city ? guestOrder.city + ', ' : ''}${guestOrder.postCode ? guestOrder.postCode + ', ' : ''}${guestOrder.country || ''}

// Order Details:
// ──────────────
// ${itemDetails}

// Order Total:
// ────────────
// Subtotal: PKR ${calculatedSubtotal.toFixed(2)}
// Taxes: PKR ${guestOrder.taxes.toFixed(2)}
// Shipping Fee: PKR ${guestOrder.shippingFee.toFixed(2)}
// Total: PKR ${guestOrder.totalPrice.toFixed(2)}

// Payment Method: ${guestOrder.paymentMethod === 'cod' ? 'Cash on Delivery' : guestOrder.paymentMethod}

// We will contact you via email or phone regarding your order status. 
// If you have any questions, please reply to this email.

// Thank you for shopping with us!
// Hadi Books Store Team
// `;

//   const emailContentAdmin = `
// NEW GUEST ORDER PLACED
// ──────────────────────
// Order ID: ${guestOrder.id}
// Order Date: ${guestOrder.createdAt.toISOString()}

// Guest Details:
// ──────────────
// Name: ${guestOrder.guestName}
// Email: ${guestOrder.guestEmail}
// Phone: ${guestOrder.guestPhone || 'Not provided'}

// Shipping Address:
// ────────────────
// ${guestOrder.shippingAddress}
// ${guestOrder.city ? guestOrder.city + ', ' : ''}${guestOrder.postCode ? guestOrder.postCode + ', ' : ''}${guestOrder.country || ''}

// Order Details:
// ──────────────
// ${itemDetails}

// Order Total:
// ────────────
// Subtotal: PKR ${calculatedSubtotal.toFixed(2)}
// Taxes: PKR ${guestOrder.taxes.toFixed(2)}
// Shipping Fee: PKR ${guestOrder.shippingFee.toFixed(2)}
// Total: PKR ${guestOrder.totalPrice.toFixed(2)}

// Payment Method: ${guestOrder.paymentMethod === 'cod' ? 'Cash on Delivery' : guestOrder.paymentMethod}
// Payment Status: ${guestOrder.paymentStatus}
// `;

//   // Run email sending in background
//   setTimeout(async () => {
//     try {
//       await transporter.sendMail({
//         from: `"Hadi Books Store" <${process.env.SMTP_USER}>`,
//         to: guestOrder.guestEmail,
//         subject: `Order Confirmation - ${guestOrder.id}`,
//         text: emailContentGuest,
//       });
//       console.log('✅ Guest order confirmation email sent to:', guestOrder.guestEmail);
//     } catch (emailErr) {
//       console.error('❌ Failed to send guest confirmation email:', emailErr);
//     }

//     try {
//       await transporter.sendMail({
//         from: `"Hadi Books Store" <${process.env.SMTP_USER}>`,
//         to: process.env.SENDER_EMAIL,
//         subject: `[GUEST ORDER] New Order - ${guestOrder.id}`,
//         text: emailContentAdmin,
//       });
//       console.log('✅ Admin notification email sent for guest order:', guestOrder.id);
//     } catch (emailErr) {
//       console.error('❌ Failed to send admin notification for guest order:', emailErr);
//     }
//     console.timeEnd('sendEmails');
//   }, 0);
// };

// const createGuestOrder = async (req, res) => {
//   console.time('createGuestOrder');
//   try {
//     const {
//       guestName,
//       guestEmail,
//       guestPhone,
//       shippingAddress,
//       city,
//       postCode,
//       country,
//       items,
//       totalPrice,
//       paymentMethod,
//       onlinePaymentOption,
//       taxes = 0,
//       shippingFee = 0,
//     } = req.body;

//     console.log('📦 Guest order request received:', {
//       guestEmail,
//       itemCount: items?.length,
//       paymentMethod,
//       onlinePaymentOption,
//     });

//     // Enhanced validation
//     console.time('validateInput');
//     if (!guestName || !guestEmail || !shippingAddress || !items || !Array.isArray(items) || items.length === 0 || !totalPrice) {
//       return res.status(400).json({
//         success: false,
//         message: 'Missing required fields: name, email, shipping address, items, and total price are required',
//       });
//     }

//     if (!validator.isEmail(guestEmail)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid email format',
//       });
//     }
//     console.timeEnd('validateInput');

//     // Validate items and product availability
//     console.time('validateItems');
//     const productIds = items.map((it) => it.productId);
//     const products = await prisma.product.findMany({
//       where: { id: { in: productIds } },
//     });

//     const productMap = new Map(products.map((p) => [p.id, p]));

//     for (const item of items) {
//       if (!item.productId || !item.quantity || isNaN(item.quantity) || item.quantity < 1 || item.price == null) {
//         return res.status(400).json({
//           success: false,
//           message: 'Invalid item data: productId, quantity, and price are required',
//         });
//       }

//       const product = productMap.get(item.productId);
//       if (!product) {
//         return res.status(404).json({
//           success: false,
//           message: `Product ${item.productId} not found`,
//         });
//       }

//       if (product.availability === false) {
//         return res.status(400).json({
//           success: false,
//           message: `Product "${product.name}" is not available`,
//         });
//       }

//       // Allow minor floating point differences (0.01 tolerance)
//       if (Math.abs(item.price - product.price) > 0.01) {
//         return res.status(400).json({
//           success: false,
//           message: `Price mismatch for product "${product.name}". Expected: ${product.price}, Received: ${item.price}`,
//         });
//       }
//     }
//     console.timeEnd('validateItems');

//     // Validate total price
//     console.time('validateTotal');
//     const calculatedSubtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
//     const calculatedTotal = calculatedSubtotal + taxes + shippingFee;

//     if (Math.abs(calculatedTotal - totalPrice) > 0.01) {
//       return res.status(400).json({
//         success: false,
//         message: `Total price mismatch. Calculated: ${calculatedTotal.toFixed(2)}, Received: ${totalPrice}`,
//       });
//     }
//     console.timeEnd('validateTotal');

//     // Validate payment method
//     console.time('validatePayment');
//     let storedPaymentMethod = null;
//     if (paymentMethod === 'online') {
//       const allowedOnlineOptions = ['JazzCash', 'EasyPaisa', 'BankTransfer'];
//       if (!onlinePaymentOption || !allowedOnlineOptions.includes(onlinePaymentOption)) {
//         return res.status(400).json({
//           success: false,
//           message: 'Invalid online payment option. Must be one of: JazzCash, EasyPaisa, BankTransfer',
//         });
//       }
//       storedPaymentMethod = onlinePaymentOption;
//     } else if (paymentMethod === 'cod') {
//       storedPaymentMethod = 'cod';
//     } else {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid payment method. Must be "cod" or "online"',
//       });
//     }
//     console.timeEnd('validatePayment');

//     // Create guest order
//     console.time('createOrder');
//     const guestOrder = await prisma.guestOrder.create({
//       data: {
//         guestEmail: guestEmail.toLowerCase().trim(),
//         guestName: guestName.trim(),
//         guestPhone: guestPhone ? guestPhone.trim() : null,
//         shippingAddress: shippingAddress.trim(),
//         city: city ? city.trim() : null,
//         postCode: postCode ? postCode.trim() : null,
//         country: country ? country.trim() : null,
//         totalPrice,
//         paymentMethod: storedPaymentMethod,
//         taxes,
//         shippingFee,
//         items: {
//           create: items.map((item) => ({
//             productId: item.productId,
//             quantity: item.quantity,
//             price: item.price,
//           })),
//         },
//       },
//     });
//     console.timeEnd('createOrder');

//     // Create payment record for online payments
//     console.time('createPayment');
//     if (storedPaymentMethod && storedPaymentMethod !== 'cod') {
//       await prisma.guestPayment.create({
//         data: {
//           orderId: guestOrder.id,
//           paymentMethod: storedPaymentMethod,
//           amount: guestOrder.totalPrice,
//           status: 'pending',
//         },
//       });
//       console.log('✅ Guest payment record created for online payment');
//     }
//     console.timeEnd('createPayment');

//     // Fetch full order details
//     console.time('fetchFullOrder');
//     const fullOrder = await prisma.guestOrder.findUnique({
//       where: { id: guestOrder.id },
//       include: {
//         items: {
//           include: {
//             product: {
//               select: {
//                 id: true,
//                 name: true,
//                 image: true,
//                 price: true,
//               },
//             },
//           },
//         },
//         payment: true,
//       },
//     });
//     console.timeEnd('fetchFullOrder');

//     console.log('✅ Guest order created:', guestOrder.id);

//     // Send emails in background
//     await sendEmailsInBackground(fullOrder, calculatedSubtotal);

//     console.timeEnd('createGuestOrder');

//     return res.status(201).json({
//       success: true,
//       message: 'Guest order placed successfully',
//       order: {
//         id: fullOrder.id,
//         guestEmail: fullOrder.guestEmail,
//         guestName: fullOrder.guestName,
//         guestPhone: fullOrder.guestPhone,
//         totalPrice: fullOrder.totalPrice,
//         status: fullOrder.status,
//         paymentStatus: fullOrder.paymentStatus,
//         shippingAddress: fullOrder.shippingAddress,
//         city: fullOrder.city,
//         postCode: fullOrder.postCode,
//         country: fullOrder.country,
//         paymentMethod: fullOrder.paymentMethod,
//         taxes: fullOrder.taxes,
//         shippingFee: fullOrder.shippingFee,
//         createdAt: fullOrder.createdAt,
//         items: fullOrder.items.map((item) => ({
//           id: item.id,
//           productId: item.productId,
//           quantity: item.quantity,
//           price: item.price,
//           product: {
//             id: item.product.id,
//             name: item.product.name,
//             image: item.product.image,
//           },
//         })),
//       },
//     });
//   } catch (error) {
//     console.error('❌ Create Guest Order Error:', error);
//     console.timeEnd('createGuestOrder');

//     if (error.code === 'P2002') {
//       return res.status(400).json({
//         success: false,
//         message: 'Order creation failed due to duplicate entry',
//       });
//     }

//     if (error.message.includes('connect')) {
//       return res.status(500).json({
//         success: false,
//         message: 'Database connection error. Please try again.',
//       });
//     }

//     return res.status(500).json({
//       success: false,
//       message: 'Failed to place guest order. Please try again.',
//     });
//   }
// };

// export { createGuestOrder };
import { PrismaClient } from '@prisma/client';
import validator from 'validator';

const prisma = new PrismaClient();

const createGuestOrder = async (req, res) => {
  console.time('createGuestOrder');
  console.log('📦 Guest order request received:', {
    guestEmail: req.body.guestEmail,
    itemCount: req.body.items?.length,
    paymentMethod: req.body.paymentMethod,
    onlinePaymentOption: req.body.onlinePaymentOption,
  });

  try {
    // Temporary static response to test endpoint
    console.timeEnd('createGuestOrder');
    return res.status(200).json({
      success: true,
      message: 'Test response from createGuestOrder',
      receivedPayload: req.body,
    });

    // Uncomment the full logic once the timeout is resolved
    /*
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

    // Validate input
    console.time('validateInput');
    if (!guestName || !guestEmail || !shippingAddress || !items || !Array.isArray(items) || items.length === 0 || !totalPrice) {
      console.timeEnd('validateInput');
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, email, shipping address, items, and total price are required',
      });
    }

    if (!validator.isEmail(guestEmail)) {
      console.timeEnd('validateInput');
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
      select: { id: true, name: true, price: true, availability: true, image: true },
    });

    if (products.length !== productIds.length) {
      console.timeEnd('validateItems');
      return res.status(404).json({
        success: false,
        message: 'One or more products not found',
      });
    }

    const productMap = new Map(products.map((p) => [p.id, p]));
    for (const item of items) {
      if (!item.productId || !item.quantity || isNaN(item.quantity) || item.quantity < 1 || item.price == null) {
        console.timeEnd('validateItems');
        return res.status(400).json({
          success: false,
          message: 'Invalid item data: productId, quantity, and price are required',
        });
      }

      const product = productMap.get(item.productId);
      if (!product.availability) {
        console.timeEnd('validateItems');
        return res.status(400).json({
          success: false,
          message: `Product "${product.name}" is not available`,
        });
      }

      if (Math.abs(item.price - product.price) > 0.01) {
        console.timeEnd('validateItems');
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
      console.timeEnd('validateTotal');
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
        console.timeEnd('validatePayment');
        return res.status(400).json({
          success: false,
          message: 'Invalid online payment option. Must be one of: JazzCash, EasyPaisa, BankTransfer',
        });
      }
      storedPaymentMethod = onlinePaymentOption;
    } else if (paymentMethod === 'cod') {
      storedPaymentMethod = 'cod';
    } else {
      console.timeEnd('validatePayment');
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
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, image: true, price: true },
            },
          },
        },
      },
    });
    console.timeEnd('createOrder');

    // Create payment record
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

    console.log('✅ Guest order created:', guestOrder.id);

    // Send emails in background
    const transporter = req.app.locals.transporter || (await import('../config/transporter.js')).default;
    sendEmailsInBackground(guestOrder, calculatedSubtotal, transporter);

    console.timeEnd('createGuestOrder');

    return res.status(201).json({
      success: true,
      message: 'Guest order placed successfully',
      order: {
        id: guestOrder.id,
        guestEmail: guestOrder.guestEmail,
        guestName: guestOrder.guestName,
        guestPhone: guestOrder.guestPhone,
        totalPrice: guestOrder.totalPrice,
        status: guestOrder.status,
        paymentStatus: guestOrder.paymentStatus,
        shippingAddress: guestOrder.shippingAddress,
        city: guestOrder.city,
        postCode: guestOrder.postCode,
        country: guestOrder.country,
        paymentMethod: guestOrder.paymentMethod,
        taxes: guestOrder.taxes,
        shippingFee: guestOrder.shippingFee,
        createdAt: guestOrder.createdAt,
        items: guestOrder.items.map((item) => ({
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
    */
  } catch (error) {
    console.error('❌ Create Guest Order Error:', error);
    console.timeEnd('createGuestOrder');
    return res.status(500).json({
      success: false,
      message: 'Failed to process test response',
    });
  }
};

export { createGuestOrder };
