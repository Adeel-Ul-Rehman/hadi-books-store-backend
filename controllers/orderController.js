import { PrismaClient } from '@prisma/client';
import transporter from '../config/transporter.js';

const prisma = new PrismaClient();

const createOrder = async (req, res) => {
  try {
    const { items, totalPrice, shippingAddress, paymentMethod, taxes = 0, shippingFee = 0 } = req.body;
    const userId = req.userId;

    if (!userId || !items || !Array.isArray(items) || items.length === 0 || !totalPrice || !shippingAddress || !paymentMethod) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

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

    const order = await prisma.$transaction(async (tx) => {
      const orderData = await tx.order.create({
        data: {
          userId,
          totalPrice,
          shippingAddress,
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
        include: { items: { include: { product: true } } },
      });

      const cart = await tx.cart.findUnique({ where: { userId } });
      if (cart) {
        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      }

      return orderData;
    });

    // Fetch user details for email
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, phoneNumber: true },
    });

    // Prepare email content in plain text
    const itemDetails = order.items
      .map(item => `Product: ${item.product.name}, Quantity: ${item.quantity}, Price: PKR ${item.price.toFixed(2)}`)
      .join('\n');
    const emailContent = `
New Order Placed - Order ID: ${order.id}
User Details:
  Name: ${user?.name || 'Unknown'}
  Email: ${user?.email || 'Unknown'}
  Phone Number: ${user?.phoneNumber || 'Not provided'}
  Shipping Address: ${order.shippingAddress}
Order Details:
${itemDetails}
Total Bill:
  Subtotal: PKR ${calculatedSubtotal.toFixed(2)}
  Taxes: PKR ${order.taxes.toFixed(2)}
  Shipping Fee: PKR ${order.shippingFee.toFixed(2)}
  Total: PKR ${order.totalPrice.toFixed(2)}
Payment Method: ${order.paymentMethod}
Order Date: ${order.createdAt.toISOString()}
`;

    // Send email to SENDER_EMAIL
    try {
      await transporter.sendMail({
        from: `"Hadi Books Store" <${process.env.SMTP_USER}>`,
        to: process.env.SENDER_EMAIL,
        subject: `New Order Placed - Order ID: ${order.id}`,
        text: emailContent,
      });
      console.log('Order confirmation email sent to:', process.env.SENDER_EMAIL);
    } catch (emailError) {
      console.error('Failed to send order confirmation email:', emailError);
      // Do not fail the order creation if email fails
    }

    return res.status(201).json({
      success: true,
      message: 'Order placed',
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
    console.error('Create Order Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to place order' });
  }
};

const getUserOrders = async (req, res) => {
  try {
    const userId = req.userId; 

    if (!userId) {
      return res.status(400).json({ success: false, message: 'Invalid userId' });
    }

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

    return res.status(200).json({
      success: true,
      message: 'Orders retrieved',
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
    console.error('Get User Orders Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve orders' });
  }
};

export { createOrder, getUserOrders };