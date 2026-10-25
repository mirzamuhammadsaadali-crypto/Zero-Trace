// ZERO TRACE server: auth, real-time game sessions (WebSocket), Postgres scores.
// Everything is a FICTIONAL simulation. Nothing here touches real networks.
import express from 'express'; import http from 'http'; import { WebSocketServer } from 'ws';
import path from 'path'; import { fileURLToPath } from 'url';
import pg from 'pg'; import bcrypt from 'bcryptjs'; import jwt from 'jsonwebtoken';

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) throw new Error('Set JWT_SECRET in production');
const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgres://zt:zt@localhost:5432/zerotrace' });
const app = express(); app.use(express.json());
const server = http.createServer(app);

const MISSIONS = [
  { id: 1, name: 'Cold Storage',   time: 180, nodes: ['gateway', 'vault'] },
  { id: 2, name: 'Night Relay',    time: 150, nodes: ['relay', 'archive', 'core'] },
  { id: 3, name: 'Ghost Protocol', time: 120, nodes: ['edge', 'mail', 'db', 'core'] },
];
const BRIEFS = ['Breach a cold-storage gateway and pull the archived files from the vault.',
  'A relay network hides the archive. Crack three nodes before the trace closes in.',
  'Four hardened nodes, tight clock. One slip and the system names you.'];
const LEVELS = ['Easy', 'Medium', 'Hard'];
const WORDS = ['phantom', 'cipher', 'shadow', 'kernel', 'packet', 'vector', 'binary', 'socket'];
const rnd = n => Math.floor(Math.random() * n);

// Puzzles are generated server-side: the answer never leaves the server.
function puzzle() {
  const k = rnd(3);
  if (k === 0) {
    const w = WORDS[rnd(WORDS.length)], s = 1 + rnd(9);
    const enc = [...w].map(c => String.fromCharCode((c.charCodeAt(0) - 97 + s) % 26 + 97)).join('');
    return { q: `CIPHER  "${enc}" was shifted forward by ${s}. Decode it.`, a: w };
  }
  if (k === 1) {
    const a = 1 + rnd(9), d = 2 + rnd(8);
    return { q: `SEQUENCE  ${[0, 1, 2, 3].map(i => a + i * d).join(', ')}, ?`, a: String(a + 4 * d) };
  }
  const n = 16 + rnd(240);
  return { q: `HEX  0x${n.toString(16).toUpperCase()} = ? (decimal)`, a: String(n) };
}

async function init() {
  for (let i = 0; i < 30; i++) {
    try {
      await pool.query(`CREATE TABLE IF NOT EXISTS users(id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL, pass TEXT NOT NULL, created TIMESTAMPTZ DEFAULT now());
        CREATE TABLE IF NOT EXISTS runs(id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id), mission INT NOT NULL, score INT NOT NULL, seconds INT NOT NULL, trace INT NOT NULL, created TIMESTAMPTZ DEFAULT now());`);
      return;
    } catch { await new Promise(r => setTimeout(r, 1500)); }
  }
  throw new Error('Database unavailable');
}

const sign = u => jwt.sign({ id: u.id, name: u.username }, SECRET, { expiresIn: '7d' });
async function board() {
  const r = await pool.query(`SELECT u.username, SUM(b.best)::int AS total, COUNT(*)::int AS missions
    FROM (SELECT user_id, mission, MAX(score) best FROM runs GROUP BY 1,2) b JOIN users u ON u.id=b.user_id
    GROUP BY u.username ORDER BY total DESC LIMIT 10`);
  return r.rows;
}

async function missionList(uid) {
  const r = await pool.query('SELECT mission, MAX(score)::int AS best FROM runs WHERE user_id=$1 GROUP BY mission', [uid]);
  const best = Object.fromEntries(r.rows.map(x => [x.mission, x.best]));
  return MISSIONS.map((m, i) => ({ id: m.id, name: m.name, time: m.time, nodes: m.nodes.length, level: LEVELS[i], brief: BRIEFS[i],
    best: best[m.id] || 0, locked: i > 0 && !best[MISSIONS[i - 1].id] }));
}

app.post('/api/register', async (req, res) => {
  const { username, password } = req.body || {};
  if (!/^[a-z0-9_]{3,16}$/i.test(username || '') || (password || '').length < 6)
    return res.status(400).json({ error: 'Username: 3-16 letters/numbers. Password: 6+ characters.' });
  try {
    const r = await pool.query('INSERT INTO users(username,pass) VALUES($1,$2) RETURNING id,username', [username, await bcrypt.hash(password, 10)]);
    res.json({ token: sign(r.rows[0]), name: username });
  } catch { res.status(409).json({ error: 'That username is taken.' }); }
});
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  const r = await pool.query('SELECT * FROM users WHERE username=$1', [username || '']);
  const u = r.rows[0];
  if (!u || !(await bcrypt.compare(password || '', u.pass))) return res.status(401).json({ error: 'Wrong username or password.' });
  res.json({ token: sign(u), name: u.username });
});
app.get('/api/leaderboard', async (_q, res) => res.json(await board()));

const wss = new WebSocketServer({ server, path: '/ws' });
const send = (ws, o) => ws.readyState === 1 && ws.send(JSON.stringify(o));
const pushBoard = async () => { const lb = await board(); wss.clients.forEach(c => send(c, { t: 'lb', lb })); };

