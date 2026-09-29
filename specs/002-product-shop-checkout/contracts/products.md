# API Contract: 商品（Products）

Base URL: `/api`  
Auth: Bearer JWT（除非标注"无需登录"）

---

## GET /products
获取商品列表（仅返回 isActive=true 的商品，按 sortOrder 升序）

**Response 200**
```json
{
  "products": [
    {
      "id": "clxxx",
      "name": "论文代写 · 基础版",
      "description": "3000字以内，3天交付",
      "imageUrl": "https://cdn.example.com/products/basic.png",
      "price": "299.00"
    }
  ]
}
```

---

## GET /products/:id
获取商品详情

**Response 200**
```json
{
  "id": "clxxx",
  "name": "论文代写 · 基础版",
  "description": "详细说明...",
  "imageUrl": "https://...",
  "price": "299.00"
}
```

**Response 404**
```json
{ "error": "PRODUCT_NOT_FOUND" }
```

---

## GET /payment-config
获取收款码配置（用户在支付弹窗展示）

**Response 200**
```json
{
  "wechatUrl": "https://...",
  "alipayUrl": "https://..."
}
```
