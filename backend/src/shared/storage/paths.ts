// 上传文件的路径与 URL 约定 —— 写入方（上传路由）与读取方（静态服务）必须共用这里的定义，
// 否则会出现"文件写在一个目录、URL 却指向另一个目录"的静默 404。

import path from 'node:path'
import { env } from '../../config/env.js'

/** 上传文件对外暴露的 URL 前缀。数据库里存的就是以此为前缀的路径（如 /uploads/ab12cd.png） */
export const UPLOAD_URL_PREFIX = '/uploads/'

/**
 * 上传目录的绝对路径。
 * 相对路径按进程工作目录解析（UPLOAD_DIR 默认 'uploads'）：
 * - 容器内 cwd 为 /app/backend，配合 compose 的 ./backend/uploads 卷
 * - PM2 部署时 cwd 为 /var/www/jituo
 */
export function resolveUploadDir(): string {
  const dir = env.UPLOAD_DIR
  return path.isAbsolute(dir) ? dir : path.resolve(process.cwd(), dir)
}

/** 由存储文件名生成对外 URL */
export function toUploadUrl(filename: string): string {
  return UPLOAD_URL_PREFIX + filename
}
