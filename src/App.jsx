import { useState, useEffect, useCallback } from "react";

const ic = (s = 20) => ({ width: s, height: s, style: { flexShrink: 0 } });
const Icons = {
  Home: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Bell: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>,
  Users: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  Shield: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  Dollar: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  Check: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  X: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Plus: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  LogOut: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  Eye: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  Send: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  Building: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><line x1="8" y1="6" x2="8" y2="6.01"/><line x1="12" y1="6" x2="12" y2="6.01"/><line x1="16" y1="6" x2="16" y2="6.01"/><line x1="8" y1="10" x2="8" y2="10.01"/><line x1="12" y1="10" x2="12" y2="10.01"/><line x1="16" y1="10" x2="16" y2="10.01"/><line x1="8" y1="14" x2="8" y2="14.01"/><line x1="12" y1="14" x2="12" y2="14.01"/><line x1="16" y1="14" x2="16" y2="14.01"/></svg>,
  Back: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>,
  Car: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="7" rx="1"/><circle cx="7.5" cy="18" r="1.5"/><circle cx="16.5" cy="18" r="1.5"/><path d="M5.2 11L7 7h10l1.8 4"/></svg>,
  UserPlus: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>,
  Gate: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="18" rx="1"/><line x1="10" y1="12" x2="14" y2="12"/><circle cx="8" cy="12" r="1"/><circle cx="16" cy="12" r="1"/></svg>,
  Clock: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Phone: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>,
  Camera: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  AlertCircle: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
};

const NOTIFS = [
  { id: 1, title: "Water Supply Disruption", body: "Water supply will be interrupted on March 5th from 10 AM to 2 PM for maintenance. Please store water.", date: "2026-03-02", author: "Management Committee", type: "notice", reactions: { "👍": 12, "😟": 3 }, priority: "high" },
  { id: 2, title: "Holi Celebration 🎨", body: "Society Holi on March 14th at clubhouse lawn from 10 AM. Organic colors provided. All residents welcome!", date: "2026-03-01", author: "Cultural Committee", type: "event", reactions: { "🎉": 24, "❤️": 8 }, priority: "normal" },
  { id: 3, title: "Parking Guidelines Update", body: "Park only in designated spots. Visitor vehicles must use visitor parking. Violators fined ₹500.", date: "2026-02-28", author: "Management Committee", type: "notice", reactions: { "👍": 6 }, priority: "normal" },
  { id: 4, title: "Monthly Maintenance Due", body: "March 2026 maintenance due. Amount: ₹4,500. Pay by March 10th to avoid late fees.", date: "2026-02-27", author: "Treasurer", type: "payment", reactions: { "👍": 15 }, priority: "high" },
];
const MAINT = [
  { id: 1, month: "March 2026", amount: 4500, status: "pending", dueDate: "2026-03-10" },
  { id: 2, month: "February 2026", amount: 4500, status: "paid", paidDate: "2026-02-08", receipt: "REC-0208" },
  { id: 3, month: "January 2026", amount: 4500, status: "paid", paidDate: "2026-01-05", receipt: "REC-0105" },
  { id: 4, month: "December 2025", amount: 4200, status: "paid", paidDate: "2025-12-07", receipt: "REC-1207" },
];
const INIT_VISITORS = [
  { id: 1, name: "Amazon Delivery", type: "delivery", status: "pre-approved", date: "2026-03-03", time: "10:00 AM", flat: "A-401", phone: "", raisedBy: "Self", purpose: "Package delivery" },
  { id: 2, name: "Ramesh Kumar", type: "guest", status: "pending", date: "2026-03-03", time: "3:00 PM", flat: "A-401", phone: "9988776655", raisedBy: "Guard - Mohan", purpose: "Personal visit" },
  { id: 3, name: "Plumber - Raj Services", type: "service", status: "approved", date: "2026-03-02", time: "11:00 AM", flat: "A-401", phone: "9876500000", raisedBy: "Guard - Mohan", purpose: "Bathroom repair" },
  { id: 4, name: "Flipkart Delivery", type: "delivery", status: "waiting", date: "2026-03-03", time: "2:15 PM", flat: "B-201", phone: "", raisedBy: "Guard - Mohan", purpose: "Package delivery" },
  { id: 5, name: "Sunita Devi", type: "guest", status: "waiting", date: "2026-03-03", time: "2:30 PM", flat: "C-105", phone: "9123456780", raisedBy: "Guard - Mohan", purpose: "Relative visiting" },
  { id: 6, name: "AC Technician - CoolAir", type: "service", status: "waiting", date: "2026-03-03", time: "2:45 PM", flat: "A-101", phone: "9000011111", raisedBy: "Guard - Mohan", purpose: "AC servicing" },
];
const REGS = [
  { id: 1, name: "Priya Sharma", flat: "B-302", type: "owner", phone: "9876543210", email: "priya@email.com", status: "pending" },
  { id: 2, name: "Amit Patel", flat: "C-105", type: "tenant", phone: "9876543211", email: "amit@email.com", status: "pending" },
  { id: 3, name: "Sneha Reddy", flat: "A-401", type: "co-owner", phone: "9876543212", email: "sneha@email.com", status: "pending" },
];
const VEHICLES = [
  { id: 1, type: "Car", make: "Hyundai Creta", number: "MH-02-AB-1234", parking: "P-42" },
  { id: 2, type: "Bike", make: "Honda Activa", number: "MH-02-CD-5678", parking: "B-15" },
];
const FLATS = ["A-101","A-102","A-201","A-202","A-301","A-302","A-401","A-402","B-101","B-102","B-201","B-202","B-301","B-302","C-101","C-102","C-105","D-101","D-102"];

const S = {
  app: { fontFamily: "'DM Sans',sans-serif", maxWidth: 430, margin: "0 auto", background: "#F8F6F1", minHeight: "100vh", position: "relative" },
  header: { background: "linear-gradient(135deg,#1B4D3E,#2D7A5F)", padding: "16px 20px 14px", color: "#fff", position: "sticky", top: 0, zIndex: 100 },
  content: { padding: "0 16px 100px" },
  nav: { position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: "#fff", borderTop: "1px solid #E8E4DC", display: "flex", justifyContent: "space-around", padding: "8px 0 12px", zIndex: 100 },
  card: { background: "#fff", borderRadius: 14, padding: "16px 18px", marginBottom: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.04)", border: "1px solid #EDE9E1" },
  input: { width: "100%", padding: "12px 14px", borderRadius: 10, border: "1.5px solid #DDD8CF", fontSize: 14, fontFamily: "inherit", background: "#FAFAF7", outline: "none", boxSizing: "border-box" },
  label: { fontSize: 13, fontWeight: 600, color: "#444", marginBottom: 6, display: "block" },
  secT: { fontSize: 17, fontWeight: 700, color: "#1B4D3E", margin: "20px 0 12px", letterSpacing: "-0.3px" },
};

