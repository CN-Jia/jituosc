import fp from 'fastify-plugin'
import fastifyCors from '@fastify/cors'
import { env } from '../config/env.js'

export default fp(async (fastify) => {
  fastify.register(fastifyCors, {
    origin: env.NODE_ENV === 'development'
      ? true
      : [env.APP_BASE_URL],
    credentials: true,
  })
})
