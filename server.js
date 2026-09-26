const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const { Redis } = require('@upstash/redis');
const { put } = require('@vercel/blob');

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
}

const app = express();
const IS_VERCEL = Boolean(process.env.VERCEL);
const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const DATA_FILE = path.join(DATA_DIR, 'portfolio.json');
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin_saini';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || ADMIN_PASSWORD;
const sessions = new Map();
const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const redis = redisUrl && redisToken
  ? new Redis({
      url: redisUrl,
      token: redisToken
    })
  : null;
const DATA_KEY = 'himanshu-portfolio:data';
const LOCK_KEY = 'himanshu-portfolio:data-lock';

if (!IS_VERCEL) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
if (!ADMIN_PASSWORD) {
  throw new Error('Set ADMIN_PASSWORD before starting the portfolio server.');
}
if (IS_VERCEL && !redis) {
  throw new Error('Configure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for persistent Vercel data.');
}
if (IS_VERCEL && !process.env.BLOB_READ_WRITE_TOKEN) {
  throw new Error('Connect Vercel Blob and configure BLOB_READ_WRITE_TOKEN for certificate and project uploads.');
}

const defaults = {
  skills: [
    { id: 'skill-html', name: 'HTML5', percentage: 95 },
    { id: 'skill-css', name: 'CSS3', percentage: 90 },
    { id: 'skill-js', name: 'JavaScript', percentage: 88 },
    { id: 'skill-bootstrap', name: 'Bootstrap', percentage: 85 },
    { id: 'skill-react', name: 'React', percentage: 80 },
    { id: 'skill-design', name: 'UI/UX Design', percentage: 75 }
  ],
  certificates: [
    { id: 'cert-web', title: 'Web Development', description: 'Responsive website design and frontend development.', imageUrl: '' },
    { id: 'cert-design', title: 'UI/UX Design', description: 'Modern user interface and user experience principles.', imageUrl: '' },
    { id: 'cert-js', title: 'JavaScript', description: 'Interactive web application development.', imageUrl: '' }
  ],
  projects: [
    { id: 'project-digital', title: 'Digital Project', description: 'A bold, mobile-ready portfolio built to highlight skills and attract clients.', imageUrl: 'https://cdn.prod.website-files.com/699d89a895b20cd0bc619dbf/699d8a0879981377f6b7deca_e2bf76c9-cac9-4ce8-a41d-f90cbd771b3d.avif' },
    { id: 'project-interface', title: 'Interface Design', description: 'Seamless process with clear updates and vibrant sites delivered on time.', imageUrl: 'https://cdn.prod.website-files.com/699d89a895b20cd0bc619dbf/699d8a0879981377f6b7dee4_9e82fe9d-019e-4fdc-b64a-c7c5e2821de2.avif' },
    { id: 'project-saas', title: 'B2B SaaS', description: 'Modern, tech-inspired design with fast turnaround.', imageUrl: 'https://cdn.prod.website-files.com/699d89a895b20cd0bc619dbf/699d8a0879981377f6b7debe_25eb4b55-607f-46f6-aba0-1fcf0b7b78fb.avif' }
  ],
  chatMessages: [{ id: 'chat-welcome', sender: 'assistant', text: 'Hello! How can I help you today?', date: new Date().toISOString() }],
  contactMessages: []
};

function readData() {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return {
      skills: Array.isArray(data.skills) ? data.skills : [],
      certificates: Array.isArray(data.certificates) ? data.certificates : [],
      projects: Array.isArray(data.projects) ? data.projects : defaults.projects,
      chatMessages: Array.isArray(data.chatMessages) ? data.chatMessages : [],
      contactMessages: Array.isArray(data.contactMessages) ? data.contactMessages : []
    };
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('Could not read portfolio data:', error.message);
    return JSON.parse(JSON.stringify(defaults));
  }
}

