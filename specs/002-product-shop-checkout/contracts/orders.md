# API Contract: 订单（Orders）

Base URL: `/api`  
Auth: Bearer JWT

---

## POST /orders
创建新订单

**Request Body**
```json
{
  "productId": "clxxx",
  "couponCode": "SUMMER20",   // 可选
  "userNote": "需要APA格式"    // 可选，用户需求说明
}
```

**Response 201**
```json
{
  "orderId": "clyyy",
  "orderNo": "ORD-20260429-A3B2C",
  "originalPrice": "299.00",
  "discountAmount": "59.80",
  "paidPrice": "239.20",
  "status": "CREATED"
}
```

**Response 400**
```json
{ "error": "COUPON_INVALID" }
// or
{ "error": "COUPON_EXPIRED" }
// or
{ "error": "COUPON_USED_UP" }
// or
{ "error": "PRODUCT_NOT_FOUND" }
```

---

## GET /orders/my
获取当前用户的订单列表（按 createdAt 降序）

**Query Params**: `?page=1&limit=20&status=CREATED`（status 可选过滤）

**Response 200**
```json
{
  "orders": [
    {
      "id": "clyyy",
      "orderNo": "ORD-20260429-A3B2C",
      "productName": "论文代写 · 基础版",
      "productImageUrl": "https://...",
      "paidPrice": "239.20",
      "status": "CREATED",
      "createdAt": "2026-04-29T05:45:00Z"
    }
  ],
  "total": 1
}
```

---

## GET /orders/my/:id
获取订单详情

**Response 200**
```json
{
  "id": "clyyy",
  "orderNo": "ORD-20260429-A3B2C",
  "product": { "id": "clxxx", "name": "...", "imageUrl": "..." },
  "originalPrice": "299.00",
  "discountAmount": "59.80",
  "paidPrice": "239.20",
  "status": "CREATED",
  "userNote": "需要APA格式",
  "createdAt": "2026-04-29T05:45:00Z",
  "paidAt": null,
  "completedAt": null
}
```

---

## POST /orders/:id/pay
用户标记"我已支付"（状态 CREATED → PAID）

**Response 200**
```json
{ "status": "PAID", "paidAt": "2026-04-29T05:50:00Z" }
```

**Response 400**
```json
{ "error": "ORDER_STATUS_INVALID" }
// 订单不在 CREATED 状态
```

**Response 403**
```json
{ "error": "FORBIDDEN" }
// 非订单所有者
```

---

## POST /orders/:id/cancel
用户取消订单（仅允许 CREATED 状态）

**Response 200**
```json
{ "status": "CANCELLED" }
```

---

## Admin Routes（需管理员 Token）

### GET /admin/orders
获取所有订单，支持筛选

**Query Params**: `?page=1&limit=20&status=PAID&keyword=ORD-`

**Response 200**
```json
{
  "orders": [
    {
      "id": "clyyy",
      "orderNo": "ORD-20260429-A3B2C",
      "userName": "张三",
      "userEmail": "z@example.com",
      "productName": "论文代写 · 基础版",
      "paidPrice": "239.20",
      "status": "PAID",
      "createdAt": "..."
    }
  ],
  "total": 5
}
```

---

### PUT /admin/orders/:id/complete
管理员确认完成（PAID → COMPLETED）

**Response 200**
```json
{ "status": "COMPLETED" }
```

---

### PUT /admin/orders/:id/cancel
管理员取消订单（CREATED 或 PAID → CANCELLED）

**Request Body**
```json
{ "reason": "商品下架，无法履约" }
```

**Response 200**
```json
{ "status": "CANCELLED" }
```
