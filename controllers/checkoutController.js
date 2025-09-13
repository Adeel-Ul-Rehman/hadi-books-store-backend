import { PrismaClient } from '@prisma/client';
import validator from 'validator';
import upload, { cleanupTempFiles } from '../middleware/multer.js';
import cloudinary from '../config/cloudinary.js';

const prisma = new PrismaClient();

const calculateCheckout = async (req, res) => {
  try {
    const { items, shippingFee = 0, taxes = 0 } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid or empty items' });
    }

    let subtotal = 0;
    const validatedItems = [];

    for (const item of items) {
      if (!item.productId || !item.quantity || isNaN(item.quantity) || item.quantity < 1) {
        return res.status(400).json({ success: false, message: 'Invalid item data' });
      }

      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: { price: true, originalPrice: true, availability: true, name: true, image: true },
      });

      if (!product || !product.availability) {
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
    return res.status(500).json({ success: false, message: 'Failed to calculate checkout' });
  }
};

const processCheckout = async (req, res) => {
  try {
    const { address, city, postCode, country, mobileNumber, saveInfo, items, taxes = 0, shippingFee = 0, paymentMethod, onlinePaymentOption } = req.body;
    const userId = req.userId;

    // Validate input
    if (!userId || !items || !Array.isArray(items) || items.length === 0 || !address || !city || !postCode || !country || !mobileNumber) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    if (!validator.isMobilePhone(mobileNumber, 'any', { strictMode: false })) {
      return res.status(400).json({ success: false, message: 'Invalid mobile number' });
    }

    const allowedPaymentMethods = ['cod', 'online'];
    if (!allowedPaymentMethods.includes(paymentMethod)) {
      return res.status(400).json({ success: false, message: 'Invalid payment method. Choose either "cod" or "online".' });
    }

    // Validate online payment option if paymentMethod is 'online'
    let storedPaymentMethod = paymentMethod;
    if (paymentMethod === 'online') {
      const allowedOnlineOptions = ['JazzCash', 'EasyPaisa', 'BankTransfer'];
      if (!onlinePaymentOption || !allowedOnlineOptions.includes(onlinePaymentOption)) {
        return res.status(400).json({ success: false, message: 'Invalid online payment option. Choose either "JazzCash", "EasyPaisa", or "BankTransfer".' });
      }
      storedPaymentMethod = onlinePaymentOption; // Store the specific online payment option in the database
    }

    // Validate items
    let subtotal = 0;
    const validatedItems = [];
    for (const item of items) {
      if (!item.productId || !item.quantity || isNaN(item.quantity) || item.quantity < 1) {
        return res.status(400).json({ success: false, message: 'Invalid item data' });
      }
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: { id: true, price: true, availability: true, name: true, image: true },
      });
      if (!product || !product.availability) {
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
      updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          address,
          city,
          postCode,
          country,
          mobileNumber,
          shippingAddress: `${address}, ${city}, ${postCode}, ${country}`,
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
      const orderData = await tx.order.create({
        data: {
          userId,
          totalPrice,
          shippingAddress: `${address}, ${city}, ${postCode}, ${country}`,
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
    console.error('Process Checkout Error:', error.message, error.stack);
    return res.status(500).json({ success: false, message: 'Failed to process checkout' });
  }
};

const uploadPaymentProof = async (req, res) => {
  try {
    const { orderId } = req.body;
    const file = req.files?.proof?.[0];
    const userId = req.userId;

    if (!orderId || !file) {
      if (file) await cleanupTempFiles(file.path);
      return res.status(400).json({ success: false, message: 'Order ID and proof file are required' });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { userId: true, payment: true, totalPrice: true },
    });

    if (!order || order.userId !== userId) {
      if (file) await cleanupTempFiles(file.path);
      return res.status(403).json({ success: false, message: 'Unauthorized access or order not found' });
    }

    if (!order.payment) {
      if (file) await cleanupTempFiles(file.path);
      return res.status(400).json({ success: false, message: 'No payment associated with this order' });
    }

    if (order.payment.status !== 'pending') {
      if (file) await cleanupTempFiles(file.path);
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
    return res.status(500).json({ success: false, message: 'Failed to upload payment proof' });
  }
};

export { calculateCheckout, processCheckout, uploadPaymentProof, upload };