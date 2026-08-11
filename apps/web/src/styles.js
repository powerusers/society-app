// Global stylesheet. Injected once by App so every screen uses plain classNames
// instead of repeating inline style objects.
//
// Everything is driven by the tokens in :root. Change a ramp there and the whole
// app follows; no screen hard-codes a colour.
export const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;450;500;600;700&display=swap');

:root{
  /* Brand — deep pine. Muted enough to sit behind data all day without shouting. */
  --b50:#EFF5F2; --b100:#D9E9E0; --b200:#B2D2C2; --b300:#83B69F;
  --b400:#519479; --b500:#33755A; --b600:#265C47; --b700:#1D4938;
  --b800:#16382B; --b900:#0F281F;

  /* Neutrals carry a faint green cast so they sit with the brand rather than fight it. */
  --n0:#FFFFFF; --n25:#FAFBFA; --n50:#F4F7F5; --n100:#EAEEEC; --n200:#DDE3E0;
  --n300:#C4CDC9; --n400:#9AA6A1; --n500:#77837E; --n600:#5A6661;
  --n700:#3D4744; --n800:#252D2A; --n900:#131917;

  --accent:var(--b500);
  --accent-hover:var(--b600);
  --accent-soft:var(--b50);
  --accent-border:var(--b200);

  /* Status colours are desaturated on purpose — a screen of bright chips reads as an alarm. */
  --ok:#1B7A4F;    --ok-bg:#E7F4ED;    --ok-border:#BFE0CE;
  --warn:#96591A;  --warn-bg:#FBF1E3;  --warn-border:#EBD6B4;
  --bad:#A83028;   --bad-bg:#FBEDEC;   --bad-border:#EFCCC9;
  --info:#1D5B94;  --info-bg:#E9F1F8;  --info-border:#C4DAEC;
  --alt:#54479B;   --alt-bg:#EEECF8;   --alt-border:#CFC9EA;

  --bg:var(--n50);
  --surface:var(--n0);
  --surface-sunken:var(--n25);
  --line:var(--n200);
  --line-soft:var(--n100);
  --ink:var(--n900);
  --ink-2:var(--n700);
  --ink-3:var(--n500);
  --ink-4:var(--n400);

  /* Status hues by name. Screens reach for these inline when colouring a number
     or a tile by meaning — a negative ledger line, an overdue badge, a stat.
     They are aliases, so the ramps above stay the single source of truth. */
  --brand:var(--accent); --brand2:var(--b600); --brand-soft:var(--accent-soft);
  --green:var(--ok);   --green-bg:var(--ok-bg);
  --red:var(--bad);    --red-bg:var(--bad-bg);
  --amber:var(--warn); --amber-bg:var(--warn-bg);
  --blue:var(--info);  --blue-bg:var(--info-bg);
  --purple:var(--alt); --purple-bg:var(--alt-bg);
  --ink2:var(--ink-2); --ink3:var(--ink-3); --line2:var(--n300);

  --r-xs:6px; --r-sm:9px; --r-md:12px; --r-lg:16px; --r-xl:22px; --r-pill:999px;

  --e1:0 1px 2px rgba(15,40,31,.05);
  --e2:0 1px 3px rgba(15,40,31,.06), 0 1px 2px rgba(15,40,31,.04);
  --e3:0 4px 14px rgba(15,40,31,.08);
  --e4:0 14px 34px rgba(15,40,31,.13);

  --shell:460px;
  --font:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
}

*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;padding:0;background:var(--n100)}
body{font-family:var(--font);color:var(--ink);font-size:14px;line-height:1.5;
  -webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;font-variant-numeric:tabular-nums}
::-webkit-scrollbar{width:0;height:0}
button{font-family:inherit;color:inherit}
button:not(:disabled){cursor:pointer}
button:disabled{opacity:.4;cursor:not-allowed}
input,select,textarea{font-family:inherit;font-size:14px}
a{color:var(--accent)}
:focus-visible{outline:2px solid var(--b400);outline-offset:2px;border-radius:4px}

