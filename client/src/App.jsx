import { useEffect, useRef, useState } from 'react';
import Rain from './Rain.jsx';

const P = { shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4', trophy: 'M8 4h8v5a4 4 0 0 1-8 0z M8 6H4v1a3 3 0 0 0 4 3M16 6h4v1a3 3 0 0 1-4 3M12 13v4M8 20h8',
  crown: 'M3 8l4 4 5-7 5 7 4-4-2 11H5z', pulse: 'M3 12h4l3-8 4 16 3-8h4', lock: 'M5 11h14v9H5z M8 11V8a4 4 0 0 1 8 0v3', out: 'M9 4H5v16h4M16 8l4 4-4 4M20 12H9',
  play: 'M7 4l13 8-13 8z', term: 'M4 6l6 6-6 6M12 18h8', server: 'M3 4h18v6H3z M3 14h18v6H3z M7 7h.01M7 17h.01',
  radio: 'M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4 M7 7a7 7 0 0 0 0 10M17 7a7 7 0 0 1 0 10M4 4a11 11 0 0 0 0 16M20 4a11 11 0 0 1 0 16',
  ghost: 'M5 20V10a7 7 0 0 1 14 0v10l-3-2-2 2-2-2-2 2-2-2z M9 11h.01M15 11h.01', check: 'M5 12l5 5 9-10', map: 'M6 10a2 2 0 1 0 .01 0 M18 4a2 2 0 1 0 .01 0 M18 16a2 2 0 1 0 .01 0 M8 11l8-5M8 13l8 4' };
const Ic = ({ n }) => <svg className="ic" viewBox="0 0 24 24" aria-hidden="true"><path d={P[n]} /></svg>;
const MI = { 1: 'server', 2: 'radio', 3: 'ghost' }, LV = { Easy: 'e', Medium: 'm', Hard: 'hd' };

