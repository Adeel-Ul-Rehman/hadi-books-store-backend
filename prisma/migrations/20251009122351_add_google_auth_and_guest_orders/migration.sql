/*
  Warnings:

  - A unique constraint covering the columns `[googleId]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "authProvider" TEXT DEFAULT 'email',
ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "googleId" TEXT,
ALTER COLUMN "password" DROP NOT NULL;

-- CreateTable
CREATE TABLE "public"."guest_orders" (
    "id" TEXT NOT NULL,
    "guestEmail" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "guestPhone" TEXT,
    "shippingAddress" TEXT NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paymentStatus" TEXT NOT NULL DEFAULT 'not_paid',
    "paymentMethod" TEXT,
    "shippingMethod" TEXT,
    "trackingId" TEXT,
    "estimatedDelivery" TIMESTAMP(3),
    "taxes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "shippingFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guest_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."guest_order_items" (
    "id" SERIAL NOT NULL,
    "order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."guest_payments" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "transactionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "amount" DOUBLE PRECISION NOT NULL,
    "bankAccount" TEXT,
    "bankName" TEXT,
    "paymentProof" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guest_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "guest_orders_guestEmail_idx" ON "public"."guest_orders"("guestEmail");

-- CreateIndex
CREATE INDEX "guest_order_items_order_id_product_id_idx" ON "public"."guest_order_items"("order_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "guest_payments_order_id_key" ON "public"."guest_payments"("order_id");

-- CreateIndex
CREATE INDEX "guest_payments_order_id_idx" ON "public"."guest_payments"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "public"."users"("googleId");

-- CreateIndex
CREATE INDEX "users_googleId_idx" ON "public"."users"("googleId");

-- AddForeignKey
ALTER TABLE "public"."guest_order_items" ADD CONSTRAINT "guest_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."guest_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."guest_order_items" ADD CONSTRAINT "guest_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."guest_payments" ADD CONSTRAINT "guest_payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."guest_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