@keyframes slideUp{from{transform:translateY(12px);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
@keyframes slideDown{from{transform:translateY(-10px);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
@keyframes ring{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
@keyframes shimmer{to{background-position:200% 0}}

/* ---------------- shell ---------------- */
.app{max-width:var(--shell);margin:0 auto;background:var(--bg);min-height:100vh;position:relative;
  overflow-x:hidden;box-shadow:0 0 0 1px var(--n200)}

.hdr{background:linear-gradient(160deg,var(--b700) 0%,var(--b800) 100%);color:#fff;
  padding:14px 16px 15px;position:sticky;top:0;z-index:60}
.hdr-row{display:flex;align-items:center;gap:10px}
.hdr h1{font-size:17px;font-weight:600;margin:0;letter-spacing:-.01em;line-height:1.3}
.hdr .sub{font-size:12px;color:rgba(255,255,255,.62);margin:1px 0 0;font-weight:450}

.iconbtn{border:none;background:rgba(255,255,255,.1);border-radius:var(--r-sm);width:34px;height:34px;
  display:inline-flex;align-items:center;justify-content:center;color:#fff;position:relative;flex-shrink:0;
  transition:background .15s}
.iconbtn:hover{background:rgba(255,255,255,.18)}
.iconbtn.ghost{background:none;width:30px;margin-left:-6px}
.iconbtn.alarm{background:rgba(255,138,128,.16);color:#FFC7C2}
.iconbtn.alarm:hover{background:rgba(255,138,128,.26)}
.dot{position:absolute;top:6px;right:6px;width:7px;height:7px;background:#FF7B72;border-radius:var(--r-pill);
  box-shadow:0 0 0 2px var(--b700)}

.body{padding:16px 14px 104px}

.nav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:var(--shell);
  background:rgba(255,255,255,.94);backdrop-filter:blur(12px);border-top:1px solid var(--line);
  display:flex;padding:6px 4px calc(8px + env(safe-area-inset-bottom,0px));z-index:60}
.nav button{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;font-size:10px;
  color:var(--ink-4);border:none;background:none;padding:6px 2px 4px;font-weight:500;position:relative;
  letter-spacing:.005em;transition:color .15s}
.nav button.on{color:var(--accent);font-weight:600}
.nav button.on:before{content:'';position:absolute;top:-6px;width:22px;height:2.5px;border-radius:var(--r-pill);
  background:var(--accent)}
.nav .pip{position:absolute;top:1px;right:calc(50% - 17px);min-width:16px;height:16px;border-radius:var(--r-pill);
  background:var(--bad);color:#fff;font-size:9.5px;font-weight:600;display:flex;align-items:center;
  justify-content:center;padding:0 4px;border:2px solid var(--n0)}

/* ---------------- surfaces ---------------- */
.card{background:var(--surface);border:1px solid var(--line-soft);border-radius:var(--r-lg);
  padding:15px 16px;margin-bottom:10px;box-shadow:var(--e1)}
.card.flat{box-shadow:none;background:var(--surface-sunken);border-color:var(--line)}
.card.tight{padding:12px 14px}
.card.brand{background:linear-gradient(155deg,var(--b600) 0%,var(--b800) 100%);border:none;color:#fff;
  box-shadow:var(--e3)}
.card.brand .muted,.card.brand .sub,.card.brand .tiny{color:rgba(255,255,255,.68)}
.card.tap{width:100%;text-align:left;font-family:inherit;display:block;transition:box-shadow .15s,transform .1s}
.card.tap:active{transform:scale(.995);box-shadow:var(--e1)}
.card.accent{border-left:3px solid var(--accent)}

.hairline{height:1px;background:var(--line-soft);margin:12px -16px}
.row{display:flex;align-items:center;justify-content:space-between;gap:12px}
.row.top{align-items:flex-start}
.col{display:flex;flex-direction:column}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.wrap{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.spacer{height:8px}

/* ---------------- type ---------------- */
.h1{font-size:24px;font-weight:700;margin:0;letter-spacing:-.022em;line-height:1.2}
.h2{font-size:15px;font-weight:600;color:var(--ink);margin:0;letter-spacing:-.008em}
.h3{font-size:15px;font-weight:600;color:var(--ink);margin:0;letter-spacing:-.006em;line-height:1.35}
.h4{font-size:13.5px;font-weight:550;color:var(--ink);margin:0;line-height:1.4}
.num{font-size:22px;font-weight:650;letter-spacing:-.025em;margin:0;line-height:1.15}
.muted{color:var(--ink-3);font-size:13px;margin:0;line-height:1.55}
.tiny{color:var(--ink-4);font-size:11.5px;margin:0;line-height:1.45}
.mono{font-family:ui-monospace,SFMono-Regular,'SF Mono',Menlo,monospace;font-size:11.5px;letter-spacing:-.01em}
.center{text-align:center}
.right{text-align:right}
.grow{flex:1;min-width:0}
.truncate{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.clamp2{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.clamp3{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}

/* Section headers use an overline rather than a big coloured title — it separates
   content without competing with the data underneath. */
.sect{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:22px 0 9px}
.sect:first-child{margin-top:2px}
.sect .h2{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:var(--ink-4)}

/* ---------------- badges & chips ---------------- */
.badge{display:inline-flex;align-items:center;gap:4px;padding:2.5px 8px;border-radius:var(--r-xs);
  font-size:11px;font-weight:550;background:var(--n100);color:var(--ink-2);white-space:nowrap;
  border:1px solid transparent;line-height:1.5}
.badge.green{background:var(--ok-bg);color:var(--ok);border-color:var(--ok-border)}
.badge.red{background:var(--bad-bg);color:var(--bad);border-color:var(--bad-border)}
.badge.amber{background:var(--warn-bg);color:var(--warn);border-color:var(--warn-border)}
.badge.blue{background:var(--info-bg);color:var(--info);border-color:var(--info-border)}
.badge.purple{background:var(--alt-bg);color:var(--alt);border-color:var(--alt-border)}
.badge.brand{background:var(--accent-soft);color:var(--b600);border-color:var(--accent-border)}
.badge.solid{background:rgba(255,255,255,.16);color:#fff;border-color:rgba(255,255,255,.14)}
.badge .dotmark{width:5px;height:5px;border-radius:50%;background:currentColor;flex-shrink:0}

.chip{border:1px solid var(--line);background:var(--surface);border-radius:var(--r-pill);padding:6px 13px;
  font-size:12.5px;font-weight:500;color:var(--ink-2);white-space:nowrap;transition:all .14s}
.chip:hover{border-color:var(--n300)}
.chip.on{background:var(--b700);border-color:var(--b700);color:#fff;font-weight:550}
.chiprow{display:flex;gap:7px;overflow-x:auto;margin:0 -14px 14px;padding:1px 14px 2px}

/* ---------------- buttons ---------------- */
.btn{padding:10px 18px;border-radius:var(--r-sm);border:1px solid transparent;font-size:13.5px;font-weight:550;
  display:inline-flex;align-items:center;justify-content:center;gap:7px;background:var(--accent);color:#fff;
  transition:background .15s,box-shadow .15s,transform .08s;box-shadow:var(--e1);letter-spacing:-.005em}
.btn:hover:not(:disabled){background:var(--accent-hover)}
.btn:active:not(:disabled){transform:translateY(.5px)}
.btn.sm{padding:6.5px 12px;font-size:12.5px;border-radius:var(--r-xs);gap:5px}
.btn.lg{padding:13px 22px;font-size:15px;border-radius:var(--r-md)}
.btn.block{width:100%}
.btn.outline{background:var(--surface);border-color:var(--line);color:var(--ink)}
.btn.outline:hover:not(:disabled){background:var(--n50);border-color:var(--n300)}
.btn.ghost{background:var(--n100);color:var(--ink-2);box-shadow:none}
.btn.ghost:hover:not(:disabled){background:var(--n200)}
.btn.danger{background:var(--bad)}
.btn.danger:hover:not(:disabled){background:#8F2921}
.btn.warn{background:var(--warn)}
.btn.white{background:#fff;color:var(--b700)}
.btn.white:hover:not(:disabled){background:var(--n50)}

.linkbtn{border:none;background:none;color:var(--accent);font-weight:550;font-size:12.5px;padding:0;
  display:inline-flex;align-items:center;gap:3px}
.linkbtn:hover{color:var(--accent-hover)}
.dashed{width:100%;padding:11px;border:1px dashed var(--n300);border-radius:var(--r-md);background:none;
  color:var(--ink-2);font-weight:500;font-size:13px;transition:all .15s}
.dashed:hover{border-color:var(--b300);color:var(--accent);background:var(--accent-soft)}

/* ---------------- forms ---------------- */
.field{margin-bottom:14px}
.field label{font-size:12.5px;font-weight:550;color:var(--ink-2);margin-bottom:6px;display:block}
.inp{width:100%;padding:10px 12px;border-radius:var(--r-sm);border:1px solid var(--line);background:var(--surface);
  color:var(--ink);transition:border-color .15s,box-shadow .15s}
.inp::placeholder{color:var(--ink-4)}
.inp:hover{border-color:var(--n300)}
.inp:focus{border-color:var(--b400)!important;outline:none;box-shadow:0 0 0 3px var(--b50)}
select.inp{appearance:none;padding-right:34px;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239AA6A1' stroke-width='2.5' stroke-linecap='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:right 12px center}
textarea.inp{min-height:90px;resize:vertical;line-height:1.5}
.hint{font-size:11.5px;color:var(--ink-4);margin:5px 0 0;line-height:1.45}
.err{font-size:12px;color:var(--bad);margin:5px 0 0;font-weight:500}

.switch{width:40px;height:23px;border-radius:var(--r-pill);background:var(--n300);position:relative;border:none;
  flex-shrink:0;transition:background .18s}
.switch.on{background:var(--accent)}
.switch i{position:absolute;top:2.5px;left:2.5px;width:18px;height:18px;border-radius:50%;background:#fff;
  transition:left .18s;display:block;box-shadow:var(--e1)}
.switch.on i{left:19.5px}

.seg{display:flex;background:var(--n100);border-radius:var(--r-sm);padding:3px;gap:2px;margin-bottom:14px}
.seg button{flex:1;border:none;background:none;padding:7px 4px;border-radius:var(--r-xs);font-size:12.5px;
  font-weight:500;color:var(--ink-3);transition:all .15s}
.seg button.on{background:var(--surface);color:var(--ink);font-weight:600;box-shadow:var(--e2)}

/* ---------------- lists ---------------- */
.list{background:var(--surface);border:1px solid var(--line-soft);border-radius:var(--r-lg);overflow:hidden;
  box-shadow:var(--e1);margin-bottom:10px}
.li{display:flex;align-items:center;gap:12px;padding:12px 14px;border-bottom:1px solid var(--line-soft);
  background:none;width:100%;text-align:left;font-family:inherit;color:inherit}
.li:last-child{border-bottom:none}
.li.tap{transition:background .12s}
.li.tap:hover{background:var(--n25)}
.li.tap:active{background:var(--n50)}

.avatar{width:36px;height:36px;border-radius:var(--r-sm);display:flex;align-items:center;justify-content:center;
  font-weight:600;font-size:12.5px;flex-shrink:0;color:#fff;letter-spacing:-.01em}
.avatar.lg{width:56px;height:56px;font-size:19px;border-radius:var(--r-md)}

.ico-tile{width:36px;height:36px;border-radius:var(--r-sm);background:var(--accent-soft);color:var(--b600);
  display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:17px}
.ico-tile.green{background:var(--ok-bg);color:var(--ok)}
.ico-tile.red{background:var(--bad-bg);color:var(--bad)}
.ico-tile.amber{background:var(--warn-bg);color:var(--warn)}
.ico-tile.blue{background:var(--info-bg);color:var(--info)}
.ico-tile.purple{background:var(--alt-bg);color:var(--alt)}
.ico-tile.plain{background:var(--n100);color:var(--ink-3)}

/* ---------------- data widgets ---------------- */
.stat{background:var(--surface);border:1px solid var(--line-soft);border-radius:var(--r-md);padding:12px 10px;
  text-align:center;box-shadow:var(--e1)}
.stat .num{font-size:19px}
.stat .lbl{font-size:10px;color:var(--ink-4);font-weight:550;margin:4px 0 0;text-transform:uppercase;
  letter-spacing:.055em;line-height:1.3}

.bar{height:6px;border-radius:var(--r-pill);background:var(--n100);overflow:hidden}
.bar i{display:block;height:100%;border-radius:var(--r-pill);background:var(--accent);transition:width .4s ease}

.alert{border-radius:var(--r-md);padding:11px 13px;display:flex;gap:10px;align-items:flex-start;font-size:12.5px;
  line-height:1.5;margin-bottom:10px;border:1px solid transparent}
.alert.info{background:var(--accent-soft);color:var(--b700);border-color:var(--accent-border)}
.alert.warn{background:var(--warn-bg);color:var(--warn);border-color:var(--warn-border)}
.alert.err{background:var(--bad-bg);color:var(--bad);border-color:var(--bad-border)}
.alert.ok{background:var(--ok-bg);color:var(--ok);border-color:var(--ok-border)}

.empty{text-align:center;padding:36px 22px;color:var(--ink-4)}
.empty .h4{color:var(--ink-2);margin-bottom:5px;font-size:14px}

.blink{width:7px;height:7px;border-radius:50%;background:var(--warn);animation:pulse 1.6s ease-in-out infinite;
  flex-shrink:0}
.blink.red{background:var(--bad)}
.blink.green{background:var(--ok)}

.tl{position:relative;padding-left:20px}
.tl:before{content:'';position:absolute;left:4px;top:7px;bottom:7px;width:1.5px;background:var(--line)}
.tl-i{position:relative;padding-bottom:16px}
.tl-i:last-child{padding-bottom:0}
.tl-i:before{content:'';position:absolute;left:-20px;top:5px;width:9px;height:9px;border-radius:50%;
  background:var(--surface);border:2px solid var(--b400)}
.tl-i.mute:before{border-color:var(--n300)}

.tbl{width:100%;border-collapse:collapse;font-size:12.5px}
.tbl th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-4);
  padding:8px 6px;border-bottom:1px solid var(--line);font-weight:600}
.tbl td{padding:9px 6px;border-bottom:1px solid var(--line-soft);color:var(--ink-2)}
.tbl tr:last-child td{border-bottom:none}
.scrollx{overflow-x:auto;margin:0 -16px;padding:0 16px}

.fab{position:fixed;bottom:82px;left:50%;transform:translateX(calc(-50% + 158px));width:50px;height:50px;
  border-radius:var(--r-lg);background:var(--accent);color:#fff;border:none;display:flex;align-items:center;
  justify-content:center;box-shadow:var(--e4);z-index:55}

/* Loading placeholders — used while a screen waits on the API. */
.skel{background:linear-gradient(90deg,var(--n100) 25%,var(--n50) 37%,var(--n100) 63%);
  background-size:200% 100%;animation:shimmer 1.3s linear infinite;border-radius:var(--r-xs)}
.skel-line{height:11px;margin-bottom:8px}
.skel-row{display:flex;align-items:center;gap:12px;padding:12px 14px;border-bottom:1px solid var(--line-soft)}

/* ---------------- overlays ---------------- */
.scrim{position:fixed;inset:0;background:rgba(15,25,21,.42);backdrop-filter:blur(2px);z-index:200;
  display:flex;align-items:flex-end;justify-content:center;animation:fadeIn .16s ease}
.sheet{background:var(--surface);border-radius:var(--r-xl) var(--r-xl) 0 0;max-width:var(--shell);width:100%;
  max-height:90vh;overflow:auto;padding:8px 16px calc(28px + env(safe-area-inset-bottom,0px));
  animation:sheetUp .24s cubic-bezier(.32,.72,0,1)}
.sheet:before{content:'';display:block;width:34px;height:4px;border-radius:var(--r-pill);background:var(--n200);
  margin:0 auto 14px}
.sheet-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:12px}
.sheet-hd h3{margin:0;font-size:16.5px;font-weight:650;color:var(--ink);letter-spacing:-.012em}
.x{border:none;background:var(--n100);border-radius:var(--r-xs);width:30px;height:30px;display:flex;
  align-items:center;justify-content:center;color:var(--ink-3);flex-shrink:0;transition:background .15s}
.x:hover{background:var(--n200)}

.toast{position:fixed;top:72px;left:50%;transform:translateX(-50%);background:var(--n900);color:#fff;
  padding:10px 18px;border-radius:var(--r-sm);font-size:13px;font-weight:450;z-index:300;
  box-shadow:var(--e4);animation:slideDown .2s ease;max-width:88%;text-align:center;line-height:1.45}
.toast.ok{background:var(--b700)}
.toast.bad{background:var(--bad)}

.sos{position:fixed;inset:0;background:linear-gradient(165deg,#B3352C,#8A241D);z-index:400;display:flex;
  flex-direction:column;align-items:center;justify-content:center;color:#fff;text-align:center;padding:32px;
  animation:fadeIn .18s}
`;

/* Avatar colours: dark enough for white text, spread far enough apart to tell people apart. */
export const AV = ["#1D4938", "#33755A", "#5C4636", "#334A5C", "#54479B", "#1D5B94", "#A83028", "#96591A", "#1B6E63", "#3F3B7A"];
export const avatarColor = (s = "") => AV[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length];
