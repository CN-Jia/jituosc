'use strict';
/**
 * 文件中转站 —— 网页版
 *
 * 上传采用「分片 + 断点续传 + 逐片校验」：
 *   - 大文件切成固定大小的分片，单片失败只重传该片，不会前功尽弃
 *   - 每片带 SHA-256，服务端校验后才落盘，链路传输损坏能立刻发现
 *   - uploadId 由 (文件名, 大小, 修改时间) 推导，关掉页面重选同一个文件可续传
 */
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
const DATA_DIR = path.resolve(ROOT, CONFIG.dataDir || 'data');
const CHUNK_DIR = path.resolve(ROOT, CONFIG.chunkDir || 'chunks');
const PORT = CONFIG.port || 3010;
const SESSION_TTL = (CONFIG.sessionDays || 30) * 24 * 3600 * 1000;
const MAX_FILE = (CONFIG.maxFileMB || 2048) * 1024 * 1024;
const CHUNK_MAX = (CONFIG.maxChunkMB || 64) * 1024 * 1024;
const CHUNK_TTL = (CONFIG.chunkTTLHours || 24) * 3600 * 1000;

const fsp = fs.promises;
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(CHUNK_DIR, { recursive: true });

/* ---------------- 认证 ---------------- */
function sign(payload) {
  return crypto.createHmac('sha256', CONFIG.secret).update(payload).digest('hex');
}
function makeToken() {
  const payload = String(Date.now() + SESSION_TTL);
  return payload + '.' + sign(payload);
}
function verifyToken(t) {
  if (typeof t !== 'string') return false;
  const i = t.indexOf('.');
  if (i < 1) return false;
  const payload = t.slice(0, i);
  const sig = t.slice(i + 1);
  const expect = sign(payload);
  if (sig.length !== expect.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return false;
  return Number(payload) > Date.now();
}
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > -1) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
function requireAuth(req, res, next) {
  if (verifyToken(parseCookies(req).wd_token)) return next();
  res.status(401).json({ ok: false, error: '未登录或登录已过期' });
}

