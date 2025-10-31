import { PrismaClient } from '@prisma/client';
import validator from 'validator';
import upload, { cleanupTempFiles } from '../middleware/multer.js';
import cloudinary from '../config/cloudinary.js';
import { sendOrderConfirmationEmail } from '../utils/emailHelper.js';

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

const calculateCheckout = async (req, res) => {
  try {
    const { items, shippingFee = 0, taxes = 0 } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      addCorsHeaders(req, res);
      return res.status(400).json({ success: false, message: 'Invalid or empty items' });
    }

    let subtotal = 0;
    const validatedItems = [];

    for (const item of items) {
      if (!item.productId || !item.quantity || isNaN(item.quantity) || item.quantity < 1) {
        addCorsHeaders(req, res);
        return res.status(400).json({ success: false, message: 'Invalid item data' });
      }

      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: { price: true, originalPrice: true, availability: true, name: true, image: true },
      });

      if (!product || !product.availability) {
        addCorsHeaders(req, res);
        return res.status(404).json({ success: false, message: `Product ${item.productId} not found or unavailable` });
      }

      const itemPrice = product.price * item.quantity;
      subtotal += itemPrice;

      validatedItems.push({
        productId: item.productId,
        quantity: item.quantity,
        price: product.price,
        originalPrice: product.originalPrice,
        productName: product.name,
        productImage: product.image,
      });
    }

    const total = subtotal + taxes + shippingFee;

    return res.status(200).json({
      success: true,
      message: 'Checkout calculated successfully',
      subtotal,
      taxes,
      shippingFee,
      total,
      items: validatedItems,
    });
  } catch (error) {
    console.error('Calculate Checkout Error:', error.message, error.stack);
    addCorsHeaders(req, res);
    return res.status(500).json({ success: false, message: 'Failed to calculate checkout' });
  }
};

