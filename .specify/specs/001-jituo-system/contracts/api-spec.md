# API Contract: 极拓空间 RESTful API v3

**Version**: v3.0 | **Updated**: 2026-05-04（完整重写，匹配当前实现）
**Base URL**: `https://yourdomain.com/api`
**Auth**: Bearer JWT（Header: `Authorization: Bearer <token>`）

---

## 通用规范

### 统一响应格式

```json
// 成功
{ "success": true, "data": { ... } }

// 失败
{ "success": false, "error": { "code": "ORDER_NOT_FOUND", "message": "订单不存在" } }
```

### 错误码清单

| Code | HTTP | 说明 |
|------|------|------|
| `UNAUTHORIZED` | 401 | 未登录或 Token 无效 |
| `FORBIDDEN` | 403 | 无权限（非管理员） |
| `ORDER_NOT_FOUND` | 404 | 订单不存在 |
| `INVALID_STATUS_TRANSITION` | 422 | 状态流转不合法 |
| `VALIDATION_ERROR` | 400 | 请求参数校验失败 |
| `RATE_LIMITED` | 429 | 请求过于频繁 |
| `INTERNAL_ERROR` | 500 | 服务器内部错误 |

---

## 认证接口（Auth）

### POST `/auth/send-code` — 发送邮箱验证码

```json
// Request
{ "email": "user@example.com" }

// Response 200
{ "success": true, "data": { "message": "验证码已发送" } }
```

60秒冷却，5分钟有效。

### POST `/auth/register` — 用户注册

```json
// Request
{
  "username": "testuser",
  "nickname": "测试用户",
  "email": "user@example.com",
  "password": "pass1234",
  "phone": "13800138000",
  "wechatId": "wxid_xxx",
  "grade": "JUNIOR",
  "code": "123456"
}

// Response 200
{
  "success": true,
  "data": { "token": "eyJhbGci...", "userId": "clxxx...", "nickname": "测试用户" }
}
```

### POST `/auth/login` — 用户登录

```json
// Request
{ "identifier": "user@example.com", "password": "pass1234" }

// Response 200
{
  "success": true,
  "data": {
    "token": "eyJhbGci...",
    "userId": "clxxx...",
    "nickname": "测试用户",
    "username": "testuser",
    "email": "user@example.com"
  }
}
```

连续5次失败锁定5分钟。

### POST `/auth/forgot-password` — 忘记密码（发送重置验证码）

```json
// Request
{ "email": "user@example.com" }

// Response 200
{ "success": true, "data": { "message": "如果该邮箱已注册，验证码将发送到您的邮箱" } }
```

不泄露邮箱是否已注册。验证码10分钟有效，60秒冷却。

### POST `/auth/reset-password` — 重置密码

```json
// Request
{ "email": "user@example.com", "code": "123456", "newPassword": "newpass123" }

// Response 200
{ "success": true, "data": { "message": "密码重置成功，请使用新密码登录" } }
```

### POST `/auth/admin-login` — 管理员登录

```json
// Request
{ "username": "admin", "password": "your_password" }

// Response 200
{ "success": true, "data": { "token": "eyJhbGci..." } }
```

15分钟内5次失败封IP。

### GET `/auth/me` — 获取当前用户（需登录）

### PUT `/auth/profile` — 更新个人资料（需登录）

### PUT `/auth/password` — 修改密码（需登录）

### POST `/auth/resend-verification` — 重新发送邮箱验证（需登录）

### POST `/auth/verify-email` — 验证邮箱（需登录）

---

## 公开接口（无需登录）

### GET `/config` — 获取公开配置

```json
// Response 200
{ "success": true, "data": { "adminWechatId": "Jt--04" } }
```

### GET `/order-types` — 获取需求类型列表

只返回 `isActive = true` 的类型，按 `sortOrder` 升序。

### GET `/activities` — 获取活动/公告列表

```json
// Query: ?type=PROMO&page=1&pageSize=20

// Response 200
{
  "success": true,
  "data": {
    "list": [
      {
        "id": "...", "title": "...", "content": "...",
        "type": "PROMO", "startAt": "...", "endAt": "...",
        "isExpired": false, "daysLeft": 42
      }
    ],
    "total": 5, "page": 1, "pageSize": 20
  }
}
```

### GET `/carousel` — 获取轮播列表

### GET `/posts` — 论坛帖子列表

```json
// Query: ?type=ANNOUNCEMENT&page=1&pageSize=10

// Response 200
{
  "success": true,
  "data": {
    "list": [
      {
        "id": "...", "title": "...", "summary": "...", "cover": "...",
        "type": "ANNOUNCEMENT", "createdAt": "...",
        "author": { "nickname": "管理员" },
        "_count": { "comments": 5 }
      }
    ],
    "total": 10, "page": 1, "pageSize": 10
  }
}
```

### GET `/posts/:id` — 帖子详情 + 评论

---

## 订单接口（需登录）

### POST `/orders` — 创建订单

```json
// Request
{
  "courseName": "高等数学",
  "orderTypeId": "clxxx...",
  "grade": "JUNIOR",
  "deadline": "2026-06-30T00:00:00Z",
  "contactWechat": "wxid_xxx",
  "source": "PC"
}

// Response 200
{
  "success": true,
  "data": {
    "orderId": "...", "orderNo": "JT-20260419-A3F2",
    "status": "PENDING", "createdAt": "...",
    "adminWechatId": "Jt--04"
  }
}
```

### GET `/orders/my` — 我的订单（需登录）

### GET `/orders/:id` — 订单详情（需登录）

### POST `/posts` — 发帖（需登录，需邮箱验证）

### POST `/posts/:id/comments` — 评论（需登录，需邮箱验证）

### POST `/feedback` — 提交反馈（需登录）

### GET `/feedback/my` — 我的反馈（需登录）

### GET `/feedback/:id` — 反馈详情（需登录）

---

## 管理员接口（全部需要 admin JWT）

### GET `/admin/stats` — 数据统计

### GET `/admin/orders` — 订单列表（含状态汇总）

### GET `/admin/orders/:id` — 订单详情（含 adminNote）

### PATCH `/admin/orders/:id/status` — 更新订单状态

### POST `/admin/orders/:id/note` — 添加内部备注

### POST `/admin/orders/:id/quote` — 设置报价

### CRUD `/admin/order-types` — 需求类型管理

### CRUD `/admin/activities` — 活动管理

### GET `/admin/posts` — 帖子列表（含待审核）

### POST `/admin/posts` — 发布公告

### PUT `/admin/posts/:id` — 编辑帖子

### PATCH `/admin/posts/:id/status` — 审核帖子

### DELETE `/admin/posts/:id` — 删除帖子

### PATCH `/admin/comments/:id` — 隐藏/显示评论

### DELETE `/admin/comments/:id` — 删除评论

### GET `/admin/feedback` — 反馈列表

### POST `/admin/feedback/:id/reply` — 回复反馈（自动设为 REPLIED）

### PATCH `/admin/feedback/:id/status` — 更新反馈状态

### CRUD `/admin/carousel` — 轮播管理

### GET `/admin/users` — 用户列表

### PATCH `/admin/users/:id` — 启用/禁用用户

---

## 订单状态流转

```
PENDING → ACCEPTED → IN_PROGRESS → COMPLETED
任意状态 → CLOSED（终态）
```
