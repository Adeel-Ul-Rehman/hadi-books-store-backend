import { PrismaClient } from '@prisma/client';
import transporter from '../config/transporter.js';

const prisma = new PrismaClient();

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

    // Basic validation: shippingAddress is required; city/postCode/country are optional
    if (!guestName || !guestEmail || !shippingAddress || !items || !Array.isArray(items) || items.length === 0 || !totalPrice) {
      return res.status(400).json({ success: false, message: 'Missing required fields for guest order' });
    }

    // Validate items and product availability/prices
    for (const item of items) {
      if (!item.productId || !item.quantity || isNaN(item.quantity) || item.quantity < 1 || !item.price) {
        return res.status(400).json({ success: false, message: 'Invalid item data' });
      }
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!product || !product.availability) {
        return res.status(404).json({ success: false, message: `Product ${item.productId} not found or unavailable` });
      }
      if (item.price !== product.price) {
        return res.status(400).json({ success: false, message: `Price mismatch for product ${item.productId}` });
      }
    }

    const calculatedSubtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const calculatedTotal = calculatedSubtotal + taxes + shippingFee;
    if (Math.abs(calculatedTotal - totalPrice) > 0.01) {
      return res.status(400).json({ success: false, message: 'Total price mismatch' });
    }

    // Create guest order within a transaction
    const guestOrder = await prisma.$transaction(async (tx) => {
      // Determine stored payment method
      let storedPaymentMethod = null;
      if (paymentMethod === 'online') {
        const allowedOnlineOptions = ['JazzCash', 'EasyPaisa', 'BankTransfer'];
        if (!onlinePaymentOption || !allowedOnlineOptions.includes(onlinePaymentOption)) {
          throw new Error('Invalid online payment option');
        }
        storedPaymentMethod = onlinePaymentOption;
      } else if (paymentMethod === 'cod') {
        storedPaymentMethod = 'cod';
      }

      const orderData = await tx.guestOrder.create({
        data: {
          guestEmail,
          guestName,
          guestPhone: guestPhone || null,
          shippingAddress,
          city: city || null,
          postCode: postCode || null,
          country: country || null,
          totalPrice,
          paymentMethod: storedPaymentMethod || null,
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
      }

      // Return the full order including items and payment
      const fullOrder = await tx.guestOrder.findUnique({
        where: { id: orderData.id },
        include: { items: { include: { product: true } }, payment: true },
      });

      return fullOrder;
    });

    // Prepare email content for guest and admin
    const itemDetails = guestOrder.items
      .map(item => `Product: ${item.product.name}, Quantity: ${item.quantity}, Price: PKR ${item.price.toFixed(2)}`)
      .join('\n');

  const emailContentGuest = `
Thank you for your order!

Order ID: ${guestOrder.id}
Name: ${guestOrder.guestName}
Email: ${guestOrder.guestEmail}
Shipping Address: ${guestOrder.shippingAddress}
City: ${guestOrder.city || 'Not provided'}
Postal Code: ${guestOrder.postCode || 'Not provided'}
Country: ${guestOrder.country || 'Not provided'}

Order Details:
${itemDetails}

Total:
  Subtotal: PKR ${calculatedSubtotal.toFixed(2)}
  Taxes: PKR ${guestOrder.taxes.toFixed(2)}
  Shipping Fee: PKR ${guestOrder.shippingFee.toFixed(2)}
  Total: PKR ${guestOrder.totalPrice.toFixed(2)}

Payment Method: ${guestOrder.paymentMethod || 'Not specified'}

We will contact you via this email or on your contact number ${guestOrder.guestPhone || 'Not provided'} regarding your order status.
`;

    const emailContentAdmin = `
New Guest Order Placed - Order ID: ${guestOrder.id}

Guest Details:
  Name: ${guestOrder.guestName}
  Email: ${guestOrder.guestEmail}
  Phone: ${guestOrder.guestPhone || 'Not provided'}
  Shipping Address: ${guestOrder.shippingAddress}
  City: ${guestOrder.city || 'Not provided'}
  Postal Code: ${guestOrder.postCode || 'Not provided'}
  Country: ${guestOrder.country || 'Not provided'}

Order Details:
${itemDetails}

Total Bill:
  Subtotal: PKR ${calculatedSubtotal.toFixed(2)}
  Taxes: PKR ${guestOrder.taxes.toFixed(2)}
  Shipping Fee: PKR ${guestOrder.shippingFee.toFixed(2)}
  Total: PKR ${guestOrder.totalPrice.toFixed(2)}

Payment Method: ${guestOrder.paymentMethod || 'Not specified'}
Order Date: ${guestOrder.createdAt.toISOString()}
`;

    // Send email to guest
    try {
      await transporter.sendMail({
        from: `"Hadi Books Store" <${process.env.SMTP_USER}>`,
        to: guestOrder.guestEmail,
        subject: `Order Confirmation - ${guestOrder.id}`,
        text: emailContentGuest,
      });
      console.log('Guest order confirmation email sent to:', guestOrder.guestEmail);
    } catch (emailErr) {
      console.error('Failed to send guest confirmation email:', emailErr);
    }

    // Send email to admin
    try {
      await transporter.sendMail({
        from: `"Hadi Books Store" <${process.env.SMTP_USER}>`,
        to: process.env.SENDER_EMAIL,
        subject: `New Guest Order - ${guestOrder.id}`,
        text: emailContentAdmin,
      });
      console.log('Admin notification email sent for guest order:', guestOrder.id);
    } catch (emailErr) {
      console.error('Failed to send admin notification for guest order:', emailErr);
    }

    return res.status(201).json({
      success: true,
      message: 'Guest order placed',
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
    console.error('Create Guest Order Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to place guest order' });
  }
};

export { createGuestOrder };