const processCheckout = async (req, res) => {
  try {
    const { address, city, postCode, country, mobileNumber, saveInfo, items, taxes = 0, shippingFee = 0, paymentMethod, onlinePaymentOption } = req.body;
    const userId = req.userId;

    console.log('🛒 Process Checkout - User ID:', userId);
    console.log('📦 Items received:', items?.length || 0);
    console.log('📍 Address info:', { address, city, postCode, country, mobileNumber });

    // Validate input
    if (!userId) {
      console.error('❌ Checkout failed: No user ID');
      addCorsHeaders(req, res);
      return res.status(401).json({ success: false, message: 'User authentication required. Please log in again.' });
    }
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      console.error('❌ Checkout failed: No items in cart');
      addCorsHeaders(req, res);
      return res.status(400).json({ success: false, message: 'Your cart is empty. Please add items before checkout.' });
    }
    
    // Required: address, city, mobileNumber. Optional: postCode. Country defaults to Pakistan.
    if (!address || !city || !mobileNumber) {
      console.error('❌ Checkout failed: Missing required fields');
      addCorsHeaders(req, res);
      return res.status(400).json({ success: false, message: 'Address, city, and mobile number are required.' });
    }
    if (!validator.isMobilePhone(mobileNumber, 'any', { strictMode: false })) {
      addCorsHeaders(req, res);
      return res.status(400).json({ success: false, message: 'Invalid mobile number' });
    }
    
    // Set country to Pakistan by default
    const finalCountry = country || 'Pakistan';

    const allowedPaymentMethods = ['cod', 'online'];
    if (!allowedPaymentMethods.includes(paymentMethod)) {
      addCorsHeaders(req, res);
      return res.status(400).json({ success: false, message: 'Invalid payment method. Choose either "cod" or "online".' });
    }

    // Validate online payment option if paymentMethod is 'online'
    let storedPaymentMethod = paymentMethod;
    if (paymentMethod === 'online') {
      const allowedOnlineOptions = ['JazzCash', 'EasyPaisa', 'BankTransfer'];
      if (!onlinePaymentOption || !allowedOnlineOptions.includes(onlinePaymentOption)) {
        addCorsHeaders(req, res);
        return res.status(400).json({ success: false, message: 'Invalid online payment option. Choose either "JazzCash", "EasyPaisa", or "BankTransfer".' });
      }
      storedPaymentMethod = onlinePaymentOption; // Store the specific online payment option in the database
    }

    // Validate items
    let subtotal = 0;
    const validatedItems = [];
    for (const item of items) {
      if (!item.productId || !item.quantity || isNaN(item.quantity) || item.quantity < 1) {
        addCorsHeaders(req, res);
        return res.status(400).json({ success: false, message: 'Invalid item data' });
      }
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: { id: true, price: true, availability: true, name: true, image: true },
      });
      if (!product || !product.availability) {
        addCorsHeaders(req, res);
        return res.status(404).json({ success: false, message: `Product ${item.productId} not found or unavailable` });
      }
      const itemTotal = product.price * item.quantity;
      subtotal += itemTotal;
      validatedItems.push({
        productId: item.productId,
        quantity: item.quantity,
        price: product.price,
      });
    }

    const totalPrice = subtotal + taxes + shippingFee;

    // If saveInfo is true, update user profile
    let updatedUser = null;
    if (saveInfo) {
      // Build shipping address: address, city, [postCode], country
      const shippingAddressParts = [address, city];
      if (postCode) shippingAddressParts.push(postCode);
      shippingAddressParts.push(finalCountry);
      const shippingAddress = shippingAddressParts.join(', ');
      
      updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          address,
          city,
          postCode: postCode || null,
          country: finalCountry,
          mobileNumber,
          shippingAddress,
        },
        select: {
          id: true,
          name: true,
          lastName: true,
          email: true,
          address: true,
          city: true,
          postCode: true,
          country: true,
          mobileNumber: true,
          shippingAddress: true,
        },
      });
    }

    // Create order
    const order = await prisma.$transaction(async (tx) => {
      console.log('📝 Creating order for user:', userId);
      
      // Build shipping address: address, city, [postCode], country
      const orderShippingParts = [address, city];
      if (postCode) orderShippingParts.push(postCode);
      orderShippingParts.push(finalCountry);
      const orderShippingAddress = orderShippingParts.join(', ');
      
      const orderData = await tx.order.create({
        data: {
          userId,
          totalPrice,
          shippingAddress: orderShippingAddress,
          paymentMethod: storedPaymentMethod,
          taxes,
          shippingFee,
          items: {
            create: validatedItems.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
            })),
          },
        },
        include: { items: { include: { product: true } } },
      });

      console.log('✅ Order created successfully:', orderData.id);

      if (paymentMethod === 'online') {
        await tx.payment.create({
          data: {
            orderId: orderData.id,
            paymentMethod: storedPaymentMethod,
            status: 'pending',
            amount: totalPrice,
          },
        });
      }

      // Clear cart
      const cart = await tx.cart.findUnique({ where: { userId } });
      if (cart) {
        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      }

      return orderData;
    });

    // Prepare and send confirmation emails to logged-in user and admin (mirror guest order behavior)
    try {
      // Fetch user info for email
      const userRecord = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true, mobileNumber: true } });

      const itemDetails = order.items
        .map(item => `Product: ${item.product.name}, Quantity: ${item.quantity}, Price: PKR ${item.price.toFixed(2)}`)
        .join('\n');

      const calculatedSubtotal = subtotal; // from earlier calculation

      const emailContentUser = `
Thank you for your order!

Order ID: ${order.id}
Name: ${userRecord?.name || 'Customer'}
Email: ${userRecord?.email || 'Not provided'}
Shipping Address: ${order.shippingAddress}
City: ${order.city || 'Not provided'}
Postal Code: ${order.postCode || 'Not provided'}
Country: ${order.country || 'Not provided'}

Order Details:
${itemDetails}

Total:
  Subtotal: PKR ${calculatedSubtotal.toFixed(2)}
  Taxes: PKR ${order.taxes.toFixed(2)}
  Shipping Fee: PKR ${order.shippingFee.toFixed(2)}
  Total: PKR ${order.totalPrice.toFixed(2)}

Payment Method: ${order.paymentMethod || 'Not specified'}

We will contact you via this email or on your contact number ${mobileNumber || userRecord?.mobileNumber || 'Not provided'} regarding your order status.
`;

      const emailContentAdmin = `
New Order Placed - Order ID: ${order.id}

Customer Details:
  Name: ${userRecord?.name || 'Customer'}
  Email: ${userRecord?.email || 'Not provided'}
  Phone: ${mobileNumber || userRecord?.mobileNumber || 'Not provided'}
  Shipping Address: ${order.shippingAddress}
  City: ${order.city || 'Not provided'}
  Postal Code: ${order.postCode || 'Not provided'}
  Country: ${order.country || 'Not provided'}

Order Details:
${itemDetails}

Total Bill:
  Subtotal: PKR ${calculatedSubtotal.toFixed(2)}
  Taxes: PKR ${order.taxes.toFixed(2)}
  Shipping Fee: PKR ${order.shippingFee.toFixed(2)}
  Total: PKR ${order.totalPrice.toFixed(2)}

Payment Method: ${order.paymentMethod || 'Not specified'}
Order Date: ${order.createdAt.toISOString()}
`;

      // Send email to user using professional HTML template
      if (userRecord?.email) {
        try {
          await sendOrderConfirmationEmail(
            userRecord.email,
            userRecord.name || 'Customer',
            {
              orderId: order.id.substring(0, 8),
              totalAmount: order.totalPrice.toFixed(2),
              paymentMethod: order.paymentMethod || 'Not specified'
            }
          );
          console.log('✅ Order confirmation email sent to:', userRecord.email);
        } catch (emailErr) {
          console.error('❌ Failed to send order confirmation email to user:', emailErr);
        }
      }

      // Send admin notification (keep as text for backend processing)
      try {
        const { default: resend } = await import('../config/resend.js');
        await resend.emails.send({
          from: 'Hadi Books Store <noreply@hadibookstore.shop>',
          to: 'hadibooksstore01@gmail.com',
          subject: `[USER ORDER] #${order.id.substring(0, 8)} - Hadi Books Store`,
          replyTo: userRecord?.email || 'hadibooksstore01@gmail.com',
          text: emailContentAdmin,
        });
        console.log('✅ Admin notification email sent for order:', order.id);
      } catch (emailErr) {
        console.error('❌ Failed to send admin notification for order:', emailErr);
      }
    } catch (err) {
      console.error('Error preparing/sending order emails for logged-in user:', err);
    }

    return res.status(201).json({
      success: true,
      message: 'Checkout processed and order placed successfully',
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
      updatedUser: saveInfo ? {
        id: updatedUser.id,
        name: updatedUser.name,
        lastName: updatedUser.lastName,
        email: updatedUser.email,
        address: updatedUser.address,
        city: updatedUser.city,
        postCode: updatedUser.postCode,
        country: updatedUser.country,
        mobileNumber: updatedUser.mobileNumber,
        shippingAddress: updatedUser.shippingAddress,
      } : null,
    });
  } catch (error) {
    console.error('❌ Process Checkout Error:', error.message);
    console.error('Stack trace:', error.stack);
    console.error('User ID:', req.userId);
    console.error('Request body:', JSON.stringify(req.body, null, 2));
    addCorsHeaders(req, res);
    return res.status(500).json({ success: false, message: 'Failed to process checkout. Please try again or contact support.' });
  }
};

