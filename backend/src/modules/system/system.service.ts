// system 模块业务逻辑：管理员登录

import bcrypt from 'bcrypt'
import { env } from '../../config/env.js'

export async function adminLogin(
  username: string,
  password: string,
): Promise<boolean> {
  if (username !== env.ADMIN_USERNAME) return false
  return bcrypt.compare(password, env.ADMIN_PASSWORD_HASH)
}
