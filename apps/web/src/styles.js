// Global stylesheet. Injected once by App so every screen can use plain
// classNames instead of repeating inline style objects.
export const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');

:root{
  --brand:#1B4D3E; --brand2:#2D7A5F; --brand-soft:#E8F5EE;
  --bg:#F8F6F1; --surface:#ffffff; --line:#EDE9E1; --line2:#DDD8CF;
  --ink:#1D2320; --ink2:#5A625D; --ink3:#98A09B;
  --green:#2E7D32; --green-bg:#E8F5E9;
  --red:#C62828; --red-bg:#FFEBEE;
  --amber:#E65100; --amber-bg:#FFF3E0;
  --blue:#1565C0; --blue-bg:#E3F2FD;
  --purple:#7B1FA2; --purple-bg:#F3E5F5;
  --r:14px; --shadow:0 1px 4px rgba(0,0,0,.05);
}

*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;padding:0;background:#e9e6df}
body{font-family:'DM Sans',system-ui,sans-serif;color:var(--ink)}
::-webkit-scrollbar{width:0;height:0}
button{font-family:inherit}
button:active:not(:disabled){transform:scale(.975)}
button:disabled{opacity:.45;cursor:not-allowed}
input,select,textarea{font-family:inherit}
input:focus,select:focus,textarea:focus{border-color:var(--brand)!important;outline:none}

