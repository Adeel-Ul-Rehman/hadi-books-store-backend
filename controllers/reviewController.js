import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const addReview = async (req, res) => {
  try {
    const { productId, userId, rating, comment } = req.body;

    if (!productId || !userId || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Product ID, user ID, and rating (1-5) are required' });
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(productId) || !uuidRegex.test(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID or user ID format' });
    }

    const [product, user] = await Promise.all([
      prisma.product.findUnique({ where: { id: productId } }),
      prisma.user.findUnique({ where: { id: userId } }),
    ]);

    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const existingReview = await prisma.review.findUnique({
      where: { productId_userId: { productId, userId } },
    });
    
    if (existingReview) {
      return res.status(400).json({ success: false, message: 'You have already reviewed this product' });
    }

    const review = await prisma.review.create({
      data: {
        productId,
        userId,
        rating: parseInt(rating),
        comment: comment || '',
      },
      include: {
        user: { select: { id: true, name: true, lastName: true, profilePicture: true } },
      },
    });

    // Calculate new average rating
    const reviews = await prisma.review.findMany({
      where: { productId },
      select: { rating: true }
    });
    
    const averageRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;

    return res.status(201).json({
      success: true,
      message: 'Review added successfully',
      review: {
        id: review.id,
        productId: review.productId,
        userId: review.userId,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        user: review.user,
      },
      averageRating
    });
  } catch (error) {
    console.error('Add Review Error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ success: false, message: 'Review already exists for this product' });
    }
    return res.status(500).json({ success: false, message: 'Failed to add review' });
  }
};

const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 3 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    if (!productId) {
      return res.status(400).json({ success: false, message: 'Product ID is required' });
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(productId)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID format' });
    }

    // Check if product exists
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const [reviews, total, allReviews] = await Promise.all([
      prisma.review.findMany({
        where: { productId },
        include: {
          user: { select: { id: true, name: true, lastName: true, profilePicture: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: skip,
        take: parseInt(limit),
      }),
      prisma.review.count({ where: { productId } }),
      prisma.review.findMany({
        where: { productId },
        select: { rating: true }
      })
    ]);

    // Calculate average rating
    const averageRating = allReviews.length > 0 
      ? allReviews.reduce((sum, review) => sum + review.rating, 0) / allReviews.length
      : 0;

    return res.status(200).json({
      success: true,
      message: total > 0 ? 'Reviews retrieved successfully' : 'No reviews found for this product',
      reviews,
      averageRating,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get Product Reviews Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve reviews' });
  }
};

export { addReview, getProductReviews };