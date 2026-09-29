import { PrismaClient, PrizeType } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // 默认需求类型
  const orderTypes = [
    { name: '期中内作业', description: '期中考试前的平时作业、小测验类', price: '100-300元', sortOrder: 1 },
    { name: '期末作业',   description: '期末考核作业、大作业、报告类',   price: '200-500元', sortOrder: 2 },
    { name: '毕业设计',   description: '毕业论文、毕业设计项目',          price: '500-2000元', sortOrder: 3 },
  ]

  for (const type of orderTypes) {
    await prisma.orderType.upsert({
      where: { name: type.name },
      create: type,
      update: { price: type.price, description: type.description, sortOrder: type.sortOrder },
    })
  }

  console.log('✅ OrderTypes seeded:', orderTypes.map(t => t.name).join(', '))

  // 示例活动公告
  const now = new Date()
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  await prisma.activity.upsert({
    where: { id: 'seed-activity-1' },
    create: {
      id: 'seed-activity-1',
      title: '🎉 期末季特惠',
      content: '本月所有期末作业享9折优惠！数量有限，先到先得。提交需求时备注"期末季"即可享受折扣。',
      type: 'PROMO',
      startAt: now,
      endAt: endOfMonth,
      isActive: true,
    },
    update: {},
  })

  await prisma.activity.upsert({
    where: { id: 'seed-activity-2' },
    create: {
      id: 'seed-activity-2',
      title: '📢 接单公告',
      content: '目前正常接单，响应时间约1-2小时。提交需求后请添加微信 Jt--04，备注订单号，方便快速沟通。',
      type: 'NOTICE',
      startAt: now,
      endAt: null,
      isActive: true,
    },
    update: {},
  })

  console.log('✅ Activities seeded')

  // 转盘奖品配置
  const wheelPrizes = [
    { id: 'prize-2888', label: '🏆 28.88元现金大奖', type: PrizeType.CASH_REDEEM, value: 28.88, weight: 1, totalStock: 1, remainStock: 1, color: '#FF6B6B', icon: '🏆', sortOrder: 1 },
    { id: 'prize-none1', label: '🎯 谢谢惠顾', type: PrizeType.NONE, value: null, weight: 4, totalStock: -1, remainStock: -1, color: '#2D3748', icon: '🎯', sortOrder: 2 },
    { id: 'prize-small', label: '📝 小作业9折券', type: PrizeType.ORDER_DISCOUNT, value: 0.9, weight: 2, totalStock: 20, remainStock: 20, color: '#4ECDC4', icon: '📝', sortOrder: 3 },
    { id: 'prize-none2', label: '🎯 谢谢惠顾', type: PrizeType.NONE, value: null, weight: 4, totalStock: -1, remainStock: -1, color: '#2D3748', icon: '🎯', sortOrder: 4 },
    { id: 'prize-final', label: '📚 期末85折券', type: PrizeType.ORDER_DISCOUNT, value: 0.85, weight: 2, totalStock: 5, remainStock: 5, color: '#45B7D1', icon: '📚', sortOrder: 5 },
    { id: 'prize-none3', label: '🎯 谢谢惠顾', type: PrizeType.NONE, value: null, weight: 4, totalStock: -1, remainStock: -1, color: '#2D3748', icon: '🎯', sortOrder: 6 },
    { id: 'prize-70', label: '🎟️ 7折券', type: PrizeType.ORDER_DISCOUNT, value: 0.7, weight: 2, totalStock: 10, remainStock: 10, color: '#F472B6', icon: '🎟️', sortOrder: 7 },
    { id: 'prize-50', label: '🎁 五折券', type: PrizeType.ORDER_DISCOUNT, value: 0.5, weight: 1, totalStock: 3, remainStock: 3, color: '#A855F7', icon: '🎁', sortOrder: 8 },
  ]

  for (const prize of wheelPrizes) {
    await prisma.wheelPrize.upsert({
      where: { id: prize.id },
      create: prize,
      update: { label: prize.label, totalStock: prize.totalStock, remainStock: prize.remainStock },
    })
  }

  console.log('✅ WheelPrizes seeded:', wheelPrizes.length, 'prizes')

  // 活动浮窗默认配置
  await prisma.activityPopup.upsert({
    where: { id: 'singleton' },
    create: {
      id: 'singleton',
      enabled: true,
      title: '🎰 幸运转盘 限时活动',
      description: '新用户注册送1次抽奖机会，邀请好友最多3次！',
      buttonText: '✨ 立即抽奖 ✨',
      linkUrl: '/lucky-wheel',
      showCondition: 'all',
    },
    update: {},
  })

  console.log('✅ ActivityPopup seeded')
  console.log('🎉 Seed complete!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