@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
@keyframes slideDown{from{transform:translateY(-16px);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes ring{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}

/* ---------- layout ---------- */
.app{max-width:460px;margin:0 auto;background:var(--bg);min-height:100vh;position:relative;overflow-x:hidden}
.hdr{background:linear-gradient(135deg,var(--brand),var(--brand2));color:#fff;padding:14px 18px;position:sticky;top:0;z-index:60}
.hdr-row{display:flex;align-items:center;justify-content:space-between;gap:10px}
.hdr h1{font-size:19px;font-weight:700;margin:0;letter-spacing:-.3px}
.hdr .sub{font-size:12px;opacity:.78;margin:2px 0 0}
.iconbtn{border:none;background:rgba(255,255,255,.16);border-radius:10px;width:36px;height:36px;display:inline-flex;
  align-items:center;justify-content:center;cursor:pointer;color:#fff;position:relative;flex-shrink:0}
.iconbtn.ghost{background:transparent}
.dot{position:absolute;top:5px;right:5px;min-width:8px;height:8px;background:#FF5252;border-radius:20px;border:2px solid var(--brand)}
.dot.count{padding:0 4px;font-size:9px;line-height:12px;height:14px;color:#fff;font-weight:700;top:2px;right:2px}
.body{padding:14px 14px 96px}
.nav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:460px;background:#fff;
  border-top:1px solid var(--line);display:flex;justify-content:space-around;padding:7px 0 11px;z-index:60}
.nav button{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:9.5px;color:var(--ink3);
  border:none;background:none;padding:3px 6px;cursor:pointer;font-weight:500;position:relative;flex:1}
.nav button.on{color:var(--brand);font-weight:700}
.nav .pip{position:absolute;top:-1px;right:calc(50% - 16px);min-width:15px;height:15px;border-radius:9px;background:#E53935;
  color:#fff;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 3px}

/* ---------- surfaces ---------- */
.card{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:15px 16px;margin-bottom:11px;box-shadow:var(--shadow)}
.card.flat{box-shadow:none}
.card.tight{padding:11px 13px}
.card.brand{background:linear-gradient(135deg,var(--brand),var(--brand2));color:#fff;border:none}
.card.brand .muted,.card.brand .sub{color:rgba(255,255,255,.75)}
.card.tap{cursor:pointer;text-align:left;width:100%;font-family:inherit;display:block}
.hairline{height:1px;background:var(--line);margin:12px -16px}
.row{display:flex;align-items:center;justify-content:space-between;gap:10px}
.row.top{align-items:flex-start}
.col{display:flex;flex-direction:column}
.stack>*+*{margin-top:10px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
.wrap{display:flex;flex-wrap:wrap;gap:6px}
.spacer{height:10px}

/* ---------- type ---------- */
.h1{font-size:22px;font-weight:800;margin:0;letter-spacing:-.5px}
.h2{font-size:17px;font-weight:700;color:var(--brand);margin:0;letter-spacing:-.3px}
.h3{font-size:15px;font-weight:700;color:var(--ink);margin:0}
.h4{font-size:13.5px;font-weight:600;color:var(--ink);margin:0}
.sect{display:flex;align-items:center;justify-content:space-between;margin:18px 0 10px;gap:8px}
.sect:first-child{margin-top:4px}
.muted{color:var(--ink2);font-size:12.5px;margin:0;line-height:1.5}
.tiny{color:var(--ink3);font-size:11px;margin:0}
.num{font-size:24px;font-weight:800;letter-spacing:-.6px;margin:0}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;letter-spacing:.3px}
.strike{text-decoration:line-through;opacity:.5}
.center{text-align:center}
.right{text-align:right}
.grow{flex:1;min-width:0}
.truncate{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* ---------- badges / chips ---------- */
.badge{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:20px;font-size:10.5px;font-weight:700;
  background:#F1EFE9;color:var(--ink2);white-space:nowrap;text-transform:capitalize}
.badge.green{background:var(--green-bg);color:var(--green)}
.badge.red{background:var(--red-bg);color:var(--red)}
.badge.amber{background:var(--amber-bg);color:var(--amber)}
.badge.blue{background:var(--blue-bg);color:var(--blue)}
.badge.purple{background:var(--purple-bg);color:var(--purple)}
.badge.brand{background:var(--brand-soft);color:var(--brand)}
.badge.solid{background:var(--brand);color:#fff}
.chip{border:1.5px solid var(--line2);background:#fff;border-radius:20px;padding:6px 13px;font-size:12px;font-weight:600;
  color:var(--ink2);cursor:pointer;white-space:nowrap}
.chip.on{background:var(--brand);border-color:var(--brand);color:#fff}
.chiprow{display:flex;gap:7px;overflow-x:auto;padding:2px 0 2px;margin:0 -14px 12px;padding-left:14px;padding-right:14px}

/* ---------- buttons ---------- */
.btn{padding:11px 20px;border-radius:11px;border:none;font-size:14px;font-weight:600;cursor:pointer;
  display:inline-flex;align-items:center;justify-content:center;gap:7px;
  background:linear-gradient(135deg,var(--brand),var(--brand2));color:#fff}
.btn.sm{padding:7px 14px;font-size:12.5px;border-radius:9px;gap:5px}
.btn.lg{padding:14px 22px;font-size:15.5px}
.btn.block{width:100%}
.btn.outline{background:none;border:1.5px solid var(--brand);color:var(--brand)}
.btn.ghost{background:#F1EFE9;color:var(--ink);}
.btn.danger{background:var(--red);color:#fff}
.btn.warn{background:var(--amber);color:#fff}
.btn.white{background:#fff;color:var(--brand)}
.linkbtn{border:none;background:none;color:var(--brand);font-weight:600;font-size:13px;cursor:pointer;padding:0}
.dashed{width:100%;padding:12px;border:1.5px dashed var(--line2);border-radius:12px;background:none;color:var(--brand);
  font-weight:600;font-size:13px;cursor:pointer}

/* ---------- forms ---------- */
.field{margin-bottom:13px}
.field label{font-size:12.5px;font-weight:600;color:#3F4642;margin-bottom:5px;display:block}
.inp{width:100%;padding:11px 13px;border-radius:10px;border:1.5px solid var(--line2);font-size:14px;
  background:#FBFAF7;color:var(--ink)}
select.inp{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='3'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:right 12px center}
textarea.inp{min-height:88px;resize:vertical}
.hint{font-size:11px;color:var(--ink3);margin:4px 0 0}
.err{font-size:11.5px;color:var(--red);margin:4px 0 0;font-weight:600}
.switch{width:44px;height:26px;border-radius:20px;background:#D8D4CB;position:relative;border:none;cursor:pointer;flex-shrink:0;transition:background .18s}
.switch.on{background:var(--brand)}
.switch i{position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:left .18s;display:block}
.switch.on i{left:21px}
.seg{display:flex;background:#F1EFE9;border-radius:11px;padding:3px;gap:3px;margin-bottom:12px}
.seg button{flex:1;border:none;background:none;padding:8px 4px;border-radius:9px;font-size:12.5px;font-weight:600;color:var(--ink2);cursor:pointer}
.seg button.on{background:#fff;color:var(--brand);box-shadow:0 1px 3px rgba(0,0,0,.07)}

/* ---------- lists ---------- */
.list{background:#fff;border:1px solid var(--line);border-radius:var(--r);overflow:hidden;box-shadow:var(--shadow);margin-bottom:11px}
.li{display:flex;align-items:center;gap:11px;padding:12px 14px;border-bottom:1px solid var(--line);
  background:none;width:100%;text-align:left;font-family:inherit;cursor:default}
.li:last-child{border-bottom:none}
.li.tap{cursor:pointer}
.li.tap:active{background:#FAF8F3}
.avatar{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;
  font-weight:700;font-size:14px;flex-shrink:0;color:#fff}
.avatar.sq{border-radius:11px}
.avatar.lg{width:54px;height:54px;font-size:19px;border-radius:15px}
.ico-tile{width:42px;height:42px;border-radius:12px;background:var(--brand-soft);color:var(--brand);
  display:flex;align-items:center;justify-content:center;flex-shrink:0}

/* ---------- misc widgets ---------- */
.stat{background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px 10px;text-align:center}
.stat .num{font-size:21px}
.stat .lbl{font-size:10px;color:var(--ink3);font-weight:700;margin:3px 0 0;text-transform:uppercase;letter-spacing:.4px}
.bar{height:7px;border-radius:6px;background:#EEEBE4;overflow:hidden}
.bar i{display:block;height:100%;border-radius:6px;background:var(--brand)}
.alert{border-radius:12px;padding:11px 13px;display:flex;gap:9px;align-items:flex-start;font-size:12.5px;line-height:1.45;margin-bottom:11px}
.alert.info{background:var(--brand-soft);color:var(--brand)}
.alert.warn{background:var(--amber-bg);color:var(--amber)}
.alert.err{background:var(--red-bg);color:var(--red)}
.alert.ok{background:var(--green-bg);color:var(--green)}
.empty{text-align:center;padding:34px 20px;color:var(--ink3)}
.empty .h4{color:var(--ink2);margin-bottom:4px}
.blink{width:8px;height:8px;border-radius:50%;background:#FF9800;animation:pulse 1.4s infinite;flex-shrink:0}
.blink.red{background:#E53935}
.blink.green{background:#43A047}
.tl{position:relative;padding-left:22px}
.tl:before{content:'';position:absolute;left:6px;top:6px;bottom:6px;width:2px;background:var(--line)}
.tl-i{position:relative;padding-bottom:14px}
.tl-i:last-child{padding-bottom:0}
.tl-i:before{content:'';position:absolute;left:-20px;top:4px;width:10px;height:10px;border-radius:50%;
  background:#fff;border:2px solid var(--brand)}
.tl-i.mute:before{border-color:var(--line2)}
.tbl{width:100%;border-collapse:collapse;font-size:12.5px}
.tbl th{text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.4px;color:var(--ink3);
  padding:8px 6px;border-bottom:1px solid var(--line);font-weight:700}
.tbl td{padding:9px 6px;border-bottom:1px solid var(--line);color:var(--ink)}
.tbl tr:last-child td{border-bottom:none}
.scrollx{overflow-x:auto;margin:0 -16px;padding:0 16px}
.fab{position:fixed;bottom:78px;left:50%;transform:translateX(calc(-50% + 160px));width:54px;height:54px;border-radius:18px;
  background:linear-gradient(135deg,var(--brand),var(--brand2));color:#fff;border:none;display:flex;align-items:center;
  justify-content:center;box-shadow:0 6px 18px rgba(27,77,62,.36);cursor:pointer;z-index:55}

/* ---------- overlays ---------- */
.scrim{position:fixed;inset:0;background:rgba(20,24,22,.45);z-index:200;display:flex;align-items:flex-end;
  justify-content:center;animation:fadeIn .18s ease}
.sheet{background:#fff;border-radius:20px 20px 0 0;max-width:460px;width:100%;max-height:88vh;overflow:auto;
  padding:18px 16px 30px;animation:slideUp .26s ease}
.sheet-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;gap:10px}
.sheet-hd h3{margin:0;font-size:17px;font-weight:700;color:var(--brand)}
.x{border:none;background:#F1EFE9;border-radius:9px;width:32px;height:32px;display:flex;align-items:center;
  justify-content:center;cursor:pointer;color:var(--ink2);flex-shrink:0}
.toast{position:fixed;top:74px;left:50%;transform:translateX(-50%);background:#1D2320;color:#fff;padding:11px 20px;
  border-radius:12px;font-size:13.5px;font-weight:500;z-index:300;box-shadow:0 6px 22px rgba(0,0,0,.25);
  animation:slideDown .25s ease;max-width:88%;text-align:center}
.toast.ok{background:var(--brand)}
.toast.bad{background:var(--red)}
.sos{position:fixed;inset:0;background:rgba(198,40,40,.96);z-index:400;display:flex;flex-direction:column;
  align-items:center;justify-content:center;color:#fff;text-align:center;padding:30px;animation:fadeIn .2s}
`;

export const AV = ["#1B4D3E", "#2D7A5F", "#6D4C41", "#37474F", "#7B1FA2", "#1565C0", "#C62828", "#E65100", "#00695C", "#4527A0"];
export const avatarColor = (s = "") => AV[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length];
