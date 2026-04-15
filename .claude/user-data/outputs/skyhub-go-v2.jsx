import { useState } from "react";

// ─── Design tokens matching Cargo Manifest ───
const accent = "#059669";
const accentDark = "#065f46";

const glass = {
  panel: "rgba(255,255,255,0.6)",
  panelBorder: "rgba(255,255,255,0.6)",
  panelShadow: "0 8px 32px rgba(0,0,0,0.08)",
  input: "rgba(255,255,255,0.7)",
  inputBorder: "rgba(0,0,0,0.05)",
  subtle: "rgba(0,0,0,0.02)",
  subtleBorder: "rgba(0,0,0,0.04)",
};

// ─── Data ───
const flights = [
  { id:"SH123",dep:"SGN",arr:"HAN",std:"06:30",sta:"08:35",etd:"06:28",eta:"08:30",atd:null,ata:null,door:null,reg:"VN-A601",type:"A321",gate:"A12",st:"boarding",pax:{b:195,on:142},cargo:{ld:2840,cap:4200},phase:"loading",tat:45,dly:[] },
  { id:"SH456",dep:"SGN",arr:"DAD",std:"07:15",sta:"08:30",etd:null,eta:null,atd:null,ata:null,door:null,reg:"VN-A588",type:"A320",gate:"B03",st:"scheduled",pax:{b:180,on:0},cargo:{ld:0,cap:3800},phase:"pre_load",tat:40,dly:[] },
  { id:"SH789",dep:"SGN",arr:"PQC",std:"08:00",sta:"09:05",etd:"07:58",eta:"09:02",atd:"07:58",ata:null,door:"07:52",reg:"VN-A612",type:"A321",gate:"C07",st:"departed",pax:{b:195,on:195},cargo:{ld:3950,cap:4200},phase:"departed",tat:null,dly:[] },
  { id:"SH234",dep:"SGN",arr:"CXR",std:"09:45",sta:"10:55",etd:"10:10",eta:"11:20",atd:null,ata:null,door:null,reg:"VN-A595",type:"A320",gate:"—",st:"delayed",pax:{b:162,on:0},cargo:{ld:310,cap:3800},phase:"pre_load",tat:40,dly:[{code:"81",mins:25,reason:"ATC flow control"}] },
  { id:"SH567",dep:"SGN",arr:"HPH",std:"10:30",sta:"12:40",etd:null,eta:null,atd:null,ata:null,door:null,reg:"VN-A603",type:"A321",gate:"A08",st:"scheduled",pax:{b:210,on:0},cargo:{ld:0,cap:4200},phase:"pre_load",tat:45,dly:[] },
  { id:"SH890",dep:"SGN",arr:"VII",std:"11:00",sta:"12:15",etd:null,eta:null,atd:null,ata:null,door:null,reg:"VN-A577",type:"A320",gate:"B11",st:"scheduled",pax:{b:155,on:0},cargo:{ld:0,cap:3800},phase:"pre_load",tat:40,dly:[] },
  { id:"SH345",dep:"SGN",arr:"UIH",std:"11:30",sta:"12:45",etd:null,eta:null,atd:null,ata:null,door:null,reg:"VN-A622",type:"A321",gate:"C12",st:"scheduled",pax:{b:188,on:0},cargo:{ld:0,cap:4200},phase:"pre_load",tat:45,dly:[] },
  { id:"SH678",dep:"SGN",arr:"DLI",std:"12:00",sta:"12:55",etd:null,eta:null,atd:null,ata:null,door:null,reg:"VN-A591",type:"A320",gate:"—",st:"scheduled",pax:{b:170,on:0},cargo:{ld:0,cap:3800},phase:"pre_load",tat:40,dly:[] },
];

const stCfg = {
  boarding:  { l:"Boarding",  bg:"#dbeafe", t:"#1e40af", d:"#3b82f6" },
  loading:   { l:"Loading",   bg:`${accent}18`, t:accent, d:accent },
  scheduled: { l:"Scheduled", bg:"#f3f4f6", t:"#6b7280", d:"#9ca3af" },
  departed:  { l:"Departed",  bg:"#f0fdf4", t:"#166534", d:"#22c55e" },
  delayed:   { l:"Delayed",   bg:"#fef2f2", t:"#991b1b", d:"#ef4444" },
};
const phCfg = {
  pre_load:{ l:"Pre-Load", p:0 }, loading:{ l:"Loading", p:40 },
  load_control:{ l:"Load Ctrl", p:70 }, captain_accept:{ l:"Captain", p:90 },
  departed:{ l:"Departed", p:100 },
};

