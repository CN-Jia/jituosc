-- 新增需求订单的管理端通知类型
--
-- 背景：上线后发现新需求订单（orders 表）不会产生任何管理端通知，
-- 而 SERVERCHAN_TOKEN 又未配置，导致「用户下单 → 管理员完全不知道」。
-- 站内通知不依赖外部服务，因此把 NEW_ORDER 加进枚举。
--
-- 说明：ALTER TYPE ... ADD VALUE 是**纯增量**操作，不影响已有数据；
-- 在 PostgreSQL 12+ 允许在事务中执行（但不能在同一事务里使用该新值）。

ALTER TYPE "AdminNotifyType" ADD VALUE IF NOT EXISTS 'NEW_ORDER';
