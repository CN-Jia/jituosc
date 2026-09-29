# API Contract: 优惠码（Coupons）

Base URL: `/api`  
Auth: Bearer JWT

---

## POST /coupons/validate
校验优惠码并预览折扣（不消耗使用次数）

**Request Body**
```json
{
  "code": "SUMMER20",
  "productId": "clxxx"
}
```

**Response 200**（校验通过）
```json
{
  "valid": true,
  "discountType": "PERCENTAGE",
  "discountValue": "20",
  "originalPrice": "299.00",
  "discountAmount": "59.80",
  "paidPrice": "239.20"
}
```

**Response 200**（校验失败）
```json
{
  "valid": false,
  "reason": "EXPIRED"
  // EXPIRED | USED_UP | NOT_FOUND | INACTIVE
}
```

---

## Admin Routes（需管理员 Token）

### GET /admin/coupons
获取优惠码列表

**Response 200**
```json
{
  "coupons": [
    {
      "id": "clzzz",
      "code": "SUMMER20",
      "discountType": "PERCENTAGE",
      "discountValue": "20",
      "validFrom": "2026-04-01T00:00:00Z",
      "validTo": "2026-04-30T23:59:59Z",
      "maxUses": 1,
      "usedCount": 0,
      "isActive": true
    }
  ]
}
```

---

### POST /admin/coupons
创建优惠码

**Request Body**
```json
{
  "code": "SUMMER20",
  "discountType": "PERCENTAGE",
  "discountValue": 20,
  "validFrom": "2026-04-01T00:00:00Z",
  "validTo": "2026-04-30T23:59:59Z",
  "maxUses": 1
}
```

**Response 201**
```json
{ "id": "clzzz", "code": "SUMMER20" }
```

**Response 400**
```json
{ "error": "COUPON_CODE_EXISTS" }
```

---

### DELETE /admin/coupons/:id
删除优惠码（已使用的不允许删除）

**Response 200**
```json
{ "deleted": true }
```

**Response 400**
```json
{ "error": "COUPON_IN_USE" }
```

---

### PUT /admin/coupons/:id/deactivate
停用优惠码（软停用，不删除）

**Response 200**
```json
{ "isActive": false }
```