function normalizeData(value) {
  const saved = typeof value === 'string' ? JSON.parse(value) : value;
  return {
    skills: Array.isArray(saved?.skills) ? saved.skills : [],
    certificates: Array.isArray(saved?.certificates) ? saved.certificates : [],
    projects: Array.isArray(saved?.projects) ? saved.projects : defaults.projects,
    chatMessages: Array.isArray(saved?.chatMessages) ? saved.chatMessages : defaults.chatMessages,
    contactMessages: Array.isArray(saved?.contactMessages) ? saved.contactMessages : []
  };
}

let data = readData();
async function saveData() {
  if (redis) {
    await redis.set(DATA_KEY, JSON.stringify(data));
    return;
  }
  const temporaryFile = `${DATA_FILE}.tmp`;
  fs.writeFileSync(temporaryFile, JSON.stringify(data, null, 2));
  fs.renameSync(temporaryFile, DATA_FILE);
}
if (!IS_VERCEL && !fs.existsSync(DATA_FILE)) {
  saveData().catch(error => {
    console.error('Could not initialize portfolio data:', error.message);
    process.exitCode = 1;
  });
}

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use('/data', (req, res) => res.status(404).json({ success: false, message: 'Not found.' }));
if (!IS_VERCEL) app.use('/uploads', express.static(UPLOAD_DIR));
app.use(express.static(PUBLIC_DIR));
app.use(['/api', '/contact', '/chat'], loadPersistentData);

async function loadPersistentData(req, res, next) {
  if (!redis) return next();
  try {
    const stored = await redis.get(DATA_KEY);
    if (stored) data = normalizeData(stored);
    next();
  } catch (error) {
    console.error('Could not load portfolio data from Redis:', error.message);
    res.status(503).json({ success: false, message: 'Portfolio storage is temporarily unavailable.' });
  }
}

