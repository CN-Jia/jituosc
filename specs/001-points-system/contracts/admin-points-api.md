# API 契约：管理端积分接口

**Base**: `/api/admin`  
**Auth**: Admin JWT

---

## 积分规则配置

### GET /admin/points/rules
获取所有积分规则

**Response 200**
```json
{
  "rules": [
    { "eventType": "INVITE_REGISTER", "points": 50, "enabled": true },
    { "eventType": "INVITE_FIRST_ORDER", "points": 100, "enabled": true },
    { "eventType": "NEW_USER_FIRST_ORDER", "points": 30, "enabled": true }
  ]
}
```

### PUT /admin/points/rules/:eventType
更新某条规则

**Body**
```json
{ "points": 80, "enabled": true }
```

**Response 200**: `{ "ok": true }`

---

## 用户积分管理

### GET /admin/points/users
用户积分列表（含余额，支持搜索）

**Query**: `keyword=张三&page=1&pageSize=20`

**Response 200**
```json
{
  "total": 100,
  "list": [
    {
      "userId": "xxx",
      "nickname": "张三",
      "username": "zhangsan",
      "totalPoints": 320,
      "frozenPoints": 100,
      "lifetimeEarned": 500
    }
  ]
}
```

### POST /admin/points/adjust
手动调整用户积分

**Body**
```json
{
  "userId": "xxx",
  "delta": 100,       // 正数增加，负数减少
  "remark": "活动奖励"
}
```

**Response 200**: `{ "newBalance": 420 }`

---

## 商城商品管理

### GET /admin/shop/items
获取全部商品（含已下架）

### POST /admin/shop/items
新建商品

**Body**
```json
{
  "name": "基础作业兑换券",
  "description": "可兑换一次基础难度作业代做服务",
  "coverUrl": "https://...",
  "type": "SERVICE",
  "pointsCost": 500,
  "stock": -1,
  "discountAmt": null,
  "isActive": true,
  "sortOrder": 0
}
```

### PUT /admin/shop/items/:id
更新商品（同上 Body 字段可选）

### DELETE /admin/shop/items/:id
删除商品（若有关联待审核兑换订单则拒绝删除）

---

## 兑换订单审核

### GET /admin/redeem/orders
获取兑换订单列表

**Query**: `status=PENDING|COMPLETED|REJECTED&page=1&pageSize=20`

**Response 200**
```json
{
  "total": 20,
  "list": [
    {
      "id": "zzz",
      "user": { "nickname": "张三", "username": "zhangsan" },
      "shopItem": { "name": "基础作业兑换券", "type": "SERVICE" },
      "pointsCost": 500,
      "status": "PENDING",
      "createdAt": "2026-04-28T12:00:00Z"
    }
  ]
}
```

### POST /admin/redeem/orders/:id/approve
审核通过：正式扣积分，若商品为 COUPON 类型则生成 Coupon 记录

**Body**: `{ "note": "已安排" }` (可选)

**Response 200**: `{ "ok": true }`

### POST /admin/redeem/orders/:id/reject
审核拒绝：解冻积分

**Body**: `{ "note": "库存不足，暂时无法兑换" }`

**Response 200**: `{ "ok": true }`
