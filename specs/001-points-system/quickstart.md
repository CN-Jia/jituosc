# Quickstart: 积分系统开发指南

## 本地开发启动

无需额外服务，复用现有 PostgreSQL + Fastify + Vue 环境。

```bash
# 1. 更新 Prisma schema 后重新生成客户端
cd backend
pnpm prisma db push
pnpm prisma generate

# 2. 初始化默认积分规则（首次部署执行一次）
# 在后台管理 → 积分规则页面手动设置，或通过 seed 脚本

# 3. 启动后端
pnpm dev

# 4. 启动前端（另开终端）
cd ../frontend
pnpm dev

# 5. 启动管理后台（另开终端）
cd ../admin
pnpm dev
```

## 关键业务流程

### 拉新积分触发点

**注册时**（`backend/src/routes/auth.ts` → `POST /auth/register`）：
```typescript
// 注册成功后，若 inviteCode 有效，触发邀请注册积分
if (inviteCode) {
  await pointsService.awardInviteRegister(inviterId)
}
```

**订单完成时**（`backend/src/routes/admin/orders.ts` → 状态变更为 COMPLETED）：
```typescript
// 若用户首次完成订单且有邀请关系
await pointsService.awardFirstOrder(userId)
```

### 积分发放（points.service.ts）

```typescript
// 所有积分操作在 Prisma 事务内执行
await prisma.$transaction(async (tx) => {
  const rule = await tx.pointRule.findUnique({ where: { eventType } })
  await tx.pointBalance.upsert({ ... increment totalPoints by rule.points ... })
  await tx.pointLog.create({ ... })
})
```

### 兑换冻结/扣减/解冻

```typescript
// 冻结：totalPoints -= N, frozenPoints += N
// 扣减（通过）：frozenPoints -= N（不再动 totalPoints，已在冻结时扣）
// 解冻（拒绝）：totalPoints += N, frozenPoints -= N
```

## 测试要点

| 场景 | 验证方式 |
|------|----------|
| 并发兑换不超扣 | 数据库直查 `point_balances` 确认 `totalPoints >= 0` |
| 自邀请不得积分 | 注册时检查 inviterId !== 新用户 id |
| 积分明细与余额一致 | `SUM(delta) == lifetimeEarned`，`totalPoints + frozenPoints` 等于实际控制值 |
| 兑换拒绝后积分归还 | REJECTED 后查询余额恢复 |

## 服务器部署

```bash
# 在服务器执行
cd /var/www/jituo
git pull origin 001-points-system   # 或 master（合并后）

cd backend
pnpm prisma db push                  # 应用新表
pnpm prisma generate
pnpm build

pm2 restart jituo-api --update-env

cd ../frontend && pnpm build
cd ../admin && pnpm build
```
