import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Get all hero images
export const getHeroImages = async (req, res) => {
  try {
    const heroImages = await prisma.heroImage.findMany({
      where: { isActive: true }
    });
    
    res.status(200).json({
      success: true,
      data: heroImages
    });
  } catch (error) {
    console.error('Error fetching hero images:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch hero images'
    });
  }
};