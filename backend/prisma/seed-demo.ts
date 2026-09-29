/**
 * 补充展示数据（**非破坏性**，可安全重复执行）
 *
 * 与 prisma/seed.ts 的关键区别：
 *   seed.ts 里转盘奖品用的是 `upsert(update: { label, totalStock, remainStock })`，
 *   重复执行会把已抽掉的库存补满（等于凭空多发奖）；本脚本一律「只创建缺失项」，
 *   绝不 update、绝不 delete，因此可以在生产库上反复运行。
 *
 * 不会触碰的数据：用户、订单、毕设进度（thesis_*）、积分余额/流水、抽奖记录、兑换记录。
 *
 * 用法：
 *   pnpm --filter backend exec tsx prisma/seed-demo.ts --dry-run   # 只预览，不写库
 *   pnpm --filter backend exec tsx prisma/seed-demo.ts             # 实际写入
 */
import {
  PrismaClient,
  ActivityType,
  DiscountType,
  PointEventType,
  PostStatus,
  PostType,
  PrizeType,
  ShopItemType,
} from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const created: string[] = []
const skipped: string[] = []

/** 只创建缺失项：已存在则跳过，绝不覆盖 */
async function ensure(label: string, exists: () => Promise<unknown>, create: () => Promise<unknown>) {
  const found = await exists()
  if (found) {
    skipped.push(label)
    console.log(`  跳过  ${label}`)
    return
  }
  if (DRY_RUN) {
    created.push(label)
    console.log(`  待建  ${label}`)
    return
  }
  await create()
  created.push(label)
  console.log(`  已建  ${label}`)
}

// ─── 数据定义 ────────────────────────────────────────────────

/** 需求类型（首页「价格参考」的数据源） */
const ORDER_TYPES = [
  { name: '期中内作业', description: '期中考试前的平时作业、小测验类', price: '100-300元', sortOrder: 1 },
  { name: '期末作业', description: '期末考核作业、大作业、报告类', price: '200-500元', sortOrder: 2 },
  { name: '毕业设计', description: '毕业论文、毕业设计项目', price: '500-2000元', sortOrder: 3 },
]

/** 活动公告（首页「最新动态」的数据源） */
const ACTIVITIES = [
  {
    id: 'seed-activity-1',
    title: '🎉 期末季特惠',
    content: '本月所有期末作业享 9 折优惠！数量有限，先到先得。提交需求时备注「期末季」即可享受折扣。',
    type: ActivityType.PROMO,
    endDays: 30,
  },
  {
    id: 'seed-activity-2',
    title: '📢 接单公告',
    content: '目前正常接单，响应时间约 1-2 小时。提交需求后请添加微信 Jt--04，备注订单号，方便快速沟通。',
    type: ActivityType.NOTICE,
    endDays: null,
  },
]

/** 幸运转盘奖品（**不覆盖库存**） */
const WHEEL_PRIZES = [
  { id: 'prize-2888', label: '🏆 28.88元现金大奖', type: PrizeType.CASH_REDEEM, value: '28.88', weight: 1, totalStock: 1, remainStock: 1, color: '#FF6B6B', icon: '🏆', sortOrder: 1 },
  { id: 'prize-none1', label: '🎯 谢谢惠顾', type: PrizeType.NONE, value: null, weight: 4, totalStock: -1, remainStock: -1, color: '#2D3748', icon: '🎯', sortOrder: 2 },
  { id: 'prize-small', label: '📝 小作业9折券', type: PrizeType.ORDER_DISCOUNT, value: '0.90', weight: 2, totalStock: 20, remainStock: 20, color: '#4ECDC4', icon: '📝', sortOrder: 3 },
  { id: 'prize-none2', label: '🎯 谢谢惠顾', type: PrizeType.NONE, value: null, weight: 4, totalStock: -1, remainStock: -1, color: '#2D3748', icon: '🎯', sortOrder: 4 },
  { id: 'prize-final', label: '📚 期末85折券', type: PrizeType.ORDER_DISCOUNT, value: '0.85', weight: 2, totalStock: 5, remainStock: 5, color: '#45B7D1', icon: '📚', sortOrder: 5 },
  { id: 'prize-none3', label: '🎯 谢谢惠顾', type: PrizeType.NONE, value: null, weight: 4, totalStock: -1, remainStock: -1, color: '#2D3748', icon: '🎯', sortOrder: 6 },
  { id: 'prize-70', label: '🎟️ 7折券', type: PrizeType.ORDER_DISCOUNT, value: '0.70', weight: 2, totalStock: 10, remainStock: 10, color: '#F472B6', icon: '🎟️', sortOrder: 7 },
  { id: 'prize-50', label: '🎁 五折券', type: PrizeType.ORDER_DISCOUNT, value: '0.50', weight: 1, totalStock: 3, remainStock: 3, color: '#A855F7', icon: '🎁', sortOrder: 8 },
]

