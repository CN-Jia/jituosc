# API Contract: 站内通知（Notifications）

Base URL: `/api`  
Auth: Bearer JWT（管理员 Token）

---

## GET /notifications
获取通知列表（管理员专用）

**Query Params**: `?unread=true&limit=20`

**Response 200**
```json
{
  "notifications": [
    {
      "id": "clnnn",
      "type": "ORDER_PAID",
      "summary": "用户 张三 已支付订单 ORD-20260429-A3B2C（¥239.20）",
      "orderId": "clyyy",
      "orderNo": "ORD-20260429-A3B2C",
      "isRead": false,
      "createdAt": "2026-04-29T05:50:00Z"
    }
  ],
  "unreadCount": 3
}
```

---

## PUT /notifications/:id/read
标记单条通知为已读

**Response 200**
```json
{ "isRead": true }
```

---

## PUT /notifications/read-all
标记所有通知为已读

**Response 200**
```json
{ "updated": 3 }
```

---

## 轮询策略

前端管理员铃铛组件轮询规则：
- 组件挂载时立即请求一次 `GET /notifications?unread=true&limit=1`（仅获取 `unreadCount`）
- 此后每 **30 秒** 轮询一次
- 管理员点击铃铛时切换为获取完整列表 `GET /notifications?limit=20`
- 铃铛下拉面板关闭时调用 `PUT /notifications/read-all`

**角标显示规则**：
- `unreadCount > 0`：显示红色角标数字（最大显示 99+）
- `unreadCount === 0`：不显示角标
