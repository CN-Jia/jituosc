import fp from 'fastify-plugin'
import fastifyMultipart from '@fastify/multipart'

export default fp(async (fastify) => {
  fastify.register(fastifyMultipart, {
    limits: {
      // 全局兜底上限（防止任何上传点被灌大文件）。
      // 各上传点的真实限制应当更严，并在解析时就传入，例如图片：
      //   req.file({ limits: { fileSize: MAX_IMAGE_BYTES } })  // 5MB，见 shared/storage/image-upload.ts
      fileSize: 10 * 1024 * 1024, // 10 MB
      files: 1,
    },
  })
})
