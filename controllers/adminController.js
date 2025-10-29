import { PrismaClient } from '@prisma/client';
import cloudinary from '../config/cloudinary.js';
import fs from 'fs/promises';
import upload, { cleanupTempFiles } from '../middleware/multer.js';

const prisma = new PrismaClient();

const convertBigIntToNumber = (obj) => {
  if (obj && typeof obj === 'object') {
    for (const key in obj) {
      if (typeof obj[key] === 'bigint') {
        obj[key] = Number(obj[key]);
      } else if (typeof obj[key] === 'object') {
        convertBigIntToNumber(obj[key]);
      }
    }
  }
  return obj;
};



const addProduct = async (req, res) => {
  try {
    const { name, description, price, originalPrice, category, subCategories, author, isbn, language } = req.body;
    if (!name || !description || !price || !category || !author || !language) {
      return res.status(400).json({ success: false, message: 'Required fields missing' });
    }

    if (name.length > 255) return res.status(400).json({ success: false, message: 'Name too long (max 255 chars)' });
    if (description.length > 1000) return res.status(400).json({ success: false, message: 'Description too long (max 1000 chars)' });
    if (isNaN(price) || parseFloat(price) <= 0) return res.status(400).json({ success: false, message: 'Invalid price' });
    if (originalPrice && (isNaN(originalPrice) || parseFloat(originalPrice) <= 0)) {
      return res.status(400).json({ success: false, message: 'Invalid original price' });
    }

    const imagePath = req.files?.image?.[0]?.path;
    if (!imagePath) return res.status(400).json({ success: false, message: 'Image required' });

    const uploadResult = await cloudinary.uploader.upload(imagePath, {
      folder: 'hadi_books_store/products',
      public_id: `product_${name.replace(/\s+/g, '_')}_${Date.now()}`,
    });
    await fs.unlink(imagePath);

    let parsedSubCategories = [];
    if (subCategories) {
      try {
        parsedSubCategories = typeof subCategories === 'string' ? JSON.parse(subCategories) : subCategories;
      } catch (error) {
        parsedSubCategories = [];
      }
    }

    const product = await prisma.product.create({
      data: {
        name,
        description,
        price: parseFloat(price),
        originalPrice: originalPrice ? parseFloat(originalPrice) : null,
        image: uploadResult.secure_url,
        category,
        subCategories: parsedSubCategories,
        author,
        isbn: isbn || null,
        language,
        date: BigInt(Date.now()),
        bestseller: false,
        availability: true,
      },
      include: {
        reviews: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                lastName: true,
                profilePicture: true,
              },
            },
          },
        },
      },
    });

    // Convert BigInt to Number for response
    const productResponse = convertBigIntToNumber({ ...product });

    return res.status(201).json({
      success: true,
      message: 'Product added successfully',
      product: productResponse,
    });
  } catch (error) {
    if (req.files?.image?.[0]) await fs.unlink(req.files.image[0].path);
    console.error('Add Product Error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ success: false, message: 'Product name or ISBN already exists' });
    }
    return res.status(500).json({ success: false, message: 'Failed to add product' });
  }
};

const listProducts = async (req, res) => {
  try {
    const { category, page = 1, limit = 10, search = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const whereClause = {};
    if (category) whereClause.category = category;
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { author: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where: whereClause,
        orderBy: { date: 'desc' },
        skip: skip,
        take: parseInt(limit),
        include: {
          reviews: {
            include: {
              user: { 
                select: { 
                  id: true, 
                  name: true, 
                  lastName: true, 
                  profilePicture: true 
                } 
              },
            },
          },
        },
      }),
      prisma.product.count({ where: whereClause }),
    ]);

    // Convert BigInt to Number for all products
    const productsResponse = products.map(product => convertBigIntToNumber({ ...product }));

    const message = total === 0 ? 'No products available yet' : 'Products retrieved successfully';

    return res.status(200).json({
      success: true,
      message,
      products: productsResponse,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('List Products Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve products' });
  }
};