/**
 * 积分规则
 * ⚠️ 数值必须与 points.service.ts 里 getRulePoints() 的 defaults 保持一致（50 / 100 / 30），
 * 否则会把线上行为改掉。其余事件类型代码中没有默认值，属系统/管理员管理，这里不擅自赋值。
 */
const POINT_RULES = [
  { eventType: PointEventType.INVITE_REGISTER, points: 50, remark: '邀请好友注册成功，邀请人获得' },
  { eventType: PointEventType.INVITE_FIRST_ORDER, points: 100, remark: '被邀请人首次下单，邀请人获得' },
  { eventType: PointEventType.NEW_USER_FIRST_ORDER, points: 30, remark: '新用户首次下单获得' },
]

/** 商品（可直接购买的服务） */
const PRODUCTS = [
  { name: '作业加急处理', description: '在原有排期上优先处理，24 小时内交付初稿。', price: '50.00', sortOrder: 1 },
  { name: '论文查重（一次）', description: '提供一次正规查重报告，含重复率与相似来源。', price: '30.00', sortOrder: 2 },
  { name: '一对一答疑（1 小时）', description: '针对你的题目进行一对一讲解，帮你真正弄懂。', price: '80.00', sortOrder: 3 },
]

/** 积分商城商品（用积兑换） */
const SHOP_ITEMS = [
  { name: '20 元作业代金券', description: '下单时抵扣 20 元，不与其他优惠叠加。', type: ShopItemType.COUPON, pointsCost: 200, discountAmt: '20.00', stock: -1, sortOrder: 1 },
  { name: '50 元作业代金券', description: '下单时抵扣 50 元，适合期末大作业与课程设计。', type: ShopItemType.COUPON, pointsCost: 480, discountAmt: '50.00', stock: 20, sortOrder: 2 },
  { name: '加急处理服务', description: '兑换后可在提交需求时勾选，优先排期。', type: ShopItemType.SERVICE, pointsCost: 800, discountAmt: null, stock: 10, sortOrder: 3 },
]

/**
 * 促销优惠码
 * 注意：product.service.ts 中 PERCENTAGE 的算法是 `原价 × discountValue / 100`，
 * 即 discountValue 表示**减免百分比**（减 10% → 填 10；不要填 90）。
 */
const PROMO_COUPONS = [
  { code: 'NEW10', discountType: DiscountType.PERCENTAGE, discountValue: '10.00', maxUses: 100, validDays: 90, remark: '新用户首单 9 折' },
  { code: 'SAVE20', discountType: DiscountType.FIXED, discountValue: '20.00', maxUses: 50, validDays: 60, remark: '满额立减 20 元' },
]

