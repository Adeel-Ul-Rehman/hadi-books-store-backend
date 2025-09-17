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

const singleProduct = async (req, res) => {
  try {
    const { id } = req.params;
    
    const product = await prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        originalPrice: true,
        image: true,
        category: true,
        subCategories: true,
        author: true,
        isbn: true,
        language: true,
        date: true,
        bestseller: true,
        availability: true,
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

    // Convert BigInt to Number for response
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


const getProducts = async (req, res) => {
  try {
    console.log("Shayan is tesiting in backend at getProduct in product controler")
    const { category, page = 1, limit = 10, search = '', bestseller = false } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = { availability: true };
    if (category) whereClause.category = category;
    if (bestseller === 'true') whereClause.bestseller = true;
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { author: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
        { subCategories: { has: search } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where: whereClause,
        orderBy: { date: 'desc' },
        skip: skip,
        take: parseInt(limit),
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          originalPrice: true,
          image: true,
          category: true,
          subCategories: true,
          author: true,
          isbn: true,
          language: true,
          date: true,
          bestseller: true,
          availability: true,
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

    return res.status(200).json({
      success: true,
      message: 'Products retrieved successfully',
      products: productsResponse,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get Products Error:', {
      message: error.message,
      stack: error.stack,
      query: req.query,
    });
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve products',
      error: error.message 
    });
  }
};

export { getProducts, singleProduct };
