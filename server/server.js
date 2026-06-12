const express = require('express');
const cors = require('cors');
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const os = require('os');
const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk');
const { exec, spawn } = require('child_process');

const app = express();
const PORT = 3001;

// ─── Database ─────────────────────────────────────────────────────────────────

const DATA_DIR = path.join(os.homedir(), '.pluggen');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, 'pluggen.db');
const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS scan_paths (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    type       TEXT NOT NULL,
    path       TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS excluded_folders (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    path       TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS plugins (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    filename       TEXT NOT NULL,
    path           TEXT NOT NULL UNIQUE,
    format         TEXT NOT NULL,
    file_size      INTEGER DEFAULT 0,
    date_modified  TEXT,
    display_name   TEXT,
    vendor         TEXT DEFAULT '',
    notes          TEXT DEFAULT '',
    name_is_custom INTEGER DEFAULT 0,
    created_at     TEXT DEFAULT (datetime('now')),
    updated_at     TEXT DEFAULT (datetime('now'))
  );
`);

// Seed default plugin paths on first run
const pluginPathCount = db.prepare("SELECT COUNT(*) as n FROM scan_paths WHERE type = 'plugin'").get();
if (pluginPathCount.n === 0) {
  const ins = db.prepare('INSERT INTO scan_paths (type, path) VALUES (?, ?)');
  ins.run('plugin', 'C:\\Program Files\\Common Files\\VST3');
  ins.run('plugin', 'C:\\Program Files\\VstPlugins');
}

console.log(`  Database: ${DB_PATH}`);

// ─── Middleware ────────────────────────────────────────────────────────────────

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:4173', 'http://localhost:3000'] }));
app.use(express.json());

// ─── Plugin Scanner ────────────────────────────────────────────────────────────

let scanState = { running: false, found: 0, current: '', error: null, done: false };
let scrapeState = { running: false, done: false, error: null, logs: [] };

function formatFromExt(ext) {
  if (ext === '.vst3')     return 'vst3';
  if (ext === '.dll')      return 'vst2';
  if (ext === '.clap')     return 'clap';
  if (ext === '.component') return 'au';
  return ext.slice(1);
}

async function extractVst3Name(bundlePath) {
  // Modern bundles: moduleinfo.json at bundle root
  const candidates = [
    path.join(bundlePath, 'moduleinfo.json'),
    path.join(bundlePath, 'Contents', 'moduleinfo.json'),
  ];
  for (const candidate of candidates) {
    try {
      const raw = await fs.promises.readFile(candidate, 'utf8');
      const info = JSON.parse(raw);
      // Try top-level Name/Vendor first, then Classes array
      let name   = info.Name   || '';
      let vendor = info.Vendor || '';
      if (Array.isArray(info.Classes) && info.Classes.length > 0) {
        const cls = info.Classes.find(c => c.Category === 'Audio Module Class') || info.Classes[0];
        if (cls.Name)   name   = cls.Name;
        if (cls.Vendor) vendor = cls.Vendor;
      }
      if (name) return { name, vendor };
    } catch { /* try next */ }
  }
  return null;
}

async function doPluginScan() {
  const scanPaths = db.prepare("SELECT path FROM scan_paths WHERE type = 'plugin'").all();
  const excluded  = db.prepare('SELECT path FROM excluded_folders').all()
                      .map(r => r.path.toLowerCase());

  scanState = { running: true, found: 0, current: '', error: null, done: false };

  const upsert = db.prepare(`
    INSERT INTO plugins (filename, path, format, file_size, date_modified, display_name, vendor)
    VALUES (@filename, @path, @format, @file_size, @date_modified, @display_name, @vendor)
    ON CONFLICT(path) DO UPDATE SET
      filename      = excluded.filename,
      file_size     = excluded.file_size,
      date_modified = excluded.date_modified,
      display_name  = CASE WHEN name_is_custom = 0 THEN excluded.display_name ELSE display_name END,
      vendor        = CASE WHEN name_is_custom = 0 THEN excluded.vendor ELSE vendor END,
      updated_at    = datetime('now')
  `);

  async function processPlugin(pluginPath, stat) {
    scanState.current = path.basename(pluginPath);
    const ext    = path.extname(pluginPath).toLowerCase();
    const format = formatFromExt(ext);
    const filename = path.basename(pluginPath);

    let display_name = path.basename(pluginPath, ext);
    let vendor = '';

    if (format === 'vst3' && stat.isDirectory()) {
      const meta = await extractVst3Name(pluginPath);
      if (meta) { display_name = meta.name; vendor = meta.vendor; }
    }

    try {
      upsert.run({ filename, path: pluginPath, format, file_size: stat.size, date_modified: stat.mtime.toISOString(), display_name, vendor });
      scanState.found++;
    } catch { /* duplicate or locked */ }
  }

  async function walk(dir) {
    if (excluded.some(ex => dir.toLowerCase().startsWith(ex))) return;
    let entries;
    try { entries = await fs.promises.readdir(dir, { withFileTypes: true }); }
    catch { return; }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const ext = path.extname(entry.name).toLowerCase();

      if (entry.isDirectory()) {
        if (ext === '.vst3' || ext === '.clap' || ext === '.component') {
          // Treat as a bundle
          const stat = await fs.promises.stat(fullPath).catch(() => null);
          if (stat) await processPlugin(fullPath, stat);
        } else {
          await walk(fullPath);
        }
      } else if (entry.isFile()) {
        if (['.vst3', '.dll', '.clap', '.component'].includes(ext)) {
          const stat = await fs.promises.stat(fullPath).catch(() => null);
          if (stat) await processPlugin(fullPath, stat);
        }
      }
    }
  }

  try {
    for (const row of scanPaths) {
      try { await fs.promises.access(row.path); } catch { continue; }
      await walk(row.path);
    }
    db.prepare(
      "INSERT INTO settings (key,value) VALUES ('plugin_last_scan',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
    ).run(new Date().toISOString());
    scanState.running = false;
    scanState.done    = true;
  } catch (e) {
    scanState.running = false;
    scanState.error   = e.message;
  }
}

// ─── Routes: health & scraper ──────────────────────────────────────────────────

app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '0.3.0' }));

app.get('/api/get-cookie', (req, res) => {
  const envPath = path.join(__dirname, '../client/.env');
  let cookie = '';
  try {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      const match = content.match(/BB_SESSION=([^\r\n]*)/);
      if (match) {
        cookie = match[1].trim();
      }
    }
  } catch (err) {
    console.error('[Server API] Error reading cookie:', err.message);
  }
  res.json({ cookie });
});

app.post('/api/scrape', (req, res) => {
  const { cookie } = req.body;
  const envPath = path.join(__dirname, '../client/.env');
  
  if (scrapeState.running) {
    return res.status(400).json({ success: false, error: 'Scraper is already running.' });
  }
  
  try {
    if (cookie !== undefined) {
      fs.writeFileSync(envPath, `# Paste your RuTracker bb_session cookie below:\nBB_SESSION=${cookie.trim()}\n`, 'utf-8');
    }
    
    scrapeState = {
      running: true,
      done: false,
      error: null,
      logs: []
    };
    
    console.log('[Server API] Triggering scraper.js asynchronous background execution...');
    scrapeState.logs.push('[System] Starting scraper process...\n');
    
    const child = spawn('node', ['scraper.js'], { 
      cwd: path.join(__dirname, '../client'),
      env: { ...process.env }
    });
    
    child.stdout.on('data', (data) => {
      scrapeState.logs.push(data.toString());
    });
    
    child.stderr.on('data', (data) => {
      scrapeState.logs.push(data.toString());
    });
    
    child.on('error', (err) => {
      console.error('[Server API] Scraper failed to start:', err.message);
      scrapeState.running = false;
      scrapeState.error = err.message;
      scrapeState.logs.push(`[System Error] Failed to start scraper: ${err.message}\n`);
    });
    
    child.on('close', (code) => {
      scrapeState.running = false;
      if (code === 0) {
        scrapeState.done = true;
        scrapeState.logs.push('\n[System] Scraper finished successfully!\n');
        console.log('[Server API] Scraper completed successfully.');
      } else {
        scrapeState.error = `Exit code ${code}`;
        scrapeState.logs.push(`\n[System Error] Scraper exited with code ${code}\n`);
        console.error(`[Server API] Scraper failed with exit code ${code}`);
      }
    });
    
    res.json({ success: true, message: 'Scraper started in background.' });
  } catch (err) {
    console.error('[Server API] Error starting scraper:', err.message);
    res.status(500).json({ success: false, log: err.message });
  }
});