const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, originalPrice, category, subCategories, author, isbn, language, bestseller } = req.body;

    const existingProduct = await prisma.product.findUnique({ where: { id } });
    if (!existingProduct) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (description) updateData.description = description;
    if (price) updateData.price = parseFloat(price);
    if (originalPrice !== undefined) {
      updateData.originalPrice = originalPrice ? parseFloat(originalPrice) : null;
    }
    if (category) updateData.category = category;
    if (subCategories !== undefined) {
      try {
        updateData.subCategories = typeof subCategories === 'string' && subCategories.trim() !== ''
          ? JSON.parse(subCategories)
          : Array.isArray(subCategories)
            ? subCategories
            : [];
        if (!Array.isArray(updateData.subCategories)) {
          updateData.subCategories = [];
        }
      } catch (error) {
        console.error('SubCategories parsing error:', error);
        return res.status(400).json({ success: false, message: 'Invalid subCategories format' });
      }
    }
    if (author) updateData.author = author;
    if (isbn) updateData.isbn = isbn || null;
    if (language) updateData.language = language;
    if (bestseller !== undefined) updateData.bestseller = bestseller === 'true' || bestseller === true;

    if (req.files?.image?.[0]?.path) {
      const imagePath = req.files.image[0].path;
      const uploadResult = await cloudinary.uploader.upload(imagePath, {
        folder: 'hadi_books_store/products',
        public_id: `product_${(name || existingProduct.name).replace(/\s+/g, '_')}_${Date.now()}`,
      });
      await fs.unlink(imagePath);
      updateData.image = uploadResult.secure_url;

      try {
        const publicId = existingProduct.image.split('/').slice(-2).join('/').split('.')[0];
        await cloudinary.uploader.destroy(publicId);
      } catch (error) {
        console.error('Error deleting old image:', error);
      }
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: updateData,
      include: {
        reviews: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                lastName: true,
                profilePicture: true,
              },
            },
          },
        },
      },
    });

    const productResponse = convertBigIntToNumber({ ...updatedProduct });

    return res.status(200).json({
      success: true,
      message: 'Product updated',
      product: productResponse,
    });
  } catch (error) {
    if (req.files?.image?.[0]) await fs.unlink(req.files.image[0].path);
    console.error('Update Product Error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ success: false, message: 'Product name or ISBN already exists' });
    }
    return res.status(500).json({ success: false, message: 'Failed to update product' });
  }
};

const removeProduct = async (req, res) => {
  try {
    const { id } = req.params;
    
    const product = await prisma.product.findUnique({ 
      where: { id },
      include: {
        reviews: true,
        wishlistItems: true,
        cartItems: true,
        orderItems: true
      }
    });
    
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    await prisma.$transaction(async (tx) => {
      if (product.reviews.length > 0) {
        await tx.review.deleteMany({
          where: { productId: id }
        });
      }

      if (product.wishlistItems.length > 0) {
        await tx.wishlistItem.deleteMany({
          where: { productId: id }
        });
      }

      if (product.cartItems.length > 0) {
        await tx.cartItem.deleteMany({
          where: { productId: id }
        });
      }

      if (product.orderItems.length > 0) {
        await tx.orderItem.deleteMany({
          where: { productId: id }
        });
      }

      try {
        const publicId = product.image.split('/').slice(-2).join('/').split('.')[0];
        await cloudinary.uploader.destroy(publicId);
      } catch (error) {
        console.error('Error deleting image from Cloudinary:', error);
      }

      await tx.product.delete({ where: { id } });
    });

    return res.status(200).json({ success: true, message: 'Product removed successfully' });
  } catch (error) {
    console.error('Remove Product Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to remove product' });
  }
};

const singleProduct = async (req, res) => {
  try {
    const { id } = req.params;
    
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        reviews: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                lastName: true,
                profilePicture: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    const productResponse = convertBigIntToNumber({ ...product });

    return res.status(200).json({
      success: true,
      message: 'Product retrieved successfully',
      product: productResponse,
    });
  } catch (error) {
    console.error('Single Product Error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve product' 
    });
  }
};

const toggleAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({ 
      where: { id },
      include: {
        reviews: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                lastName: true,
                profilePicture: true,
              },
            },
          },
        },
      },
    });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: { availability: !product.availability },
      include: {
        reviews: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                lastName: true,
                profilePicture: true,
              },
            },
          },
        },
      },
    });

    const productResponse = convertBigIntToNumber({ ...updatedProduct });

    return res.status(200).json({
      success: true,
      message: 'Product availability updated successfully',
      product: productResponse,
    });
  } catch (error) {
    console.error('Toggle Availability Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to toggle availability' });
  }
};

