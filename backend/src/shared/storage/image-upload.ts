// 图片上传的统一校验与落盘（各模块复用；未来换 OSS 只需替换这里）。
//
// 安全要点：
// 1. **只信文件内容**（魔数），不信客户端给的 filename / Content-Type：
//    把脚本改名成 .png 会被直接拒绝。content-type 与扩展名都只是提示，不作为依据。
// 2. **落盘文件名一律服务端生成**（随机名 + 由魔数推导的扩展名），
//    用户原始文件名绝不出现在磁盘路径里（防目录穿越、防覆盖、防扩展名注入）。
// 3. **先写 .tmp 再原子改名**，避免其他读者看到半截文件。
// 4. 原始文件名仅作展示用，且清理路径分隔符 / 控制字符并截断长度。
//
// 说明：这里手写魔数嗅探而不是引 file-type —— 后端是 CommonJS 构建，
// 而 file-type v17+ 为 ESM-only；本项目白名单只有 3 种格式，手写更可控且可单测。
// 若将来白名单显著扩大，再换用 file-type（v16 是最后的 CJS 版本）。

import fs from 'node:fs'
import path from 'node:path'
import { nanoid } from 'nanoid'
import type { MultipartFile } from '@fastify/multipart'

import { badRequest, payloadTooLarge } from '../../framework/errors.js'
import { ERROR_CODES } from '../../framework/response.js'
import { resolveUploadDir, toUploadUrl } from './paths.js'

/** 单张图片大小上限（5 MB） */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

/** 展示用原始文件名的最大长度 */
const MAX_DISPLAY_NAME_LENGTH = 80

export type AllowedImageType = 'image/png' | 'image/jpeg' | 'image/webp'

interface Signature {
  type: AllowedImageType
  ext: string
  matches: (buf: Buffer) => boolean
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const SIGNATURES: Signature[] = [
  {
    type: 'image/png',
    ext: '.png',
    matches: (b) => b.length >= 8 && b.subarray(0, 8).equals(PNG_MAGIC),
  },
  {
    type: 'image/jpeg',
    ext: '.jpg',
    // JPEG 以 SOI(FFD8) 开头，后跟一个标记（FFxx）
    matches: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    type: 'image/webp',
    ext: '.webp',
    // RIFF....WEBP
    matches: (b) =>
      b.length >= 12 &&
      b.toString('latin1', 0, 4) === 'RIFF' &&
      b.toString('latin1', 8, 12) === 'WEBP',
  },
]

/** 允许的 MIME 类型白名单 */
export const ALLOWED_IMAGE_TYPES: AllowedImageType[] = SIGNATURES.map((s) => s.type)

/** 按文件内容判断图片类型；不认识则返回 null */
export function sniffImageType(buffer: Buffer): AllowedImageType | null {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return null
  return SIGNATURES.find((s) => s.matches(buffer))?.type ?? null
}

/** 由嗅探结果推导扩展名（永远不取自用户文件名） */
export function extensionFor(type: AllowedImageType): string {
  return SIGNATURES.find((s) => s.type === type)?.ext ?? '.bin'
}

/** 清理展示用文件名：去掉路径与目录穿越、控制字符，并截断长度 */
export function sanitizeDisplayName(name: unknown): string {
  const raw = typeof name === 'string' ? name : ''
  const cleaned = path.posix
    .basename(raw.replace(/\\/g, '/'))    // 先把 Windows 分隔符归一，保证行为与平台无关
    .replace(/[\u0000-\u001f\u007f]/g, '') // 去掉控制字符
    .trim()
    .slice(0, MAX_DISPLAY_NAME_LENGTH)
  // '.' / '..' 之类不是有意义的展示名，一并回落
  return cleaned && cleaned !== '.' && cleaned !== '..' ? cleaned : '截图'
}

/** 人话可读的大小，用于错误提示 */
function formatMb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

/** 判断是否为 multipart 的大小超限错误（而不是网络中断等其它 I/O 错误） */
function isFileSizeError(err: unknown, file: MultipartFile): boolean {
  const e = err as { code?: string; statusCode?: number } | null
  if (e?.code === 'FST_REQ_FILE_TOO_LARGE' || e?.statusCode === 413) return true
  // 兜底：流被截断即说明触到了限制
  return Boolean(file.file?.truncated)
}

/**
 * 读取并校验上传的图片。
 * 校验失败抛 HttpError：类型不符 400 FILE_TYPE_INVALID / 超出大小 413 FILE_TOO_LARGE。
 */
export async function readValidatedImage(
  file: MultipartFile,
  maxBytes: number = MAX_IMAGE_BYTES,
): Promise<{ buffer: Buffer; type: AllowedImageType; size: number }> {
  let buffer: Buffer
  try {
    buffer = await file.toBuffer()
  } catch (err) {
    // 只有确实是超限才转成 413，其它 I/O 错误照常上抛（避免掩盖真实故障）
    if (isFileSizeError(err, file)) {
      throw payloadTooLarge(`图片过大，请压缩到 ${formatMb(maxBytes)} 以内`)
    }
    throw err
  }

  if (file.file.truncated || buffer.length > maxBytes) {
    throw payloadTooLarge(`图片过大，请压缩到 ${formatMb(maxBytes)} 以内`)
  }
  if (buffer.length === 0) {
    throw badRequest('上传的文件为空', ERROR_CODES.FILE_TYPE_INVALID)
  }

  const type = sniffImageType(buffer)
  if (!type) {
    throw badRequest(
      `不支持的文件类型，仅允许 ${ALLOWED_IMAGE_TYPES.map((t) => t.replace('image/', '')).join(' / ')}`,
      ERROR_CODES.FILE_TYPE_INVALID,
    )
  }

  return { buffer, type, size: buffer.length }
}

export interface SavedImage {
  /** 落盘文件名（服务端生成） */
  storedName: string
  /** 对外访问路径（/uploads/xxx） */
  url: string
  /** 清理后的展示用文件名 */
  displayName: string
  size: number
  type: AllowedImageType
}

/**
 * 校验并保存图片到 UPLOAD_DIR，返回访问路径与元信息。
 * 只负责存储；数据库记录由调用方（service）负责，失败时调用方需回滚文件。
 */
export async function saveImageUpload(
  file: MultipartFile,
  maxBytes: number = MAX_IMAGE_BYTES,
): Promise<SavedImage> {
  const { buffer, type, size } = await readValidatedImage(file, maxBytes)

  const uploadDir = resolveUploadDir()
  fs.mkdirSync(uploadDir, { recursive: true })

  // 扩展名来自魔数，文件名由服务端生成 —— 用户输入不参与路径构造
  const storedName = `${nanoid(24)}${extensionFor(type)}`
  const finalPath = path.join(uploadDir, storedName)
  const tempPath = `${finalPath}.tmp`

  // 先写临时文件再改名：避免并发读取到半截内容
  try {
    await fs.promises.writeFile(tempPath, buffer, { flag: 'wx' })
    await fs.promises.rename(tempPath, finalPath)
  } catch (err) {
    await fs.promises.unlink(tempPath).catch(() => {})
    throw err
  }

  return {
    storedName,
    url: toUploadUrl(storedName),
    displayName: sanitizeDisplayName(file.filename),
    size,
    type,
  }
}
