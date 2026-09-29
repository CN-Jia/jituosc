import { FastifyRequest, FastifyReply } from 'fastify'
import { errorResponse, ERROR_CODES } from '../utils/response.js'

export async function verifyJWT(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
  } catch {
    return reply.code(401).send(errorResponse(ERROR_CODES.UNAUTHORIZED, '请先登录'))
  }
}

export async function verifyAdmin(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
    const payload = request.user as { role?: string }
    if (payload.role !== 'admin') {
      return reply.code(403).send(errorResponse(ERROR_CODES.FORBIDDEN, '需要管理员权限'))
    }
  } catch {
    return reply.code(401).send(errorResponse(ERROR_CODES.UNAUTHORIZED, '请先登录'))
  }
}
