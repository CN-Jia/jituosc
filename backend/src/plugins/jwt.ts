import fp from 'fastify-plugin'
import fastifyJwt from '@fastify/jwt'
import { env } from '../config/env.js'

export default fp(async (fastify) => {
  fastify.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: env.JWT_EXPIRES_IN },
  })
})