const toggleBestseller = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({ 
      where: { id },
      include: {
        reviews: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                lastName: true,
                profilePicture: true,
              },
            },
          },
        },
      },
    });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: { bestseller: !product.bestseller },
      include: {
        reviews: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                lastName: true,
                profilePicture: true,
              },
            },
          },
        },
      },
    });

    const productResponse = convertBigIntToNumber({ ...updatedProduct });

    return res.status(200).json({
      success: true,
      message: 'Product bestseller status updated successfully',
      product: productResponse,
    });
  } catch (error) {
    console.error('Toggle Bestseller Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to toggle bestseller status' });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, trackingId, shippingMethod, estimatedDelivery, paymentStatus } = req.body;

    if (!id || !status) {
      return res.status(400).json({ success: false, message: 'Order ID and status are required' });
    }

    const validStatuses = ['pending', 'confirmed', 'processing', 'ready_for_shipment', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'refunded', 'partially_refunded'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    // Validate shipping method if provided
    const validShippingMethods = ['tcs', 'leopard', 'trax', 'postex', 'pakistan_post', 'other'];
    if (shippingMethod && !validShippingMethods.includes(shippingMethod)) {
      return res.status(400).json({ success: false, message: 'Invalid shipping method' });
    }

    // Validate payment status if provided
    const validPaymentStatuses = ['paid', 'not_paid', 'pending', 'failed'];
    if (paymentStatus && !validPaymentStatuses.includes(paymentStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid payment status' });
    }

    const updateData = { status };
    if (trackingId) updateData.trackingId = trackingId;
    if (shippingMethod) updateData.shippingMethod = shippingMethod;
    if (estimatedDelivery) updateData.estimatedDelivery = new Date(estimatedDelivery);
    if (paymentStatus) updateData.paymentStatus = paymentStatus;

    // Try updating a regular user order first; if not found, try guest order
    // Start a transaction to update both order/payment
    try {
      const updatedOrder = await prisma.$transaction(async (prismaTx) => {
        // Attempt to find regular order
        const existing = await prismaTx.order.findUnique({ where: { id } });
        if (existing) {
          const order = await prismaTx.order.update({
            where: { id },
            data: updateData,
            include: {
              items: { include: { product: true } },
              user: { select: { id: true, name: true, lastName: true, email: true, mobileNumber: true, profilePicture: true } },
              payment: true,
            },
          });

          if (paymentStatus && order.payment) {
            await prismaTx.payment.update({ where: { orderId: id }, data: { status: paymentStatus === 'paid' ? 'completed' : paymentStatus === 'failed' ? 'failed' : paymentStatus } });
            order.payment.status = paymentStatus === 'paid' ? 'completed' : paymentStatus === 'failed' ? 'failed' : paymentStatus;
          }

          return { type: 'user', order };
        }

        // Not a regular order — check guest orders
        const existingGuest = await prismaTx.guestOrder.findUnique({ where: { id } });
        if (existingGuest) {
          const guestOrder = await prismaTx.guestOrder.update({
            where: { id },
            data: updateData,
            include: { items: { include: { product: true } }, payment: true },
          });

          if (paymentStatus && guestOrder.payment) {
            await prismaTx.guestPayment.update({ where: { orderId: id }, data: { status: paymentStatus === 'paid' ? 'completed' : paymentStatus === 'failed' ? 'failed' : paymentStatus } });
            guestOrder.payment.status = paymentStatus === 'paid' ? 'completed' : paymentStatus === 'failed' ? 'failed' : paymentStatus;
          }

          return { type: 'guest', guestOrder };
        }

        throw new Error('Order not found');
      });

      if (updatedOrder.type === 'user') {
        const o = updatedOrder.order;
        return res.status(200).json({ success: true, message: 'Order status updated', order: {
          id: o.id,
          userId: o.userId,
          totalPrice: o.totalPrice,
          status: o.status,
          paymentStatus: o.paymentStatus,
          shippingAddress: o.shippingAddress,
          paymentMethod: o.paymentMethod,
          shippingMethod: o.shippingMethod,
          trackingId: o.trackingId,
          estimatedDelivery: o.estimatedDelivery,
          taxes: o.taxes,
          shippingFee: o.shippingFee,
          createdAt: o.createdAt,
          user: o.user,
          payment: o.payment,
          items: o.items.map(item => ({ id: item.id, productId: item.productId, quantity: item.quantity, price: item.price, product: { id: item.product.id, name: item.product.name, image: item.product.image } })),
        }});
      } else {
        const go = updatedOrder.guestOrder;
        return res.status(200).json({ success: true, message: 'Guest order status updated', order: {
          id: go.id,
          userId: null,
          isGuest: true,
          guest: { name: go.guestName, email: go.guestEmail, phone: go.guestPhone, city: go.city || null, postCode: go.postCode || null, country: go.country || null },
          totalPrice: go.totalPrice,
          status: go.status,
          paymentStatus: go.paymentStatus,
          shippingAddress: go.shippingAddress,
          city: go.city || null,
          postCode: go.postCode || null,
          country: go.country || null,
          paymentMethod: go.paymentMethod,
          shippingMethod: go.shippingMethod,
          trackingId: go.trackingId,
          estimatedDelivery: go.estimatedDelivery,
          taxes: go.taxes,
          shippingFee: go.shippingFee,
          createdAt: go.createdAt,
          user: null,
          payment: go.payment,
          items: go.items.map(item => ({ id: item.id, productId: item.productId, quantity: item.quantity, price: item.price, product: { id: item.product.id, name: item.product.name, image: item.product.image } })),
        }});
      }
    } catch (err) {
      console.error('Update Order Status Error (not found):', err);
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
  } catch (error) {
    console.error('Update Order Status Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update order status' });
  }
};

