// product 模块业务逻辑：商品订单创建、状态流转、优惠码校验

import { prisma } from '../../lib/prisma.js'
import { Prisma, ProductOrderStatus } from '@prisma/client'
import { HttpError } from '../../framework/errors.js'
import { ERROR_CODES } from '../../framework/response.js'

export function generateOrderNo(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase()
  return `ORD-${date}-${rand}`
}

export function assertCanTransition(
  current: ProductOrderStatus,
  next: ProductOrderStatus,
  isAdmin: boolean,
): void {
  const allowed: Record<ProductOrderStatus, ProductOrderStatus[]> = {
    CREATED: isAdmin ? ['PAID', 'CANCELLED'] : ['PAID', 'CANCELLED'],
    PAID: isAdmin ? ['COMPLETED', 'CANCELLED'] : [],
    COMPLETED: [],
    CANCELLED: [],
  }
  if (!allowed[current].includes(next)) {
    throw new HttpError(ERROR_CODES.ORDER_STATUS_INVALID, `订单状态不可从 ${current} 变更为 ${next}`, 400)
  }
}

export async function createProductOrder(params: {
  userId: string
  productId: string
  couponCode?: string
  userNote?: string
}) {
  const { userId, productId, couponCode, userNote } = params

  const product = await prisma.product.findUnique({ where: { id: productId } })
  if (!product || !product.isActive) throw new HttpError(ERROR_CODES.PRODUCT_NOT_FOUND, '商品不存在或已下架', 404)

  const originalPrice = product.price
  let discountAmount = new Prisma.Decimal(0)
  let paidPrice = originalPrice
  let couponId: string | undefined

  if (couponCode) {
    const coupon = await prisma.promoCoupon.findUnique({ where: { code: couponCode } })
    if (!coupon || !coupon.isActive) throw new HttpError(ERROR_CODES.COUPON_INVALID, '优惠码无效', 400)
    const now = new Date()
    if (now < coupon.validFrom || now > coupon.validTo) throw new HttpError(ERROR_CODES.COUPON_EXPIRED, '优惠码已过期', 400)
    if (coupon.usedCount >= coupon.maxUses) throw new HttpError(ERROR_CODES.COUPON_USED_UP, '优惠码已使用完毕', 400)

    if (coupon.discountType === 'FIXED') {
      discountAmount = Prisma.Decimal.min(coupon.discountValue, originalPrice)
    } else {
      discountAmount = originalPrice.mul(coupon.discountValue).div(100).toDecimalPlaces(2)
    }
    paidPrice = Prisma.Decimal.max(originalPrice.sub(discountAmount), new Prisma.Decimal(0))
    couponId = coupon.id
  }

  const orderNo = generateOrderNo()

  const order = await prisma.$transaction(async (tx) => {
    if (couponId) {
      const coupon = await tx.promoCoupon.findUnique({ where: { id: couponId } })
      if (!coupon || coupon.usedCount >= coupon.maxUses) throw new HttpError(ERROR_CODES.COUPON_USED_UP, '优惠码已使用完毕', 400)
      await tx.promoCoupon.update({
        where: { id: couponId, version: coupon.version },
        data: { usedCount: { increment: 1 }, version: { increment: 1 } },
      })
    }

    return tx.productOrder.create({
      data: {
        orderNo,
        userId,
        productId,
        couponId: couponId ?? null,
        originalPrice,
        discountAmount,
        paidPrice,
        userNote,
        status: 'CREATED',
      },
      include: { product: { select: { name: true } } },
    })
  })

  return order
}

export async function getMyProductOrders(
  userId: string,
  page: number,
  pageSize: number,
  status?: ProductOrderStatus,
) {
  const where: Prisma.ProductOrderWhereInput = {
    userId,
    ...(status ? { status } : {}),
  }
  const [list, total] = await Promise.all([
    prisma.productOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        product: { select: { id: true, name: true, imageUrl: true } },
      },
    }),
    prisma.productOrder.count({ where }),
  ])
  return { list, total }
}

export async function getProductOrderDetail(id: string, userId?: string) {
  return prisma.productOrder.findFirst({
    where: { id, ...(userId ? { userId } : {}) },
    include: {
      product: true,
      coupon: { select: { code: true, discountType: true, discountValue: true } },
    },
  })
}

/** 校验优惠码并预览折扣（不消耗次数） */
export async function validatePromoCoupon(code: string, productId: string) {
  const product = await prisma.product.findFirst({ where: { id: productId, isActive: true } })
  if (!product) throw new HttpError(ERROR_CODES.PRODUCT_NOT_FOUND, '商品不存在', 404)

  const coupon = await prisma.promoCoupon.findUnique({ where: { code } })
  if (!coupon || !coupon.isActive) {
    return { valid: false as const, reason: 'NOT_FOUND' }
  }
  const now = new Date()
  if (now < coupon.validFrom || now > coupon.validTo) {
    return { valid: false as const, reason: 'EXPIRED' }
  }
  if (coupon.usedCount >= coupon.maxUses) {
    return { valid: false as const, reason: 'USED_UP' }
  }

  const originalPrice = product.price
  let discountAmount: Prisma.Decimal
  if (coupon.discountType === 'FIXED') {
    discountAmount = Prisma.Decimal.min(coupon.discountValue, originalPrice)
  } else {
    discountAmount = originalPrice.mul(coupon.discountValue).div(100).toDecimalPlaces(2)
  }
  const paidPrice = Prisma.Decimal.max(originalPrice.sub(discountAmount), new Prisma.Decimal(0))

  return {
    valid: true as const,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    originalPrice,
    discountAmount,
    paidPrice,
  }
}