const bdg = (c) => ({ display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
  background: c==="green"?"#E8F5E9":c==="red"?"#FFEBEE":c==="orange"?"#FFF3E0":c==="blue"?"#E3F2FD":c==="purple"?"#F3E5F5":"#F5F5F5",
  color: c==="green"?"#2E7D32":c==="red"?"#C62828":c==="orange"?"#E65100":c==="blue"?"#1565C0":c==="purple"?"#7B1FA2":"#666" });
const btnS = (v="primary",sz="md") => ({ padding: sz==="sm"?"8px 16px":"12px 24px", borderRadius: 10,
  border: v==="outline"?"1.5px solid #1B4D3E":"none",
  background: v==="primary"?"linear-gradient(135deg,#1B4D3E,#2D7A5F)":v==="danger"?"#C62828":"transparent",
  color: v==="primary"||v==="danger"?"#fff":"#1B4D3E", fontSize: sz==="sm"?13:14, fontWeight: 600, cursor: "pointer",
  display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "inherit" });
const navI = (a) => ({ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, fontSize: 10,
  fontWeight: a?600:400, color: a?"#1B4D3E":"#999", cursor: "pointer", border: "none", background: "none", padding: "4px 8px" });

const Badge = ({children,color}) => <span style={bdg(color)}>{children}</span>;
const Btn = ({children,variant,size,onClick,style:sx,...r}) => <button style={{...btnS(variant,size),...sx}} onClick={onClick} {...r}>{children}</button>;
const Inp = ({label,...p}) => <div style={{marginBottom:14}}>{label&&<label style={S.label}>{label}</label>}<input style={S.input} {...p}/></div>;
const Sel = ({label,options,...p}) => <div style={{marginBottom:14}}>{label&&<label style={S.label}>{label}</label>}<select style={{...S.input,appearance:"none"}} {...p}>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></div>;
const TArea = ({label,...p}) => <div style={{marginBottom:14}}>{label&&<label style={S.label}>{label}</label>}<textarea style={{...S.input,minHeight:80,resize:"vertical"}} {...p}/></div>;