/* ---------------- 文件名安全 ---------------- */
function safePath(name) {
  if (typeof name !== 'string' || !name) return null;
  if (name.includes('/') || name.includes('\\') || name.includes('\0')) return null;
  if (name === '.' || name === '..') return null;
  const full = path.resolve(DATA_DIR, name);
  if (path.dirname(full) !== DATA_DIR) return null;
  return full;
}
function cleanName(raw) {
  let n = String(raw);
  // busboy 1.x 把文件名按 latin1 解码，中文会变乱码；2.x 已是 utf8。
  // 含 Latin-1 高位字符时尝试还原，还原后无替换符才采用（兼容 café.txt 这类真实文件名）
  if (/[\u0080-\u00ff]/.test(n)) {
    const conv = Buffer.from(n, 'latin1').toString('utf8');
    if (!conv.includes('\ufffd')) n = conv;
  }
  n = n.replace(/[\u0000-\u001f\u007f]/g, '').replace(/[\/\\]/g, '_').trim();
  n = n.replace(/^\.+/, '').slice(0, 200);
  return n || 'unnamed';
}
function uniqueName(dir, name) {
  const ext = path.extname(name);
  const base = path.basename(name, ext);
  let candidate = name;
  let i = 1;
  while (fs.existsSync(path.join(dir, candidate))) {
    candidate = `${base} (${i})${ext}`;
    i++;
  }
  return candidate;
}
function humanSize(n) {
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n < 10 && i > 0 ? n.toFixed(1) : Math.round(n)} ${u[i]}`;
}

/* ---------------- 分片存储 ---------------- */
const ID_RE = /^[a-f0-9]{16,64}$/;
function chunkDirOf(id) {
  const s = String(id || '');
  return ID_RE.test(s) ? path.join(CHUNK_DIR, s) : null;
}
function cleanStaleChunks() {
  const now = Date.now();
  fs.readdir(CHUNK_DIR, (err, names) => {
    if (err) return;
    for (const n of names) {
      if (!ID_RE.test(n)) continue;
      const d = path.join(CHUNK_DIR, n);
      fs.stat(d, (e, st) => {
        if (!e && st.isDirectory() && now - st.mtimeMs > CHUNK_TTL) {
          fs.rm(d, { recursive: true, force: true }, () => {});
        }
      });
    }
  });
}
cleanStaleChunks();
setInterval(cleanStaleChunks, 3600 * 1000).unref();

/* ---------------- 应用 ---------------- */
const app = express();
app.disable('x-powered-by');
// 只信任本机 nginx，这样 req.ip 取到 X-Forwarded-For 里的真实客户端 IP
app.set('trust proxy', '127.0.0.1');
app.use(express.json({ limit: '64kb' }));

/* 登录失败限流：同一 IP 15 分钟内最多 10 次 */
const LOGIN_MAX = 10, LOGIN_WINDOW = 15 * 60 * 1000;
const loginFails = new Map();
function loginBlocked(ip) {
  const rec = loginFails.get(ip);
  if (!rec) return 0;
  if (Date.now() > rec.until) { loginFails.delete(ip); return 0; }
  return rec.count >= LOGIN_MAX ? Math.ceil((rec.until - Date.now()) / 60000) : 0;
}
function loginFailed(ip) {
  const now = Date.now();
  const rec = loginFails.get(ip);
  if (!rec || now > rec.until) loginFails.set(ip, { count: 1, until: now + LOGIN_WINDOW });
  else rec.count++;
}

app.post('/login', (req, res) => {
  const ip = req.ip || 'unknown';
  const wait = loginBlocked(ip);
  if (wait) return res.status(429).json({ ok: false, error: `尝试次数过多，请 ${wait} 分钟后再试` });

  const pw = String((req.body && req.body.password) || '');
  const a = Buffer.from(pw);
  const b = Buffer.from(String(CONFIG.password));
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!ok) {
    loginFailed(ip);
    return res.status(403).json({ ok: false, error: '密码错误' });
  }
  loginFails.delete(ip);
  res.setHeader(
    'Set-Cookie',
    `wd_token=${makeToken()}; HttpOnly; SameSite=Lax; Secure; Path=${CONFIG.cookiePath || '/files'}; Max-Age=${Math.floor(SESSION_TTL / 1000)}`
  );
  res.json({ ok: true });
});

app.post('/logout', (req, res) => {
  res.setHeader('Set-Cookie', `wd_token=; HttpOnly; SameSite=Lax; Secure; Path=${CONFIG.cookiePath || '/files'}; Max-Age=0`);
  res.json({ ok: true });
});

app.get('/api/session', (req, res) => {
  res.json({ ok: true, authed: verifyToken(parseCookies(req).wd_token) });
});

app.get('/api/list', requireAuth, (req, res) => {
  let names = [];
  try { names = fs.readdirSync(DATA_DIR); } catch (e) { return res.status(500).json({ ok: false, error: '读取目录失败' }); }
  const items = [];
  for (const n of names) {
    let st;
    try { st = fs.statSync(path.join(DATA_DIR, n)); } catch (e) { continue; }
    if (!st.isFile()) continue;
    items.push({ name: n, size: st.size, sizeText: humanSize(st.size), mtime: st.mtimeMs });
  }
  items.sort((x, y) => y.mtime - x.mtime);

  let disk = null;
  try {
    const s = fs.statfsSync(DATA_DIR);
    disk = { free: humanSize(s.bavail * s.bsize), total: humanSize(s.blocks * s.bsize) };
  } catch (e) { /* 老内核忽略 */ }

  const total = items.reduce((s, i) => s + i.size, 0);
  res.json({ ok: true, items, count: items.length, totalText: humanSize(total), disk });
});

/* ---------------- 分片上传接口 ---------------- */

// 查询某次上传已收到哪些分片（断点续传的依据）
app.get('/api/chunk/status/:id', requireAuth, (req, res) => {
  const dir = chunkDirOf(req.params.id);
  if (!dir || !fs.existsSync(dir)) return res.json({ ok: true, received: [] });
  const received = [];
  let names = [];
  try { names = fs.readdirSync(dir); } catch (e) { return res.json({ ok: true, received: [] }); }
  for (const f of names) {
    if (!/^\d+$/.test(f)) continue;               // 忽略 .tmp 等中间文件
    try {
      const st = fs.statSync(path.join(dir, f));
      if (st.isFile()) received.push({ i: Number(f), size: st.size });
    } catch (e) { /* 并发删除，忽略 */ }
  }
  res.json({ ok: true, received });
});

// 接收单个分片：裸二进制体 + 元数据走请求头，省掉 multipart 解析开销
const rawChunk = express.raw({ type: () => true, limit: CHUNK_MAX });
app.post('/api/chunk', requireAuth, rawChunk, async (req, res) => {
  const dir = chunkDirOf(req.get('X-Upload-Id'));
  const index = Number(req.get('X-Chunk-Index'));
  const wantSum = String(req.get('X-Chunk-Sha256') || '').toLowerCase();

  if (!dir || !Number.isInteger(index) || index < 0 || index > 1e6) {
    return res.status(400).json({ ok: false, error: '参数错误' });
  }
  const body = req.body;
  if (!Buffer.isBuffer(body) || body.length === 0) {
    return res.status(400).json({ ok: false, error: '缺少分片数据' });
  }
  // 逐片校验：链路把数据传坏了立刻发现，让客户端重传这一片
  if (/^[a-f0-9]{64}$/.test(wantSum)) {
    const actual = crypto.createHash('sha256').update(body).digest('hex');
    if (actual !== wantSum) {
      return res.status(422).json({ ok: false, error: '分片校验不通过', retry: true });
    }
  }
  try {
    await fsp.mkdir(dir, { recursive: true });
    // 先写 .tmp 再改名：中途失败不会留下一个"看起来已收到"的残缺分片
    const tmp = path.join(dir, `${index}.tmp`);
    await fsp.writeFile(tmp, body);
    await fsp.rename(tmp, path.join(dir, String(index)));
  } catch (e) {
    return res.status(500).json({ ok: false, error: '写入分片失败' });
  }
  res.json({ ok: true, index, size: body.length });
});

// 合并分片
app.post('/api/chunk/complete', requireAuth, async (req, res) => {
  const { uploadId, name, total, size } = req.body || {};
  const dir = chunkDirOf(uploadId);
  const n = Number(total);
  if (!dir || !Number.isInteger(n) || n < 1 || n > 1e6) {
    return res.status(400).json({ ok: false, error: '参数错误' });
  }
  if (!fs.existsSync(dir)) {
    return res.status(409).json({ ok: false, error: '分片已过期，请重新上传', retry: true });
  }

  const missing = [];
  for (let i = 0; i < n; i++) {
    if (!fs.existsSync(path.join(dir, String(i)))) missing.push(i);
  }
  if (missing.length) {
    return res.status(409).json({ ok: false, error: `还缺 ${missing.length} 个分片`, missing: missing.slice(0, 50), retry: true });
  }

  const finalName = uniqueName(DATA_DIR, cleanName(name || 'unnamed'));
  const finalPath = path.join(DATA_DIR, finalName);
  const tmpPath = `${finalPath}.assembling`;
  try {
    const fh = await fsp.open(tmpPath, 'w');
    try {
      for (let i = 0; i < n; i++) {
        const buf = await fsp.readFile(path.join(dir, String(i)));
        await fh.write(buf);
      }
    } finally {
      await fh.close();
    }
    const st = await fsp.stat(tmpPath);
    if (size && st.size !== Number(size)) {
      await fsp.unlink(tmpPath);
      return res.status(409).json({ ok: false, error: `合并后大小不符（期望 ${size}，实际 ${st.size}）`, retry: true });
    }
    await fsp.rename(tmpPath, finalPath);
  } catch (e) {
    try { await fsp.unlink(tmpPath); } catch (x) { /* ignore */ }
    return res.status(500).json({ ok: false, error: '合并失败' });
  }

  fs.rm(dir, { recursive: true, force: true }, () => {});
  const st = fs.statSync(finalPath);
  res.json({ ok: true, name: finalName, size: st.size, sizeText: humanSize(st.size) });
});

// 小文件直传（保留：单请求、少两次往返）
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, DATA_DIR),
  filename: (req, file, cb) => cb(null, uniqueName(DATA_DIR, cleanName(file.originalname))),
});
const upload = multer({ storage, limits: { fileSize: MAX_FILE, files: 100 } });

app.post('/api/upload', requireAuth, (req, res) => {
  upload.array('files', 100)(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? `单个文件超过 ${CONFIG.maxFileMB || 2048}MB 上限` : '上传失败: ' + err.message;
      return res.status(400).json({ ok: false, error: msg });
    }
    const saved = (req.files || []).map((f) => ({ name: path.basename(f.filename), size: f.size, sizeText: humanSize(f.size) }));
    res.json({ ok: true, saved });
  });
});

app.get('/api/download/:name', requireAuth, (req, res) => {
  const full = safePath(req.params.name);
  if (!full || !fs.existsSync(full) || !fs.statSync(full).isFile()) {
    return res.status(404).json({ ok: false, error: '文件不存在' });
  }
  res.download(full, path.basename(full), (err) => { if (err && !res.headersSent) res.status(500).end(); });
});

app.post('/api/delete', requireAuth, (req, res) => {
  const full = safePath(req.body && req.body.name);
  if (!full || !fs.existsSync(full)) return res.status(404).json({ ok: false, error: '文件不存在' });
  try { fs.unlinkSync(full); } catch (e) { return res.status(500).json({ ok: false, error: '删除失败' }); }
  res.json({ ok: true });
});

app.get('/api/health', (req, res) => res.json({ ok: true, uptime: Math.round(process.uptime()) }));

app.use(express.static(path.join(ROOT, 'public'), {
  index: 'index.html',
  maxAge: '1h',
  setHeaders: (res, filePath) => {
    // 入口 HTML 必须不缓存，否则改版后用户会一直拿到旧页面
    if (path.basename(filePath) === 'index.html') {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  },
}));
app.use((req, res) => res.status(404).json({ ok: false, error: 'not found' }));

/* 统一错误处理：绝不把堆栈返回给客户端 */
app.use((err, req, res, next) => {
  console.error('[webdrop] error:', (err && err.message) || err);
  if (res.headersSent) return next(err);
  const code = Number((err && (err.status || err.statusCode)) || 500);
  const msg = code === 400 ? '请求格式错误'
    : code === 413 ? '分片过大'
    : code === 401 ? '未登录'
    : code < 500 ? '请求被拒绝'
    : '服务器内部错误';
  res.status(code >= 400 && code < 600 ? code : 500).json({ ok: false, error: msg });
});

process.on('uncaughtException', (e) => console.error('[webdrop] uncaught:', (e && e.stack) || e));
process.on('unhandledRejection', (e) => console.error('[webdrop] unhandled:', (e && e.stack) || e));

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[webdrop] listening on 127.0.0.1:${PORT}, data=${DATA_DIR}, chunks=${CHUNK_DIR}`);
});