/** 论坛帖子（直接置为已审核，作者留空表示官方发布） */
const POSTS = [
  {
    title: '📌 下单流程与常见问题',
    summary: '从提交需求到交付验收，一共 4 步；附常见问题解答。',
    content: '## 下单流程\n\n1. 注册并登录后，在「提交需求」填写课程、类型、年级与截止日期；\n2. 管理员评估工作量后给出报价，确认无误再开工；\n3. 开发过程中可在「我的订单」查看进度；\n4. 交付源码与文档，验收完成后订单归档。\n\n## 常见问题\n\n- **报价怎么算？** 按工作量与难度评估，开工前一次性说清，无隐藏收费。\n- **能改吗？** 交付前可提出修改，质量问题免费返工。\n- **隐私安全吗？** 订单信息仅你与管理员可见，不会对外泄露。',
    board: 'faq',
    type: PostType.ANNOUNCEMENT,
    isPinned: true,
  },
  {
    title: '期末大作业怎么拿高分？说说我的经验',
    summary: '选题、结构、演示三件事做好了，分数基本稳了。',
    content: '刚做完一门专业课的期末大作业，分享几点体会：\n\n1. **选题别贪大**，能在两周内做完的题目才是好题目；\n2. **结构要清晰**，老师看的是逻辑而不是代码行数；\n3. **演示要能跑**，答辩现场演示崩了，前面做得再好也打折。\n\n有需要可以在这里留言，我看到会回。',
    board: 'exchange',
    type: PostType.DISCUSSION,
    isPinned: false,
  },
  {
    title: '课程设计报告模板要点（附目录结构）',
    summary: '报告写不好很吃亏，这里给一份可直接套用的结构。',
    content: '课程设计报告建议包含：\n\n1. 需求分析（要解决什么问题）\n2. 总体设计（模块划分与流程图）\n3. 详细实现（关键代码与说明）\n4. 测试与结果（截图 + 说明）\n5. 总结与展望\n\n每一节都配图和表格，页数不用多，但要能自圆其说。',
    board: 'service',
    type: PostType.DISCUSSION,
    isPinned: false,
  },
]

/** 首页「历代作品」占位（图片为占位 SVG，见 --placeholders 步骤；后台可随时替换） */
const CAROUSELS = [
  { courseName: '课程设计 · Web 系统开发', orderType: '期末作业', review: '交付及时，代码结构清晰，答辩很顺利。', orderNoMask: 'JT****1001', monthsAgo: 2, imageUrl: '/uploads/case-placeholder-1.svg' },
  { courseName: '期末大作业 · 数据分析', orderType: '期末作业', review: '功能完整，文档齐全，老师评价不错。', orderNoMask: 'JT****1002', monthsAgo: 3, imageUrl: '/uploads/case-placeholder-2.svg' },
  { courseName: '毕业设计 · 管理系统', orderType: '毕业设计', review: '从选题到答辩全程跟进，省心。', orderNoMask: 'JT****1003', monthsAgo: 5, imageUrl: '/uploads/case-placeholder-3.svg' },
]

// ─── 执行 ────────────────────────────────────────────────────

const TOUCHED_TABLES = [
  'order_types', 'activities', 'activity_popup', 'wheel_prizes', 'point_rules',
  'products', 'shop_items', 'promo_coupons', 'posts', 'carousels',
] as const

const GUARDED_TABLES = [
  'thesis_projects', 'thesis_progresses', 'thesis_progress_images', 'thesis_activities',
  'users', 'site_notices',
] as const

/**
 * 精确计数。
 * ⚠️ 不要用 pg_stat_user_tables.n_live_tup —— 那是统计收集器的估算值，
 * INSERT 之后不会立刻刷新，会让人误以为"没写进去"。
 */
async function snapshot(tables: readonly string[]) {
  const map = new Map<string, number>()
  for (const t of tables) {
    // 表名来自上方硬编码常量，不含外部输入；此处仅为了动态拼表名
    const rows = await prisma.$queryRawUnsafe<Array<{ c: bigint }>>(`SELECT count(*)::bigint AS c FROM "${t}"`)
    map.set(t, Number(rows[0]?.c ?? 0))
  }
  return map
}

function diffLine(label: string, before: Map<string, number>, after: Map<string, number>, tables: readonly string[]) {
  console.log(`\n── ${label} ──`)
  for (const t of tables) {
    const b = before.get(t) ?? 0
    const a = after.get(t) ?? 0
    const delta = a - b
    console.log(`  ${t.padEnd(24)} ${String(b).padStart(3)} → ${String(a).padStart(3)}${delta > 0 ? '  (+' + delta + ')' : ''}`)
  }
}