wss.on('connection', async (ws, req) => {
  let user;
  try { user = jwt.verify(new URL(req.url, 'http://x').searchParams.get('token'), SECRET); } catch { return ws.close(4001); }
  let g = null;
  const out = (text, cls = '') => send(ws, { t: 'out', text, cls });
  const hud = () => send(ws, { t: 'hud', hud: g ? { trace: g.trace, time: g.time, done: g.nodes.filter(n => n.ok).length, total: g.nodes.length, mission: g.m.name, max: g.m.time, cur: g.cur ? g.cur.name : null, nodes: g.nodes.map(n => ({ name: n.name, ok: n.ok })) } : null });

  const sendMissions = async () => send(ws, { t: 'missions', list: await missionList(user.id) });

  async function finish(win, why) {
    clearInterval(g.timer);
    const { m, trace, time } = g; g = null; hud();
    if (!win) return out(`MISSION FAILED: ${why}`, 'bad');
    const score = Math.max(100, 1000 + time * 5 - trace * 8);
    await pool.query('INSERT INTO runs(user_id,mission,score,seconds,trace) VALUES($1,$2,$3,$4,$5)', [user.id, m.id, score, m.time - time, trace]);
    out(`MISSION COMPLETE: ${m.name}. Score ${score} (trace ${trace}%, ${m.time - time}s).`, 'good');
    pushBoard(); sendMissions();
  }
  const bump = (n, why) => { g.trace = Math.min(100, g.trace + n); if (g.trace >= 100) finish(false, 'trace reached 100%. You were identified.'); else { out(why, 'warn'); hud(); } };

  async function start(id) {
    const m = MISSIONS.find(x => x.id === id);
    if (!m) return out('Unknown mission. Type "missions".', 'bad');
    if (id > 1) {
      const r = await pool.query('SELECT 1 FROM runs WHERE user_id=$1 AND mission=$2 LIMIT 1', [user.id, id - 1]);
      if (!r.rowCount) return out(`Locked. Complete mission ${id - 1} first.`, 'bad');
    }
    g = { m, trace: 0, time: m.time, cur: null, nodes: m.nodes.map(n => ({ name: n, ok: false })) };
    g.timer = setInterval(() => {
      g.time--; if (g.time % 15 === 0) g.trace = Math.min(100, g.trace + 2);
      if (g.time <= 0) return finish(false, 'time expired.');
      if (g.trace >= 100) return finish(false, 'trace reached 100%.');
      hud();
    }, 1000);
    out(`MISSION ${m.id}: ${m.name}. Crack ${m.nodes.length} nodes in ${m.time}s. Type "scan".`, 'good'); hud();
  }

  async function run(line) {
    line = line.replace(/[<>]/g, '');
    const [c, ...a] = line.trim().split(/\s+/); const arg = a.join(' ');
    switch ((c || '').toLowerCase()) {
      case '': return;
      case 'help': return out('help | missions | start <id> | scan | connect <node> | answer <text> | abort');
      case 'missions': {
        const l = await missionList(user.id);
        out('MISSION  NAME             LEVEL    NODES  TIME   STATUS', 'info');
        l.forEach(m => out(`[${m.id}]      ${m.name.padEnd(16)} ${m.level.padEnd(8)} ${String(m.nodes).padEnd(6)} ${(m.time + 's').padEnd(6)} ${m.locked ? 'LOCKED (clear mission ' + (m.id - 1) + ')' : m.best ? 'best score ' + m.best : 'open'}`, m.locked ? 'warn' : ''));
        out('Type "start <id>" to begin.', 'info'); return send(ws, { t: 'missions', list: l });
      }
      case 'start': return g ? out('Mission already running.', 'bad') : start(parseInt(arg));
      case 'abort': return g ? finish(false, 'aborted.') : out('No active mission.');
      case 'scan':
        if (!g) return out('Start a mission first.', 'bad');
        g.nodes.forEach(n => out(`  ${n.name.padEnd(10)} ${n.ok ? 'CRACKED' : 'LOCKED'}`)); return bump(3, 'Scan noise: trace +3%');
      case 'connect': {
        if (!g) return out('Start a mission first.', 'bad');
        const n = g.nodes.find(x => x.name === arg.toLowerCase());
        if (!n) return bump(5, 'No such node. Trace +5%');
        if (n.ok) return out('Already cracked.');
        g.cur = n; n.p = n.p || puzzle(); hud(); return out(`[${n.name}] ${n.p.q}\nType your answer (a word or number) and press Enter.`, 'info');
      }
      case 'answer': {
        if (!g || !g.cur) return out('Connect to a node first.', 'bad');
        if (arg.toLowerCase() !== g.cur.p.a) return bump(12, 'ACCESS DENIED. Trace +12%');
        g.cur.ok = true; out(`${g.cur.name} cracked.`, 'good'); g.cur = null; hud();
        return g.nodes.every(n => n.ok) ? finish(true) : undefined;
      }
      default: if (g && g.cur) return run('answer ' + line); return out(`Unknown command "${c}". Type help.`, 'bad');
    }
  }
  out(`Welcome, ${user.name}. Type "help".`, 'info');
  send(ws, { t: 'lb', lb: await board() }); sendMissions();
  ws.on('message', async raw => { try { const m = JSON.parse(raw); if (m.t === 'cmd' && typeof m.text === 'string') await run(m.text.slice(0, 200)); } catch (e) { console.error(e); } });
  ws.on('close', () => g && clearInterval(g.timer));
});

// Single-service mode: serve the built React app from ./public when it exists (used by the root Dockerfile).
const pub = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
app.use(express.static(pub));
app.get('*', (_q, res) => res.sendFile(path.join(pub, 'index.html'), e => e && res.status(404).end()));

await init();
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`ZERO TRACE server on :${PORT}`));
