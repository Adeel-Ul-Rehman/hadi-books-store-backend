import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Utility function to convert BigInt to Number in objects
const convertBigIntToNumber = (obj) => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return Number(obj);
  if (Array.isArray(obj)) {
    return obj.map(item => convertBigIntToNumber(item));
  }
  if (typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [key, convertBigIntToNumber(value)])
    );
  }
  return obj;
};

const addToWishlist = async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.userId;

    if (!productId) {
      return res.status(400).json({ success: false, message: 'Product ID is required' });
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const wishlist = await prisma.wishlist.upsert({
      where: { userId },
      create: { userId, itemLimit: 10 },
      update: {},
      include: { items: true },
    });

    if (wishlist.items.length >= wishlist.itemLimit) {
      return res.status(400).json({ success: false, message: 'Wishlist limit of 10 items reached' });
    }

    const existingItem = await prisma.wishlistItem.findUnique({
      where: { wishlistId_productId: { wishlistId: wishlist.id, productId } },
    });
    if (existingItem) {
      return res.status(400).json({ success: false, message: 'Product already in wishlist' });
    }

    await prisma.wishlistItem.create({
      data: { wishlistId: wishlist.id, productId },
    });

    const updatedWishlist = await prisma.wishlist.findUnique({
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
                category: true,
              },
            },
          },
        },
      },
    });

    const convertedWishlist = convertBigIntToNumber(updatedWishlist);

    return res.status(201).json({
      success: true,
      message: 'Product added to wishlist',
      wishlist: {
        id: convertedWishlist.id,
        userId,
        items: convertedWishlist.items.map(item => ({
          id: item.id,
          productId: item.productId,
          product: item.product,
        })) || [],
      },
    });
  } catch (error) {
    console.error('Add to Wishlist Error:', {
      message: error.message,
      stack: error.stack,
      body: req.body,
    });
    if (error.code === 'P2002') {
      return res.status(400).json({ success: false, message: 'Product already in wishlist' });
    }
    return res.status(500).json({ success: false, message: 'Failed to add to wishlist', error: error.message });
  }
};

const getWishlist = async (req, res) => {
  try {
    const paramUserId = req.params.userId;
    const tokenUserId = req.userId;

    if (paramUserId !== tokenUserId) {
      return res.status(403).json({ success: false, message: 'Unauthorized access to wishlist' });
    }

    const wishlist = await prisma.wishlist.findUnique({
      where: { userId: tokenUserId },
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
                category: true,
                availability: true,
              },
            },
          },
        },
      },
    });

    const convertedWishlist = convertBigIntToNumber(wishlist);

    return res.status(200).json({
      success: true,
      message: convertedWishlist ? 'Wishlist retrieved' : 'Wishlist is empty',
      wishlist: {
        id: convertedWishlist?.id || null,
        userId: tokenUserId,
        items: convertedWishlist?.items.map(item => ({
          id: item.id,
          productId: item.productId,
          product: item.product,
        })) || [],
      },
    });
  } catch (error) {
    console.error('Get Wishlist Error:', {
      message: error.message,
      stack: error.stack,
      params: req.params,
    });
    return res.status(500).json({ success: false, message: 'Failed to retrieve wishlist', error: error.message });
  }
};

const removeFromWishlist = async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.userId;

    if (!productId) {
      return res.status(400).json({ success: false, message: 'Product ID is required' });
    }

    const wishlist = await prisma.wishlist.findUnique({
      where: { userId },
      include: { items: { where: { productId } } },
    });

    if (!wishlist || !wishlist.items.length) {
      return res.status(404).json({ success: false, message: 'Wishlist or item not found' });
    }

    await prisma.wishlistItem.delete({
      where: { wishlistId_productId: { wishlistId: wishlist.id, productId } },
    });

    const updatedWishlist = await prisma.wishlist.findUnique({
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
                category: true,
              },
            },
          },
        },
      },
    });

    const convertedWishlist = convertBigIntToNumber(updatedWishlist);

    return res.status(200).json({
      success: true,
      message: 'Product removed from wishlist',
      wishlist: {
        id: convertedWishlist.id,
        userId,
        items: convertedWishlist.items.map(item => ({
          id: item.id,
          productId: item.productId,
          product: item.product,
        })) || [],
      },
    });
  } catch (error) {
    console.error('Remove from Wishlist Error:', {
      message: error.message,
      stack: error.stack,
      body: req.body,
    });
    return res.status(500).json({ success: false, message: 'Failed to remove from wishlist', error: error.message });
  }
};

export { addToWishlist, getWishlist, removeFromWishlist };