const actions = [
  { k:"loading",l:"Loading Plan",d:"Assign cargo to compartments",ic:"📦",s:"4.1" },
  { k:"flight",l:"Flight Loading",d:"Live pax + cargo monitoring",ic:"🔄",s:"4.2" },
  { k:"summary",l:"Load Summary",d:"Combined weight dashboard",ic:"⚖️",s:"4.3" },
  { k:"msg",l:"Messages",d:"Generate LDM, CPM, NOTOC",ic:"📨",s:"4.3" },
  { k:"wb",l:"Loadsheet",d:"Weight & Balance",ic:"📊",s:"4.3" },
  { k:"capt",l:"Captain Accept",d:"Digital sign-off",ic:"✍️",s:"4.3" },
];

const docs = [
  { k:"loadsheet",l:"Loadsheet",s:"pending",ic:"📊" },
  { k:"ldm",l:"LDM",s:"generated",ic:"📄" },
  { k:"cpm",l:"CPM",s:"n/a",ic:"📄" },
  { k:"notoc",l:"NOTOC",s:"not_req",ic:"⚠️" },
  { k:"pax",l:"Pax Manifest",s:"pending",ic:"👥" },
  { k:"cargo",l:"Cargo Manifest",s:"generated",ic:"📦" },
  { k:"gendec",l:"Gendec",s:"pending",ic:"🛂" },
];

const dsCfg = {
  generated:{ bg:"#dcfce7",t:"#166534",l:"Generated" },
  sent:{ bg:"#dbeafe",t:"#1e40af",l:"Sent" },
  pending:{ bg:"#fef3c7",t:"#92400e",l:"Pending" },
  not_req:{ bg:"#f3f4f6",t:"#9ca3af",l:"N/A" },
  "n/a":{ bg:"#f3f4f6",t:"#9ca3af",l:"N/A" },
};

function Pill({ status }) {
  const s = stCfg[status];
  return <span style={{ display:"inline-flex",alignItems:"center",gap:4,fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:20,background:s.bg,color:s.t }}><span style={{ width:5,height:5,borderRadius:3,background:s.d }}/>{s.l}</span>;
}