const getOrders = async (req, res) => {
  try {
    const { status, paymentStatus } = req.query;
    const whereClause = {};
    
    if (status) {
      whereClause.status = status;
    }
    
    if (paymentStatus) {
      whereClause.paymentStatus = paymentStatus;
    }

      // Fetch regular orders
      const orders = await prisma.order.findMany({
        where: whereClause,
        include: {
          user: { select: { id: true, name: true, lastName: true, email: true, mobileNumber: true, profilePicture: true } },
          items: { include: { product: { select: { id: true, name: true, image: true, price: true, originalPrice: true } } } },
          payment: true,
        },
      });

      // Fetch guest orders (apply same filters where possible)
      const guestWhere = {};
      if (status) guestWhere.status = status;
      if (paymentStatus) guestWhere.paymentStatus = paymentStatus;

      const guestOrders = await prisma.guestOrder.findMany({
        where: guestWhere,
        include: { items: { include: { product: true } }, payment: true },
      });

      // Normalize both lists into a single array with an isGuest flag
      const normalizedUserOrders = orders.map(o => ({
        id: o.id,
        userId: o.userId,
        isGuest: false,
        totalPrice: o.totalPrice,
        status: o.status,
        paymentStatus: o.paymentStatus,
        shippingAddress: o.shippingAddress,
        paymentMethod: o.paymentMethod,
        shippingMethod: o.shippingMethod,
        trackingId: o.trackingId,
        estimatedDelivery: o.estimatedDelivery,
        taxes: o.taxes,
        shippingFee: o.shippingFee,
        createdAt: o.createdAt,
        user: o.user,
        guest: null,
        payment: o.payment,
        items: o.items.map(item => ({ id: item.id, productId: item.productId, quantity: item.quantity, price: item.price, product: { id: item.product.id, name: item.product.name, image: item.product.image, price: item.product.price, originalPrice: item.product.originalPrice } })),
      }));

      const normalizedGuestOrders = guestOrders.map(go => ({
        id: go.id,
        userId: null,
        isGuest: true,
        guest: { name: go.guestName, email: go.guestEmail, phone: go.guestPhone, city: go.city || null, postCode: go.postCode || null, country: go.country || null },
        totalPrice: go.totalPrice,
        status: go.status,
        paymentStatus: go.paymentStatus,
        shippingAddress: go.shippingAddress,
        city: go.city || null,
        postCode: go.postCode || null,
        country: go.country || null,
        paymentMethod: go.paymentMethod,
        shippingMethod: go.shippingMethod,
        trackingId: go.trackingId,
        estimatedDelivery: go.estimatedDelivery,
        taxes: go.taxes,
        shippingFee: go.shippingFee,
        createdAt: go.createdAt,
        user: null,
        payment: go.payment,
        items: go.items.map(item => ({ id: item.id, productId: item.productId, quantity: item.quantity, price: item.price, product: { id: item.product.id, name: item.product.name, image: item.product.image, price: item.product.price, originalPrice: item.product.originalPrice } })),
      }));

      const combined = [...normalizedUserOrders, ...normalizedGuestOrders];
      // Sort by createdAt desc
      combined.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      console.log(`📦 Orders fetched from database: ${combined.length} total (${normalizedUserOrders.length} user orders, ${normalizedGuestOrders.length} guest orders)`);

      const message = combined.length === 0 ? 'No orders available yet' : 'Orders retrieved';

      return res.status(200).json({ success: true, message, orders: combined });
  } catch (error) {
    console.error('Get Orders Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve orders' });
  }
};

const deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if order exists
    const order = await prisma.order.findUnique({
      where: { id }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Delete the order (cascade will handle items and payment)
    await prisma.order.delete({
      where: { id }
    });

    console.log(`🗑️ Deleted user order ${id} from database (cascade deleted items and payment)`);
    return res.status(200).json({ success: true, message: 'Order deleted successfully from database' });
  } catch (error) {
    console.error('Delete Order Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete order' });
  }
};

const deleteGuestOrder = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if guest order exists
    const guestOrder = await prisma.guestOrder.findUnique({
      where: { id }
    });

    if (!guestOrder) {
      return res.status(404).json({ success: false, message: 'Guest order not found' });
    }

    // Delete the guest order (cascade will handle items and payment)
    await prisma.guestOrder.delete({
      where: { id }
    });

    console.log(`🗑️ Deleted guest order ${id} from database (cascade deleted items and payment)`);
    return res.status(200).json({ success: true, message: 'Guest order deleted successfully from database' });
  } catch (error) {
    console.error('Delete Guest Order Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete guest order' });
  }
};

const getOrderStats = async (req, res) => {
  try {
    const [
      totalOrders,
      pendingOrders,
      processingOrders,
      deliveredOrders,
      totalRevenue
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { status: 'pending' } }),
      prisma.order.count({ where: { status: 'processing' } }),
      prisma.order.count({ where: { status: 'delivered' } }),
      prisma.order.aggregate({
        _sum: {
          totalPrice: true,
        },
        where: {
          paymentStatus: 'paid'
        }
      })
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        totalOrders,
        pendingOrders,
        processingOrders,
        deliveredOrders,
        totalRevenue: totalRevenue._sum.totalPrice || 0
      }
    });
  } catch (error) {
    console.error('Get Order Stats Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve order statistics' });
  }
};

const getAllHeroImages = async (req, res) => {
  try {
    const heroImages = await prisma.heroImage.findMany({
      orderBy: { id: 'asc' }
    });
    
    const activeImagesCount = await prisma.heroImage.count({
      where: { isActive: true }
    });

    res.status(200).json({
      success: true,
      data: heroImages,
      activeCount: activeImagesCount
    });
  } catch (error) {
    console.error('Error fetching all hero images:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch hero images'
    });
  }
};

const addHeroImage = async (req, res) => {
  try {
    const file = req.files?.image?.[0];
    const { altText } = req.body;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'Image file is required'
      });
    }

    const activeImagesCount = await prisma.heroImage.count({
      where: { isActive: true }
    });

    if (activeImagesCount >= 10) {
      await cleanupTempFiles(file.path);
      return res.status(400).json({
        success: false,
        message: 'Maximum limit of 10 active hero images reached. Please deactivate some images first.'
      });
    }

    const uploadResult = await cloudinary.uploader.upload(file.path, {
      folder: 'hadi_books_store/hero_images',
      public_id: `hero_image_${Date.now()}`,
    });
    await cleanupTempFiles(file.path);

    const newHeroImage = await prisma.heroImage.create({
      data: {
        imageUrl: uploadResult.secure_url,
        altText: altText || '',
        isActive: true
      }
    });

    res.status(201).json({
      success: true,
      message: 'Hero image added successfully',
      data: newHeroImage
    });
  } catch (error) {
    if (req.files?.image?.[0]) await cleanupTempFiles(req.files.image[0].path);
    console.error('Error adding hero image:', error);
    
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: 'Image URL already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to add hero image'
    });
  }
};

