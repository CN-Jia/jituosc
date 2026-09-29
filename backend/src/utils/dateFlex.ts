/** 轮播等场景：支持 YYYY-MM-DD（默认当日 UTC 12:00）或任意可被 Date 解析的字符串 */
export function parseFlexibleCompletedAt(input: string): Date {
  const s = input.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(`${s}T12:00:00.000Z`)
  }
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) {
    throw new Error('INVALID_DATE')
  }
  return d
}
