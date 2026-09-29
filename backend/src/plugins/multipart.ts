import fp from 'fastify-plugin'
import fastifyMultipart from '@fastify/multipart'

export default fp(async (fastify) => {
  fastify.register(fastifyMultipart, {
    limits: {
      fileSize: 100 * 1024 * 1024, // 100 MB
      files: 1,
    },
  })
})
