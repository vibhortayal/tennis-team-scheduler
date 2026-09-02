export function Styles() {
  return (
    <style>{`
      *{box-sizing:border-box}
      body{margin:0;background:#f5f6f1;font-family:Arial;color:#15231a}
      main{max-width:1100px;margin:auto;padding:24px}
      button,select,input,textarea{font:inherit}
      button{border:0;border-radius:9px;padding:10px 14px;background:#147a42;color:white;font-weight:700;cursor:pointer}
      button:disabled{cursor:not-allowed;opacity:.55}
      .top,.hero,.card,form,.tabs{background:#fff;border:1px solid #e0e8df;border-radius:16px}
      .top{padding:18px;display:flex;justify-content:space-between;align-items:center;gap:12px}
      .identity-select{width:auto;min-width:190px;max-width:260px;background:#eaf4eb;color:#17663d;font-weight:700}
      .identity-picker{display:flex;align-items:center;gap:8px}
      .identity-picker-label{font-size:12px;font-weight:700;color:#17663d;text-transform:uppercase;letter-spacing:.5px;white-space:nowrap}
      .tabs{display:flex;padding:5px;margin:18px 0;gap:5px}
      .tabs button{flex:1;background:transparent;color:#57705e}
      .tabs button.active{background:#147a42;color:#fff}
      .hero{padding:24px;display:flex;justify-content:space-between;gap:16px;background:linear-gradient(120deg,#fff,#edf8ef);margin:18px 0 0}
      .next-matches{display:block}
      .wide-hero{width:100%}
      .wide-hero .eyebrow{margin-bottom:12px}
      .group-schedule{margin:0 0 16px}
      .eyebrow{color:#147a42;font-size:12px;font-weight:800;letter-spacing:1px}
      .badge{background:#147a42;color:#fff;height:max-content;border-radius:999px;padding:10px;font-weight:800}
      .filters{display:flex;gap:8px;flex-wrap:wrap;margin:20px 0}
      .filters button{background:#eaf4eb;color:#17663d}
      .filters button.active{background:#17231d;color:#fff}
      select,input,textarea{padding:10px;border:1px solid #d6dfd5;border-radius:8px;background:white}
      .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
      .card{padding:16px}
      .card p{color:#5f7064}
      .empty,.notice{background:#fff;padding:16px;border-radius:12px;color:#5f7064}
      .notice{color:#17663d}

      /* === Modal overlay + card === */
      .modal{
        position:fixed;inset:0;
        background:rgba(16,32,21,.52);
        display:grid;place-items:center;
        padding:15px;z-index:10;
      }
      .modal-card{
        width:min(540px,100%);
        max-height:90vh;
        overflow:auto;
        background:#fff;
        border:1px solid #d6dfd5;
        border-radius:16px;
        padding:28px;
        box-shadow:0 18px 52px rgba(16,32,21,.26);
      }
      .modal-card h2{margin-top:0}
      .modal-card > p{color:#5f7064;line-height:1.55;margin-top:6px}

      .fields{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .field{display:grid;gap:5px;font-size:13px;font-weight:bold}
      .field-label{font-size:13px;font-weight:bold;color:#15231a}
      .wide{grid-column:1/-1}
      .actions{margin-top:20px;display:flex;justify-content:flex-end;gap:8px}
      .secondary{background:#eaf4eb;color:#17663d}
      .team-line{display:flex;align-items:center;gap:8px;min-width:0}
      .team-number{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;min-width:32px;height:26px;padding:0 8px;border-radius:999px;background:#eaf4eb;color:#17663d;font-size:12px;font-weight:800}
      .team-names{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#15231a;font-weight:750}
      .team-line.winner .team-names{color:#147a42;font-weight:800}
.team-line.winner .team-number{background:#147a42;color:#fff}
.winner-badge{display:inline-flex;align-items:center;gap:2px;flex:0 0 auto;padding:2px 8px;border-radius:999px;background:#147a42;color:#fff;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px}
      .matchup{display:grid;gap:8px;margin:12px 0}
      .versus{color:#758278;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.8px}
      .team-with-info{display:grid;gap:6px;min-width:0}
      .info-inline{padding:8px 10px;border-radius:10px;background:#f1f7f1}
      .info-inline p{margin:0 0 4px;color:#47614d !important;font-size:12px;font-weight:400;line-height:1.4}
      .info-inline p:last-child{margin:0}
      .overdue-section{margin:20px 0;padding:18px;border:2px solid #d94924;border-radius:16px;background:#fff3ed}
      .overdue-heading{margin:0 0 6px;color:#a72c11}
      .overdue-copy{margin:0 0 16px;color:#8c351f}
      .overdue-card{border:2px solid #ef7d58;background:#fffaf7;box-shadow:0 4px 14px rgba(167,44,17,.14)}
      .overdue-card small{color:#a72c11}
      .overdue-card button{background:#c63d1c}
      .overdue-badge{display:inline-block;margin-bottom:8px;padding:5px 8px;border-radius:999px;background:#c63d1c;color:#fff;font-size:11px;font-weight:800;letter-spacing:.6px}
      .suggestions-panel{margin:6px 0 24px;padding:20px;border:1px solid #cbdccd;border-radius:16px;background:linear-gradient(120deg,#ffffff,#edf8ef)}
      .suggestions-panel h2{margin:5px 0 8px}
      .suggestions-panel p{color:#5f7064}
      .suggestion-step{margin-top:18px}
      .suggestion-step h3{margin:0 0 8px;font-size:14px}
      .suggestion-fields{display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:end;margin-top:10px}
      .known-team{padding:12px;border:1px solid #cbdccd;border-radius:10px;background:#f1f7f1;color:#17663d;font-weight:800}
      .known-team small{display:block;margin-bottom:4px;color:#5f7064;font-size:11px;letter-spacing:.7px}
      .known-team-note{font-size:12px;color:#8a9d8e;margin-top:6px !important;font-weight:400}
      .suggest-button{margin-top:16px}
      .suggestion-note{margin:14px 0 0;color:#17663d !important;font-weight:700}
      .suggestion-filter{margin-top:16px;max-width:360px}
      .suggestion-grid{margin-top:16px}
      .suggestion-card{border-color:#c3dac8;background:#ffffff}
      .suggestion-card > small{color:#147a42;font-weight:800;letter-spacing:.7px}
      .gap-text{padding:10px;border-radius:10px;background:#f1f7f1;color:#47614d !important;font-size:13px;line-height:1.5}

      /* === Score entry === */
      .score-entry{
        display:grid;gap:10px;
        padding:14px;border-radius:10px;
        background:#f1f7f1;
        border:1px solid #d6dfd5;
      }
      .score-entry-header{display:flex;align-items:center;justify-content:space-between}
      .score-entry-legend{
        display:grid;grid-template-columns:1fr auto 1fr;
        gap:6px;align-items:center;
        font-size:12px;font-weight:700;color:#47614d;
        margin-bottom:4px;
      }
      .score-legend-left{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .score-legend-right{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:right}
      .score-legend-vs{color:#8a9d8e;font-size:11px;font-weight:800;text-align:center;text-transform:uppercase;letter-spacing:.5px}
      .set-row{
        display:grid;grid-template-columns:48px 1fr;
        gap:8px;align-items:center;
      }
      .set-label{font-size:12px;font-weight:700;color:#47614d;white-space:nowrap}
      .set-optional{font-weight:400;color:#8a9d8e}
      .set-inputs{display:grid;grid-template-columns:1fr auto 1fr;gap:6px;align-items:center}
      .set-team-input{display:flex;align-items:center;gap:6px}
      .set-team-input--right{flex-direction:row-reverse}
      .set-team-name{
        font-size:11px;color:#5f7064;overflow:hidden;
        text-overflow:ellipsis;white-space:nowrap;max-width:80px;
        flex:1;min-width:0;
      }
      .score-input{
        width:54px;min-width:0;padding:7px 6px;
        text-align:center;font-weight:700;
        border:1px solid #d6dfd5;border-radius:7px;background:#fff;
      }
      .score-input::-webkit-inner-spin-button,
      .score-input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
      .score-input[type=number]{-moz-appearance:textfield}
      .set-vs{color:#758278;font-size:13px;font-weight:800;text-align:center}
      .score-error{color:#a72c11;font-size:13px;font-weight:700;margin:4px 0 0;padding:8px 10px;background:#fff3ed;border-radius:7px;border-left:3px solid #d94924}

      /* === Standings === */
      .standings-wrap{margin-top:12px}
      .standings-overflow{overflow-x:auto;-webkit-overflow-scrolling:touch}
      .standings-table{
        width:100%;border-collapse:collapse;
        font-size:14px;
        background:#fff;
        border:1px solid #e0e8df;
        border-radius:12px;
        overflow:hidden;
      }
      .standings-table th,
      .standings-table td{
        padding:10px 12px;
        text-align:left;
        border-bottom:1px solid #e8ede7;
        white-space:nowrap;
      }
      .standings-table thead th{
        background:#eaf4eb;
        color:#17663d;
        font-size:12px;
        font-weight:800;
        text-transform:uppercase;
        letter-spacing:.5px;
      }
      .standings-table tbody tr:last-child td{border-bottom:none}
      .standings-table tbody tr:hover{background:#f6fbf6}
      .standings-num{text-align:right;font-variant-numeric:tabular-nums}
      .standings-pts{font-weight:700;color:#147a42}
      .standings-nsr--pos{color:#147a42;font-weight:700}
      .standings-nsr--neg{color:#a72c11;font-weight:700}
      .standings-rank{font-weight:700;color:#5f7064}
      .standings-team-cell{display:flex;align-items:center;gap:6px}
      .standings-players{}
      .standings-players-cell{color:#5f7064;font-size:13px}
      .standings-q-badge{
        display:inline-flex;align-items:center;justify-content:center;
        width:22px;height:22px;border-radius:999px;
        background:#147a42;color:#fff;
        font-size:11px;font-weight:800;
      }
      .standings-qualifying td:first-child{}
      .standings-own-team{background:#edf8ef !important}
      .standings-own-team:hover{background:#e0f5e3 !important}
      .standings-you{
        display:inline-block;padding:2px 6px;
        background:#147a42;color:#fff;
        font-size:10px;font-weight:800;
        border-radius:999px;letter-spacing:.4px;
        margin-left:4px;text-transform:uppercase;
        }
        .standings-team-cell{flex-wrap:wrap}
        .standings-team-players{flex-basis:100%;color:#5f7064;font-size:12px;line-height:1.3}        
      .standings-footnote{
        margin:10px 0 0;
        font-size:12px;color:#758278;
      }
      .permission-note{font-size:12px;color:#758278;margin:4px 0 0}

      @media(max-width:650px){
        main{padding:14px}
        .top{align-items:flex-start}
        .identity-select{min-width:0;max-width:180px}
        .grid,.fields,.suggestion-fields{grid-template-columns:1fr}
        .wide{grid-column:auto}
        .hero{display:block}
        .badge{display:inline-block;margin-top:12px}
        .standings-table th,
        .standings-table td{padding:8px 8px;font-size:13px}
        .standings-players{display:none}
        .standings-players-cell{display:none}
        .set-row{grid-template-columns:44px 1fr}
        .score-input{width:46px}
        .set-team-name{max-width:60px}
      }
    `}</style>
  );
}
