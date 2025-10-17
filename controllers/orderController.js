import { PrismaClient } from '@prisma/client';
import resend from '../config/resend.js';
import validator from 'validator';

const prisma = new PrismaClient();

const createOrder = async (req, res) => {
  try {
    const { items, totalPrice, shippingAddress, paymentMethod, taxes = 0, shippingFee = 0 } = req.body;
    const userId = req.userId;

    console.log('📦 User order request received:', {
      userId,
      itemCount: items?.length,
      paymentMethod
    });

    // Enhanced validation
    if (!userId || !items || !Array.isArray(items) || items.length === 0 || !totalPrice || !shippingAddress || !paymentMethod) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: items, total price, shipping address, and payment method are required' 
      });
    }

    // Validate user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Validate items
    for (const item of items) {
      if (!item.productId || !item.quantity || isNaN(item.quantity) || item.quantity < 1 || !item.price) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid item data: productId, quantity, and price are required' 
        });
      }
      
      const product = await prisma.product.findUnique({ 
        where: { id: item.productId } 
      });
      
      if (!product) {
        return res.status(404).json({ 
          success: false, 
          message: `Product ${item.productId} not found` 
        });
      }
      
      if (!product.availability) {
        return res.status(400).json({ 
          success: false, 
          message: `Product "${product.name}" is not available` 
        });
      }
      
      // Allow minor floating point differences
      if (Math.abs(item.price - product.price) > 0.01) {
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
      return res.status(400).json({ 
        success: false, 
        message: `Total price mismatch. Calculated: ${calculatedTotal.toFixed(2)}, Received: ${totalPrice}` 
      });
    }

    // Validate payment method
    const allowedPaymentMethods = ['cod', 'JazzCash', 'EasyPaisa', 'BankTransfer'];
    if (!allowedPaymentMethods.includes(paymentMethod)) {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid payment method. Must be one of: ${allowedPaymentMethods.join(', ')}` 
      });
    }

    const order = await prisma.$transaction(async (tx) => {
      console.log('🔄 Creating user order transaction...');
      
      const orderData = await tx.order.create({
        data: {
          userId,
          totalPrice,
          shippingAddress: shippingAddress.trim(),
          paymentMethod,
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
          } 
        },
      });

      console.log('✅ User order created:', orderData.id);

      // Clear user's cart after successful order
      const cart = await tx.cart.findUnique({ where: { userId } });
      if (cart) {
        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
        console.log('✅ User cart cleared after order');
      }

      // Create payment record for online payments
      if (paymentMethod !== 'cod') {
        await tx.payment.create({
          data: {
            orderId: orderData.id,
            paymentMethod: paymentMethod,
            amount: orderData.totalPrice,
            status: 'pending',
          },
        });
        console.log('✅ Payment record created for online payment');
      }

      return orderData;
    });

    console.log('✅ User order transaction completed:', order.id);

    // Prepare email content
    const itemDetails = order.items
      .map(item => `• ${item.product.name} - Qty: ${item.quantity} - Price: PKR ${item.price.toFixed(2)}`)
      .join('\n');

    const emailContent = `
NEW ORDER PLACED - ORDER ID: ${order.id}

User Details:
─────────────
Name: ${user.name}${user.lastName ? ' ' + user.lastName : ''}
Email: ${user.email}
Phone: ${user.mobileNumber || 'Not provided'}

Shipping Address:
────────────────
${order.shippingAddress}

Order Details:
──────────────
${itemDetails}

Order Total:
────────────
Subtotal: PKR ${calculatedSubtotal.toFixed(2)}
Taxes: PKR ${order.taxes.toFixed(2)}
Shipping Fee: PKR ${order.shippingFee.toFixed(2)}
Total: PKR ${order.totalPrice.toFixed(2)}

Payment Method: ${order.paymentMethod}
Order Date: ${order.createdAt.toISOString()}
`;

    // Send email to admin
    try {
      await resend.emails.send({
        from: process.env.SENDER_EMAIL || 'onboarding@resend.dev',
        to: process.env.SENDER_EMAIL,
        subject: `[USER ORDER] New Order - ${order.id}`,
        text: emailContent,
      });
      console.log('✅ Order confirmation email sent to admin');
    } catch (emailError) {
      console.error('❌ Failed to send order confirmation email:', emailError);
      // Don't fail the order if email fails
    }

    return res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      order: {
        id: order.id,
        userId: order.userId,
        totalPrice: order.totalPrice,
        status: order.status,
        paymentStatus: order.paymentStatus,
        shippingAddress: order.shippingAddress,
        paymentMethod: order.paymentMethod,
        taxes: order.taxes,
        shippingFee: order.shippingFee,
        createdAt: order.createdAt,
        items: order.items.map(item => ({
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
    console.error('❌ Create Order Error:', error);
    
    // More specific error messages
    if (error.code === 'P2002') {
      return res.status(400).json({ 
        success: false, 
        message: 'Order creation failed due to duplicate entry' 
      });
    }
    
    if (error.message.includes('connect')) {
      return res.status(500).json({ 
        success: false, 
        message: 'Database connection error. Please try again.' 
      });
    }
    
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to place order. Please try again.' 
    });
  }
};

const getUserOrders = async (req, res) => {
  try {
    const userId = req.userId; 

    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID is required' 
      });
    }

    console.log('📋 Fetching orders for user:', userId);

    const orders = await prisma.order.findMany({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                image: true,
                price: true,
                originalPrice: true,
              },
            },
          },
        },
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`✅ Retrieved ${orders.length} orders for user ${userId}`);

    return res.status(200).json({
      success: true,
      message: 'Orders retrieved successfully',
      orders: orders.map(order => ({
        id: order.id,
        userId: order.userId,
        totalPrice: order.totalPrice,
        status: order.status,
        paymentStatus: order.paymentStatus,
        shippingAddress: order.shippingAddress,
        paymentMethod: order.paymentMethod,
        shippingMethod: order.shippingMethod,
        trackingId: order.trackingId,
        estimatedDelivery: order.estimatedDelivery,
        taxes: order.taxes,
        shippingFee: order.shippingFee,
        createdAt: order.createdAt,
        items: order.items.map(item => ({
          id: item.id,
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          product: {
            id: item.product.id,
            name: item.product.name,
            image: item.product.image,
            price: item.product.price,
            originalPrice: item.product.originalPrice,
          },
        })),
        payment: order.payment ? {
          id: order.payment.id,
          paymentMethod: order.payment.paymentMethod,
          status: order.payment.status,
          amount: order.payment.amount,
          transactionId: order.payment.transactionId,
          createdAt: order.payment.createdAt,
        } : null,
      })),
    });
  } catch (error) {
    console.error('❌ Get User Orders Error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve orders' 
    });
  }
};

export { createOrder, getUserOrders };