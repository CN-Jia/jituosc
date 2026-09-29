-- AlterEnum: add new order statuses
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'CREATED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- AlterEnum: add ORDER_COMPLETED event type
ALTER TYPE "PointEventType" ADD VALUE IF NOT EXISTS 'ORDER_COMPLETED';

-- AlterTable: OrderType - add pointRewardRate
ALTER TABLE "order_types" ADD COLUMN "pointRewardRate" DECIMAL(5,4);

-- AlterTable: Order - add new fields
ALTER TABLE "orders" ADD COLUMN "estimatedDelivery" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN "rewardPoints" INTEGER;
ALTER TABLE "orders" ADD COLUMN "redeemItemId" TEXT;

-- AlterTable: RedeemOrder - add new fields
ALTER TABLE "redeem_orders" ADD COLUMN "usedAt" TIMESTAMP(3);
ALTER TABLE "redeem_orders" ADD COLUMN "usedOrderId" TEXT;
ALTER TABLE "redeem_orders" ADD COLUMN "expiresAt" TIMESTAMP(3);

-- AlterTable: Post - add board field
ALTER TABLE "posts" ADD COLUMN "board" TEXT NOT NULL DEFAULT 'exchange';

-- CreateIndex: Post board index
CREATE INDEX "posts_board_status_createdAt_idx" ON "posts"("board", "status", "createdAt");