app.get('/api/scrape/status', (req, res) => {
  res.json(scrapeState);
});

// ─── Routes: scan paths ────────────────────────────────────────────────────────

app.get('/api/scan-paths', (req, res) => {
  const { type } = req.query;
  if (!type) return res.status(400).json({ error: 'type required' });
  res.json(db.prepare('SELECT id, path, created_at FROM scan_paths WHERE type = ? ORDER BY id').all(type));
});

app.post('/api/scan-paths', (req, res) => {
  const { type, path: p } = req.body;
  if (!type || !p?.trim()) return res.status(400).json({ error: 'type and path required' });
  try {
    const result = db.prepare('INSERT INTO scan_paths (type, path) VALUES (?, ?)').run(type, p.trim());
    res.json({ id: Number(result.lastInsertRowid), type, path: p.trim() });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/scan-paths/:id', (req, res) => {
  db.prepare('DELETE FROM scan_paths WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ─── Routes: excluded folders ──────────────────────────────────────────────────

app.get('/api/excluded-folders', (req, res) => {
  res.json(db.prepare('SELECT id, path FROM excluded_folders ORDER BY id').all());
});

app.post('/api/excluded-folders', (req, res) => {
  const { path: p } = req.body;
  if (!p?.trim()) return res.status(400).json({ error: 'path required' });
  try {
    const result = db.prepare('INSERT OR IGNORE INTO excluded_folders (path) VALUES (?)').run(p.trim());
    res.json({ id: Number(result.lastInsertRowid), path: p.trim() });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/excluded-folders/:id', (req, res) => {
  db.prepare('DELETE FROM excluded_folders WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ─── Routes: settings kv ──────────────────────────────────────────────────────

app.get('/api/settings/:key', (req, res) => {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(req.params.key);
  res.json({ key: req.params.key, value: row ? row.value : null });
});

app.post('/api/settings', (req, res) => {
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ error: 'key required' });
  db.prepare(
    'INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value'
  ).run(key, value ?? null);
  res.json({ ok: true });
});

// ─── Routes: scan ──────────────────────────────────────────────────────────────

app.post('/api/scan/plugins', (req, res) => {
  if (scanState.running) return res.json({ ok: false, message: 'Already running' });
  doPluginScan(); // async, fire and forget
  res.json({ ok: true });
});

app.get('/api/scan/status', (req, res) => res.json(scanState));

// ─── Routes: plugins ──────────────────────────────────────────────────────────

app.get('/api/plugins', (req, res) => {
  const { search = '', sort = 'display_name', order = 'asc' } = req.query;
  const allowed  = ['display_name', 'vendor', 'format', 'file_size', 'date_modified', 'created_at'];
  const sortCol  = allowed.includes(sort) ? sort : 'display_name';
  const sortDir  = order === 'desc' ? 'DESC' : 'ASC';

  let sql    = 'SELECT id, filename, path, format, file_size, date_modified, display_name, vendor FROM plugins';
  const params = [];

  if (search.trim()) {
    sql += ' WHERE (display_name LIKE ? OR vendor LIKE ? OR filename LIKE ?)';
    const s = `%${search.trim()}%`;
    params.push(s, s, s);
  }

  sql += ` ORDER BY ${sortCol} COLLATE NOCASE ${sortDir}`;
  res.json(db.prepare(sql).all(...params));
});

app.get('/api/plugins/count', (req, res) => {
  const row = db.prepare('SELECT COUNT(*) as n FROM plugins').get();
  res.json({ count: row.n });
});

app.get('/api/plugins/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM plugins WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

app.put('/api/plugins/:id', (req, res) => {
  const { display_name, vendor, notes } = req.body;
  const existing = db.prepare('SELECT id FROM plugins WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  // name_is_custom = 1 if user explicitly provided a display_name
  const setCustom = display_name !== undefined ? 1 : null;
  db.prepare(`
    UPDATE plugins SET
      display_name   = CASE WHEN @name IS NOT NULL THEN @name   ELSE display_name END,
      vendor         = CASE WHEN @vendor IS NOT NULL THEN @vendor ELSE vendor END,
      notes          = CASE WHEN @notes IS NOT NULL THEN @notes  ELSE notes END,
      name_is_custom = CASE WHEN @setCustom IS NOT NULL THEN 1   ELSE name_is_custom END,
      updated_at     = datetime('now')
    WHERE id = @id
  `).run({ name: display_name ?? null, vendor: vendor ?? null, notes: notes ?? null, setCustom, id: req.params.id });

  res.json({ ok: true });
});

// ─── Routes: AI assistant ──────────────────────────────────────────────────────

app.get('/api/ai/key-status', (req, res) => {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'anthropic_api_key'").get();
  res.json({ configured: !!(row && row.value && row.value.trim()) });
});

app.post('/api/ai/suggest', async (req, res) => {
  const { messages } = req.body; // array of { role, content }
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const keyRow = db.prepare("SELECT value FROM settings WHERE key = 'anthropic_api_key'").get();
  if (!keyRow || !keyRow.value?.trim()) {
    return res.status(400).json({ error: 'No Anthropic API key configured. Add it in Settings.' });
  }

  // Build plugin context (grouped by format)
  const plugins = db.prepare('SELECT display_name, vendor, format FROM plugins ORDER BY display_name COLLATE NOCASE').all();
  if (plugins.length === 0) {
    return res.status(400).json({ error: 'No plugins in library yet. Scan plugins first.' });
  }

  const grouped = {};
  for (const p of plugins) {
    const fmt = (p.format || 'other').toUpperCase();
    if (!grouped[fmt]) grouped[fmt] = [];
    grouped[fmt].push(p.vendor ? `${p.display_name} (${p.vendor})` : p.display_name);
  }
  const pluginList = Object.entries(grouped)
    .map(([fmt, names]) => `### ${fmt}\n${names.join('\n')}`)
    .join('\n\n');

  const systemPrompt = `You are Pluggen Assistant — a music production expert that helps producers choose plugins from their personal library.

The user has ${plugins.length} plugins installed. Your job is to suggest relevant plugins from their library for the musical style or song they describe. Be specific about WHY each plugin fits. Group suggestions by role (synth, effects, drums, etc). Keep suggestions practical and concise.

Only suggest plugins that appear in the list below. If the perfect plugin isn't in their library, mention it briefly but focus on what they DO have.

## User's Plugin Library

${pluginList}`;

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const client = new Anthropic({ apiKey: keyRow.value.trim() });

    const stream = client.messages.stream({
      model: 'claude-opus-4-7',
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        }
      ],
      messages,
    });

    stream.on('text', (text) => {
      res.write(`data: ${JSON.stringify({ text })}\n\n`);
    });

    stream.on('error', (err) => {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    });

    stream.on('finalMessage', () => {
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    });
  } catch (e) {
    res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
    res.end();
  }
});

// ─── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n  Pluggen server running on http://localhost:${PORT}\n`);
});