function NetMap({ hud }) {
  if (!hud) return <p className="hint pad">Start a mission to see its network.</p>;
  const n = hud.nodes.length, pts = hud.nodes.map((_, i) => [40 + i * (220 / Math.max(1, n - 1)), i % 2 ? 125 : 55]);
  return (
    <svg viewBox="0 0 300 180" width="100%" role="img" aria-label="Network map" style={{ display: 'block', padding: '8px 12px 12px' }}>
      <g stroke="#1c3a2b" strokeWidth="2">{pts.slice(1).map((p, i) => <line key={i} x1={pts[i][0]} y1={pts[i][1]} x2={p[0]} y2={p[1]} />)}</g>
      {hud.nodes.map((nd, i) => { const [x, y] = pts[i], cur = nd.name === hud.cur; return (
        <g key={nd.name}>
          {cur && <circle cx={x} cy={y} r="17" fill="none" stroke="#ffc233" strokeWidth="1.5" />}
          <circle cx={x} cy={y} r="11" fill={nd.ok ? '#39ff88' : cur ? '#ffc233' : '#0b1510'} stroke={nd.ok || cur ? 'none' : '#86ab96'} strokeWidth="2" />
          <text x={x} y={y + 32} textAnchor="middle" fontSize="11" fill="#86ab96">{nd.name}</text>
        </g>); })}
    </svg>
  );
}

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
        <h1><Ic n="shield" />ZERO TRACE</h1>
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
  const rank = lb.findIndex(r => r.username === auth.name) + 1;
  const total = ms.reduce((s, m) => s + m.best, 0), cleared = ms.filter(m => m.best).length;
  const C = 2 * Math.PI * 28, tc = hud ? (hud.trace > 66 ? '#ff6b78' : hud.trace > 33 ? '#ffc233' : '#39ff88') : '#39ff88';
  const tiles = [['trophy', total, 'Total score'], ['shield', `${cleared} / ${ms.length || 3}`, 'Missions cleared'], ['crown', rank ? '#' + rank : 'Unranked', 'Global rank'], ['pulse', hud ? 'In mission' : 'Standing by', 'Status']];
  return (
    <div className="game">
      <header className="top"><div className="brand"><Ic n="shield" />ZERO TRACE</div><div className="sp" />
        <div className="chip"><span className="av">{auth.name.slice(0, 2).toUpperCase()}</span>{auth.name}</div>
        <button className="btn g" onClick={onExit}><Ic n="out" />Log out</button></header>
      <section className="stats">{tiles.map(([ic, v, l]) => <div className="tile" key={l}><div className="ico"><Ic n={ic} /></div><div><b>{v}</b><span>{l}</span></div></div>)}</section>
      <h2 className="h">Missions</h2>
      <section className="mgrid">
        {ms.map(m => (
          <article key={m.id} className={'mc' + (m.locked ? ' lock' : '')}>
            <div className="mh"><div className="ico"><Ic n={m.locked ? 'lock' : MI[m.id]} /></div><h3>{m.name}</h3><span className={'bg ' + LV[m.level]}>{m.level}</span></div>
            <p>{m.brief}</p>
            <div className="dots">{Array.from({ length: m.nodes }, (_, k) => <span key={k} className={'dot' + (m.best ? ' f' : '')} />)}</div>
            <div className="meta"><div><i>Nodes</i>{m.nodes}</div><div><i>Time</i>{m.time}s</div><div><i>Best</i>{m.best || '-'}</div></div>
            <button className={'btn' + (m.locked ? ' d' : m.best ? ' g' : '')} disabled={m.locked || !!hud} onClick={() => cmd('start ' + m.id)}>
              {m.locked ? `Clear mission ${m.id - 1} to unlock` : <><Ic n="play" />{m.best ? 'Replay' : 'Start mission'}</>}</button>
          </article>
        ))}
      </section>
      <section className="main">
        <div className="card">
          <div className="win"><i /><i /><i /><span>zero-trace://{hud ? hud.mission.toLowerCase().replace(/\s+/g, '-') : 'standby'}</span></div>
          <div className="hud">
            {hud ? <>
              <div className="ring"><svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true"><circle cx="32" cy="32" r="28" fill="none" stroke="#1c3a2b" strokeWidth="5" />
                <circle cx="32" cy="32" r="28" fill="none" stroke="#39ff88" strokeWidth="5" strokeDasharray={C} strokeDashoffset={C * (1 - hud.time / hud.max)} transform="rotate(-90 32 32)" /></svg>
                <b>{Math.floor(hud.time / 60)}:{String(hud.time % 60).padStart(2, '0')}</b></div>
              <div className="tr"><div className="l"><span>TRACE LEVEL</span><span>{hud.trace}%</span></div>
                <div className="seg" role="progressbar" aria-valuenow={hud.trace} aria-label="Trace level"><div style={{ width: hud.trace + '%', '--tc': tc }} /></div></div>
              <div className="nodes">{hud.nodes.map(n => <span key={n.name} className={'nd ' + (n.ok ? 'go' : n.name === hud.cur ? 'wn' : '')}><Ic n={n.ok ? 'check' : 'lock'} />{n.name}</span>)}</div>
            </> : <div className="hint">No active mission. Choose one above or type <code>start 1</code>.</div>}
          </div>
          <div className="term" ref={box}>{lines.map((l, k) => <div key={k} className={l.cls}>{l.text}</div>)}</div>
          <div className="chips">{['missions', 'help', 'scan', 'abort'].map(c => <button key={c} className="btn g" onClick={() => cmd(c)}>{c}</button>)}</div>
          <form className="cmd" onSubmit={submit}><Ic n="term" /><input autoFocus value={text} onChange={e => setText(e.target.value)} onKeyDown={key} placeholder="type a command or your answer…" aria-label="Command" /></form>
        </div>
        <div className="side">
          <div className="card"><div className="ch"><Ic n="map" />Network map</div><NetMap hud={hud} /></div>
          <div className="card"><div className="ch"><Ic n="trophy" />Global leaderboard</div>
            {lb.length ? <ol className="lb">{lb.map((r, k) => <li key={r.username} className={r.username === auth.name ? 'you' : ''}><span className="n">{k + 1}</span>{k === 0 && <Ic n="crown" />}{r.username}<b>{r.total}</b></li>)}</ol> : <p className="hint pad">No scores yet. Be the first.</p>}</div>
          <div className="card"><div className="ch"><Ic n="term" />How to play</div>
            <ol className="steps"><li><code>start 1</code> begins a mission.</li><li><code>scan</code> lists the nodes.</li><li><code>connect gateway</code> shows a puzzle.</li><li>Type the answer and press Enter.</li></ol>
            <p className="hint pad">Wrong answers and scans raise TRACE. At 100% you lose.</p></div>
        </div>
      </section>
    </div>
  );
}

export default function App() {
  const [auth, setAuth] = useState(() => JSON.parse(localStorage.getItem('zt_auth') || 'null'));
  const set = a => { a ? localStorage.setItem('zt_auth', JSON.stringify(a)) : localStorage.removeItem('zt_auth'); setAuth(a); };
  return <><Rain dim={!!auth} />{auth ? <Game auth={auth} onExit={() => set(null)} /> : <Auth onAuth={set} />}</>;
}