const uploadPaymentProof = async (req, res) => {
  try {
    const { orderId } = req.body;
    const file = req.files?.proof?.[0];
    const userId = req.userId;

    if (!orderId || !file) {
      if (file) await cleanupTempFiles(file.path);
      addCorsHeaders(req, res);
      return res.status(400).json({ success: false, message: 'Order ID and proof file are required' });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { userId: true, payment: true, totalPrice: true },
    });

    if (!order || order.userId !== userId) {
      if (file) await cleanupTempFiles(file.path);
      addCorsHeaders(req, res);
      return res.status(403).json({ success: false, message: 'Unauthorized access or order not found' });
    }

    if (!order.payment) {
      if (file) await cleanupTempFiles(file.path);
      addCorsHeaders(req, res);
      return res.status(400).json({ success: false, message: 'No payment associated with this order' });
    }

    if (order.payment.status !== 'pending') {
      if (file) await cleanupTempFiles(file.path);
      addCorsHeaders(req, res);
      return res.status(400).json({ success: false, message: 'Payment is not in pending status' });
    }

    // Upload to Cloudinary
    const uploadResult = await cloudinary.uploader.upload(file.path, {
      folder: 'hadi_books_store/payment_proofs',
      public_id: `proof_${orderId}_${Date.now()}`,
    });
    await cleanupTempFiles(file.path); // Clean up the temporary file

    const proofUrl = uploadResult.secure_url;

    await prisma.payment.update({
      where: { id: order.payment.id },
      data: { paymentProof: proofUrl },
    });

    return res.status(200).json({
      success: true,
      message: 'Payment proof uploaded successfully. Our team will verify it soon. You will be notified once your payment is verified and your order is confirmed.',
    });
  } catch (error) {
    if (req.files?.proof?.[0]) await cleanupTempFiles(req.files.proof[0].path);
    console.error('Upload Payment Proof Error:', error.message, error.stack);
    addCorsHeaders(req, res);
    return res.status(500).json({ success: false, message: 'Failed to upload payment proof' });
  }
};

