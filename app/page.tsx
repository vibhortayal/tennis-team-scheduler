'use client';

import { useState } from 'react';

type Response = 'Approved' | 'Pending' | 'Declined';
type Player = { name: string; status: Response };

const initialPlayers: Player[] = [
  { name: 'Vibhor', status: 'Approved' },
  { name: 'Gourav', status: 'Approved' },
  { name: 'Gaurav', status: 'Approved' },
  { name: 'Anish', status: 'Pending' }
];

export default function Home() {
  const [players, setPlayers] = useState(initialPlayers);
  const [notice, setNotice] = useState('Awaiting 1 approval');
  const approve = () => {
    setPlayers((all) => all.map((p) => p.name === 'Anish' ? { ...p, status: 'Approved' } : p));
    setNotice('Confirmed — every participant approved');
  };
  return <main>
    <section className="hero"><p className="eyebrow">TENNIS LEAGUE</p><h1>Schedule matches.<br/><span>Everyone agrees.</span></h1><p className="lead">No captains. Any player can propose a match; all named players must explicitly approve before it is confirmed.</p><button onClick={() => alert('Connect this screen to create_match_proposal in Supabase.')}>Propose a match</button></section>
    <section className="card"><div className="topline"><div><p className="eyebrow">PENDING APPROVAL</p><h2>Team #10 <i>vs</i> Team #3</h2></div><strong className={notice.startsWith('Confirmed') ? 'confirmed' : ''}>{notice}</strong></div><div className="details"><div><small>DATE & TIME</small><b>Sunday, Sep 13 · 10:00–11:30 AM</b></div><div><small>LOCATION</small><b>Fremont Tennis Center · Court 2</b></div><div><small>RESPONSE DEADLINE</small><b>Friday, Sep 11 · 6:00 PM</b></div></div><hr/><h3>Participant responses</h3><div className="players">{players.map((p) => <div className="player" key={p.name}><span className={p.status.toLowerCase()}>{p.status === 'Approved' ? '✓' : p.status === 'Pending' ? '○' : '×'}</span><b>{p.name}</b><em>{p.status}</em></div>)}</div><div className="actions"><button onClick={approve}>Approve match</button><button className="secondary" onClick={() => setNotice('Declined — propose another time')}>Decline</button><button className="link" onClick={() => alert('Alternative-slot flow goes here.')}>Suggest another time</button></div></section>
    <section className="rules"><h2>The confirmation rule</h2><p>A proposal is not scheduled until the last required participant approves it. A date, court, team, and player conflict check runs one more time at confirmation.</p></section>
    <style jsx global>{`*{box-sizing:border-box}body{margin:0;background:#f7f5ef;color:#15221c;font-family:Arial,sans-serif}main{max-width:1050px;margin:auto;padding:70px 24px}.hero{max-width:760px}.eyebrow{font-size:12px;font-weight:800;letter-spacing:.14em;color:#57715f}.hero h1{font-size:clamp(42px,7vw,78px);line-height:.96;letter-spacing:-.06em;margin:12px 0 24px}.hero h1 span{color:#497a52}.lead{font-size:20px;line-height:1.55;color:#526159;max-width:650px}.card{background:#fff;border:1px solid #e2e4da;border-radius:22px;padding:32px;margin-top:50px;box-shadow:0 12px 35px #15221c12}.topline{display:flex;justify-content:space-between;gap:20px}.topline h2{font-size:30px;margin:7px 0}.topline i{font-weight:400;color:#758078}.topline strong{height:max-content;background:#fff4d7;color:#8a6300;padding:9px 12px;border-radius:99px;font-size:13px}.topline .confirmed{background:#ddf4e2;color:#1d6b35}.details{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;margin:30px 0}.details div{display:grid;gap:7px}.details small{font-size:11px;letter-spacing:.08em;color:#768078}.details b{font-size:15px}hr{border:0;border-top:1px solid #edf0ea}h3{font-size:15px;margin-top:26px}.players{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.player{border:1px solid #e7ebe4;border-radius:12px;padding:14px;display:flex;align-items:center;gap:10px}.player span{font-size:20px}.approved{color:#278245}.pending{color:#be8100}.declined{color:#c03c3c}.player em{font-style:normal;font-size:13px;color:#768078;margin-left:auto}.actions{display:flex;gap:12px;align-items:center;margin-top:30px}button{border:0;background:#1f6d39;color:white;border-radius:10px;padding:13px 17px;font-weight:700;cursor:pointer;font-size:14px}.secondary{background:#edf0ea;color:#2b3b31}.link{background:none;color:#276b3e;padding:8px}.rules{padding:38px 4px;max-width:700px}.rules h2{font-size:28px;margin-bottom:8px}.rules p{font-size:17px;line-height:1.55;color:#526159}@media(max-width:650px){main{padding:42px 16px}.card{padding:22px}.topline,.actions{align-items:flex-start;flex-direction:column}.details,.players{grid-template-columns:1fr}.hero h1{font-size:48px}}`}</style>
  </main>;
}