const updateHeroImage = async (req, res) => {
  try {
    const { id } = req.params;
    const { altText, isActive } = req.body;
    const file = req.files?.image?.[0];

    const existingImage = await prisma.heroImage.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingImage) {
      if (file) await cleanupTempFiles(file.path);
      return res.status(404).json({
        success: false,
        message: 'Hero image not found'
      });
    }

    if (isActive === true && existingImage.isActive === false) {
      const activeImagesCount = await prisma.heroImage.count({
        where: { isActive: true }
      });

      if (activeImagesCount >= 10) {
        if (file) await cleanupTempFiles(file.path);
        return res.status(400).json({
          success: false,
          message: 'Maximum limit of 10 active hero images reached. Please deactivate some images first.'
        });
      }
    }

    let imageUrl = existingImage.imageUrl;
    if (file) {
      const uploadResult = await cloudinary.uploader.upload(file.path, {
        folder: 'hadi_books_store/hero_images',
        public_id: `hero_image_${id}_${Date.now()}`,
      });
      await cleanupTempFiles(file.path);
      imageUrl = uploadResult.secure_url;

      try {
        const publicId = existingImage.imageUrl.split('/').slice(-2).join('/').split('.')[0];
        await cloudinary.uploader.destroy(publicId);
      } catch (error) {
        console.error('Error deleting old hero image from Cloudinary:', error);
      }
    }

    const updatedHeroImage = await prisma.heroImage.update({
      where: { id: parseInt(id) },
      data: {
        imageUrl,
        altText: altText !== undefined ? altText : existingImage.altText,
        isActive: isActive !== undefined ? isActive : existingImage.isActive
      }
    });

    res.status(200).json({
      success: true,
      message: 'Hero image updated successfully',
      data: updatedHeroImage
    });
  } catch (error) {
    if (req.files?.image?.[0]) await cleanupTempFiles(req.files.image[0].path);
    console.error('Error updating hero image:', error);
    
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: 'Image URL already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update hero image'
    });
  }
};

const toggleHeroImageAvailability = async (req, res) => {
  try {
    const { id } = req.params;

    const existingImage = await prisma.heroImage.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingImage) {
      return res.status(404).json({
        success: false,
        message: 'Hero image not found'
      });
    }

    if (!existingImage.isActive) {
      const activeImagesCount = await prisma.heroImage.count({
        where: { isActive: true }
      });

      if (activeImagesCount >= 10) {
        return res.status(400).json({
          success: false,
          message: 'Maximum limit of 10 active hero images reached. Please deactivate some images first.'
        });
      }
    }

    const updatedHeroImage = await prisma.heroImage.update({
      where: { id: parseInt(id) },
      data: {
        isActive: !existingImage.isActive
      }
    });

    res.status(200).json({
      success: true,
      message: `Hero image ${updatedHeroImage.isActive ? 'activated' : 'deactivated'} successfully`,
      data: updatedHeroImage
    });
  } catch (error) {
    console.error('Error toggling hero image availability:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle hero image availability'
    });
  }
};

const deleteHeroImage = async (req, res) => {
  try {
    const { id } = req.params;

    const existingImage = await prisma.heroImage.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingImage) {
      return res.status(404).json({
        success: false,
        message: 'Hero image not found'
      });
    }

    try {
      const publicId = existingImage.imageUrl.split('/').slice(-2).join('/').split('.')[0];
      await cloudinary.uploader.destroy(publicId);
    } catch (error) {
      console.error('Error deleting hero image from Cloudinary:', error);
    }

    await prisma.heroImage.delete({
      where: { id: parseInt(id) }
    });

    res.status(200).json({
      success: true,
      message: 'Hero image deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting hero image:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete hero image'
    });
  }
};

export { 
  addProduct,
  listProducts, 
  updateProduct, 
  removeProduct, 
  singleProduct, 
  toggleAvailability, 
  toggleBestseller,
  updateOrderStatus,
  getOrders,
  getOrderStats,
  deleteOrder,
  deleteGuestOrder,
  getAllHeroImages,
  addHeroImage,
  updateHeroImage,
  deleteHeroImage,
  toggleHeroImageAvailability
};