const uploadGuestPaymentProof = async (req, res) => {
  try {
    const { orderId, guestEmail } = req.body;
    const file = req.files?.proof?.[0];

    if (!orderId || !guestEmail || !file) {
      if (file) await cleanupTempFiles(file.path);
      addCorsHeaders(req, res);
      return res.status(400).json({ success: false, message: 'Order ID, guest email and proof file are required' });
    }

    const guestOrder = await prisma.guestOrder.findUnique({
      where: { id: orderId },
      select: { guestEmail: true, payment: true, totalPrice: true },
    });

    if (!guestOrder || guestOrder.guestEmail !== guestEmail) {
      if (file) await cleanupTempFiles(file.path);
      addCorsHeaders(req, res);
      return res.status(403).json({ success: false, message: 'Unauthorized access or guest order not found' });
    }

    if (!guestOrder.payment) {
      if (file) await cleanupTempFiles(file.path);
      addCorsHeaders(req, res);
      return res.status(400).json({ success: false, message: 'No payment associated with this guest order' });
    }

    if (guestOrder.payment.status !== 'pending') {
      if (file) await cleanupTempFiles(file.path);
      addCorsHeaders(req, res);
      return res.status(400).json({ success: false, message: 'Payment is not in pending status' });
    }

    // Upload to Cloudinary
    const uploadResult = await cloudinary.uploader.upload(file.path, {
      folder: 'hadi_books_store/guest_payment_proofs',
      public_id: `guest_proof_${orderId}_${Date.now()}`,
    });
    await cleanupTempFiles(file.path);

    const proofUrl = uploadResult.secure_url;

    await prisma.guestPayment.update({
      where: { id: guestOrder.payment.id },
      data: { paymentProof: proofUrl },
    });

    return res.status(200).json({
      success: true,
      message: 'Payment proof uploaded successfully. Our team will verify it soon. You will be notified once your payment is verified and your order is confirmed.',
    });
  } catch (error) {
    if (req.files?.proof?.[0]) await cleanupTempFiles(req.files.proof[0].path);
    console.error('Upload Guest Payment Proof Error:', error.message, error.stack);
    addCorsHeaders(req, res);
    return res.status(500).json({ success: false, message: 'Failed to upload guest payment proof' });
  }
};

export { calculateCheckout, processCheckout, uploadPaymentProof, uploadGuestPaymentProof, upload };
