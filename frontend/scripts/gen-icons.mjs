/**
 * 生成 PWA & iOS 所需图标
 * 运行：node scripts/gen-icons.mjs
 * 依赖：pnpm add -D @resvg/resvg-js
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const svgPath = resolve(root, 'public/logo.svg')

async function main() {
  let Resvg
  try {
    const mod = await import('@resvg/resvg-js')
    Resvg = mod.Resvg
  } catch {
    console.error('请先安装依赖: pnpm add -D @resvg/resvg-js')
    process.exit(1)
  }

  const svg = readFileSync(svgPath, 'utf-8')

  const sizes = [
    { name: 'apple-touch-icon.png', size: 180 },
    { name: 'icon-192.png',          size: 192 },
    { name: 'icon-512.png',          size: 512 },
    { name: 'favicon-32.png',        size: 32  },
  ]

  for (const { name, size } of sizes) {
    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: size },
      background: '#050d1a',
    })
    const pngData = resvg.render()
    const pngBuffer = pngData.asPng()
    const outPath = resolve(root, 'public', name)
    writeFileSync(outPath, pngBuffer)
    console.log(`✓ ${name} (${size}x${size})`)
  }
  console.log('\n所有图标已生成到 public/')
}

main()
