/**
 * Global stylesheet.
 *
 * Design intent, so future edits do not drift back:
 *
 *  - Neutral first. The palette is graphite and white. Nothing is themed after
 *    the society's name; the single `--accent` token is a society setting.
 *  - Content sits on the surface, not inside floating cards. Groups are
 *    delimited by hairlines and whitespace, the way records are shown in
 *    banking and operations tools.
 *  - Colour carries meaning or it is not used. Status is a small dot plus a
 *    word; tinted fills are reserved for states that need action now.
 *  - Icons are monochrome and quiet. No coloured tile behind every row.
 *  - One number leads a screen. Everything else stays subordinate.
 */
export const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;450;500;600;650&display=swap');

:root{
  /* Neutral ramp — very slightly cool, so it reads as ink rather than mud. */
  --n0:#FFFFFF; --n25:#FCFCFD; --n50:#F7F8F9; --n100:#F0F1F3; --n150:#E8EAED;
  --n200:#DFE1E6; --n300:#C6CAD1; --n400:#9BA1AB; --n500:#727984;
  --n600:#545B66; --n700:#3A404A; --n800:#252A32; --n900:#14171C;

  /* The one branded value in the app. Societies override it in settings;
     nothing else in this file assumes a hue. */
  --accent:#2D4EA2;
  --accent-hover:#25417F;
  --accent-soft:#EEF2FB;
  --accent-line:#CBD8F0;
  --on-accent:#FFFFFF;

  /* Status. Used sparingly and mostly as text plus a dot. */
  --ok:#1B7A4F;   --ok-bg:#EAF5EF;   --ok-line:#C3E0D0;
  --warn:#8A5A12; --warn-bg:#FBF2E4; --warn-line:#E8D5B0;
  --bad:#A6322A;  --bad-bg:#FBEDEC;  --bad-line:#EECBC8;
  --info:#1F5B94; --info-bg:#EAF1F8; --info-line:#C6DAEC;
  --alt:#514A8C;  --alt-bg:#EFEEF8;  --alt-line:#CFCBE7;

  --bg:var(--n50);
  --surface:var(--n0);
  --line:var(--n150);
  --line-strong:var(--n200);
  --ink:var(--n900);
  --ink-2:var(--n700);
  --ink-3:var(--n500);
  --ink-4:var(--n400);

  --r-sm:6px; --r-md:8px; --r-lg:12px; --r-xl:16px; --r-pill:999px;
  --pad:16px;
  --shell:440px;
  --font:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;

  /* Aliases kept so inline colour usages have one source of truth. */
  --brand:var(--accent); --brand2:var(--accent-hover); --brand-soft:var(--accent-soft);
  --green:var(--ok);   --green-bg:var(--ok-bg);
  --red:var(--bad);    --red-bg:var(--bad-bg);
  --amber:var(--warn); --amber-bg:var(--warn-bg);
  --blue:var(--info);  --blue-bg:var(--info-bg);
  --purple:var(--alt); --purple-bg:var(--alt-bg);
  --ink2:var(--ink-2); --ink3:var(--ink-3); --line2:var(--n200);
  --b400:var(--accent); --b500:var(--accent); --b600:var(--accent-hover);
  --b700:var(--n800); --b800:var(--n900); --b900:#0B0D11; --b50:var(--accent-soft);
  --ok-border:var(--ok-line); --warn-border:var(--warn-line);
  --bad-border:var(--bad-line); --info-border:var(--info-line); --alt-border:var(--alt-line);
  --accent-border:var(--accent-line); --surface-sunken:var(--n25); --line-soft:var(--line);
  --e1:none; --e2:0 1px 2px rgba(20,23,28,.04); --e3:0 2px 8px rgba(20,23,28,.06);
  --e4:0 16px 40px rgba(20,23,28,.16);
}

*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;padding:0;background:var(--n150)}
body{font-family:var(--font);color:var(--ink);font-size:14px;line-height:1.45;letter-spacing:-.006em;
  -webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;font-variant-numeric:tabular-nums}
::-webkit-scrollbar{width:0;height:0}
button{font-family:inherit;color:inherit;background:none;border:none;padding:0}
button:not(:disabled){cursor:pointer}
button:disabled{opacity:.4;cursor:not-allowed}
input,select,textarea{font-family:inherit;font-size:14px;color:var(--ink)}
a{color:var(--accent)}
:focus-visible{outline:2px solid var(--accent);outline-offset:1px;border-radius:3px}

@keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes slideDown{from{transform:translateY(-8px);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes ring{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
@keyframes shimmer{to{background-position:200% 0}}
@keyframes slideUp{from{opacity:0}to{opacity:1}}

/* ---------------- shell ---------------- */
.app{max-width:var(--shell);margin:0 auto;background:var(--surface);min-height:100vh;position:relative;
  overflow-x:hidden;border-inline:1px solid var(--n200)}

/* A white header with a hairline, not a coloured banner. The screen title is
   the loudest thing on the page and nothing competes with it. */
.hdr{background:var(--surface);border-bottom:1px solid var(--line);padding:13px var(--pad) 12px;
  position:sticky;top:0;z-index:60}
.hdr-row{display:flex;align-items:center;gap:10px}
.hdr h1{font-size:17px;font-weight:600;margin:0;letter-spacing:-.02em;color:var(--ink);line-height:1.25}
.hdr .sub{font-size:12px;color:var(--ink-4);margin:1px 0 0;font-weight:450;letter-spacing:0}

.iconbtn{width:32px;height:32px;border-radius:var(--r-md);display:inline-flex;align-items:center;
  justify-content:center;color:var(--ink-3);position:relative;flex-shrink:0;transition:background .13s,color .13s}
.iconbtn:hover{background:var(--n100);color:var(--ink)}
.iconbtn.ghost{width:28px;margin-left:-6px}
.iconbtn.alarm{color:var(--bad)}
.iconbtn.alarm:hover{background:var(--bad-bg)}
.dot{position:absolute;top:5px;right:5px;width:6px;height:6px;background:var(--bad);border-radius:var(--r-pill);
  box-shadow:0 0 0 2px var(--surface)}

.body{padding:4px var(--pad) 96px}

.nav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:var(--shell);
  background:var(--surface);border-top:1px solid var(--line);display:flex;
  padding:7px 4px calc(9px + env(safe-area-inset-bottom,0px));z-index:60}
.nav button{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;font-size:10.5px;
  color:var(--ink-4);padding:3px 2px;font-weight:500;position:relative;letter-spacing:-.002em;transition:color .13s}
.nav button.on{color:var(--accent);font-weight:600}
.nav .pip{position:absolute;top:-2px;right:calc(50% - 16px);min-width:15px;height:15px;border-radius:var(--r-pill);
  background:var(--bad);color:#fff;font-size:9px;font-weight:600;display:flex;align-items:center;
  justify-content:center;padding:0 4px;border:1.5px solid var(--surface)}

/* ---------------- structure ---------------- */
/* Sections are a label and a rule, not a box. Groups bleed to the shell edge so
   rows read as records rather than as tiles. */
.sect{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin:26px 0 2px}
.sect:first-child{margin-top:14px}
.sect .h2{font-size:13px;font-weight:600;color:var(--ink);letter-spacing:-.012em;text-transform:none}

.card{background:var(--surface);border:1px solid var(--line);border-radius:var(--r-lg);padding:14px 15px;
  margin-bottom:10px}
.card.flat{background:var(--n25);border-color:var(--line)}
.card.tight{padding:11px 13px}
.card.tap{width:100%;text-align:left;font-family:inherit;display:block;transition:border-color .13s}
.card.tap:hover{border-color:var(--n300)}
/* Deliberately no left-border accent variant. Emphasis comes from weight and
   position, not from a coloured stripe down the side of a box. */

/* The one dark surface in the app: a single figure that leads a screen. */
.panel{background:var(--n900);color:#fff;border-radius:var(--r-lg);padding:18px 17px;margin-bottom:12px}
.panel .muted,.panel .sub,.panel .tiny{color:rgba(255,255,255,.5)}
.panel .h1{color:#fff}

.hairline{height:1px;background:var(--line);margin:12px -15px}
.row{display:flex;align-items:center;justify-content:space-between;gap:12px}
.row.top{align-items:flex-start}
.col{display:flex;flex-direction:column}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.grid3{display:grid;grid-template-columns:repeat(3,1fr)}
.wrap{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.spacer{height:8px}

/* ---------------- type ---------------- */
.h1{font-size:27px;font-weight:600;margin:0;letter-spacing:-.03em;line-height:1.12}
.h2{font-size:14px;font-weight:600;color:var(--ink);margin:0;letter-spacing:-.014em}
.h3{font-size:14.5px;font-weight:550;color:var(--ink);margin:0;letter-spacing:-.012em;line-height:1.35}
.h4{font-size:13.5px;font-weight:500;color:var(--ink);margin:0;line-height:1.4;letter-spacing:-.008em}
.num{font-size:20px;font-weight:600;letter-spacing:-.028em;margin:0;line-height:1.15}
.muted{color:var(--ink-3);font-size:13px;margin:0;line-height:1.5}
.tiny{color:var(--ink-4);font-size:12px;margin:0;line-height:1.4}
.mono{font-family:ui-monospace,SFMono-Regular,'SF Mono',Menlo,monospace;font-size:11.5px;letter-spacing:0}
.center{text-align:center}
.right{text-align:right}
.grow{flex:1;min-width:0}
.truncate{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.clamp2{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.clamp3{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}

/* ---------------- status ---------------- */
/* Default is a quiet word with a dot. Only states that need action now get a
   tinted fill, which is what makes those states actually stand out. */
.badge{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:450;color:var(--ink-3);
  white-space:nowrap;line-height:1.4}
.badge:before{content:'';width:5px;height:5px;border-radius:50%;background:var(--n300);flex-shrink:0}
.badge.green{color:var(--ok)} .badge.green:before{background:var(--ok)}
.badge.red{color:var(--bad)} .badge.red:before{background:var(--bad)}
.badge.amber{color:var(--warn)} .badge.amber:before{background:var(--warn)}
.badge.blue{color:var(--info)} .badge.blue:before{background:var(--info)}
.badge.purple{color:var(--alt)} .badge.purple:before{background:var(--alt)}
.badge.brand{color:var(--accent)} .badge.brand:before{background:var(--accent)}
/* The 'solid' variant is the exception: a state that must be seen at a glance. */
.badge.solid{background:var(--bad);color:#fff;padding:2px 7px;border-radius:var(--r-sm);font-weight:500}
.badge.solid:before{display:none}
.badge .dotmark{display:none}
/* Counts and reactions are values, not statuses — no leading dot. */
.badge.bare:before{display:none}

.chip{border:1px solid var(--line-strong);border-radius:var(--r-pill);padding:5px 12px;font-size:12.5px;
  font-weight:450;color:var(--ink-2);white-space:nowrap;transition:all .13s;background:var(--surface)}
.chip:hover{border-color:var(--n400)}
.chip.on{background:var(--ink);border-color:var(--ink);color:#fff;font-weight:500}
.chiprow{display:flex;gap:7px;overflow-x:auto;margin:0 calc(var(--pad) * -1) 14px;padding:1px var(--pad) 2px}

/* ---------------- buttons ---------------- */
.btn{padding:9.5px 16px;border-radius:var(--r-md);border:1px solid transparent;font-size:13.5px;font-weight:500;
  display:inline-flex;align-items:center;justify-content:center;gap:7px;background:var(--accent);
  color:var(--on-accent);transition:background .13s,border-color .13s;letter-spacing:-.008em}
.btn:hover:not(:disabled){background:var(--accent-hover)}
.btn.sm{padding:6px 11px;font-size:12.5px;gap:5px}
.btn.lg{padding:12px 20px;font-size:15px}
.btn.block{width:100%}
.btn.outline{background:var(--surface);border-color:var(--line-strong);color:var(--ink)}
.btn.outline:hover:not(:disabled){background:var(--n50);border-color:var(--n400)}
.btn.ghost{background:var(--n100);color:var(--ink-2)}
.btn.ghost:hover:not(:disabled){background:var(--n150)}
.btn.danger{background:var(--bad)}
.btn.danger:hover:not(:disabled){background:#8C2921}
.btn.warn{background:var(--warn)}
.btn.white{background:#fff;color:var(--ink)}
.btn.white:hover:not(:disabled){background:var(--n100)}

.linkbtn{color:var(--accent);font-weight:500;font-size:12.5px;display:inline-flex;align-items:center;gap:3px}
.linkbtn:hover{color:var(--accent-hover)}
.dashed{width:100%;padding:11px;border:1px dashed var(--n300);border-radius:var(--r-md);color:var(--ink-3);
  font-weight:450;font-size:13px;transition:all .13s;background:none}
.dashed:hover{border-color:var(--accent);color:var(--accent);background:var(--accent-soft)}

/* ---------------- forms ---------------- */
.field{margin-bottom:14px}
.field label{font-size:12.5px;font-weight:500;color:var(--ink-2);margin-bottom:6px;display:block}
.inp{width:100%;padding:9.5px 11px;border-radius:var(--r-md);border:1px solid var(--line-strong);
  background:var(--surface);transition:border-color .13s,box-shadow .13s}
.inp::placeholder{color:var(--ink-4)}
.inp:hover{border-color:var(--n400)}
.inp:focus{border-color:var(--accent)!important;outline:none;box-shadow:0 0 0 3px var(--accent-soft)}
select.inp{appearance:none;padding-right:32px;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239BA1AB' stroke-width='2.5' stroke-linecap='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:right 11px center}
textarea.inp{min-height:88px;resize:vertical;line-height:1.5}
.hint{font-size:12px;color:var(--ink-4);margin:5px 0 0;line-height:1.45}
.err{font-size:12px;color:var(--bad);margin:5px 0 0;font-weight:450}

.switch{width:38px;height:22px;border-radius:var(--r-pill);background:var(--n300);position:relative;
  flex-shrink:0;transition:background .16s}
.switch.on{background:var(--accent)}
.switch i{position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;
  transition:left .16s;display:block;box-shadow:0 1px 2px rgba(20,23,28,.2)}
.switch.on i{left:18px}

.seg{display:flex;border-bottom:1px solid var(--line);margin:0 calc(var(--pad) * -1) 4px;padding:0 var(--pad);gap:20px}
.seg button{padding:9px 0 10px;font-size:13.5px;font-weight:450;color:var(--ink-3);position:relative;
  transition:color .13s}
.seg button.on{color:var(--ink);font-weight:550}
.seg button.on:after{content:'';position:absolute;left:0;right:0;bottom:-1px;height:2px;background:var(--ink)}

/* ---------------- lists ---------------- */
/* No outer border or radius: a group of records, ruled like a table. */
.list{margin:0 calc(var(--pad) * -1) 4px;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.list + .list{margin-top:14px}
.li{display:flex;align-items:center;gap:12px;padding:13px var(--pad);border-bottom:1px solid var(--line);
  width:100%;text-align:left;font-family:inherit;color:inherit;background:none}
.li:last-child{border-bottom:none}
.li.tap{transition:background .1s}
.li.tap:hover{background:var(--n25)}
.li.tap:active{background:var(--n50)}

.avatar{width:34px;height:34px;border-radius:var(--r-pill);display:flex;align-items:center;justify-content:center;
  font-weight:550;font-size:12px;flex-shrink:0;background:var(--n100);color:var(--ink-2);letter-spacing:-.01em}
.avatar.lg{width:56px;height:56px;font-size:18px}

/* Monochrome and unboxed. A tinted square behind every row is the fastest way
   to make an interface look generated. */
.ico-tile{width:26px;display:flex;align-items:center;justify-content:center;flex-shrink:0;
  color:var(--ink-4);font-size:17px;background:none}
.ico-tile.green{color:var(--ok)} .ico-tile.red{color:var(--bad)}
.ico-tile.amber{color:var(--warn)} .ico-tile.blue{color:var(--info)}
.ico-tile.purple{color:var(--alt)} .ico-tile.plain{color:var(--ink-4)}

/* ---------------- data ---------------- */
/* Metrics share one rule and are divided, not boxed. */
.grid3 .stat{border-left:1px solid var(--line)}
.grid3 .stat:first-child{border-left:none;padding-left:0}
.stat{padding:2px 12px;text-align:left;background:none;border:none}
.stat .num{font-size:19px}
.stat .lbl{font-size:11.5px;color:var(--ink-4);font-weight:450;margin:3px 0 0;text-transform:none;letter-spacing:0}

.bar{height:4px;border-radius:var(--r-pill);background:var(--n150);overflow:hidden}
.bar i{display:block;height:100%;border-radius:var(--r-pill);background:var(--ink);transition:width .4s ease}

.alert{border-radius:var(--r-md);padding:10px 12px;display:flex;gap:9px;align-items:flex-start;font-size:12.5px;
  line-height:1.5;margin-bottom:10px;border:1px solid transparent}
.alert.info{background:var(--n50);color:var(--ink-2);border-color:var(--line)}
.alert.warn{background:var(--warn-bg);color:var(--warn);border-color:var(--warn-line)}
.alert.err{background:var(--bad-bg);color:var(--bad);border-color:var(--bad-line)}
.alert.ok{background:var(--ok-bg);color:var(--ok);border-color:var(--ok-line)}

.empty{text-align:center;padding:44px 24px;color:var(--ink-4);border:none;background:none;margin:0}
.empty .h4{color:var(--ink-2);margin-bottom:4px;font-size:14px;font-weight:500}

.blink{width:6px;height:6px;border-radius:50%;background:var(--warn);animation:pulse 1.8s ease-in-out infinite;
  flex-shrink:0}
.blink.red{background:var(--bad)} .blink.green{background:var(--ok)}

.tl{position:relative;padding-left:18px}
.tl:before{content:'';position:absolute;left:3px;top:6px;bottom:6px;width:1px;background:var(--line-strong)}
.tl-i{position:relative;padding-bottom:16px}
.tl-i:last-child{padding-bottom:0}
.tl-i:before{content:'';position:absolute;left:-18px;top:5px;width:7px;height:7px;border-radius:50%;
  background:var(--n400)}
.tl-i.mute:before{background:var(--n300)}

.tbl{width:100%;border-collapse:collapse;font-size:13px}
.tbl th{text-align:left;font-size:12px;color:var(--ink-4);padding:7px 6px;border-bottom:1px solid var(--line);
  font-weight:450;letter-spacing:0;text-transform:none}
.tbl td{padding:9px 6px;border-bottom:1px solid var(--line);color:var(--ink-2)}
.tbl tr:last-child td{border-bottom:none}
.scrollx{overflow-x:auto;margin:0 calc(var(--pad) * -1);padding:0 var(--pad)}

.fab{position:fixed;bottom:78px;left:50%;transform:translateX(calc(-50% + 150px));width:48px;height:48px;
  border-radius:var(--r-pill);background:var(--ink);color:#fff;display:flex;align-items:center;
  justify-content:center;box-shadow:var(--e4);z-index:55}

.skel{background:linear-gradient(90deg,var(--n100) 25%,var(--n50) 37%,var(--n100) 63%);background-size:200% 100%;
  animation:shimmer 1.3s linear infinite;border-radius:3px}
.skel-line{height:10px;margin-bottom:8px}
.skel-row{display:flex;align-items:center;gap:12px;padding:13px var(--pad);border-bottom:1px solid var(--line)}

/* ---------------- overlays ---------------- */
.scrim{position:fixed;inset:0;background:rgba(20,23,28,.4);z-index:200;display:flex;align-items:flex-end;
  justify-content:center;animation:fadeIn .14s ease}
.sheet{background:var(--surface);border-radius:var(--r-xl) var(--r-xl) 0 0;max-width:var(--shell);width:100%;
  max-height:90vh;overflow:auto;padding:20px var(--pad) calc(26px + env(safe-area-inset-bottom,0px));
  animation:sheetUp .22s cubic-bezier(.32,.72,0,1)}
.sheet-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:12px}
.sheet-hd h3{margin:0;font-size:17px;font-weight:600;color:var(--ink);letter-spacing:-.02em}
.x{width:28px;height:28px;border-radius:var(--r-md);display:flex;align-items:center;justify-content:center;
  color:var(--ink-4);flex-shrink:0;transition:background .13s}
.x:hover{background:var(--n100);color:var(--ink)}

.toast{position:fixed;top:66px;left:50%;transform:translateX(-50%);background:var(--n900);color:#fff;
  padding:9px 15px;border-radius:var(--r-md);font-size:13px;font-weight:450;z-index:300;
  box-shadow:var(--e4);animation:slideDown .18s ease;max-width:88%;text-align:center;line-height:1.4}
.toast.ok{background:var(--n900)}
.toast.bad{background:var(--bad)}

.sos{position:fixed;inset:0;background:var(--bad);z-index:400;display:flex;flex-direction:column;
  align-items:center;justify-content:center;color:#fff;text-align:center;padding:32px;animation:fadeIn .16s}
`;

/** Applied to :root at runtime so a society can brand the app without a rebuild. */
export const ACCENTS = {
  indigo: { accent: "#2D4EA2", hover: "#25417F", soft: "#EEF2FB", line: "#CBD8F0" },
  slate: { accent: "#3C4A5A", hover: "#2E3947", soft: "#EFF1F4", line: "#CFD6DE" },
  teal: { accent: "#12695F", hover: "#0D544C", soft: "#E9F4F2", line: "#BFDDD8" },
  plum: { accent: "#6B3A6E", hover: "#552E57", soft: "#F5EEF6", line: "#DFC9E1" },
  clay: { accent: "#9A4B2A", hover: "#7C3B21", soft: "#FAEFEA", line: "#E9CCBF" },
};

export function applyAccent(name) {
  const a = ACCENTS[name] || ACCENTS.indigo;
  const r = document.documentElement.style;
  r.setProperty("--accent", a.accent);
  r.setProperty("--accent-hover", a.hover);
  r.setProperty("--accent-soft", a.soft);
  r.setProperty("--accent-line", a.line);
}

/* People get neutral initials. Assigning everyone a different bright colour is
   decoration pretending to be information. */
export const avatarColor = () => "var(--n100)";
export const AV = [];