// ─── WORKSPACE TABS ───
function OverviewContent({ f }) {
  const cPct = f.cargo.cap > 0 ? Math.round(f.cargo.ld/f.cargo.cap*100) : 0;
  const holdData = [
    { n:"FWD Hold", w:1200, c:1500, p:80 },
    { n:"AFT Hold", w:1340, c:2000, p:67 },
    { n:"Bulk", w:300, c:700, p:43 },
  ];
  return (
    <div style={{ padding:16, overflowY:"auto", height:"100%" }}>
      {/* Top stats */}
      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        {[
          { v:String(f.pax.on)+"/"+f.pax.b, l:"PASSENGERS", a:false },
          { v:"5,500 kg", l:"BAGS", a:false },
          { v:f.cargo.ld.toLocaleString()+" kg", l:"CARGO", a:false },
          { v:"120 kg", l:"MAIL", a:false },
          { v:"8,460 kg", l:"TOTAL DEADLOAD", a:true },
        ].map((s,i) => (
          <div key={i} style={{
            flex:1, padding:"10px 12px", borderRadius:10,
            background:glass.panel, backdropFilter:"blur(16px)",
            border:`1px solid ${glass.panelBorder}`, position:"relative", overflow:"hidden",
          }}>
            <div style={{ position:"absolute",top:0,left:0,right:0,height:2.5,borderRadius:"2px 2px 0 0",background:s.a?accent:"rgba(0,0,0,0.06)" }}/>
            <div style={{ fontSize:16,fontWeight:700,color:s.a?accent:"#111",marginTop:2 }}>{s.v}</div>
            <div style={{ fontSize:8,fontWeight:600,color:"#888",textTransform:"uppercase",letterSpacing:0.5,marginTop:2 }}>{s.l}</div>
          </div>
        ))}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        {/* Left: Compartments */}
        <div style={{ background:glass.panel, backdropFilter:"blur(16px)", borderRadius:12, padding:14, border:`1px solid ${glass.panelBorder}` }}>
          <div style={{ fontSize:11,fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:0.5,marginBottom:10 }}>By Compartment</div>
          {holdData.map(h => (
            <div key={h.n} style={{ display:"flex",alignItems:"center",gap:8,marginBottom:8 }}>
              <span style={{ fontSize:12,fontWeight:600,color:"#333",width:70 }}>{h.n}</span>
              <div style={{ flex:1,height:6,borderRadius:3,background:"rgba(0,0,0,0.06)",overflow:"hidden" }}>
                <div style={{ height:"100%",width:`${h.p}%`,borderRadius:3,background:accent,transition:"width 0.3s" }}/>
              </div>
              <span style={{ fontSize:11,fontWeight:600,color:"#555",width:80,textAlign:"right" }}>{h.w.toLocaleString()}/{h.c.toLocaleString()}</span>
              <span style={{ fontSize:10,fontWeight:700,color:accent,width:32,textAlign:"right" }}>{h.p}%</span>
            </div>
          ))}
          <div style={{ fontSize:11,fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:0.5,marginTop:16,marginBottom:10 }}>By Zone (Pax)</div>
          {[{z:"A",r:"1–10",p:58,w:4640},{z:"B",r:"11–20",p:72,w:5760},{z:"C",r:"21–30",p:45,w:3600},{z:"D",r:"31–37",p:20,w:1600}].map(z => (
            <div key={z.z} style={{ display:"flex",alignItems:"center",gap:8,marginBottom:4,fontSize:11,color:"#555" }}>
              <span style={{ fontWeight:600,width:50 }}>Zone {z.z}</span>
              <span style={{ color:"#999",width:50 }}>({z.r})</span>
              <span style={{ fontWeight:600 }}>{z.p} pax</span>
              <span style={{ marginLeft:"auto",color:"#888" }}>{z.w.toLocaleString()} kg</span>
            </div>
          ))}
        </div>
        {/* Right: Weights + CG */}
        <div style={{ background:glass.panel, backdropFilter:"blur(16px)", borderRadius:12, padding:14, border:`1px solid ${glass.panelBorder}` }}>
          <div style={{ fontSize:11,fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:0.5,marginBottom:10 }}>Weights</div>
          {[
            {l:"Dry Operating Weight",v:"48,200",ok:null},
            {l:"Zero Fuel Weight",v:"72,340",ok:true,mx:"73,500"},
            {l:"Takeoff Weight",v:"88,140",ok:true,mx:"93,500"},
            {l:"Landing Weight",v:"83,940",ok:true,mx:"77,800"},
          ].map(w => (
            <div key={w.l} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:"1px solid rgba(0,0,0,0.04)" }}>
              <span style={{ fontSize:12,color:"#555" }}>{w.l}</span>
              <div style={{ display:"flex",alignItems:"center",gap:4 }}>
                <span style={{ fontSize:13,fontWeight:700,color:"#111",fontVariantNumeric:"tabular-nums" }}>{w.v}</span>
                {w.ok !== null && <span style={{ fontSize:9,fontWeight:700,color:w.ok?"#16a34a":"#dc2626" }}>{w.ok?"✓":"⚠"}</span>}
                {w.mx && <span style={{ fontSize:9,color:"#999" }}>/ {w.mx}</span>}
              </div>
            </div>
          ))}
          <div style={{ marginTop:16 }}>
            <div style={{ fontSize:11,fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:0.5,marginBottom:8 }}>Center of Gravity</div>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6 }}>
              <div><span style={{ fontSize:20,fontWeight:700,color:accent }}>28.4%</span><span style={{ fontSize:11,color:"#888",marginLeft:4 }}>MAC</span></div>
              <span style={{ fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:8,background:"#dcfce7",color:"#166534" }}>Within Limits</span>
            </div>
            <div style={{ position:"relative",height:8,borderRadius:4,background:"rgba(0,0,0,0.06)" }}>
              <div style={{ position:"absolute",left:"17%",width:"20%",height:"100%",borderRadius:4,background:`${accent}15` }}/>
              <div style={{ position:"absolute",left:"28.4%",top:-3,width:14,height:14,borderRadius:7,background:accent,border:"2.5px solid #fff",boxShadow:"0 1px 4px rgba(0,0,0,0.2)",transform:"translateX(-7px)" }}/>
            </div>
            <div style={{ display:"flex",justifyContent:"space-between",fontSize:9,color:"#999",marginTop:3 }}>
              <span>17.0%</span><span>37.0%</span>
            </div>
          </div>
          <div style={{ marginTop:12,padding:"8px 10px",borderRadius:8,background:"#fef3c7",border:"1px solid #fde68a" }}>
            <span style={{ fontSize:11,color:"#92400e" }}>⚠ DG: 1 item (Lithium Ion, FWD) · NOTOC: Pending</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessagesContent() {
  const [sel, setSel] = useState("ldm");
  const msgs = [
    { k:"ldm",l:"LDM",s:"generated",d:"Load Distribution Message" },
    { k:"cpm",l:"CPM",s:"n/a",d:"Container/Pallet Message" },
    { k:"notoc",l:"NOTOC",s:"pending",d:"Dangerous Goods Notification" },
    { k:"ucm",l:"UCM",s:"n/a",d:"ULD Control Message" },
  ];
  return (
    <div style={{ display:"flex",height:"100%",gap:10,padding:16 }}>
      <div style={{ width:200,display:"flex",flexDirection:"column",gap:6 }}>
        {msgs.map(m => {
          const ds = dsCfg[m.s] || dsCfg["n/a"];
          return (
            <div key={m.k} onClick={()=>setSel(m.k)} style={{
              padding:"10px 12px",borderRadius:10,cursor:"pointer",
              background: sel===m.k ? glass.panel : "transparent",
              border: sel===m.k ? `1.5px solid ${accent}40` : "1.5px solid transparent",
              backdropFilter: sel===m.k ? "blur(12px)" : "none",
              transition:"all 0.15s",
            }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                <span style={{ fontSize:13,fontWeight:600,color:"#111" }}>{m.l}</span>
                <span style={{ fontSize:9,fontWeight:600,padding:"2px 7px",borderRadius:8,background:ds.bg,color:ds.t }}>{ds.l}</span>
              </div>
              <div style={{ fontSize:10,color:"#999",marginTop:2 }}>{m.d}</div>
            </div>
          );
        })}
      </div>
      <div style={{ flex:1,background:glass.panel,backdropFilter:"blur(16px)",borderRadius:12,border:`1px solid ${glass.panelBorder}`,padding:16,display:"flex",flexDirection:"column" }}>
        <div style={{ fontSize:12,fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:0.5,marginBottom:10 }}>LDM Preview</div>
        <pre style={{ flex:1,fontFamily:"'SF Mono','Roboto Mono',monospace",fontSize:12,lineHeight:1.6,color:"#333",background:"rgba(0,0,0,0.02)",borderRadius:8,padding:12,overflow:"auto",border:"1px solid rgba(0,0,0,0.04)" }}>{`LDM
SH123/01.VNA601.Y220
-HAN.195/195/0/0.T.8460
 .1/1200.3/1340
 5/300
PAX/195 B/5500 C/2840 M/120
SI SPML 2WCHC 1UM 1PETC`}</pre>
        <div style={{ display:"flex",gap:6,marginTop:10 }}>
          <button style={{ flex:1,padding:"8px 0",borderRadius:8,border:`1.5px solid ${accent}30`,background:`${accent}08`,color:accent,fontSize:11,fontWeight:600,cursor:"pointer" }}>Copy to Clipboard</button>
          <button style={{ flex:1,padding:"8px 0",borderRadius:8,border:"none",background:accent,color:"#fff",fontSize:11,fontWeight:600,cursor:"pointer",boxShadow:"0 2px 8px rgba(5,150,105,0.3)" }}>Send via Hub</button>
          <button style={{ padding:"8px 12px",borderRadius:8,border:"1.5px solid rgba(0,0,0,0.08)",background:"#fff",color:"#555",fontSize:11,fontWeight:600,cursor:"pointer" }}>Regenerate</button>
        </div>
      </div>
    </div>
  );
}

function DocsContent() {
  return (
    <div style={{ padding:16,display:"flex",flexDirection:"column",gap:6 }}>
      {docs.map(d => {
        const ds = dsCfg[d.s] || dsCfg["n/a"];
        return (
          <div key={d.k} style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,background:glass.panel,backdropFilter:"blur(12px)",border:`1px solid ${glass.panelBorder}`,cursor:"pointer",transition:"all 0.15s" }}>
            <div style={{ width:34,height:34,borderRadius:9,background:"rgba(0,0,0,0.03)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15 }}>{d.ic}</div>
            <div style={{ flex:1 }}><div style={{ fontSize:13,fontWeight:600,color:"#111" }}>{d.l}</div></div>
            <span style={{ fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:8,background:ds.bg,color:ds.t }}>{ds.l}</span>
          </div>
        );
      })}
      <button style={{ marginTop:6,padding:"10px 0",borderRadius:10,border:"none",background:accent,color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",boxShadow:"0 2px 8px rgba(5,150,105,0.3)" }}>Download All as ZIP</button>
    </div>
  );
}

function InfoContent({ f }) {
  return (
    <div style={{ padding:16 }}>
      <div style={{ fontSize:11,fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:0.5,marginBottom:8 }}>Times (Local)</div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:16 }}>
        {[["STD",f.std],["STA",f.sta],["ETD",f.etd],["ETA",f.eta],["ATD",f.atd],["ATA",f.ata],["Door Closed",f.door]].map(([l,v])=>(
          <div key={l} style={{ padding:"7px 10px",borderRadius:8,background:glass.panel,backdropFilter:"blur(12px)",border:`1px solid ${glass.panelBorder}` }}>
            <div style={{ fontSize:9,color:"#999",textTransform:"uppercase",letterSpacing:0.3 }}>{l}</div>
            <div style={{ fontSize:14,fontWeight:600,color:v?"#111":"#ddd",fontVariantNumeric:"tabular-nums" }}>{v||"—"}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize:11,fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:0.5,marginBottom:8 }}>Aircraft</div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:16 }}>
        {[["Registration",f.reg],["Type",f.type],["Config","Y220"],["Turnaround",f.tat?f.tat+"m":"—"]].map(([l,v])=>(
          <div key={l} style={{ padding:"7px 10px",borderRadius:8,background:glass.panel,backdropFilter:"blur(12px)",border:`1px solid ${glass.panelBorder}` }}>
            <div style={{ fontSize:9,color:"#999",textTransform:"uppercase",letterSpacing:0.3 }}>{l}</div>
            <div style={{ fontSize:13,fontWeight:600,color:"#111" }}>{v}</div>
          </div>
        ))}
      </div>
      {f.dly.length > 0 && (
        <>
          <div style={{ fontSize:11,fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:0.5,marginBottom:8 }}>Delays</div>
          {f.dly.map((d,i) => (
            <div key={i} style={{ padding:"8px 10px",borderRadius:8,background:"#fef2f2",border:"1px solid #fecaca" }}>
              <div style={{ fontSize:12,fontWeight:600,color:"#991b1b" }}>Code {d.code} · +{d.mins} min</div>
              <div style={{ fontSize:11,color:"#b91c1c",marginTop:1 }}>{d.reason}</div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ─── MAIN ───
export default function SkyHubGO() {
  const [sel, setSel] = useState(null);
  const [tab, setTab] = useState("overview");

  const boardingN = flights.filter(f=>f.st==="boarding").length;
  const loadingN = flights.filter(f=>f.phase==="loading").length;
  const delayedN = flights.filter(f=>f.st==="delayed").length;
  const departedN = flights.filter(f=>f.st==="departed").length;

  const sf = sel !== null ? flights.find(f=>f.id===sel) : null;

  return (
    <div style={{
      height:"100vh",fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
      display:"flex",flexDirection:"column",overflow:"hidden",
      background:"linear-gradient(160deg, #e8ecf1 0%, #dde2e8 30%, #d0d5dc 60%, #c8cdd4 100%)",
    }}>
      {/* Radial highlight */}
      <div style={{ position:"fixed",inset:0,pointerEvents:"none",zIndex:0,background:"radial-gradient(ellipse 60% 45% at 50% 35%, rgba(255,255,255,0.3), transparent 70%)" }}/>

      {/* ═══ TOP BAR — frosted ═══ */}
      <div style={{
        display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 16px",
        position:"relative",zIndex:10,
        background:"rgba(255,255,255,0.45)",backdropFilter:"blur(20px)",
        borderBottom:"1px solid rgba(255,255,255,0.6)",
      }}>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <div style={{ width:30,height:30,borderRadius:8,background:accent,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:13 }}>H</div>
          <div>
            <div style={{ fontSize:15,fontWeight:700,color:"#111" }}>SkyHub GO</div>
            <div style={{ fontSize:10,color:"#888",marginTop:-1 }}>Ground Operations</div>
          </div>
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:8 }}>
          <div style={{ display:"flex",alignItems:"center",gap:6,padding:"5px 12px",borderRadius:8,background:"rgba(255,255,255,0.5)",border:"1px solid rgba(255,255,255,0.6)" }}>
            <span style={{ fontSize:17,fontWeight:800,color:accentDark,letterSpacing:1 }}>SGN</span>
            <span style={{ fontSize:10,color:"#888" }}>Tan Son Nhat</span>
            <span style={{ fontSize:10,color:"#bbb" }}>▾</span>
          </div>
          <div style={{ fontSize:11,color:"#777",textAlign:"right" }}>
            <div style={{ fontWeight:600,color:"#444" }}>03 Apr 2026</div>
            <div>06:44 UTC+7</div>
          </div>
        </div>
      </div>

      {/* ═══ KPI STRIP ═══ */}
      <div style={{ display:"flex",gap:8,padding:"8px 16px 4px",position:"relative",zIndex:1 }}>
        {[
          { v:flights.length,l:"Total Flights",a:true },
          { v:boardingN,l:"Boarding Now",a:true },
          { v:loadingN,l:"Loading",a:true },
          { v:delayedN,l:"Delayed",w:delayedN>0 },
          { v:departedN,l:"Departed" },
          { v:"87%",l:"OTP",a:true },
        ].map((k,i) => (
          <div key={i} style={{
            flex:1, padding:"8px 10px", borderRadius:10, position:"relative",overflow:"hidden",
            background:glass.panel, backdropFilter:"blur(16px)",
            border:`1px solid ${glass.panelBorder}`,
            boxShadow:glass.panelShadow,
          }}>
            <div style={{ position:"absolute",top:0,left:0,right:0,height:2.5,borderRadius:"2px 2px 0 0",background:k.w?"#ef4444":k.a?accent:"rgba(0,0,0,0.06)" }}/>
            <div style={{ fontSize:18,fontWeight:700,color:k.w?"#dc2626":k.a?accent:"#111",marginTop:1 }}>{k.v}</div>
            <div style={{ fontSize:8,fontWeight:600,color:"#888",textTransform:"uppercase",letterSpacing:0.5,marginTop:1 }}>{k.l}</div>
          </div>
        ))}
      </div>

      {/* ═══ MAIN ═══ */}
      <div style={{ flex:1,display:"flex",overflow:"hidden",padding:"6px 16px 16px",gap:10,position:"relative",zIndex:1 }}>

        {/* ─── LEFT: Flight List (always 320px) ─── */}
        <div style={{
          width:320, flexShrink:0,
          display:"flex",flexDirection:"column",overflow:"hidden",
          background:glass.panel, backdropFilter:"blur(20px)",
          borderRadius:14, border:`1px solid ${glass.panelBorder}`,
          boxShadow:glass.panelShadow,
        }}>
          {/* Header + search */}
          <div style={{ padding:"10px 12px 6px" }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8 }}>
              <span style={{ fontSize:13,fontWeight:700,color:"#111" }}>Flights Today</span>
              <span style={{ fontSize:10,color:"#999" }}>{flights.length} flights</span>
            </div>
            <div style={{
              display:"flex",alignItems:"center",gap:6,padding:"7px 10px",borderRadius:8,
              background:glass.input,border:`1px solid ${glass.inputBorder}`,
            }}>
              <span style={{ fontSize:12,color:"#999" }}>🔍</span>
              <span style={{ fontSize:12,color:"#bbb" }}>Search flights...</span>
            </div>
          </div>

          {/* Flight cards */}
          <div style={{ flex:1,overflowY:"auto",padding:"0 8px 8px" }}>
            {flights.map(f => {
              const on = sel===f.id;
              const ph = phCfg[f.phase];
              const sc = stCfg[f.st];
              const cPct = f.cargo.cap>0 ? Math.round(f.cargo.ld/f.cargo.cap*100) : 0;
              const pPct = f.pax.b>0 ? Math.round(f.pax.on/f.pax.b*100) : 0;
              return (
                <div key={f.id} onClick={()=>{setSel(f.id);if(!sel)setTab("overview");}} style={{
                  padding:"10px 12px",cursor:"pointer",marginBottom:4,
                  borderRadius:10,
                  border: on ? `1.5px solid ${accent}` : "1.5px solid transparent",
                  background: on ? `${accent}08` : "transparent",
                  transition:"all 0.12s",
                }}>
                  {/* Row 1: Flight + status */}
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4 }}>
                    <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                      <span style={{ fontSize:14,fontWeight:700,color:on?accentDark:"#111" }}>{f.id}</span>
                      <span style={{ fontSize:10,color:"#999",fontFamily:"monospace" }}>{f.type}</span>
                    </div>
                    <Pill status={f.st}/>
                  </div>
                  {/* Row 2: Route */}
                  <div style={{ display:"flex",alignItems:"center",gap:4,marginBottom:4 }}>
                    <span style={{ fontSize:13,fontWeight:600,color:"#222" }}>{f.dep}</span>
                    <div style={{ flex:1,display:"flex",alignItems:"center" }}>
                      <div style={{ flex:1,height:0,borderTop:"1px dashed #ccc" }}/>
                      <span style={{ fontSize:10,color:"#bbb",margin:"0 3px" }}>✈</span>
                      <div style={{ flex:1,height:0,borderTop:"1px dashed #ccc" }}/>
                    </div>
                    <span style={{ fontSize:13,fontWeight:600,color:"#222" }}>{f.arr}</span>
                    <span style={{ fontSize:11,fontWeight:600,color:"#555",fontVariantNumeric:"tabular-nums",marginLeft:6 }}>{f.std}</span>
                  </div>
                  {/* Row 3: Info strip */}
                  <div style={{ display:"flex",alignItems:"center",gap:8,fontSize:10,color:"#999" }}>
                    <span style={{ fontFamily:"monospace" }}>{f.reg}</span>
                    <span>·</span>
                    <span>{f.gate==="—"?"No gate":f.gate}</span>
                    {f.door && <span style={{ fontSize:9,fontWeight:600,padding:"1px 5px",borderRadius:4,background:accent,color:"#fff" }}>D.CL {f.door}</span>}
                    {f.dly.length>0 && <span style={{ fontSize:9,fontWeight:600,padding:"1px 5px",borderRadius:4,background:"#fef2f2",color:"#dc2626" }}>+{f.dly[0].mins}m</span>}
                  </div>
                  {/* Row 4: Phase bar */}
                  <div style={{ display:"flex",alignItems:"center",gap:6,marginTop:5 }}>
                    <div style={{ flex:1,height:3,borderRadius:2,background:"rgba(0,0,0,0.06)",overflow:"hidden" }}>
                      <div style={{ height:"100%",width:`${ph.p}%`,borderRadius:2,background:ph.p===100?"#22c55e":accent }}/>
                    </div>
                    <span style={{ fontSize:9,color:"#aaa",width:48,textAlign:"right" }}>{ph.l}</span>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Footer */}
          <div style={{ padding:"7px 12px",borderTop:"1px solid rgba(0,0,0,0.04)",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
            <span style={{ fontSize:10,color:"#999" }}>Auto-refresh 30s</span>
            <div style={{ display:"flex",gap:4 }}>
              <button style={{ padding:"3px 8px",borderRadius:5,border:"1px solid rgba(0,0,0,0.08)",background:"rgba(255,255,255,0.5)",fontSize:10,color:"#555",cursor:"pointer" }}>Filter</button>
              <button style={{ padding:"3px 8px",borderRadius:5,border:"1px solid rgba(0,0,0,0.08)",background:"rgba(255,255,255,0.5)",fontSize:10,color:"#555",cursor:"pointer" }}>Export</button>
            </div>
          </div>
        </div>

        {/* ─── RIGHT: Workspace or Empty State ─── */}
        {sel && sf ? (
          <div style={{
            flex:1,display:"flex",flexDirection:"column",overflow:"hidden",
            borderRadius:14,
            background:"rgba(255,255,255,0.35)",
            backdropFilter:"blur(20px)",
            border:`1px solid ${glass.panelBorder}`,
            boxShadow:glass.panelShadow,
            animation:"ws-in 0.3s cubic-bezier(0.16,1,0.3,1)",
          }}>
            {/* Flight header — faint frosted glass with accent tint */}
            <div style={{
              padding:"12px 16px",
              borderRadius:"14px 14px 0 0",
              background:`linear-gradient(135deg, ${accent}26 0%, ${accent}15 100%)`,
              backdropFilter:"blur(12px)",
              borderBottom:`1px solid ${accent}25`,
            }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontSize:20,fontWeight:800,letterSpacing:-0.5,color:accentDark }}>{sf.id}</div>
                  <div style={{ fontSize:11,color:"#888",marginTop:1 }}>{sf.reg} · {sf.type} · Gate {sf.gate}</div>
                </div>
                <Pill status={sf.st}/>
              </div>
              <div style={{ display:"flex",alignItems:"center",margin:"10px 0 4px" }}>
                <div style={{ textAlign:"center" }}>
                  <div style={{ fontSize:18,fontWeight:700,color:"#222" }}>{sf.dep}</div>
                  <div style={{ fontSize:10,color:"#999" }}>{sf.std}</div>
                </div>
                <div style={{ flex:1,margin:"0 14px",position:"relative" }}>
                  <div style={{ borderTop:`1.5px dashed ${accent}30` }}/>
                  <span style={{ position:"absolute",top:-9,left:"calc(50% - 7px)",fontSize:13,color:`${accent}50` }}>✈</span>
                </div>
                <div style={{ textAlign:"center" }}>
                  <div style={{ fontSize:18,fontWeight:700,color:"#222" }}>{sf.arr}</div>
                  <div style={{ fontSize:10,color:"#999" }}>{sf.sta}</div>
                </div>
                <div style={{ width:1,height:28,background:"rgba(0,0,0,0.06)",margin:"0 16px" }}/>
                <div style={{ display:"flex",gap:16 }}>
                  <div>
                    <div style={{ fontSize:8,color:"#999",textTransform:"uppercase",letterSpacing:0.4 }}>Pax</div>
                    <div style={{ fontSize:14,fontWeight:700,color:"#222" }}>{sf.pax.on}<span style={{ fontWeight:400,color:"#999" }}>/{sf.pax.b}</span></div>
                  </div>
                  <div>
                    <div style={{ fontSize:8,color:"#999",textTransform:"uppercase",letterSpacing:0.4 }}>Cargo</div>
                    <div style={{ fontSize:14,fontWeight:700,color:accent }}>{sf.cargo.cap>0?Math.round(sf.cargo.ld/sf.cargo.cap*100):0}%</div>
                  </div>
                  <div>
                    <div style={{ fontSize:8,color:"#999",textTransform:"uppercase",letterSpacing:0.4 }}>Door</div>
                    <div style={{ fontSize:14,fontWeight:700,color:sf.door?accent:"#ddd" }}>{sf.door||"—"}</div>
                  </div>
                </div>
              </div>
              {sf.dly.length > 0 && (
                <div style={{ marginTop:6,padding:"5px 8px",borderRadius:6,background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.12)",fontSize:11,color:"#dc2626" }}>
                  ⚠ {sf.dly[0].reason} (+{sf.dly[0].mins}m)
                </div>
              )}
            </div>

            {/* Tab bar */}
            <div style={{ display:"flex",borderBottom:"1px solid rgba(0,0,0,0.06)",padding:"0 16px",background:"rgba(255,255,255,0.3)" }}>
              {[
                ["overview","Overview"],["loading","Loading"],["wb","W&B"],
                ["messages","Messages"],["docs","Documents"],["captain","Captain"],
              ].map(([k,l])=>(
                <button key={k} onClick={()=>setTab(k)} style={{
                  padding:"10px 14px",fontSize:12,fontWeight:tab===k?600:400,
                  color:tab===k?accent:"#777",
                  background:"transparent",border:"none",cursor:"pointer",
                  position:"relative",transition:"color 0.15s",
                }}>
                  {l}
                  {tab===k && <div style={{ position:"absolute",bottom:-1,left:10,right:10,height:2,background:accent,borderRadius:2 }}/>}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ flex:1,overflow:"hidden" }}>
              {tab==="overview" && <OverviewContent f={sf}/>}
              {tab==="messages" && <MessagesContent/>}
              {tab==="docs" && <DocsContent/>}
              {tab==="info" && <InfoContent f={sf}/>}
              {tab==="loading" && (
                <div style={{ display:"flex",alignItems:"center",justifyContent:"center",height:"100%",color:"#999",fontSize:13 }}>
                  <div style={{ textAlign:"center" }}>
                    <div style={{ fontSize:40,marginBottom:8,opacity:0.2 }}>📦</div>
                    <div style={{ fontWeight:600,color:"#555" }}>Aircraft Loading View</div>
                    <div style={{ fontSize:11,color:"#999",marginTop:2 }}>Reuses the Cargo Manifest aircraft image + compartment overlays</div>
                  </div>
                </div>
              )}
              {tab==="wb" && (
                <div style={{ display:"flex",alignItems:"center",justifyContent:"center",height:"100%",color:"#999",fontSize:13 }}>
                  <div style={{ textAlign:"center" }}>
                    <div style={{ fontSize:40,marginBottom:8,opacity:0.2 }}>⚖️</div>
                    <div style={{ fontWeight:600,color:"#555" }}>Loadsheet & LMC</div>
                    <div style={{ fontSize:11,color:"#999",marginTop:2 }}>Weight chain + inline LMC calculator</div>
                  </div>
                </div>
              )}
              {tab==="captain" && (
                <div style={{ display:"flex",alignItems:"center",justifyContent:"center",height:"100%",color:"#999",fontSize:13 }}>
                  <div style={{ textAlign:"center" }}>
                    <div style={{ fontSize:40,marginBottom:8,opacity:0.2 }}>✍️</div>
                    <div style={{ fontWeight:600,color:"#555" }}>Captain Acceptance</div>
                    <div style={{ fontSize:11,color:"#999",marginTop:2 }}>Loadsheet + NOTOC review + digital sign-off</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Empty state — no flight selected */
          <div style={{
            flex:1,display:"flex",alignItems:"center",justifyContent:"center",
            borderRadius:14,
            background:"rgba(255,255,255,0.2)",
            backdropFilter:"blur(12px)",
            border:"1px solid rgba(255,255,255,0.3)",
          }}>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:48,marginBottom:12,opacity:0.15 }}>✈</div>
              <div style={{ fontSize:16,fontWeight:600,color:"#555" }}>Select a flight</div>
              <div style={{ fontSize:12,color:"#999",marginTop:4,maxWidth:260,lineHeight:1.5 }}>
                Tap a flight from the list to open the workspace with Overview, Loading, W&B, Messages, and more
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes ws-in {
          0% { opacity:0; transform:translateX(20px); }
          100% { opacity:1; transform:translateX(0); }
        }
      `}</style>
    </div>
  );
}
