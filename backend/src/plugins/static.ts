// 上传文件静态服务：把 UPLOAD_DIR 挂到 /uploads/ 前缀。
//
// 背景：上传路由会把文件的访问路径（/uploads/xxx.png）写入数据库，但此前没有任何地方
// 提供这些文件 —— 后端未注册静态服务、Nginx 也没有对应 location，导致图片必然 404。
// 这里补齐后端这一侧；Nginx 侧由 deploy/nginx-docker.conf 与 deploy/nginx/jituo.conf
// 用 `location ^~ /uploads/` 反向代理到本服务（^~ 是为了不被静态资源正则 location 抢占）。

import fp from 'fastify-plugin'
import fastifyStatic from '@fastify/static'
import fs from 'node:fs'
import { resolveUploadDir, UPLOAD_URL_PREFIX } from '../shared/storage/paths.js'

export default fp(async (fastify) => {
  const root = resolveUploadDir()

  // 启动时确保目录存在：上传路由是懒创建的，若先有请求进来会读不到目录
  fs.mkdirSync(root, { recursive: true })

  await fastify.register(fastifyStatic, {
    root,
    prefix: UPLOAD_URL_PREFIX,
    index: false,   // 不因目录请求而返回 index.html
    list: false,    // 禁止目录列表（避免枚举用户上传内容）
    maxAge: '7d',
    // 路径穿越由 @fastify/static 自身规范化拦截（'..' 会被拒绝）
  })

  fastify.log.info(`📁 上传目录已挂载: ${UPLOAD_URL_PREFIX} -> ${root}`)
})
