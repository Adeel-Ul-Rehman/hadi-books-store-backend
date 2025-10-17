import { PrismaClient } from '@prisma/client';
import transporter from '../config/transporter.js';
import validator from 'validator';

const prisma = new PrismaClient();

// CORS helper to add headers to all responses
const allowedOrigins = [
  'https://hadibookstore.shop',
  'https://www.hadibookstore.shop',
  'https://api.hadibookstore.shop',
  'http://api.hadibookstore.shop',
  'http://localhost:5173',
  'http://localhost:5174'
];

const addCorsHeaders = (req, res) => {
  const origin = req.headers.origin;
  if (origin && (allowedOrigins.includes(origin) || origin.endsWith('.hadibookstore.shop'))) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }
};

const createGuestOrder = async (req, res) => {
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
      paymentMethod, // 'cod' or 'online'
      onlinePaymentOption, // 'JazzCash', 'EasyPaisa', 'BankTransfer'
      taxes = 0,
      shippingFee = 0,
    } = req.body;

    console.log('📦 Guest order request received:', {
      guestEmail,
      itemCount: items?.length,
      paymentMethod,
      onlinePaymentOption
    });

    // Enhanced validation
    if (!guestName || !guestEmail || !shippingAddress || !items || !Array.isArray(items) || items.length === 0 || !totalPrice) {
      addCorsHeaders(req, res);
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: name, email, shipping address, items, and total price are required' 
      });
    }

    if (!validator.isEmail(guestEmail)) {
      addCorsHeaders(req, res);
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid email format' 
      });
    }

    // Validate items and product availability
    const productIds = items.map(it => it.productId);
    const products = await prisma.product.findMany({ 
      where: { id: { in: productIds } } 
    });
    
    const productMap = new Map(products.map(p => [p.id, p]));

    for (const item of items) {
      if (!item.productId || !item.quantity || isNaN(item.quantity) || item.quantity < 1 || item.price == null) {
        addCorsHeaders(req, res);
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid item data: productId, quantity, and price are required' 
        });
      }
      
      const product = productMap.get(item.productId);
      if (!product) {
        addCorsHeaders(req, res);
        return res.status(404).json({ 
          success: false, 
          message: `Product ${item.productId} not found` 
        });
      }
      
      if (product.availability === false) {
        addCorsHeaders(req, res);
        return res.status(400).json({ 
          success: false, 
          message: `Product "${product.name}" is not available` 
        });
      }
      
      // Allow minor floating point differences (0.01 tolerance)
      if (Math.abs(item.price - product.price) > 0.01) {
        addCorsHeaders(req, res);
        return res.status(400).json({ 
          success: false, 
          message: `Price mismatch for product "${product.name}". Expected: ${product.price}, Received: ${item.price}` 
        });
      }
    }

    // Validate total price
    const calculatedSubtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const calculatedTotal = calculatedSubtotal + taxes + shippingFee;
    
    if (Math.abs(calculatedTotal - totalPrice) > 0.01) {
      addCorsHeaders(req, res);
      return res.status(400).json({ 
        success: false, 
        message: `Total price mismatch. Calculated: ${calculatedTotal.toFixed(2)}, Received: ${totalPrice}` 
      });
    }

    // Validate payment method
    let storedPaymentMethod = null;
    if (paymentMethod === 'online') {
      const allowedOnlineOptions = ['JazzCash', 'EasyPaisa', 'BankTransfer'];
      if (!onlinePaymentOption || !allowedOnlineOptions.includes(onlinePaymentOption)) {
        addCorsHeaders(req, res);
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid online payment option. Must be one of: JazzCash, EasyPaisa, BankTransfer' 
        });
      }
      storedPaymentMethod = onlinePaymentOption;
    } else if (paymentMethod === 'cod') {
      storedPaymentMethod = 'cod';
    } else {
      addCorsHeaders(req, res);
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid payment method. Must be "cod" or "online"' 
      });
    }

    // Create guest order within a transaction
    const guestOrder = await prisma.$transaction(async (tx) => {
      console.log('🔄 Creating guest order transaction...');
      
      const orderData = await tx.guestOrder.create({
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
            create: items.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
            })),
          },
        },
      });

      console.log('✅ Guest order created:', orderData.id);

      // If online payment, create a guestPayment record
      if (storedPaymentMethod && storedPaymentMethod !== 'cod') {
        await tx.guestPayment.create({
          data: {
            orderId: orderData.id,
            paymentMethod: storedPaymentMethod,
            amount: orderData.totalPrice,
            status: 'pending',
          },
        });
        console.log('✅ Guest payment record created for online payment');
      }

      // Return the full order including items and payment
      const fullOrder = await tx.guestOrder.findUnique({
        where: { id: orderData.id },
        include: { 
          items: { 
            include: { 
              product: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                  price: true
                }
              } 
            } 
          }, 
          payment: true 
        },
      });

      return fullOrder;
    });

    console.log('✅ Guest order transaction completed:', guestOrder.id);

    // Prepare email content for guest and admin
    const itemDetails = guestOrder.items
      .map(item => `• ${item.product?.name || 'Unknown Product'} - Qty: ${item.quantity} - Price: PKR ${Number(item.price).toFixed(2)}`)
      .join('\n');

    const emailContentGuest = `
Thank you for your order at Hadi Books Store!

Order Summary:
──────────────
Order ID: ${guestOrder.id}
Name: ${guestOrder.guestName}
Email: ${guestOrder.guestEmail}
Phone: ${guestOrder.guestPhone || 'Not provided'}

Shipping Address:
${guestOrder.shippingAddress}
${guestOrder.city ? guestOrder.city + ', ' : ''}${guestOrder.postCode ? guestOrder.postCode + ', ' : ''}${guestOrder.country || ''}

Order Details:
──────────────
${itemDetails}

Order Total:
────────────
Subtotal: PKR ${calculatedSubtotal.toFixed(2)}
Taxes: PKR ${guestOrder.taxes.toFixed(2)}
Shipping Fee: PKR ${guestOrder.shippingFee.toFixed(2)}
Total: PKR ${guestOrder.totalPrice.toFixed(2)}

Payment Method: ${guestOrder.paymentMethod === 'cod' ? 'Cash on Delivery' : guestOrder.paymentMethod}

We will contact you via email or phone regarding your order status. 
If you have any questions, please reply to this email.

Thank you for shopping with us!
Hadi Books Store Team
`;

    const emailContentAdmin = `
NEW GUEST ORDER PLACED
──────────────────────
Order ID: ${guestOrder.id}
Order Date: ${guestOrder.createdAt.toISOString()}

Guest Details:
──────────────
Name: ${guestOrder.guestName}
Email: ${guestOrder.guestEmail}
Phone: ${guestOrder.guestPhone || 'Not provided'}

Shipping Address:
────────────────
${guestOrder.shippingAddress}
${guestOrder.city ? guestOrder.city + ', ' : ''}${guestOrder.postCode ? guestOrder.postCode + ', ' : ''}${guestOrder.country || ''}

Order Details:
──────────────
${itemDetails}

Order Total:
────────────
Subtotal: PKR ${calculatedSubtotal.toFixed(2)}
Taxes: PKR ${guestOrder.taxes.toFixed(2)}
Shipping Fee: PKR ${guestOrder.shippingFee.toFixed(2)}
Total: PKR ${guestOrder.totalPrice.toFixed(2)}

Payment Method: ${guestOrder.paymentMethod === 'cod' ? 'Cash on Delivery' : guestOrder.paymentMethod}
Payment Status: ${guestOrder.paymentStatus}
`;

    // Send email to guest
    try {
      await transporter.sendMail({
        from: `"Hadi Books Store" <${process.env.SMTP_USER}>`,
        to: guestOrder.guestEmail,
        subject: `Order Confirmation - ${guestOrder.id}`,
        text: emailContentGuest,
      });
      console.log('✅ Guest order confirmation email sent to:', guestOrder.guestEmail);
    } catch (emailErr) {
      console.error('❌ Failed to send guest confirmation email:', emailErr);
      // Don't fail the order if email fails
    }

    // Send email to admin
    try {
      await transporter.sendMail({
        from: `"Hadi Books Store" <${process.env.SMTP_USER}>`,
        to: process.env.SENDER_EMAIL,
        subject: `[GUEST ORDER] New Order - ${guestOrder.id}`,
        text: emailContentAdmin,
      });
      console.log('✅ Admin notification email sent for guest order:', guestOrder.id);
    } catch (emailErr) {
      console.error('❌ Failed to send admin notification for guest order:', emailErr);
      // Don't fail the order if email fails
    }

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
        items: guestOrder.items.map(item => ({
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
    
    // More specific error messages
    if (error.code === 'P2002') {
      addCorsHeaders(req, res);
      return res.status(400).json({ 
        success: false, 
        message: 'Order creation failed due to duplicate entry' 
      });
    }
    
    if (error.message.includes('connect')) {
      addCorsHeaders(req, res);
      return res.status(500).json({ 
        success: false, 
        message: 'Database connection error. Please try again.' 
      });
    }
    
    addCorsHeaders(req, res);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to place guest order. Please try again.' 
    });
  }
};

export { createGuestOrder };