async function main() {
  console.log(DRY_RUN ? '🔎 DRY RUN：只预览，不写入数据库\n' : '🌱 补充展示数据（只创建缺失项）\n')

  const before = await snapshot([...TOUCHED_TABLES, ...GUARDED_TABLES])

  console.log('【需求类型】')
  for (const t of ORDER_TYPES) {
    await ensure(`OrderType ${t.name}`, () => prisma.orderType.findUnique({ where: { name: t.name } }),
      () => prisma.orderType.create({ data: t }))
  }

  console.log('\n【活动公告】')
  for (const a of ACTIVITIES) {
    const endAt = a.endDays ? new Date(Date.now() + a.endDays * 86400_000) : null
    await ensure(`Activity ${a.title}`, () => prisma.activity.findUnique({ where: { id: a.id } }),
      () => prisma.activity.create({
        data: { id: a.id, title: a.title, content: a.content, type: a.type, startAt: new Date(), endAt, isActive: true },
      }))
  }

  console.log('\n【活动浮窗】')
  await ensure('ActivityPopup singleton', () => prisma.activityPopup.findUnique({ where: { id: 'singleton' } }),
    () => prisma.activityPopup.create({
      data: {
        id: 'singleton',
        enabled: true,
        title: '🎰 幸运转盘 限时活动',
        description: '新用户注册送 1 次抽奖机会，邀请好友最多 3 次！',
        buttonText: '✨ 立即抽奖 ✨',
        linkUrl: '/lucky-wheel',
        showCondition: 'all',
      },
    }))

  console.log('\n【幸运转盘奖品】（只补缺失，不动已有库存）')
  for (const p of WHEEL_PRIZES) {
    await ensure(`WheelPrize ${p.label}`, () => prisma.wheelPrize.findUnique({ where: { id: p.id } }),
      () => prisma.wheelPrize.create({ data: p }))
  }

  console.log('\n【积分规则】（与代码默认值一致：50 / 100 / 30）')
  for (const r of POINT_RULES) {
    await ensure(`PointRule ${r.eventType}`, () => prisma.pointRule.findUnique({ where: { eventType: r.eventType } }),
      () => prisma.pointRule.create({ data: r }))
  }

  console.log('\n【商品】')
  for (const p of PRODUCTS) {
    await ensure(`Product ${p.name}`, () => prisma.product.findFirst({ where: { name: p.name } }),
      () => prisma.product.create({ data: p }))
  }

  console.log('\n【积分商城商品】')
  for (const s of SHOP_ITEMS) {
    await ensure(`ShopItem ${s.name}`, () => prisma.shopItem.findFirst({ where: { name: s.name } }),
      () => prisma.shopItem.create({ data: s }))
  }

  console.log('\n【促销优惠码】')
  for (const c of PROMO_COUPONS) {
    const validTo = new Date(Date.now() + c.validDays * 86400_000)
    await ensure(`PromoCoupon ${c.code}`, () => prisma.promoCoupon.findUnique({ where: { code: c.code } }),
      () => prisma.promoCoupon.create({
        data: {
          code: c.code,
          discountType: c.discountType,
          discountValue: c.discountValue,
          validFrom: new Date(),
          validTo,
          maxUses: c.maxUses,
          isActive: true,
        },
      }))
  }

  console.log('\n【论坛帖子】（状态直接置为 APPROVED，作者留空＝官方发布）')
  for (const p of POSTS) {
    await ensure(`Post ${p.title}`, () => prisma.post.findFirst({ where: { title: p.title } }),
      () => prisma.post.create({
        data: {
          title: p.title,
          summary: p.summary,
          content: p.content,
          board: p.board,
          type: p.type,
          status: PostStatus.APPROVED,
          isPinned: p.isPinned,
          authorId: null,
        },
      }))
  }

  console.log('\n【历代作品（占位）】')
  for (const [i, c] of CAROUSELS.entries()) {
    const completedAt = new Date()
    completedAt.setMonth(completedAt.getMonth() - c.monthsAgo)
    await ensure(`Carousel ${c.courseName}`, () => prisma.carousel.findFirst({ where: { courseName: c.courseName } }),
      () => prisma.carousel.create({
        data: {
          courseName: c.courseName,
          orderType: c.orderType,
          review: c.review,
          orderNoMask: c.orderNoMask,
          imageUrl: c.imageUrl,
          completedAt,
          sortOrder: i + 1,
          isActive: true,
        },
      }))
  }

  const after = await snapshot([...TOUCHED_TABLES, ...GUARDED_TABLES])
  diffLine('本次涉及的展示表', before, after, TOUCHED_TABLES)
  diffLine('必须保持不变的数据（应全为 0 变化）', before, after, GUARDED_TABLES)

  console.log(`\n合计：新建 ${created.length} 条，跳过 ${skipped.length} 条（已存在）`)
  if (DRY_RUN) console.log('（DRY RUN，未写入任何数据）')
}

main()
  .catch((e) => { console.error('❌ 执行失败：', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
