const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrateData() {
  try {
    // Fetch all old orders with their items
    const oldOrders = await prisma.oldOrder.findMany({ include: { items: true } });

    for (const oldOrder of oldOrders) {
      // Create new order with UUID
      const newOrder = await prisma.order.create({
        data: {
          id: require('crypto').randomUUID(), // Generate UUID
          userId: oldOrder.userId,
          totalPrice: oldOrder.totalPrice,
          status: oldOrder.status,
          shippingAddress: oldOrder.shippingAddress,
          paymentMethod: oldOrder.paymentMethod,
          paymentStatus: 'not_paid', // Default for existing orders
          shippingMethod: null, // Set as needed
          trackingId: oldOrder.trackingNumber, // Map old trackingNumber
          estimatedDelivery: null, // Set as needed
          taxes: oldOrder.taxes,
          shippingFee: oldOrder.shippingFee,
          createdAt: oldOrder.createdAt,
          updatedAt: oldOrder.updatedAt,
          user: { connect: { id: oldOrder.userId } },
        },
      });

      // Migrate order items
      for (const oldItem of oldOrder.items) {
        await prisma.orderItem.create({
          data: {
            orderId: newOrder.id,
            productId: oldItem.productId,
            quantity: oldItem.quantity,
            price: oldItem.price,
            createdAt: oldItem.createdAt,
          },
        });
      }
    }
    console.log('Data migrated successfully');
  } catch (e) {
    console.error('Migration failed:', e);
  } finally {
    await prisma.$disconnect();
  }
}

migrateData();