async function withDataLock(req, res, next) {
  if (!redis) return next();
  const lockToken = crypto.randomBytes(24).toString('hex');
  try {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const acquired = await redis.set(LOCK_KEY, lockToken, { nx: true, ex: 30 });
      if (acquired === 'OK') {
        req.dataLockToken = lockToken;
        const stored = await redis.get(DATA_KEY);
        if (stored) data = normalizeData(stored);
        res.once('finish', () => {
          redis.eval(
            "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
            [LOCK_KEY],
            [lockToken]
          ).catch(error => console.error('Could not release portfolio data lock:', error.message));
        });
        return next();
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    res.status(503).json({ success: false, message: 'Portfolio storage is busy. Please retry in a moment.' });
  } catch (error) {
    console.error('Could not access portfolio storage lock:', error.message);
    res.status(503).json({ success: false, message: 'Portfolio storage is temporarily unavailable.' });
  }
}

const upload = multer({
  storage: IS_VERCEL
    ? multer.memoryStorage()
    : multer.diskStorage({
        destination: UPLOAD_DIR,
        filename: (req, file, callback) => {
          const extension = path.extname(file.originalname).toLowerCase();
          callback(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${extension}`);
        }
      }),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)) {
      return callback(new Error('Upload a JPG, PNG, WEBP, or GIF image.'));
    }
    callback(null, true);
  }
});

function getToken(req) {
  const match = (req.get('authorization') || '').match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : '';
}
function getTokenExpiry(token) {
  const [payload, signature, ...extra] = token.split('.');
  if (!payload || !signature || extra.length) return null;
  const expected = crypto.createHmac('sha256', ADMIN_SESSION_SECRET).update(payload).digest();
  let supplied;
  try {
    supplied = Buffer.from(signature, 'base64url');
  } catch {
    return null;
  }
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (session.username !== ADMIN_USERNAME || !Number.isSafeInteger(session.expiresAt) || session.expiresAt <= Date.now()) return null;
    return session.expiresAt;
  } catch {
    return null;
  }
}
function createToken(expiresAt) {
  const payload = Buffer.from(JSON.stringify({ username: ADMIN_USERNAME, expiresAt, nonce: crypto.randomBytes(16).toString('hex') })).toString('base64url');
  const signature = crypto.createHmac('sha256', ADMIN_SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}
async function requireAdmin(req, res, next) {
  const token = getToken(req);
  const expiresAt = getTokenExpiry(token);
  if (!token || !expiresAt) {
    sessions.delete(token);
    return res.status(401).json({ success: false, message: 'Your admin session expired. Please sign in again.' });
  }
  if (redis) {
    try {
      const active = await redis.exists(`himanshu-portfolio:session:${crypto.createHash('sha256').update(token).digest('hex')}`);
      if (!active) return res.status(401).json({ success: false, message: 'Your admin session expired. Please sign in again.' });
    } catch (error) {
      console.error('Could not verify admin session:', error.message);
      return res.status(503).json({ success: false, message: 'Admin authentication is temporarily unavailable.' });
    }
  } else if (sessions.get(token) !== expiresAt) {
    return res.status(401).json({ success: false, message: 'Your admin session expired. Please sign in again.' });
  }
  next();
}
function findById(collection, id) {
  return collection.findIndex(item => item.id === id);
}
function validText(value, max = 300) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
}
function validImageUrl(value) {
  if (!value) return true;
  if (typeof value !== 'string' || value.length > 2000) return false;
  return value.startsWith('/uploads/') || /^https?:\/\/\S+$/i.test(value);
}
function handleUpload(req, res, next) {
  upload.single('file')(req, res, error => {
    if (error) return res.status(400).json({ success: false, message: error.message });
    next();
  });
}

app.get('/', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));
app.get('/admin', (req, res) => res.redirect('/admin.html'));
app.get('/api/skills', (req, res) => res.json(data.skills));
app.get('/api/certificates', (req, res) => res.json(data.certificates));
app.get('/api/projects', (req, res) => res.json(data.projects));
app.get('/api/chat/replies', (req, res) => res.json(data.chatMessages.filter(message => message.sender === 'assistant')));

app.post('/admin/login', async (req, res) => {
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const expectedUser = Buffer.from(ADMIN_USERNAME);
  const suppliedUser = Buffer.from(username);
  const expectedPassword = Buffer.from(ADMIN_PASSWORD);
  const suppliedPassword = Buffer.from(password);
  const valid = expectedUser.length === suppliedUser.length &&
    expectedPassword.length === suppliedPassword.length &&
    crypto.timingSafeEqual(expectedUser, suppliedUser) &&
    crypto.timingSafeEqual(expectedPassword, suppliedPassword);
  if (!valid) return res.status(401).json({ success: false, message: 'Username or password is incorrect.' });

  const expiresAt = Date.now() + 8 * 60 * 60 * 1000;
  const token = createToken(expiresAt);
  if (redis) {
    try {
      await redis.set(
        `himanshu-portfolio:session:${crypto.createHash('sha256').update(token).digest('hex')}`,
        '1',
        { ex: 8 * 60 * 60 }
      );
    } catch (error) {
      console.error('Could not create admin session:', error.message);
      return res.status(503).json({ success: false, message: 'Admin authentication is temporarily unavailable.' });
    }
  } else {
    sessions.set(token, expiresAt);
  }
  res.json({ success: true, token, redirect: '/admin.html' });
});
app.get('/admin/verify', requireAdmin, (req, res) => res.json({ success: true }));
app.post('/admin/logout', async (req, res) => {
  const token = getToken(req);
  sessions.delete(token);
  if (redis && token) {
    try {
      await redis.del(`himanshu-portfolio:session:${crypto.createHash('sha256').update(token).digest('hex')}`);
    } catch (error) {
      console.error('Could not revoke admin session:', error.message);
      return res.status(503).json({ success: false, message: 'Could not safely sign out. Please try again.' });
    }
  }
  res.json({ success: true });
});

app.post('/api/upload', requireAdmin, handleUpload, async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'Choose an image file to upload.' });
  if (IS_VERCEL) {
    try {
      const blob = await put(
        `portfolio/${Date.now()}-${crypto.randomBytes(8).toString('hex')}${path.extname(req.file.originalname).toLowerCase()}`,
        req.file.buffer,
        { access: 'public', contentType: req.file.mimetype }
      );
      return res.json({ success: true, url: blob.url });
    } catch (error) {
      console.error('Could not upload certificate image to Vercel Blob:', error.message);
      return res.status(503).json({ success: false, message: 'Image storage is temporarily unavailable.' });
    }
  }
  res.json({ success: true, url: `/uploads/${req.file.filename}` });
});

app.post('/api/skills', requireAdmin, withDataLock, async (req, res) => {
  const { name, percentage } = req.body || {};
  const value = Number(percentage);
  if (!validText(name, 80) || !Number.isInteger(value) || value < 1 || value > 100) {
    return res.status(400).json({ success: false, message: 'Enter a skill name and a whole-number percentage from 1 to 100.' });
  }
  const item = { id: crypto.randomUUID(), name: name.trim(), percentage: value };
  data.skills.push(item); await saveData();
  res.status(201).json({ success: true, data: item });
});
app.put('/api/skills/:id', requireAdmin, withDataLock, async (req, res) => {
  const index = findById(data.skills, req.params.id);
  if (index < 0) return res.status(404).json({ success: false, message: 'Skill not found.' });
  const { name, percentage } = req.body || {};
  const value = Number(percentage);
  if (!validText(name, 80) || !Number.isInteger(value) || value < 1 || value > 100) {
    return res.status(400).json({ success: false, message: 'Enter a skill name and a whole-number percentage from 1 to 100.' });
  }
  data.skills[index] = { ...data.skills[index], name: name.trim(), percentage: value };
  await saveData(); res.json({ success: true, data: data.skills[index] });
});
app.delete('/api/skills/:id', requireAdmin, withDataLock, async (req, res) => {
  const index = findById(data.skills, req.params.id);
  if (index < 0) return res.status(404).json({ success: false, message: 'Skill not found.' });
  data.skills.splice(index, 1); await saveData(); res.json({ success: true });
});

app.post('/api/certificates', requireAdmin, withDataLock, async (req, res) => {
  const { title, description, imageUrl = '' } = req.body || {};
  if (!validText(title, 120) || !validText(description, 1000) || !validImageUrl(imageUrl)) {
    return res.status(400).json({ success: false, message: 'Enter a title and description (and a valid image URL if provided).' });
  }
  const item = { id: crypto.randomUUID(), title: title.trim(), description: description.trim(), imageUrl };
  data.certificates.push(item); await saveData();
  res.status(201).json({ success: true, data: item });
});
app.put('/api/certificates/:id', requireAdmin, withDataLock, async (req, res) => {
  const index = findById(data.certificates, req.params.id);
  if (index < 0) return res.status(404).json({ success: false, message: 'Certificate not found.' });
  const { title, description, imageUrl = '' } = req.body || {};
  if (!validText(title, 120) || !validText(description, 1000) || !validImageUrl(imageUrl)) {
    return res.status(400).json({ success: false, message: 'Enter a title and description (and a valid image URL if provided).' });
  }
  data.certificates[index] = { ...data.certificates[index], title: title.trim(), description: description.trim(), imageUrl };
  await saveData(); res.json({ success: true, data: data.certificates[index] });
});
app.delete('/api/certificates/:id', requireAdmin, withDataLock, async (req, res) => {
  const index = findById(data.certificates, req.params.id);
  if (index < 0) return res.status(404).json({ success: false, message: 'Certificate not found.' });
  data.certificates.splice(index, 1); await saveData(); res.json({ success: true });
});

app.post('/api/projects', requireAdmin, withDataLock, async (req, res) => {
  const { title, description, imageUrl = '' } = req.body || {};
  if (!validText(title, 120) || !validText(description, 1000) || !validImageUrl(imageUrl)) {
    return res.status(400).json({ success: false, message: 'Enter a project title, description, and valid image URL.' });
  }
  const item = { id: crypto.randomUUID(), title: title.trim(), description: description.trim(), imageUrl };
  data.projects.push(item); await saveData(); res.status(201).json({ success: true, data: item });
});
app.put('/api/projects/:id', requireAdmin, withDataLock, async (req, res) => {
  const index = findById(data.projects, req.params.id);
  if (index < 0) return res.status(404).json({ success: false, message: 'Project not found.' });
  const { title, description, imageUrl = '' } = req.body || {};
  if (!validText(title, 120) || !validText(description, 1000) || !validImageUrl(imageUrl)) {
    return res.status(400).json({ success: false, message: 'Enter a project title, description, and valid image URL.' });
  }
  data.projects[index] = { ...data.projects[index], title: title.trim(), description: description.trim(), imageUrl };
  await saveData(); res.json({ success: true, data: data.projects[index] });
});
app.delete('/api/projects/:id', requireAdmin, withDataLock, async (req, res) => {
  const index = findById(data.projects, req.params.id);
  if (index < 0) return res.status(404).json({ success: false, message: 'Project not found.' });
  data.projects.splice(index, 1); await saveData(); res.json({ success: true });
});

app.get('/api/chat-messages', requireAdmin, (req, res) => res.json(data.chatMessages));
app.post('/api/chat-messages', requireAdmin, withDataLock, async (req, res) => {
  const { sender = 'assistant', text } = req.body || {};
  if (!validText(sender, 80) || !validText(text, 1000)) {
    return res.status(400).json({ success: false, message: 'Enter a sender and message.' });
  }
  const item = { id: crypto.randomUUID(), sender: sender.trim(), text: text.trim(), date: new Date().toISOString() };
  data.chatMessages.push(item); await saveData(); res.status(201).json({ success: true, data: item });
});
app.put('/api/chat-messages/:id', requireAdmin, withDataLock, async (req, res) => {
  const index = findById(data.chatMessages, req.params.id);
  if (index < 0) return res.status(404).json({ success: false, message: 'Chat message not found.' });
  const { sender, text } = req.body || {};
  if (!validText(sender, 80) || !validText(text, 1000)) {
    return res.status(400).json({ success: false, message: 'Enter a sender and message.' });
  }
  data.chatMessages[index] = { ...data.chatMessages[index], sender: sender.trim(), text: text.trim() };
  await saveData(); res.json({ success: true, data: data.chatMessages[index] });
});
app.delete('/api/chat-messages/:id', requireAdmin, withDataLock, async (req, res) => {
  const index = findById(data.chatMessages, req.params.id);
  if (index < 0) return res.status(404).json({ success: false, message: 'Chat message not found.' });
  data.chatMessages.splice(index, 1); await saveData(); res.json({ success: true });
});
app.get('/api/contact-messages', requireAdmin, (req, res) => res.json(data.contactMessages));
app.post('/contact', withDataLock, async (req, res) => {
  const { name, email, message } = req.body || {};
  if (!validText(name, 120) || !validText(email, 254) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !validText(message, 3000)) {
    return res.status(400).json({ success: false, message: 'Enter a valid name, email, and message.' });
  }
  data.contactMessages.push({ id: crypto.randomUUID(), name: name.trim(), email: email.trim(), message: message.trim(), date: new Date().toISOString() });
  await saveData(); res.status(201).json({ success: true, message: 'Message sent successfully.' });
});
app.post('/chat', withDataLock, async (req, res) => {
  const { sender = 'visitor', text } = req.body || {};
  if (!validText(text, 1000)) return res.status(400).json({ success: false, message: 'Enter a message.' });
  data.chatMessages.push({ id: crypto.randomUUID(), sender: validText(sender, 80) ? sender.trim() : 'visitor', text: text.trim(), date: new Date().toISOString() });
  await saveData(); res.status(201).json({ success: true });
});

app.use((error, req, res, next) => {
  console.error('Request failed:', error.message);
  if (res.headersSent) return next(error);
  res.status(500).json({ success: false, message: 'The server could not complete that request.' });
});

if (IS_VERCEL) {
  module.exports = app;
} else {
  app.listen(PORT, () => console.log(`Portfolio running at http://localhost:${PORT}`));
}