const Modal = ({title,onClose,children}) => (
  <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
    <div style={{background:"#fff",borderRadius:"20px 20px 0 0",maxWidth:430,width:"100%",maxHeight:"85vh",overflow:"auto",padding:"20px 20px 32px",animation:"slideUp .3s ease"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <h3 style={{margin:0,fontSize:18,fontWeight:700,color:"#1B4D3E"}}>{title}</h3>
        <button onClick={onClose} style={{border:"none",background:"#F0EDE6",borderRadius:8,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><Icons.X {...ic(16)}/></button>
      </div>
      {children}
    </div>
  </div>
);

const Toast = ({message,onHide}) => {
  useEffect(()=>{const t=setTimeout(onHide,2500);return()=>clearTimeout(t)},[onHide]);
  return <div style={{position:"fixed",top:80,left:"50%",transform:"translateX(-50%)",background:"#1B4D3E",color:"#fff",padding:"12px 24px",borderRadius:12,fontSize:14,fontWeight:500,zIndex:300,boxShadow:"0 4px 20px rgba(0,0,0,0.2)",animation:"slideDown .3s ease"}}>{message}</div>;
};

const NoticeCard = ({n,onReact}) => {
  const tc = {notice:"blue",event:"green",payment:"orange"};
  return (
    <div style={S.card}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <Badge color={tc[n.type]}>{n.type==="payment"?"💰 Payment":n.type==="event"?"🎉 Event":"📋 Notice"}</Badge>
        {n.priority==="high"&&<span style={{fontSize:10}}>Urgent 🔴</span>}
      </div>
      <h4 style={{margin:"0 0 6px",fontSize:15,fontWeight:700,color:"#222"}}>{n.title}</h4>
      <p style={{margin:"0 0 10px",fontSize:13,color:"#666",lineHeight:1.55}}>{n.body}</p>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6}}>
        <span style={{fontSize:11,color:"#AAA"}}>{n.author} · {n.date}</span>
        <div style={{display:"flex",gap:4}}>
          {["👍","❤️","🎉","😟"].map(em=>(
            <button key={em} onClick={()=>onReact(n.id,em)} style={{border:"1px solid #EDE9E1",borderRadius:20,padding:"2px 7px",fontSize:12,background:n.reactions[em]?"#F5F2EA":"#fff",cursor:"pointer",display:"flex",alignItems:"center",gap:2}}>
              {em}{n.reactions[em]?<span style={{fontSize:10,color:"#666"}}>{n.reactions[em]}</span>:null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Login Screen ──
const LoginScreen = ({onLogin,onRegister}) => {
  const [email,setEmail] = useState("");
  const [pw,setPw] = useState("");
  const [showPw,setShowPw] = useState(false);
  const demos = [
    {role:"admin",label:"Admin",icon:Icons.Shield,desc:"Full access"},
    {role:"committee",label:"Committee",icon:Icons.Users,desc:"Post & manage"},
    {role:"resident",label:"Resident",icon:Icons.Home,desc:"View & approve"},
    {role:"guard",label:"Guard",icon:Icons.Gate,desc:"Gate entry"},
  ];
  return (
    <div style={{...S.app,display:"flex",flexDirection:"column",justifyContent:"center",padding:"40px 24px",background:"linear-gradient(180deg,#1B4D3E 0%,#2D7A5F 40%,#F8F6F1 100%)"}}>
      <div style={{textAlign:"center",marginBottom:36}}>
        <div style={{width:72,height:72,background:"rgba(255,255,255,0.15)",borderRadius:20,display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:16}}>
          <Icons.Building width={36} height={36} style={{color:"#fff"}}/>
        </div>
        <h1 style={{color:"#fff",fontSize:26,fontWeight:800,margin:"0 0 4px",letterSpacing:"-0.5px"}}>Green Valley Society</h1>
        <p style={{color:"rgba(255,255,255,0.7)",fontSize:14,margin:0}}>Resident Management Portal</p>
      </div>
      <div style={{...S.card,padding:"24px 20px"}}>
        <h2 style={{fontSize:18,fontWeight:700,color:"#1B4D3E",margin:"0 0 20px"}}>Sign In</h2>
        <Inp label="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com"/>
        <div style={{position:"relative"}}>
          <Inp label="Password" type={showPw?"text":"password"} value={pw} onChange={e=>setPw(e.target.value)} placeholder="Enter password"/>
          <button onClick={()=>setShowPw(!showPw)} style={{position:"absolute",right:12,top:34,border:"none",background:"none",cursor:"pointer",color:"#999"}}><Icons.Eye {...ic(18)}/></button>
        </div>
        <Btn onClick={()=>onLogin("resident")} style={{width:"100%",justifyContent:"center",marginTop:4}}>Sign In</Btn>
        <p style={{textAlign:"center",marginTop:16,fontSize:13,color:"#888"}}>New resident? <span onClick={onRegister} style={{color:"#1B4D3E",fontWeight:600,cursor:"pointer"}}>Register here</span></p>
      </div>
      <div style={{marginTop:24}}>
        <p style={{textAlign:"center",fontSize:11,color:"#ccc",marginBottom:10,textTransform:"uppercase",letterSpacing:1}}>Quick Demo Access</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {demos.map(d=>(
            <button key={d.role} onClick={()=>onLogin(d.role)} style={{padding:"14px 10px",borderRadius:12,border:"1.5px solid rgba(255,255,255,0.2)",background:"rgba(255,255,255,0.08)",cursor:"pointer",display:"flex",alignItems:"center",gap:10,fontFamily:"inherit",backdropFilter:"blur(4px)",textAlign:"left"}}>
              <div style={{width:40,height:40,borderRadius:10,background:"rgba(255,255,255,0.12)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <d.icon width={20} height={20} style={{color:"#fff"}}/>
              </div>
              <div>
                <span style={{fontSize:13,fontWeight:700,color:"#fff",display:"block"}}>{d.label}</span>
                <span style={{fontSize:10,color:"rgba(255,255,255,0.6)"}}>{d.desc}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Register Screen ──
const RegisterScreen = ({onBack,onSubmit}) => {
  const [f,sF] = useState({name:"",flat:"",block:"A",type:"owner",phone:"",email:"",password:""});
  const u = (k,v)=>sF(p=>({...p,[k]:v}));
  return (
    <div style={S.app}>
      <div style={S.header}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button onClick={onBack} style={{border:"none",background:"none",color:"#fff",cursor:"pointer",padding:0}}><Icons.Back {...ic(22)}/></button>
          <h1 style={{fontSize:20,fontWeight:700,margin:0}}>Register</h1>
        </div>
      </div>
      <div style={{...S.content,paddingTop:16}}>
        <div style={S.card}>
          <p style={{fontSize:13,color:"#888",margin:"0 0 16px",lineHeight:1.5}}>Fill your details. Your registration will be reviewed and approved by the society admin.</p>
          <Inp label="Full Name" value={f.name} onChange={e=>u("name",e.target.value)} placeholder="e.g. Rahul Mehta"/>
          <div style={{display:"flex",gap:10}}>
            <div style={{flex:1}}><Sel label="Block" value={f.block} onChange={e=>u("block",e.target.value)} options={["A","B","C","D"].map(b=>({value:b,label:"Block "+b}))}/></div>
            <div style={{flex:1}}><Inp label="Flat No." value={f.flat} onChange={e=>u("flat",e.target.value)} placeholder="e.g. 401"/></div>
          </div>
          <Sel label="I am a" value={f.type} onChange={e=>u("type",e.target.value)} options={[{value:"owner",label:"Owner"},{value:"co-owner",label:"Co-Owner"},{value:"tenant",label:"Tenant"}]}/>
          <Inp label="Phone" type="tel" value={f.phone} onChange={e=>u("phone",e.target.value)} placeholder="10-digit mobile"/>
          <Inp label="Email" type="email" value={f.email} onChange={e=>u("email",e.target.value)} placeholder="your@email.com"/>
          <Inp label="Password" type="password" value={f.password} onChange={e=>u("password",e.target.value)} placeholder="Min 8 characters"/>
          <Btn onClick={onSubmit} style={{width:"100%",justifyContent:"center",marginTop:8}}>Submit Registration</Btn>
        </div>
      </div>
    </div>
  );
};

// ═══ MAIN APP ═══
export default function SocietyApp() {
  const [screen,setScreen] = useState("login");
  const [role,setRole] = useState(null);
  const [tab,setTab] = useState("home");
  const [toast,setToast] = useState(null);
  const [modal,setModal] = useState(null);
  const [notifs,setNotifs] = useState(NOTIFS);
  const [visitors,setVisitors] = useState(INIT_VISITORS);
  const [vehicles,setVehicles] = useState(VEHICLES);
  const [regs,setRegs] = useState(REGS);
  const [maint] = useState(MAINT);

  const showT = useCallback(m=>setToast(m),[]);
  const login = r=>{setRole(r);setScreen("app");setTab(r==="guard"?"gate":"home");};

  const CSS = `@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
    @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
    @keyframes slideDown{from{transform:translateY(-20px);opacity:0}to{transform:translateY(0);opacity:1}}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
    *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
    ::-webkit-scrollbar{width:0}
    input:focus,select:focus,textarea:focus{border-color:#1B4D3E!important;outline:none}
    button:active{transform:scale(0.97)}`;

  if(screen==="login") return (<><style>{CSS}</style><LoginScreen onLogin={login} onRegister={()=>setScreen("register")}/>{toast&&<Toast message={toast} onHide={()=>setToast(null)}/>}</>);
  if(screen==="register") return (<><style>{CSS}</style><RegisterScreen onBack={()=>setScreen("login")} onSubmit={()=>{setScreen("login");setToast("Registration submitted! Awaiting admin approval.")}}/>{toast&&<Toast message={toast} onHide={()=>setToast(null)}/>}</>);

  const isGuard = role==="guard";
  const isCom = role==="committee"||role==="admin";
  const isAdm = role==="admin";
  const isResident = role==="resident"||isCom||isAdm;

  const rName = role==="admin"?"Admin":role==="committee"?"Committee Member":role==="guard"?"Security Guard":"Resident";
  const uName = role==="admin"?"Suresh Joshi":role==="committee"?"Meena Patil":role==="guard"?"Mohan Singh":"Rahul Mehta";
  const uFlat = role==="admin"?"A-101":role==="committee"?"B-201":role==="guard"?"Main Gate":"A-401";

  // ── Nav items based on role ──
  const navItems = isGuard ? [
    {id:"gate",icon:Icons.Gate,label:"Gate"},
    {id:"gateLog",icon:Icons.Clock,label:"Log"},
  ] : [
    {id:"home",icon:Icons.Home,label:"Home"},
    {id:"notices",icon:Icons.Bell,label:"Notices"},
    {id:"visitors",icon:Icons.Users,label:"Visitors"},
    {id:"maintenance",icon:Icons.Dollar,label:"Payments"},
    ...(isAdm?[{id:"admin",icon:Icons.Shield,label:"Admin"}]:[]),
  ];

  const react = (nid,em)=>setNotifs(p=>p.map(n=>n.id!==nid?n:{...n,reactions:{...n.reactions,[em]:(n.reactions[em]||0)+1}}));

  const getNow = () => {
    const d = new Date();
    let h = d.getHours(), m = d.getMinutes();
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return h + ":" + (m < 10 ? "0" : "") + m + " " + ampm;
  };

  // ═══════════════════════════════════
  // GUARD: Gate Entry Tab
  // ═══════════════════════════════════
  const GateTab = () => {
    const waitingCount = visitors.filter(v=>v.status==="waiting").length;
    const pendingCount = visitors.filter(v=>v.status==="pending").length;
    return (
      <div>
        <div style={{...S.card,background:"linear-gradient(135deg,#1B4D3E,#2D7A5F)",color:"#fff",marginTop:16,border:"none"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <p style={{margin:"0 0 4px",fontSize:13,opacity:0.8}}>On Duty</p>
              <h2 style={{margin:"0 0 2px",fontSize:22,fontWeight:700}}>{uName}</h2>
              <p style={{margin:0,fontSize:12,opacity:0.7}}>Main Gate · Security Guard</p>
            </div>
            <button onClick={()=>{setScreen("login");setRole(null)}} style={{border:"none",background:"rgba(255,255,255,0.15)",borderRadius:10,padding:8,cursor:"pointer",color:"#fff"}}><Icons.LogOut {...ic(18)}/></button>
          </div>
        </div>

        {/* Stats */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:12}}>
          <div style={{...S.card,textAlign:"center",padding:"14px 8px"}}>
            <p style={{margin:0,fontSize:22,fontWeight:800,color:"#E65100"}}>{waitingCount}</p>
            <p style={{margin:"2px 0 0",fontSize:10,color:"#999",fontWeight:600}}>Waiting</p>
          </div>
          <div style={{...S.card,textAlign:"center",padding:"14px 8px"}}>
            <p style={{margin:0,fontSize:22,fontWeight:800,color:"#1565C0"}}>{pendingCount}</p>
            <p style={{margin:"2px 0 0",fontSize:10,color:"#999",fontWeight:600}}>Sent to Flat</p>
          </div>
          <div style={{...S.card,textAlign:"center",padding:"14px 8px"}}>
            <p style={{margin:0,fontSize:22,fontWeight:800,color:"#2E7D32"}}>{visitors.filter(v=>v.status==="approved"||v.status==="pre-approved").length}</p>
            <p style={{margin:"2px 0 0",fontSize:10,color:"#999",fontWeight:600}}>Approved</p>
          </div>
        </div>

        {/* New Entry Button */}
        <Btn onClick={()=>setModal("guardEntry")} style={{width:"100%",justifyContent:"center",marginTop:12,padding:"14px 24px",fontSize:16}}>
          <Icons.Plus {...ic(20)}/> New Visitor Entry
        </Btn>

        {/* Waiting for flat response */}
        {visitors.filter(v=>v.status==="waiting"||v.status==="pending").length>0 && (
          <>
            <h3 style={S.secT}>⏳ Awaiting Flat Approval</h3>
            {visitors.filter(v=>v.status==="waiting"||v.status==="pending").map(v=>(
              <div key={v.id} style={{...S.card,borderLeft:"4px solid #FF9800"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <h4 style={{margin:"0 0 4px",fontSize:15,fontWeight:600,color:"#222"}}>{v.name}</h4>
                    <p style={{margin:0,fontSize:12,color:"#888"}}>
                      {v.type==="delivery"?"📦":v.type==="service"?"🔧":"👤"} {v.type} · Flat <b>{v.flat}</b>
                    </p>
                    {v.purpose&&<p style={{margin:"4px 0 0",fontSize:11,color:"#999"}}>Purpose: {v.purpose}</p>}
                  </div>
                  <div style={{textAlign:"right"}}>
                    <Badge color={v.status==="waiting"?"purple":"orange"}>{v.status==="waiting"?"waiting":"sent"}</Badge>
                    <p style={{margin:"4px 0 0",fontSize:10,color:"#AAA"}}>{v.time}</p>
                  </div>
                </div>
                {v.status==="waiting"&&(
                  <div style={{marginTop:10,display:"flex",gap:8}}>
                    <Btn size="sm" onClick={()=>{setVisitors(p=>p.map(x=>x.id===v.id?{...x,status:"pending"}:x));showT("Request sent to Flat "+v.flat)}}>
                      <Icons.Send {...ic(14)}/> Send to Flat
                    </Btn>
                    <Btn variant="outline" size="sm" onClick={()=>{setVisitors(p=>p.map(x=>x.id===v.id?{...x,status:"rejected"}:x));showT("Entry denied")}}>
                      <Icons.X {...ic(14)}/> Deny
                    </Btn>
                  </div>
                )}
                {v.status==="pending"&&(
                  <div style={{marginTop:8,padding:"8px 12px",background:"#FFF8E1",borderRadius:8,display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:"#FF9800",animation:"pulse 1.5s infinite"}}/>
                    <span style={{fontSize:12,color:"#E65100",fontWeight:500}}>Waiting for resident to respond...</span>
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {/* Pre-approved visitors */}
        {visitors.filter(v=>v.status==="pre-approved").length>0 && (
          <>
            <h3 style={S.secT}>✅ Pre-Approved (Allow Entry)</h3>
            {visitors.filter(v=>v.status==="pre-approved").map(v=>(
              <div key={v.id} style={{...S.card,borderLeft:"4px solid #4CAF50",background:"#F9FFF9"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <h4 style={{margin:"0 0 4px",fontSize:15,fontWeight:600,color:"#222"}}>{v.name}</h4>
                    <p style={{margin:0,fontSize:12,color:"#888"}}>{v.type==="delivery"?"📦":v.type==="service"?"🔧":"👤"} {v.type} · Flat <b>{v.flat}</b></p>
                  </div>
                  <Badge color="green">Pre-Approved ✓</Badge>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Recently approved */}
        {visitors.filter(v=>v.status==="approved").length>0 && (
          <>
            <h3 style={S.secT}>👋 Approved - Let In</h3>
            {visitors.filter(v=>v.status==="approved").map(v=>(
              <div key={v.id} style={{...S.card,borderLeft:"4px solid #2196F3"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <h4 style={{margin:"0 0 4px",fontSize:15,fontWeight:600,color:"#222"}}>{v.name}</h4>
                    <p style={{margin:0,fontSize:12,color:"#888"}}>{v.type==="delivery"?"📦":v.type==="service"?"🔧":"👤"} {v.type} · Flat <b>{v.flat}</b></p>
                  </div>
                  <Badge color="green">Approved ✓</Badge>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Rejected */}
        {visitors.filter(v=>v.status==="rejected").length>0 && (
          <>
            <h3 style={{...S.secT,color:"#999",fontSize:14}}>❌ Denied</h3>
            {visitors.filter(v=>v.status==="rejected").map(v=>(
              <div key={v.id} style={{...S.card,opacity:0.6}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <h4 style={{margin:"0 0 2px",fontSize:14,fontWeight:600,color:"#666"}}>{v.name}</h4>
                    <p style={{margin:0,fontSize:12,color:"#AAA"}}>Flat {v.flat}</p>
                  </div>
                  <Badge color="red">Denied</Badge>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    );
  };

  // Guard: Log Tab
  const GateLogTab = () => (
    <div>
      <h3 style={{...S.secT,marginTop:16}}>Today's Gate Log</h3>
      {visitors.map(v=>(
        <div key={v.id} style={{...S.card,padding:"12px 16px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:36,height:36,borderRadius:10,background:v.status==="approved"||v.status==="pre-approved"?"#E8F5E9":v.status==="rejected"?"#FFEBEE":"#FFF3E0",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>
                {v.type==="delivery"?"📦":v.type==="service"?"🔧":"👤"}
              </div>
              <div>
                <p style={{margin:0,fontSize:13,fontWeight:600,color:"#222"}}>{v.name}</p>
                <p style={{margin:"2px 0 0",fontSize:11,color:"#999"}}>Flat {v.flat} · {v.time}</p>
              </div>
            </div>
            <Badge color={v.status==="approved"||v.status==="pre-approved"?"green":v.status==="rejected"?"red":v.status==="pending"?"orange":"purple"}>
              {v.status}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );

  // ═══ Guard Entry Modal ═══
  const GuardEntryModal = () => {
    const [f,sF]=useState({name:"",type:"guest",flat:FLATS[0],phone:"",purpose:""});
    const u=(k,v)=>sF(p=>({...p,[k]:v}));
    return (
      <Modal title="🚪 New Visitor Entry" onClose={()=>setModal(null)}>
        <div style={{padding:"10px 14px",background:"#E8F5EE",borderRadius:10,marginBottom:16,display:"flex",alignItems:"center",gap:8}}>
          <Icons.AlertCircle {...ic(18)} style={{color:"#1B4D3E",flexShrink:0}}/>
          <span style={{fontSize:12,color:"#1B4D3E",lineHeight:1.4}}>A request will be sent to the flat owner/tenant for approval before the visitor can enter.</span>
        </div>
        <Inp label="Visitor Name" value={f.name} onChange={e=>u("name",e.target.value)} placeholder="e.g. Ramesh Kumar"/>
        <Sel label="Visitor Type" value={f.type} onChange={e=>u("type",e.target.value)} options={[{value:"guest",label:"👤 Guest"},{value:"delivery",label:"📦 Delivery"},{value:"service",label:"🔧 Service Provider"}]}/>
        <Sel label="Visiting Flat" value={f.flat} onChange={e=>u("flat",e.target.value)} options={FLATS.map(fl=>({value:fl,label:"Flat "+fl}))}/>
        <Inp label="Visitor Phone (optional)" type="tel" value={f.phone} onChange={e=>u("phone",e.target.value)} placeholder="e.g. 9876543210"/>
        <Inp label="Purpose of Visit" value={f.purpose} onChange={e=>u("purpose",e.target.value)} placeholder="e.g. Personal visit, Package delivery"/>
        <Btn onClick={()=>{
          if(!f.name) return showT("Enter visitor name");
          if(!f.purpose) return showT("Enter purpose of visit");
          const newV = {id:Date.now(),name:f.name,type:f.type,flat:f.flat,phone:f.phone,purpose:f.purpose,status:"waiting",date:"2026-03-03",time:getNow(),raisedBy:"Guard - "+uName};
          setVisitors(p=>[newV,...p]);
          setModal(null);
          showT("Entry recorded! Send request to flat.");
        }} style={{width:"100%",justifyContent:"center",padding:"14px 24px"}}>
          <Icons.Plus {...ic(16)}/> Record Visitor
        </Btn>
      </Modal>
    );
  };

  // ═══════════════════════════════════
  // RESIDENT TABS (same as before)
  // ═══════════════════════════════════
  const HomeTab = () => (
    <div>
      <div style={{...S.card,background:"linear-gradient(135deg,#1B4D3E,#2D7A5F)",color:"#fff",marginTop:16,border:"none"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <p style={{margin:"0 0 4px",fontSize:13,opacity:0.8}}>Welcome back,</p>
            <h2 style={{margin:"0 0 2px",fontSize:22,fontWeight:700}}>{uName}</h2>
            <p style={{margin:0,fontSize:12,opacity:0.7}}>Flat {uFlat} · {rName}</p>
          </div>
          <button onClick={()=>{setScreen("login");setRole(null)}} style={{border:"none",background:"rgba(255,255,255,0.15)",borderRadius:10,padding:8,cursor:"pointer",color:"#fff"}}><Icons.LogOut {...ic(18)}/></button>
        </div>
      </div>

      {/* Pending visitor alert */}
      {visitors.filter(v=>v.status==="pending"&&(v.flat===uFlat)).length>0&&(
        <div style={{...S.card,marginTop:12,background:"#FFF3E0",border:"1.5px solid #FFB74D",cursor:"pointer"}} onClick={()=>setTab("visitors")}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:10,height:10,borderRadius:"50%",background:"#FF9800",animation:"pulse 1.5s infinite"}}/>
            <div>
              <p style={{margin:0,fontSize:14,fontWeight:700,color:"#E65100"}}>🔔 {visitors.filter(v=>v.status==="pending"&&v.flat===uFlat).length} Visitor(s) Waiting at Gate</p>
              <p style={{margin:"2px 0 0",fontSize:12,color:"#F57C00"}}>Tap to approve or reject</p>
            </div>
          </div>
        </div>
      )}

      <h3 style={S.secT}>Quick Actions</h3>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        {[
          {icon:Icons.UserPlus,label:"Pre-approve\nVisitor",action:()=>{setTab("visitors");setTimeout(()=>setModal("addVisitor"),100)}},
          {icon:Icons.Car,label:"My\nVehicles",action:()=>setModal("vehicles")},
          ...(isCom?[{icon:Icons.Send,label:"Post\nNotice",action:()=>{setTab("notices");setTimeout(()=>setModal("addNotice"),100)}}]:[]),
          ...(isAdm?[{icon:Icons.Shield,label:"Pending\nApprovals",action:()=>setTab("admin")}]:[]),
        ].map((it,i)=>(
          <button key={i} onClick={it.action} style={{...S.card,display:"flex",alignItems:"center",gap:12,cursor:"pointer",border:"1.5px solid #EDE9E1",padding:"16px 14px",textAlign:"left",fontFamily:"inherit"}}>
            <div style={{width:44,height:44,borderRadius:12,background:"#E8F5EE",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><it.icon width={22} height={22} style={{color:"#1B4D3E"}}/></div>
            <span style={{fontSize:13,fontWeight:600,color:"#333",whiteSpace:"pre-line",lineHeight:1.3}}>{it.label}</span>
          </button>
        ))}
      </div>
      <h3 style={S.secT}>Recent Notices</h3>
      {notifs.slice(0,2).map(n=><NoticeCard key={n.id} n={n} onReact={react}/>)}
      <button onClick={()=>setTab("notices")} style={{width:"100%",padding:12,border:"1.5px dashed #CCC8BE",borderRadius:12,background:"transparent",color:"#1B4D3E",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>View All Notices →</button>
    </div>
  );

  const NoticesTab = () => (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:16}}>
        <h3 style={{...S.secT,margin:0}}>Notice Board</h3>
        {isCom&&<Btn size="sm" onClick={()=>setModal("addNotice")}><Icons.Plus {...ic(16)}/> Post</Btn>}
      </div>
      <div style={{marginTop:12}}>{notifs.map(n=><NoticeCard key={n.id} n={n} onReact={react}/>)}</div>
    </div>
  );

  const VisitorsTab = () => {
    const sc={"pre-approved":"blue",approved:"green",pending:"orange",rejected:"red",waiting:"purple"};
    const myVisitors = visitors.filter(v=>v.flat===uFlat||isAdm);
    const pendingOnes = myVisitors.filter(v=>v.status==="pending");
    return (
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:16}}>
          <h3 style={{...S.secT,margin:0}}>Visitor Management</h3>
          <Btn size="sm" onClick={()=>setModal("addVisitor")}><Icons.Plus {...ic(16)}/> Pre-approve</Btn>
        </div>

        {/* Pending approval from guard */}
        {pendingOnes.length>0&&(
          <>
            <div style={{marginTop:12,padding:"10px 14px",background:"#FFF3E0",borderRadius:10,display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:"#FF9800",animation:"pulse 1.5s infinite"}}/>
              <span style={{fontSize:13,fontWeight:600,color:"#E65100"}}>{pendingOnes.length} visitor(s) waiting for your approval</span>
            </div>
            {pendingOnes.map(v=>(
              <div key={v.id} style={{...S.card,marginTop:8,borderLeft:"4px solid #FF9800",background:"#FFFDF7"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <h4 style={{margin:"0 0 4px",fontSize:15,fontWeight:700,color:"#222"}}>{v.name}</h4>
                    <p style={{margin:0,fontSize:12,color:"#888"}}>{v.type==="delivery"?"📦 Delivery":v.type==="service"?"🔧 Service":"👤 Guest"} · {v.date} at {v.time}</p>
                    {v.purpose&&<p style={{margin:"4px 0 0",fontSize:12,color:"#666"}}>📝 {v.purpose}</p>}
                    {v.raisedBy&&<p style={{margin:"2px 0 0",fontSize:11,color:"#999"}}>Raised by: {v.raisedBy}</p>}
                    {v.phone&&<p style={{margin:"2px 0 0",fontSize:11,color:"#999"}}>📱 {v.phone}</p>}
                  </div>
                  <Badge color="orange">Pending</Badge>
                </div>
                <div style={{display:"flex",gap:8,marginTop:12}}>
                  <Btn size="sm" onClick={()=>{setVisitors(p=>p.map(x=>x.id===v.id?{...x,status:"approved"}:x));showT("Visitor approved! Guard notified. ✓")}}><Icons.Check {...ic(14)}/> Approve</Btn>
                  <Btn variant="danger" size="sm" onClick={()=>{setVisitors(p=>p.map(x=>x.id===v.id?{...x,status:"rejected"}:x));showT("Visitor rejected. Guard notified.")}}><Icons.X {...ic(14)}/> Reject</Btn>
                </div>
              </div>
            ))}
          </>
        )}

        <h3 style={{...S.secT,fontSize:14}}>All Visitors</h3>
        <div style={{marginTop:4}}>
          {myVisitors.filter(v=>v.status!=="pending").map(v=>(
            <div key={v.id} style={S.card}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div>
                  <h4 style={{margin:"0 0 4px",fontSize:15,fontWeight:600,color:"#222"}}>{v.name}</h4>
                  <p style={{margin:0,fontSize:12,color:"#888"}}>{v.type==="delivery"?"📦 Delivery":v.type==="service"?"🔧 Service":"👤 Guest"} · {v.date} at {v.time}</p>
                  {v.raisedBy&&v.raisedBy!=="Self"&&<p style={{margin:"2px 0 0",fontSize:11,color:"#999"}}>Via: {v.raisedBy}</p>}
                </div>
                <Badge color={sc[v.status]}>{v.status}</Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const MaintenanceTab = () => (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:16}}>
        <h3 style={{...S.secT,margin:0}}>Maintenance</h3>
        {isCom&&<Btn size="sm" onClick={()=>setModal("addMaint")}><Icons.Plus {...ic(16)}/> Add</Btn>}
      </div>
      <div style={{...S.card,marginTop:12,background:"linear-gradient(135deg,#FFF8E1,#FFF3E0)",border:"1px solid #FFE0B2"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <p style={{margin:"0 0 4px",fontSize:12,color:"#E65100",fontWeight:600}}>⏰ Due This Month</p>
            <p style={{margin:0,fontSize:26,fontWeight:800,color:"#BF360C"}}>₹4,500</p>
            <p style={{margin:"4px 0 0",fontSize:12,color:"#999"}}>Due by March 10, 2026</p>
          </div>
          <Btn size="sm" onClick={()=>showT("Payment gateway coming soon!")}>Pay Now</Btn>
        </div>
      </div>
      <h3 style={{...S.secT,fontSize:14}}>Payment History</h3>
      {maint.map(m=>(
        <div key={m.id} style={S.card}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <h4 style={{margin:"0 0 4px",fontSize:14,fontWeight:600,color:"#222"}}>{m.month}</h4>
              <p style={{margin:0,fontSize:12,color:"#888"}}>{m.status==="paid"?"Paid on "+m.paidDate+" · "+m.receipt:"Due by "+m.dueDate}</p>
            </div>
            <div style={{textAlign:"right"}}>
              <p style={{margin:"0 0 4px",fontSize:16,fontWeight:700,color:"#222"}}>₹{m.amount.toLocaleString()}</p>
              <Badge color={m.status==="paid"?"green":"orange"}>{m.status==="paid"?"Paid ✓":"Pending"}</Badge>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const AdminTab = () => (
    <div>
      <h3 style={{...S.secT,marginTop:16}}>Registration Requests</h3>
      {regs.filter(r=>r.status==="pending").length===0&&(
        <div style={{...S.card,textAlign:"center",padding:32}}>
          <Icons.Check width={40} height={40} style={{color:"#4CAF50",margin:"0 auto 8px"}}/>
          <p style={{margin:0,color:"#888",fontSize:14}}>All registrations processed!</p>
        </div>
      )}
      {regs.map(r=>(
        <div key={r.id} style={S.card}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
            <div>
              <h4 style={{margin:"0 0 4px",fontSize:15,fontWeight:600,color:"#222"}}>{r.name}</h4>
              <p style={{margin:0,fontSize:12,color:"#888"}}>Flat {r.flat} · {r.type.charAt(0).toUpperCase()+r.type.slice(1)}</p>
            </div>
            <Badge color={r.status==="pending"?"orange":r.status==="approved"?"green":"red"}>{r.status}</Badge>
          </div>
          <div style={{display:"flex",gap:12,fontSize:12,color:"#888",marginBottom:12}}>
            <span>📱 {r.phone}</span><span>📧 {r.email}</span>
          </div>
          {r.status==="pending"&&(
            <div style={{display:"flex",gap:8}}>
              <Btn size="sm" onClick={()=>{setRegs(p=>p.map(x=>x.id===r.id?{...x,status:"approved"}:x));showT(r.name+" approved ✓")}}><Icons.Check {...ic(14)}/> Approve</Btn>
              <Btn variant="danger" size="sm" onClick={()=>{setRegs(p=>p.map(x=>x.id===r.id?{...x,status:"rejected"}:x));showT(r.name+" rejected")}}><Icons.X {...ic(14)}/> Reject</Btn>
            </div>
          )}
        </div>
      ))}
      <h3 style={S.secT}>All Residents</h3>
      <div style={S.card}>
        {[{name:"Rahul Mehta",flat:"A-401",type:"Owner"},{name:"Sneha Reddy",flat:"A-401",type:"Co-Owner"},{name:"Vikram Singh",flat:"A-302",type:"Tenant"},{name:"Meena Patil",flat:"B-201",type:"Owner"},{name:"Suresh Joshi",flat:"A-101",type:"Owner"}].map((r,i,a)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:i<a.length-1?"1px solid #F0EDE6":"none"}}>
            <div><p style={{margin:0,fontSize:14,fontWeight:600,color:"#222"}}>{r.name}</p><p style={{margin:"2px 0 0",fontSize:12,color:"#888"}}>Flat {r.flat} · {r.type}</p></div>
            <Badge color="green">active</Badge>
          </div>
        ))}
      </div>
    </div>
  );

  // ── Modals ──
  const AddVisitorModal = () => {
    const [f,sF]=useState({name:"",type:"guest",date:"2026-03-04",time:"10:00",pre:true});
    const u=(k,v)=>sF(p=>({...p,[k]:v}));
    return (
      <Modal title="Pre-approve Visitor" onClose={()=>setModal(null)}>
        <div style={{padding:"10px 14px",background:"#E8F5EE",borderRadius:10,marginBottom:16}}>
          <span style={{fontSize:12,color:"#1B4D3E",lineHeight:1.4}}>✅ Pre-approved visitors will be allowed entry by the guard without needing your approval at the gate.</span>
        </div>
        <Inp label="Visitor Name" value={f.name} onChange={e=>u("name",e.target.value)} placeholder="e.g. John / Swiggy"/>
        <Sel label="Type" value={f.type} onChange={e=>u("type",e.target.value)} options={[{value:"guest",label:"👤 Guest"},{value:"delivery",label:"📦 Delivery"},{value:"service",label:"🔧 Service"}]}/>
        <div style={{display:"flex",gap:10}}>
          <div style={{flex:1}}><Inp label="Date" type="date" value={f.date} onChange={e=>u("date",e.target.value)}/></div>
          <div style={{flex:1}}><Inp label="Time" type="time" value={f.time} onChange={e=>u("time",e.target.value)}/></div>
        </div>
        <Btn onClick={()=>{if(!f.name)return showT("Enter visitor name");setVisitors(p=>[{id:Date.now(),name:f.name,type:f.type,status:"pre-approved",date:f.date,time:f.time,flat:uFlat,raisedBy:"Self",purpose:"",phone:""},...p]);setModal(null);showT("Visitor pre-approved ✓ Guard notified.")}} style={{width:"100%",justifyContent:"center"}}>Pre-approve Visitor</Btn>
      </Modal>
    );
  };

  const VehiclesModal = () => {
    const [adding,setAdding]=useState(false);
    const [f,sF]=useState({type:"Car",make:"",number:"",parking:""});
    const u=(k,v)=>sF(p=>({...p,[k]:v}));
    return (
      <Modal title="My Vehicles" onClose={()=>setModal(null)}>
        {vehicles.map(v=>(
          <div key={v.id} style={{...S.card,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <p style={{margin:"0 0 4px",fontSize:14,fontWeight:600,color:"#222"}}>{v.type==="Car"?"🚗":"🏍️"} {v.make}</p>
              <p style={{margin:0,fontSize:12,color:"#888"}}>{v.number} · Parking: {v.parking}</p>
            </div>
            <button onClick={()=>{setVehicles(p=>p.filter(x=>x.id!==v.id));showT("Vehicle removed")}} style={{border:"none",background:"#FFEBEE",borderRadius:8,padding:6,cursor:"pointer",color:"#C62828"}}><Icons.X {...ic(16)}/></button>
          </div>
        ))}
        {!adding?(
          <Btn variant="outline" onClick={()=>setAdding(true)} style={{width:"100%",justifyContent:"center"}}><Icons.Plus {...ic(16)}/> Add Vehicle</Btn>
        ):(
          <div style={{...S.card,border:"1.5px solid #1B4D3E"}}>
            <Sel label="Type" value={f.type} onChange={e=>u("type",e.target.value)} options={[{value:"Car",label:"🚗 Car"},{value:"Bike",label:"🏍️ Two Wheeler"}]}/>
            <Inp label="Make / Model" value={f.make} onChange={e=>u("make",e.target.value)} placeholder="e.g. Maruti Swift"/>
            <Inp label="Reg. Number" value={f.number} onChange={e=>u("number",e.target.value)} placeholder="MH-02-XX-1234"/>
            <Inp label="Parking Slot" value={f.parking} onChange={e=>u("parking",e.target.value)} placeholder="P-42"/>
            <div style={{display:"flex",gap:8}}>
              <Btn onClick={()=>{if(!f.make||!f.number)return showT("Fill all fields");setVehicles(p=>[...p,{id:Date.now(),...f}]);setAdding(false);showT("Vehicle added ✓")}} style={{flex:1,justifyContent:"center"}}>Save</Btn>
              <Btn variant="outline" onClick={()=>setAdding(false)} style={{flex:1,justifyContent:"center"}}>Cancel</Btn>
            </div>
          </div>
        )}
      </Modal>
    );
  };

  const AddNoticeModal = () => {
    const [f,sF]=useState({title:"",body:"",type:"notice",priority:"normal"});
    const u=(k,v)=>sF(p=>({...p,[k]:v}));
    return (
      <Modal title="Post Notice" onClose={()=>setModal(null)}>
        <Inp label="Title" value={f.title} onChange={e=>u("title",e.target.value)} placeholder="e.g. Water Supply Update"/>
        <TArea label="Details" value={f.body} onChange={e=>u("body",e.target.value)} placeholder="Write notice details..."/>
        <div style={{display:"flex",gap:10}}>
          <div style={{flex:1}}><Sel label="Type" value={f.type} onChange={e=>u("type",e.target.value)} options={[{value:"notice",label:"📋 Notice"},{value:"event",label:"🎉 Event"},{value:"payment",label:"💰 Payment"}]}/></div>
          <div style={{flex:1}}><Sel label="Priority" value={f.priority} onChange={e=>u("priority",e.target.value)} options={[{value:"normal",label:"Normal"},{value:"high",label:"🔴 Urgent"}]}/></div>
        </div>
        <Btn onClick={()=>{if(!f.title||!f.body)return showT("Fill all fields");setNotifs(p=>[{id:Date.now(),...f,date:"2026-03-03",author:uName,reactions:{}},...p]);setModal(null);showT("Notice posted ✓")}} style={{width:"100%",justifyContent:"center"}}><Icons.Send {...ic(16)}/> Post Notice</Btn>
      </Modal>
    );
  };

  const AddMaintModal = () => {
    const [f,sF]=useState({month:"April 2026",amount:"4500",due:"2026-04-10"});
    const u=(k,v)=>sF(p=>({...p,[k]:v}));
    return (
      <Modal title="Add Maintenance Entry" onClose={()=>setModal(null)}>
        <Inp label="Month" value={f.month} onChange={e=>u("month",e.target.value)} placeholder="April 2026"/>
        <Inp label="Amount (₹)" type="number" value={f.amount} onChange={e=>u("amount",e.target.value)}/>
        <Inp label="Due Date" type="date" value={f.due} onChange={e=>u("due",e.target.value)}/>
        <Btn onClick={()=>{if(!f.month||!f.amount)return showT("Fill all fields");setModal(null);showT("Maintenance entry added ✓")}} style={{width:"100%",justifyContent:"center"}}>Add Entry</Btn>
      </Modal>
    );
  };

  const allTabs = {home:HomeTab,notices:NoticesTab,visitors:VisitorsTab,maintenance:MaintenanceTab,admin:AdminTab,gate:GateTab,gateLog:GateLogTab};
  const TabC = allTabs[tab]||HomeTab;

  return (
    <div style={S.app}>
      <style>{CSS}</style>
      <div style={S.header}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <h1 style={{fontSize:20,fontWeight:700,margin:0}}>Green Valley Society</h1>
            <p style={{fontSize:12,opacity:0.8,marginTop:2}}>{uFlat} · {rName}</p>
          </div>
          <div style={{display:"flex",gap:8}}>
            {!isGuard&&(
              <button onClick={()=>setTab("notices")} style={{border:"none",background:"rgba(255,255,255,0.15)",borderRadius:10,padding:8,cursor:"pointer",color:"#fff",position:"relative"}}>
                <Icons.Bell {...ic(20)}/>
                <span style={{position:"absolute",top:4,right:4,width:8,height:8,background:"#FF5252",borderRadius:"50%",border:"2px solid #1B4D3E"}}/>
              </button>
            )}
            {isGuard&&(
              <button onClick={()=>{setScreen("login");setRole(null)}} style={{border:"none",background:"rgba(255,255,255,0.15)",borderRadius:10,padding:8,cursor:"pointer",color:"#fff"}}>
                <Icons.LogOut {...ic(18)}/>
              </button>
            )}
          </div>
        </div>
      </div>
      <div style={S.content}><TabC/></div>
      <div style={S.nav}>
        {navItems.map(it=>(
          <button key={it.id} style={navI(tab===it.id)} onClick={()=>setTab(it.id)}>
            <it.icon {...ic(22)}/><span>{it.label}</span>
          </button>
        ))}
      </div>
      {modal==="addVisitor"&&<AddVisitorModal/>}
      {modal==="vehicles"&&<VehiclesModal/>}
      {modal==="addNotice"&&<AddNoticeModal/>}
      {modal==="addMaint"&&<AddMaintModal/>}
      {modal==="guardEntry"&&<GuardEntryModal/>}
      {toast&&<Toast message={toast} onHide={()=>setToast(null)}/>}
    </div>
  );
}
