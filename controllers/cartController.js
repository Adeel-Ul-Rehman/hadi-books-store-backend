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

const addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
    const userId = req.userId;

    if (!productId || isNaN(quantity) || quantity < 1) {
      return res.status(400).json({ success: false, message: 'Invalid productId or quantity' });
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || !product.availability) {
      return res.status(404).json({ success: false, message: 'Product not found or unavailable' });
    }

    // Find or create cart for the user (using UUID userId directly)
    const cart = await prisma.cart.upsert({
      where: { userId: userId },
      create: { userId: userId },
      update: {},
      include: { items: true },
    });

    const existingItem = await prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId: cart.id, productId } }
    });

    let cartItem;
    if (existingItem) {
      cartItem = await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: { increment: parseInt(quantity) } },
        include: { product: true },
      });
    } else {
      cartItem = await prisma.cartItem.create({
        data: { 
          cartId: cart.id, 
          productId, 
          quantity: parseInt(quantity) 
        },
        include: { product: true },
      });
    }

    const convertedCartItem = convertBigIntToNumber(cartItem);

    return res.status(201).json({
      success: true,
      cartItem: {
        id: convertedCartItem.id,
        productId: convertedCartItem.productId,
        quantity: convertedCartItem.quantity,
        product: {
          id: convertedCartItem.product.id,
          name: convertedCartItem.product.name,
          price: convertedCartItem.product.price,
          originalPrice: convertedCartItem.product.originalPrice,
          image: convertedCartItem.product.image,
          category: convertedCartItem.product.category,
        },
      },
    });
  } catch (error) {
    console.error('Add to Cart Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to add to cart' });
  }
};

const getCart = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'Invalid userId' });
    }

    const cart = await prisma.cart.findUnique({
      where: { userId: userId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
                originalPrice: true,
                image: true,
                category: true,
                availability: true,
              },
            },
          },
        },
      },
    });

    const convertedCart = convertBigIntToNumber(cart);

    return res.status(200).json({
      success: true,
      message: cart ? 'Cart retrieved' : 'Cart is empty',
      cart: {
        id: convertedCart?.id || null,
        userId: userId,
        items: convertedCart?.items.map(item => ({
          id: item.id,
          productId: item.productId,
          quantity: item.quantity,
          product: {
            id: item.product.id,
            name: item.product.name,
            price: item.product.price,
            originalPrice: item.product.originalPrice,
            image: item.product.image,
            category: item.product.category,
            availability: item.product.availability,
          },
        })) || [],
      },
    });
  } catch (error) {
    console.error('Get Cart Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve cart' });
  }
};

const updateCartItem = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const userId = req.userId;

    if (!productId || isNaN(quantity) || quantity < 1) {
      return res.status(400).json({ success: false, message: 'Invalid productId or quantity' });
    }

    const cart = await prisma.cart.findUnique({
      where: { userId: userId },
      include: { items: { where: { productId } } },
    });

    if (!cart || !cart.items.length) {
      return res.status(404).json({ success: false, message: 'Cart or item not found' });
    }

    const updatedCartItem = await prisma.cartItem.update({
      where: { id: cart.items[0].id },
      data: { quantity: parseInt(quantity) },
      include: { product: true },
    });

    const convertedCartItem = convertBigIntToNumber(updatedCartItem);

    return res.status(200).json({
      success: true,
      message: 'Cart item updated',
      cartItem: {
        id: convertedCartItem.id,
        productId: convertedCartItem.productId,
        quantity: convertedCartItem.quantity,
        product: {
          id: convertedCartItem.product.id,
          name: convertedCartItem.product.name,
          price: convertedCartItem.product.price,
          originalPrice: convertedCartItem.product.originalPrice,
          image: convertedCartItem.product.image,
        },
      },
    });
  } catch (error) {
    console.error('Update Cart Item Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update cart item' });
  }
};

const removeCartItem = async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.userId;

    if (!productId) {
      return res.status(400).json({ success: false, message: 'Invalid productId' });
    }

    const cart = await prisma.cart.findUnique({
      where: { userId: userId },
      include: { items: { where: { productId } } },
    });

    if (!cart || !cart.items.length) {
      return res.status(404).json({ success: false, message: 'Cart or item not found' });
    }

    await prisma.cartItem.delete({
      where: { id: cart.items[0].id },
    });

    return res.status(200).json({
      success: true,
    });
  } catch (error) {
    console.error('Remove Cart Item Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to remove cart item' });
  }
};

export { addToCart, getCart, updateCartItem, removeCartItem };