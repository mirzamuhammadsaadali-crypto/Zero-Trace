import { useEffect, useRef, useState } from 'react';
import Rain from './Rain.jsx';

function Auth({ onAuth }) {
  const [mode, setMode] = useState('login'), [u, setU] = useState(''), [p, setP] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      const r = await fetch(`/api/${mode}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p }) });
      const d = await r.json(); r.ok ? onAuth(d) : setErr(d.error || 'Something went wrong.');
    } catch { setErr('Cannot reach the server. Check that it is running.'); }
    setBusy(false);
  };
  const reg = mode === 'register';
  return (
    <main className="auth">
      <form className="card" onSubmit={submit}>
        <h1>ZERO TRACE</h1>
        <p className="tag">Break the system. Beat the clock. Leave no trace.</p>
        <p className="status"><i /> Secure channel ready</p>
        <label>Operative name
          <input autoFocus autoComplete="username" value={u} onChange={e => setU(e.target.value)} />
        </label>
        <label>Passphrase
          <input type="password" autoComplete={reg ? 'new-password' : 'current-password'} value={p} onChange={e => setP(e.target.value)} />
        </label>
        {err && <p className="bad" role="alert">{err}</p>}
        <button type="submit" disabled={busy}>{busy ? 'Authenticating…' : reg ? 'Create account' : 'Log in'}</button>
        <button type="button" className="ghost" onClick={() => { setMode(reg ? 'login' : 'register'); setErr(''); }}>
          {reg ? 'Already an operative? Log in' : 'New here? Create an account'}
        </button>
        <p className="note">Fictional simulation. No real systems are involved.</p>
      </form>
    </main>
  );
}

function Game({ auth, onExit }) {
  const [lines, setLines] = useState([]), [hud, setHud] = useState(null), [lb, setLb] = useState([]), [ms, setMs] = useState([]), [text, setText] = useState('');
  const ws = useRef(null), box = useRef(null), hist = useRef([]), hi = useRef(0);
  useEffect(() => {
    const s = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws?token=${auth.token}`);
    s.onmessage = e => { const m = JSON.parse(e.data);
      if (m.t === 'out') setLines(l => [...l, m]); if (m.t === 'hud') setHud(m.hud); if (m.t === 'lb') setLb(m.lb); if (m.t === 'missions') setMs(m.list); };
    s.onclose = e => { setLines(l => [...l, { text: 'Connection closed.', cls: 'bad' }]); if (e.code === 4001) onExit(); };
    ws.current = s; return () => s.close();
  }, []);
  useEffect(() => { box.current?.scrollTo(0, 1e9); }, [lines]);
  const cmd = t => {
    if (!t.trim() || ws.current?.readyState !== 1) return;
    ws.current.send(JSON.stringify({ t: 'cmd', text: t })); setLines(l => [...l, { text: '> ' + t, cls: 'me' }]);
    hist.current.push(t); hi.current = hist.current.length;
  };
  const submit = e => { e.preventDefault(); cmd(text); setText(''); };
  const key = e => { if (e.key === 'ArrowUp' && hi.current > 0) setText(hist.current[--hi.current]); };
  const traceCls = hud ? (hud.trace > 66 ? 'hot' : hud.trace > 33 ? 'warm' : '') : '';
  const rank = lb.findIndex(r => r.username === auth.name) + 1;
  const total = ms.reduce((s, m) => s + m.best, 0), cleared = ms.filter(m => m.best).length;
  return (
    <div className="game">
      <header><b>ZERO TRACE</b><span>Operative {auth.name}</span><button className="ghost" onClick={onExit}>Log out</button></header>
      <section className="stats">
        <div className="tile"><b>{total}</b><span>Total score</span></div>
        <div className="tile"><b>{cleared}/{ms.length || 3}</b><span>Missions cleared</span></div>
        <div className="tile"><b>{rank ? '#' + rank : 'Unranked'}</b><span>Global rank</span></div>
        <div className="tile"><b>{hud ? 'In mission' : 'Standing by'}</b><span>Status</span></div>
      </section>
      <section className="mgrid">
        {ms.map(m => (
          <article key={m.id} className={'mc' + (m.locked ? ' locked' : '')}>
            <div className="mh"><h3>{m.name}</h3><span className={'lvl ' + m.level}>{m.level}</span></div>
            <p>{m.brief}</p>
            <dl><div><dt>Nodes</dt><dd>{m.nodes}</dd></div><div><dt>Time</dt><dd>{m.time}s</dd></div><div><dt>Best</dt><dd>{m.best || '-'}</dd></div></dl>
            <button disabled={m.locked || !!hud} onClick={() => cmd('start ' + m.id)}>{m.locked ? 'Locked' : m.best ? 'Replay' : 'Start mission'}</button>
          </article>
        ))}
      </section>
      <section className="hud">
        {hud ? <>
          <div>{hud.mission}: nodes {hud.done}/{hud.total}</div>
          <div className="time">{Math.floor(hud.time / 60)}:{String(hud.time % 60).padStart(2, '0')}</div>
          <div className="meter" role="progressbar" aria-valuenow={hud.trace}><i className={traceCls} style={{ width: hud.trace + '%' }} /><span>TRACE {hud.trace}%</span></div>
        </> : <div>No active mission. Choose one above or type <code>start 1</code>.</div>}
      </section>
      <div className="term" ref={box}>{lines.map((l, i) => <pre key={i} className={l.cls}>{l.text}</pre>)}</div>
      <div className="cmdwrap">
        <div className="chips">{['missions', 'help', 'scan', 'abort'].map(c => <button key={c} className="ghost" onClick={() => cmd(c)}>{c}</button>)}</div>
        <form className="cmd" onSubmit={submit}><span>&gt;</span><input autoFocus value={text} onChange={e => setText(e.target.value)} onKeyDown={key} placeholder="type a command…" /></form>
      </div>
      <div className="side">
        <div><h2>Global leaderboard (live)</h2>
          {lb.length ? <ol>{lb.map(r => <li key={r.username} className={r.username === auth.name ? 'you' : ''}><span>{r.username}</span><b>{r.total}</b></li>)}</ol> : <p>No scores yet. Be the first.</p>}</div>
        <div><h2>How to play</h2>
          <ol className="steps">
            <li><code>start 1</code> begins a mission and starts the clock.</li>
            <li><code>scan</code> lists the nodes you must crack.</li>
            <li><code>connect gateway</code> opens a node and shows its puzzle.</li>
            <li><code>answer &lt;text&gt;</code> submits your solution.</li>
          </ol>
          <p className="hint">Wrong answers and scans raise TRACE. At 100% you lose. Crack every node before time runs out.</p></div>
      </div>
    </div>
  );
}

export default function App() {
  const [auth, setAuth] = useState(() => JSON.parse(localStorage.getItem('zt_auth') || 'null'));
  const set = a => { a ? localStorage.setItem('zt_auth', JSON.stringify(a)) : localStorage.removeItem('zt_auth'); setAuth(a); };
  return <><Rain dim={!!auth} />{auth ? <Game auth={auth} onExit={() => set(null)} /> : <Auth onAuth={set} />}</>;
}
