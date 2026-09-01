export function Styles() {
return (
<style>{`
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@600;700&display=swap');
:root{
--green:#0B4F2C;--green-2:#0f6b3b;--accent:#E1FF3F;--cream:#FAF7F0;--ink:#12140f;--muted:#5f6b60;--card:#ffffff;--line:#e6e9e0;--shadow:0 10px 30px rgba(11,79,44,.10);--radius:20px;
}
@media (prefers-color-scheme: dark){
:root{--green:#12b866;--green-2:#0f9a55;--accent:#E1FF3F;--cream:#0c0f0b;--ink:#f2f5ec;--muted:#9aa89b;--card:#141a12;--line:#242c1f;--shadow:0 10px 30px rgba(0,0,0,.5);}
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--cream);color:var(--ink);font-family:'Inter',system-ui,sans-serif;-webkit-font-smoothing:antialiased}
main{max-width:1120px;margin:auto;padding:0 16px 96px}
h1,h2,h3,.display{font-family:'Space Grotesk','Inter',sans-serif;letter-spacing:-.02em}
button,select,input,textarea{font:inherit;color:inherit}
button{border:0;border-radius:999px;padding:12px 18px;min-height:44px;background:var(--green);color:#fff;font-weight:700;cursor:pointer;transition:transform .12s ease,box-shadow .12s ease,background .12s ease}
button:hover{transform:translateY(-1px)}
button:disabled{cursor:not-allowed;opacity:.5;transform:none}
.appbar{position:sticky;top:0;z-index:20;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 16px;margin:0 -16px 8px;background:color-mix(in srgb,var(--cream) 78%,transparent);backdrop-filter:saturate(160%) blur(14px);border-bottom:1px solid var(--line)}
.brand{display:flex;flex-direction:column;gap:2px;min-width:0}
.brand h1{margin:0;font-size:20px;font-weight:700;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.brand .tagline{font-size:11px;color:var(--muted);font-weight:600;letter-spacing:.06em;text-transform:uppercase}
.player-chip{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:6px 6px 6px 6px;border-radius:999px;background:var(--card);border:1px solid var(--line);box-shadow:var(--shadow)}
.player-chip .avatar{width:32px;height:32px;border-radius:999px;display:grid;place-items:center;background:var(--green);color:var(--accent);font-weight:800;font-size:14px}
.player-chip select{border:0;background:transparent;font-weight:700;padding:0 6px 0 0;min-height:0;cursor:pointer;max-width:150px}
.seg{display:inline-flex;padding:4px;gap:4px;background:var(--card);border:1px solid var(--line);border-radius:999px;box-shadow:var(--shadow);width:100%;margin:8px 0 4px}
.seg button{flex:1;background:transparent;color:var(--muted);min-height:40px;padding:8px 12px;border-radius:999px;transition:all .18s ease}
.seg button.active{background:var(--green);color:#fff;box-shadow:0 6px 18px rgba(11,79,44,.25)}
.notice{background:var(--card);padding:14px 16px;border-radius:14px;color:var(--green);border:1px solid var(--line);margin:8px 0;font-weight:600}
.hero{position:relative;overflow:hidden;margin:12px 0 20px;padding:22px;border-radius:var(--radius);background:linear-gradient(135deg,var(--green) 0%,var(--green-2) 100%);color:#fff;box-shadow:var(--shadow)}
.hero::after{content:'';position:absolute;right:-40px;top:-40px;width:180px;height:180px;border-radius:999px;background:radial-gradient(circle,var(--accent) 0%,transparent 70%);opacity:.22}
.hero .eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--accent)}
.hero .countdown{margin:4px 0 14px;font-family:'Space Grotesk';font-size:14px;font-weight:700;color:var(--accent)}
.hero-grid{display:grid;gap:14px}
@media(min-width:768px){.hero-grid{grid-template-columns:1fr 1fr}}
.hero-match{background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.18);border-radius:16px;padding:16px}
.hero-teams{display:flex;align-items:center;gap:12px;margin:6px 0}
.hero-team{flex:1;font-family:'Space Grotesk';font-size:19px;font-weight:700;line-height:1.15}
.vs-badge{flex:0 0 auto;width:38px;height:38px;border-radius:999px;display:grid;place-items:center;background:var(--accent);color:var(--green);font-weight:800;font-size:13px}
.hero-meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;font-size:13px;color:rgba(255,255,255,.85)}
.hero-meta span{display:inline-flex;align-items:center;gap:5px}
.hero-cta{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.hero-cta a{display:inline-flex;align-items:center;gap:6px;min-height:38px;padding:8px 14px;border-radius:999px;background:var(--accent);color:var(--green);font-weight:700;font-size:13px;text-decoration:none}
.hero-cta a.ghost{background:rgba(255,255,255,.14);color:#fff}
.live-dot{width:9px;height:9px;border-radius:999px;background:var(--accent);box-shadow:0 0 0 0 var(--accent);animation:pulse 1.6s infinite}
@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(225,255,63,.6)}70%{box-shadow:0 0 0 10px rgba(225,255,63,0)}100%{box-shadow:0 0 0 0 rgba(225,255,63,0)}}
.section-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:24px 0 12px}
.section-head h2{margin:0;font-size:18px}
.count-pill{font-size:12px;font-weight:700;color:var(--muted);background:var(--card);border:1px solid var(--line);border-radius:999px;padding:4px 10px}
.grid{display:grid;grid-template-columns:1fr;gap:14px}
@media(min-width:768px){.grid{grid-template-columns:repeat(2,1fr)}}
@media(min-width:1200px){.grid{grid-template-columns:repeat(3,1fr)}}
.mcard{position:relative;overflow:hidden;display:flex;gap:14px;padding:16px;background:var(--card);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);transition:transform .16s ease,box-shadow .16s ease}
@media(hover:hover){.mcard:hover{transform:translateY(-3px);box-shadow:0 16px 40px rgba(11,79,44,.16)}}
.date-rail{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;width:56px;padding:10px 0;border-radius:14px;background:color-mix(in srgb,var(--green) 8%,var(--card));border:1px solid var(--line)}
.date-rail .dow{font-size:11px;font-weight:800;letter-spacing:.08em;color:var(--green);text-transform:uppercase}
.date-rail .day{font-family:'Space Grotesk';font-size:22px;font-weight:700;line-height:1}
.date-rail .mon{font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase}
.mcard-body{flex:1;min-width:0}
.mcard .teams{display:flex;align-items:center;gap:10px;margin:2px 0 8px}
.mcard .team{flex:1;font-family:'Space Grotesk';font-weight:700;font-size:16px;line-height:1.2;overflow:hidden;text-overflow:ellipsis}
.mcard .mini-vs{flex:0 0 auto;font-size:11px;font-weight:800;color:var(--muted)}
.status-pill{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;padding:4px 10px;border-radius:999px;border:1px solid var(--line)}
.status-pill.Scheduled{background:color-mix(in srgb,var(--green) 12%,var(--card));color:var(--green)}
.status-pill.Completed{background:color-mix(in srgb,var(--accent) 30%,var(--card));color:var(--ink)}
.status-pill.Cancelled{background:color-mix(in srgb,#9aa89b 22%,var(--card));color:var(--muted)}
.score{font-family:'JetBrains Mono',monospace;font-size:20px;font-weight:700;letter-spacing:.04em;margin:8px 0}
.court-chip{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--muted);background:color-mix(in srgb,var(--green) 6%,var(--card));border:1px solid var(--line);border-radius:999px;padding:5px 10px;margin-top:4px}
.mcard .reason{font-size:13px;color:var(--muted);margin:6px 0 0}
.mcard .act{margin-top:12px;min-height:40px;padding:8px 16px;font-size:14px}
.mcard .act.secondary{background:color-mix(in srgb,var(--green) 10%,var(--card));color:var(--green)}
.toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:4px 0 8px}
.chips{display:flex;gap:8px;flex-wrap:wrap;flex:1}
.chip{background:var(--card);color:var(--muted);border:1px solid var(--line);border-radius:999px;padding:8px 14px;min-height:40px;font-size:13px;font-weight:700}
.chip.active{background:var(--ink);color:var(--cream)}
.team-select{border:1px solid var(--line);border-radius:999px;background:var(--card);min-height:40px;padding:8px 14px;font-weight:600}
.fab{position:fixed;right:18px;bottom:18px;z-index:30;display:inline-flex;align-items:center;gap:8px;height:56px;padding:0 22px;border-radius:999px;background:var(--green);color:#fff;font-weight:800;box-shadow:0 12px 30px rgba(11,79,44,.35)}
.fab .plus{font-size:22px;line-height:1}
.empty{background:var(--card);padding:26px 18px;border:1px dashed var(--line);border-radius:var(--radius);color:var(--muted);text-align:center;font-weight:600}
.skeleton{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);height:118px;position:relative;overflow:hidden}
.skeleton::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--green) 8%,transparent),transparent);transform:translateX(-100%);animation:shimmer 1.3s infinite}
@keyframes shimmer{100%{transform:translateX(100%)}}
.fade-in{animation:fadeUp .4s ease both}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.overdue-section{margin:20px 0;padding:18px;border:1px solid color-mix(in srgb,#e0632f 40%,var(--line));border-radius:var(--radius);background:color-mix(in srgb,#ff8a5c 12%,var(--card))}
.overdue-section h2{margin:0 0 6px;font-size:16px;color:#c94a1f}
.overdue-copy{margin:0 0 14px;color:var(--muted);font-size:14px}
.overdue-badge{display:inline-block;margin-bottom:8px;padding:4px 10px;border-radius:999px;background:#c94a1f;color:#fff;font-size:11px;font-weight:800;letter-spacing:.05em}
.modal{position:fixed;inset:0;background:rgba(6,16,10,.55);backdrop-filter:blur(4px);display:grid;place-items:end center;padding:0;z-index:40;animation:fadeUp .2s ease}
@media(min-width:768px){.modal{place-items:center}}
.modal-card{width:100%;max-width:560px;max-height:92vh;overflow:auto;background:var(--card);border:1px solid var(--line);border-radius:24px 24px 0 0;padding:24px;box-shadow:0 -18px 52px rgba(6,16,10,.4)}
@media(min-width:768px){.modal-card{border-radius:24px;box-shadow:0 24px 60px rgba(6,16,10,.4)}}
.modal-card h2{margin:0 0 4px;font-size:20px}
.modal-card>p{color:var(--muted);line-height:1.5;margin:0 0 8px}
.fields{display:grid;grid-template-columns:1fr;gap:12px;margin-top:8px}
@media(min-width:560px){.fields{grid-template-columns:1fr 1fr}}
.field{display:grid;gap:6px;font-size:13px;font-weight:700}
.wide{grid-column:1/-1}
select,input,textarea{padding:11px 12px;border:1px solid var(--line);border-radius:12px;background:var(--card);min-height:44px}
.actions{margin-top:20px;display:flex;justify-content:flex-end;gap:8px}
.secondary{background:color-mix(in srgb,var(--green) 10%,var(--card));color:var(--green)}
.suggestions-panel{margin:12px 0 24px;padding:20px;border:1px solid var(--line);border-radius:var(--radius);background:var(--card);box-shadow:var(--shadow)}
.suggestions-panel h2{margin:0 0 8px;font-size:18px}
.suggestions-panel p{color:var(--muted)}
.suggestion-step{margin-top:18px}
.suggestion-fields{display:grid;grid-template-columns:1fr;gap:12px;align-items:end;margin-top:10px}
@media(min-width:560px){.suggestion-fields{grid-template-columns:1fr 1fr}}
.known-team{padding:12px;border:1px solid var(--line);border-radius:12px;background:color-mix(in srgb,var(--green) 6%,var(--card));color:var(--green);font-weight:800}
.known-team small{display:block;margin-bottom:4px;color:var(--muted);font-size:11px;letter-spacing:.05em}
.gap-text{padding:10px;border-radius:12px;background:color-mix(in srgb,var(--green) 6%,var(--card));color:var(--muted);font-size:13px;line-height:1.5}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
`}</style>
);
}
