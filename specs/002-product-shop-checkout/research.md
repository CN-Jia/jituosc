# Research: 商品列表与订单结算流程

**Feature**: 002-product-shop-checkout  
**Date**: 2026-04-29

---

## 决策 1：优惠码并发安全

**问题**：同一优惠码在高并发场景下可能被多人同时使用，导致超出单次使用限制。

**Decision**: Prisma 乐观锁（`version` 字段）+ 数据库层唯一约束  
**Rationale**: 项目并发量低（< 1000 用户），乐观锁足够处理偶发并发，无需引入 Redis 分布式锁。  
**Implementation**:
```typescript
// 使用 Prisma transaction 保证原子性
await prisma.$transaction(async (tx) => {
  const coupon = await tx.coupon.findUnique({ where: { code } })
  if (coupon.usedCount >= coupon.maxUses) throw new Error('COUPON_USED')
  await tx.coupon.update({
    where: { id: coupon.id, version: coupon.version }, // 乐观锁
    data: { usedCount: { increment: 1 }, version: { increment: 1 } }
  })
})
```
**Alternatives considered**: Redis SETNX 分布式锁（过度复杂）、数据库行锁 SELECT FOR UPDATE（Prisma 支持有限）

---

## 决策 2：管理员通知推送机制

**问题**：用户标记"已支付"后，需要实时/近实时通知管理员。

**Decision**: 前端轮询（Polling）每 30 秒请求一次未读通知数量  
**Rationale**: 项目规模小，轮询实现简单、无需额外基础设施，30s 延迟对人工核单业务完全可接受。  
**Implementation**: 管理员后台铃铛组件挂载时启动轮询 `/api/notifications?unread=1`，返回未读数量更新角标。  
**Alternatives considered**:
- SSE（Server-Sent Events）：实现稍复杂，Nginx 需特殊配置，当前阶段不必要
- WebSocket：引入新依赖（Socket.io），过度设计

---

## 决策 3：旧订单系统迁移策略

**问题**：新系统取代旧系统，但生产数据库中可能存在历史订单数据（旧版 `Order` 表）。

**Decision**: 重命名旧表保留历史数据，新建 `Product`/`ProductOrder` 表作为新系统  
**Rationale**: 完全删除旧表有丢失历史数据风险；重命名保留历史记录，同时不影响新系统运行。  
**Migration Plan**:
1. 备份数据库（`pg_dump`）
2. 重命名旧表：`Order` → `OrderLegacy`，`OrderType` → `OrderTypeLegacy`
3. 创建新表：`Product`、`ProductOrder`、`Coupon`、`PaymentConfig`、`Notification`
4. 前后台路由切换到新表
5. 旧路由（`/api/orders` 旧版、`/api/order-types`）下线
**Alternatives considered**: 完全删除（数据丢失风险）、双写过渡（过于复杂）

---

## 决策 4：收款码图片存储

**问题**：微信和支付宝收款码图片需要持久化存储并可被更新。

**Decision**: 图片作为 Base64 或 URL 存储在数据库 `PaymentConfig` 表中，沿用现有轮播图上传机制  
**Rationale**: 轮播图管理已有图片上传逻辑，直接复用，不引入新的存储方案。收款码图片数量少（仅 2 张），数据库存储 URL 完全够用。  
**Alternatives considered**: 本地文件系统（无 CDN 加速）、OSS（引入新付费服务）

---

## 决策 5：订单号生成格式

**问题**：订单号需要唯一、可读，且用于支付备注便于核对。

**Decision**: 格式 `ORD-YYYYMMDD-XXXXX`（日期 + 5 位随机字母数字）  
**Rationale**: 可读性好，用户备注时易识别，碰撞概率极低（36^5 = 60M 种组合/天）。  
**Implementation**:
```typescript
function generateOrderNo(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase()
  return `ORD-${date}-${rand}`
}
```
**Alternatives considered**: UUID（太长，不适合备注）、自增 ID（暴露业务量）
