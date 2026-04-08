// ─────────────────────────────────────────────────────────
// frontend/src/App.jsx — ALGO_BOT_ORB React Frontend
// Connects live to backend via Socket.io
// npm install socket.io-client axios
// ─────────────────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { io } from "socket.io-client";
import axios from "axios";
import {
  Activity, AlertCircle, ArrowDownRight, ArrowUpRight, BarChart2,
  Bell, Calculator, CheckCircle, ChevronDown, Clock, Code2,
  Copy, Edit3, Eye, EyeOff, Info, Key, LayoutDashboard, List,
  Monitor, Plus, Power, RefreshCw, Search, Send, Settings,
  Shield, Target, TrendingDown, TrendingUp, Wifi, WifiOff,
  X, Zap, XCircle, AlertTriangle
} from "lucide-react";

// ─────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────
const API_BASE   = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const SOCKET_URL = API_BASE;

// ─────────────────────────────────────────────────────────
// GLOBAL STYLES
// ─────────────────────────────────────────────────────────
function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Outfit',sans-serif;background:#fff;overflow:hidden}
      ::-webkit-scrollbar{width:5px;height:5px}
      ::-webkit-scrollbar-track{background:#F3F4F6}
      ::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:3px}
      input:focus,select:focus{outline:none}
      .mono{font-family:'JetBrains Mono',monospace}
      .pulse{animation:pulse 2s infinite}
      @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
      .live-dot{animation:liveDot 1.5s infinite}
      @keyframes liveDot{0%,100%{transform:scale(1)}50%{transform:scale(1.5)}}
      .slide-in{animation:slideIn 0.22s ease-out}
      @keyframes slideIn{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}
      .tooltip-wrap{position:relative}
      .tooltip-wrap:hover .tip{display:block}
      .tip{display:none;position:absolute;bottom:calc(100%+6px);left:50%;transform:translateX(-50%);
        background:#1E293B;color:#fff;padding:6px 10px;border-radius:6px;font-size:11px;
        white-space:nowrap;z-index:999;pointer-events:none}
      .tip::after{content:'';position:absolute;top:100%;left:50%;transform:translateX(-50%);
        border:5px solid transparent;border-top-color:#1E293B}
      @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
      .trade-blink{animation:tradeBlink 1s infinite}
      @keyframes tradeBlink{0%,100%{box-shadow:0 0 0 0 rgba(16,185,129,.6)}50%{box-shadow:0 0 0 8px rgba(16,185,129,0)}}
      .sell-blink{animation:sellBlink 1s infinite}
      @keyframes sellBlink{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.6)}50%{box-shadow:0 0 0 8px rgba(239,68,68,0)}}
    `}</style>
  );
}

// ─────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────
const SB   = "#1E40AF";
const SBg  = "#F1F5F9";
const G    = "#10B981";
const R    = "#EF4444";
const W    = "#F59E0B";
const BD   = "#E2E8F0";
const T1   = "#0F172A";
const T2   = "#64748B";

const INDIAN_STOCKS = [
  { symbol: "NSE:RELIANCE-EQ",  name: "Reliance Industries",    price: 2847.50 },
  { symbol: "NSE:TCS-EQ",       name: "Tata Consultancy Svcs",  price: 3892.30 },
  { symbol: "NSE:HDFCBANK-EQ",  name: "HDFC Bank",              price: 1678.45 },
  { symbol: "NSE:INFY-EQ",      name: "Infosys",                price: 1842.60 },
  { symbol: "NSE:ICICIBANK-EQ", name: "ICICI Bank",             price: 1124.75 },
  { symbol: "NSE:SBIN-EQ",      name: "State Bank of India",    price: 812.35  },
  { symbol: "NSE:BHARTIARTL-EQ",name: "Bharti Airtel",          price: 1478.90 },
  { symbol: "NSE:WIPRO-EQ",     name: "Wipro",                  price: 482.60  },
  { symbol: "NSE:BAJFINANCE-EQ",name: "Bajaj Finance",          price: 7234.50 },
  { symbol: "NSE:LT-EQ",        name: "Larsen & Toubro",        price: 3812.40 },
  { symbol: "NSE:AXISBANK-EQ",  name: "Axis Bank",              price: 1124.20 },
  { symbol: "NSE:TATAMOTORS-EQ",name: "Tata Motors",            price: 924.60  },
  { symbol: "NSE:MARUTI-EQ",    name: "Maruti Suzuki",          price: 12450.30},
  { symbol: "NSE:SUNPHARMA-EQ", name: "Sun Pharma",             price: 1624.80 },
  { symbol: "NSE:TITAN-EQ",     name: "Titan Company",          price: 3456.80 },
  { symbol: "NSE:NTPC-EQ",      name: "NTPC",                   price: 362.80  },
  { symbol: "NSE:ONGC-EQ",      name: "ONGC",                   price: 278.60  },
  { symbol: "NSE:POWERGRID-EQ", name: "Power Grid",             price: 312.45  },
  { symbol: "NSE:ITC-EQ",       name: "ITC",                    price: 487.30  },
  { symbol: "NSE:HCLTECH-EQ",   name: "HCL Technologies",       price: 1834.60 },
  { symbol: "NSE:TECHM-EQ",     name: "Tech Mahindra",          price: 1678.20 },
  { symbol: "NSE:KOTAKBANK-EQ", name: "Kotak Mahindra Bank",    price: 1892.30 },
  { symbol: "NSE:ADANIPORTS-EQ",name: "Adani Ports",            price: 1342.60 },
  { symbol: "NSE:JSWSTEEL-EQ",  name: "JSW Steel",              price: 934.50  },
  { symbol: "NSE:DLF-EQ",       name: "DLF",                    price: 812.60  },
  { symbol: "NSE:ZOMATO-EQ",    name: "Zomato",                 price: 234.60  },
  { symbol: "NSE:IRCTC-EQ",     name: "IRCTC",                  price: 924.30  },
  { symbol: "NSE:TATAPOWER-EQ", name: "Tata Power",             price: 412.80  },
  { symbol: "NSE:BEL-EQ",       name: "Bharat Electronics",     price: 278.80  },
  { symbol: "NSE:HAL-EQ",       name: "Hindustan Aeronautics",  price: 4234.60 },
  { symbol: "NSE:DMART-EQ",     name: "Avenue Supermarts",      price: 4234.80 },
  { symbol: "NSE:LUPIN-EQ",     name: "Lupin",                  price: 2134.80 },
  { symbol: "NSE:CIPLA-EQ",     name: "Cipla",                  price: 1612.40 },
  { symbol: "NSE:DRREDDY-EQ",   name: "Dr Reddy's",             price: 6234.80 },
  { symbol: "NSE:APOLLOHOSP-EQ",name: "Apollo Hospitals",       price: 7234.50 },
  { symbol: "NSE:HINDUNILVR-EQ",name: "Hindustan Unilever",     price: 2612.80 },
  { symbol: "NSE:NESTLEIND-EQ", name: "Nestle India",           price: 24680.50},
  { symbol: "NSE:COALINDIA-EQ", name: "Coal India",             price: 432.90  },
  { symbol: "NSE:SAIL-EQ",      name: "SAIL",                   price: 134.80  },
  { symbol: "NSE:TATASTEEL-EQ", name: "Tata Steel",             price: 162.45  },
  { symbol: "NSE:HINDALCO-EQ",  name: "Hindalco Industries",    price: 678.80  },
  { symbol: "NSE:VEDL-EQ",      name: "Vedanta",                price: 478.60  },
  { symbol: "NSE:GAIL-EQ",      name: "GAIL India",             price: 212.60  },
  { symbol: "NSE:IOC-EQ",       name: "Indian Oil Corporation",  price: 178.40  },
  { symbol: "NSE:BPCL-EQ",      name: "BPCL",                   price: 345.60  },
  { symbol: "NSE:GODREJCP-EQ",  name: "Godrej Consumer",        price: 1234.80 },
  { symbol: "NSE:DABUR-EQ",     name: "Dabur India",            price: 612.40  },
  { symbol: "NSE:TRENT-EQ",     name: "Trent",                  price: 5678.30 },
  { symbol: "NSE:PAYTM-EQ",     name: "Paytm",                  price: 678.30  },
  { symbol: "NSE:NYKAA-EQ",     name: "Nykaa",                  price: 178.40  },
];

function shortSym(full) { return full.replace('NSE:', '').replace('-EQ', ''); }
function fmtINR(v) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(v);
}

// ─────────────────────────────────────────────────────────
// SOCKET HOOK
// ─────────────────────────────────────────────────────────
function useSocket(url) {
  const [socket,    setSocket]    = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const s = io(url, { transports: ['websocket'], reconnectionAttempts: 10 });
    s.on('connect',    () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    setSocket(s);
    return () => s.disconnect();
  }, [url]);

  return { socket, connected };
}

// ─────────────────────────────────────────────────────────
// API HELPER
// ─────────────────────────────────────────────────────────
const api = {
  get:  (path)       => axios.get(`${API_BASE}${path}`).then(r => r.data),
  post: (path, body) => axios.post(`${API_BASE}${path}`, body).then(r => r.data),
};

// ─────────────────────────────────────────────────────────
// SMALL UI COMPONENTS
// ─────────────────────────────────────────────────────────
function Toggle({ on, onToggle, size = 'md', label }) {
  const d = size === 'lg' ? { w:56,h:28,r:14,dot:20,off:4,on:32 }
          : size === 'sm' ? { w:32,h:18,r:9, dot:12,off:3,on:17 }
          :                 { w:44,h:24,r:12,dot:16,off:4,on:24 };
  return (
    <div style={{ display:'flex',alignItems:'center',gap:8,cursor:'pointer' }} onClick={onToggle}>
      <div style={{ position:'relative',width:d.w,height:d.h,borderRadius:d.r,
        background:on?SB:'#CBD5E1',transition:'background .25s',flexShrink:0 }}>
        <div style={{ position:'absolute',top:(d.h-d.dot)/2,left:on?d.on:d.off,
          width:d.dot,height:d.dot,borderRadius:'50%',background:'#fff',
          transition:'left .25s',boxShadow:'0 1px 4px rgba(0,0,0,.2)' }} />
      </div>
      {label && <span style={{ fontSize:13,fontWeight:700,color:on?SB:T2 }}>{on?'ON':'OFF'}</span>}
    </div>
  );
}

function Badge({ text, color=SB }) {
  return <span style={{ display:'inline-flex',alignItems:'center',padding:'2px 8px',
    borderRadius:20,fontSize:11,fontWeight:700,background:color+'18',color }}>{text}</span>;
}

function SCard({ title, children, action, icon: Icon }) {
  return (
    <div style={{ background:'#fff',border:`1.5px solid ${BD}`,borderRadius:12,marginBottom:14,overflow:'hidden' }}>
      <div style={{ padding:'11px 16px',borderBottom:`1px solid ${BD}`,background:'#FAFBFF',
        display:'flex',alignItems:'center',justifyContent:'space-between' }}>
        <div style={{ display:'flex',alignItems:'center',gap:8 }}>
          {Icon && <Icon size={15} color={SB} />}
          <span style={{ fontWeight:700,fontSize:13,color:T1 }}>{title}</span>
        </div>
        {action}
      </div>
      <div style={{ padding:'14px 16px' }}>{children}</div>
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon, color=SB }) {
  return (
    <div style={{ background:'#fff',border:`1.5px solid ${BD}`,borderRadius:12,padding:'14px 16px' }}>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6 }}>
        <span style={{ fontSize:11,fontWeight:600,color:T2 }}>{label}</span>
        <div style={{ background:color+'15',borderRadius:7,padding:5 }}><Icon size={14} color={color} /></div>
      </div>
      <div className="mono" style={{ fontSize:21,fontWeight:700,color:T1 }}>{value}</div>
      {sub && <div style={{ fontSize:11,color:T2,marginTop:3 }}>{sub}</div>}
    </div>
  );
}

function Field({ label, value, onChange, type='text', prefix, suffix, tooltip, disabled, placeholder }) {
  return (
    <div style={{ marginBottom:13 }}>
      <div style={{ display:'flex',alignItems:'center',gap:5,marginBottom:5 }}>
        <label style={{ fontSize:12,fontWeight:600,color:T2 }}>{label}</label>
        {tooltip && (
          <div className="tooltip-wrap">
            <Info size={11} color="#94A3B8" style={{ cursor:'pointer' }} />
            <div className="tip">{tooltip}</div>
          </div>
        )}
      </div>
      <div style={{ display:'flex',alignItems:'center',border:`1.5px solid ${BD}`,
        borderRadius:8,background:disabled?'#F8FAFC':'#fff',overflow:'hidden' }}>
        {prefix && <span style={{ padding:'0 10px',color:T2,fontSize:14 }}>{prefix}</span>}
        <input type={type} value={value} onChange={e=>onChange(e.target.value)}
          disabled={disabled} placeholder={placeholder}
          style={{ flex:1,padding:'9px 12px',border:'none',background:'transparent',
            fontSize:14,color:T1,fontFamily:"'JetBrains Mono',monospace" }} />
        {suffix && <span style={{ padding:'0 12px',color:T2,fontSize:13,fontWeight:600 }}>{suffix}</span>}
      </div>
    </div>
  );
}

function SelectField({ label, value, onChange, options, tooltip }) {
  return (
    <div style={{ marginBottom:13 }}>
      <div style={{ display:'flex',alignItems:'center',gap:5,marginBottom:5 }}>
        <label style={{ fontSize:12,fontWeight:600,color:T2 }}>{label}</label>
        {tooltip && <div className="tooltip-wrap"><Info size={11} color="#94A3B8" /><div className="tip">{tooltip}</div></div>}
      </div>
      <select value={value} onChange={e=>onChange(e.target.value)} style={{ width:'100%',
        padding:'9px 12px',border:`1.5px solid ${BD}`,borderRadius:8,fontSize:14,
        color:T1,background:'#fff',fontFamily:"'Outfit',sans-serif",cursor:'pointer' }}>
        {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// STOCK DROPDOWN (searchable)
// ─────────────────────────────────────────────────────────
function StockDropdown({ value, onChange, placeholder, stockList }) {
  const [open, setOpen]   = useState(false);
  const [q, setQ]         = useState('');
  const ref               = useRef(null);

  const sourceList = stockList || INDIAN_STOCKS;
  const filtered = sourceList.filter(s =>
    shortSym(s.symbol).includes(q.toUpperCase()) ||
    s.name.toLowerCase().includes(q.toLowerCase())
  ).slice(0, 100);

  useEffect(() => {
    const fn = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const sel = value ? sourceList.find(s => s.symbol === value) || INDIAN_STOCKS.find(s => s.symbol === value) : null;
  return (
    <div ref={ref} style={{ position:'relative' }}>
      <div onClick={() => setOpen(o=>!o)} style={{ display:'flex',alignItems:'center',
        justifyContent:'space-between',padding:'9px 12px',
        border:`1.5px solid ${open?SB:BD}`,borderRadius:8,cursor:'pointer',background:'#fff',gap:8 }}>
        {sel ? (
          <div>
            <span style={{ fontWeight:700,fontSize:13,color:T1 }}>{shortSym(sel.symbol)}</span>
            <span style={{ fontSize:11,color:T2,marginLeft:6 }}>{sel.name.slice(0,24)}</span>
          </div>
        ) : <span style={{ fontSize:13,color:T2 }}>{placeholder||'Select stock…'}</span>}
        <ChevronDown size={13} color={T2} style={{ transform:open?'rotate(180deg)':'none',transition:'.2s' }} />
      </div>
      {open && (
        <div style={{ position:'absolute',top:'100%',left:0,right:0,zIndex:999,
          background:'#fff',border:`1.5px solid ${BD}`,borderRadius:8,marginTop:3,
          boxShadow:'0 8px 24px rgba(0,0,0,.12)',overflow:'hidden' }}>
          <div style={{ padding:'7px 8px',borderBottom:`1px solid ${BD}` }}>
            <div style={{ display:'flex',alignItems:'center',gap:5,background:'#F8FAFC',borderRadius:6,padding:'5px 8px' }}>
              <Search size={12} color={T2} />
              <input autoFocus value={q} onChange={e=>setQ(e.target.value)}
                placeholder="Type to search…"
                style={{ border:'none',background:'none',fontSize:12,color:T1,width:'100%' }} />
            </div>
          </div>
          <div style={{ maxHeight:200,overflowY:'auto' }}>
            {value && (
              <div onClick={()=>{onChange('');setOpen(false);setQ('');}}
                style={{ padding:'7px 12px',fontSize:12,color:R,cursor:'pointer',borderBottom:`1px solid ${BD}` }}>
                ✕ Clear
              </div>
            )}
            {filtered.map(s=>(
              <div key={s.symbol} onClick={()=>{onChange(s.symbol);setOpen(false);setQ('');}}
                style={{ padding:'8px 12px',cursor:'pointer',background:value===s.symbol?'#EEF2FF':'transparent',
                  borderBottom:`1px solid #F8FAFC` }}
                onMouseEnter={e=>e.currentTarget.style.background=value===s.symbol?'#EEF2FF':'#F8FAFC'}
                onMouseLeave={e=>e.currentTarget.style.background=value===s.symbol?'#EEF2FF':'transparent'}>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                  <div>
                    <span style={{ fontWeight:700,fontSize:13,color:T1 }}>{shortSym(s.symbol)}</span>
                    <span style={{ fontSize:11,color:T2,marginLeft:5 }}>{s.name.slice(0,26)}</span>
                  </div>
                  <span className="mono" style={{ fontSize:12,color:T1 }}>₹{s.price.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// CANDLESTICK CHART (Canvas-based, receives live candles)
// ─────────────────────────────────────────────────────────
function LiveCandleChart({ candles, orbHigh, orbLow, tradeInfo, symbol }) {
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);
  const dataRef   = useRef({ candles, orbHigh, orbLow, tradeInfo });

  // Keep ref in sync without re-running draw
  useEffect(() => { dataRef.current = { candles, orbHigh, orbLow, tradeInfo }; }, [candles, orbHigh, orbLow, tradeInfo]);

  const draw = useCallback(() => {
    const { candles, orbHigh, orbLow, tradeInfo } = dataRef.current;
    if (!candles?.length || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    canvas.width  = rect.width  * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;
    const pad = { top:36, right:82, bottom:52, left:8 };
    const cW = W - pad.left - pad.right, cH = H - pad.top - pad.bottom;

    ctx.fillStyle = '#fff'; ctx.fillRect(0,0,W,H);

    const prices = candles.flatMap(d=>[d.high,d.low]);
    const minP = Math.min(...prices)*0.998, maxP = Math.max(...prices)*1.002;
    const pRange = maxP - minP;
    const cw = Math.max(2, (cW / candles.length) * 0.72);
    const xOf = i => pad.left + (i+0.5)*(cW/candles.length);
    const yOf = p => pad.top  + cH - ((p-minP)/pRange)*cH;

    // Grid
    for (let g=0;g<=6;g++) {
      const yp = pad.top+(cH/6)*g;
      ctx.strokeStyle='#F1F5F9'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(pad.left,yp); ctx.lineTo(W-pad.right,yp); ctx.stroke();
      const price = maxP-(pRange/6)*g;
      ctx.fillStyle='#94A3B8'; ctx.font='11px JetBrains Mono,monospace'; ctx.textAlign='left';
      ctx.fillText(price.toFixed(2), W-pad.right+5, yp+4);
    }

    // ORB lines
    [orbHigh, orbLow].forEach((level, isLow) => {
      if (!level) return;
      const color = isLow ? R : G;
      const label = isLow ? `ORB L ${level.toFixed(2)}` : `ORB H ${level.toFixed(2)}`;
      const yp = yOf(level);
      ctx.save(); ctx.strokeStyle=color; ctx.lineWidth=1.5; ctx.setLineDash([7,4]);
      ctx.beginPath(); ctx.moveTo(pad.left,yp); ctx.lineTo(W-pad.right,yp); ctx.stroke(); ctx.restore();
      ctx.fillStyle=color; ctx.font='bold 10px JetBrains Mono,monospace'; ctx.textAlign='right';
      ctx.fillText(label, W-pad.right-4, isLow ? yp+13 : yp-4);
    });

    // Trade levels
    if (tradeInfo?.entry) {
      ['entry','sl','target'].forEach(key => {
        const colors = { entry:'#6366F1', sl:R, target:G };
        const yp = yOf(tradeInfo[key]);
        ctx.save(); ctx.strokeStyle=colors[key]; ctx.lineWidth=1.5; ctx.setLineDash([4,3]);
        ctx.beginPath(); ctx.moveTo(pad.left,yp); ctx.lineTo(W-pad.right,yp); ctx.stroke(); ctx.restore();
        ctx.fillStyle=colors[key]; ctx.font='bold 10px JetBrains Mono,monospace'; ctx.textAlign='right';
        ctx.fillText(`${key.toUpperCase()} ${tradeInfo[key].toFixed(2)}`, W-pad.right-4, key==='sl'?yp+13:yp-4);
      });
    }

    // Candles
    const volMax = Math.max(...candles.map(d=>d.volume||1));
    const volH = cH*0.1;
    candles.forEach((c,i)=>{
      const cx=xOf(i), isG=c.close>=c.open;
      const color=isG?G:R, fill=isG?'#D1FAE5':'#FEE2E2';
      const bT=yOf(Math.max(c.open,c.close)), bB=yOf(Math.min(c.open,c.close));
      const bH=Math.max(1.5, bB-bT);
      ctx.strokeStyle=color; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(cx,yOf(c.high)); ctx.lineTo(cx,yOf(c.low)); ctx.stroke();
      ctx.fillStyle=fill; ctx.strokeStyle=color;
      ctx.fillRect(cx-cw/2,bT,cw,bH); ctx.strokeRect(cx-cw/2,bT,cw,bH);
      // Volume
      if (c.volume) {
        const vh=(c.volume/volMax)*volH;
        ctx.fillStyle=isG?'rgba(16,185,129,.22)':'rgba(239,68,68,.22)';
        ctx.fillRect(cx-cw/2, pad.top+cH-vh, cw, vh);
      }
    });

    // Time labels
    const step = Math.max(1,Math.floor(candles.length/8));
    ctx.fillStyle='#94A3B8'; ctx.font='10px JetBrains Mono,monospace'; ctx.textAlign='center';
    candles.forEach((c,i)=>{
      if(i%step===0) {
        const t = c.time ? new Date(c.time) : null;
        const lbl = t ? t.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}) : '';
        ctx.fillText(lbl, xOf(i), pad.top+cH+20);
      }
    });
    ctx.strokeStyle=BD; ctx.lineWidth=1; ctx.setLineDash([]);
    ctx.strokeRect(pad.left,pad.top,cW,cH);
    ctx.restore();
  }, []);

  // Start RAF loop
  useEffect(() => {
    const loop = () => {
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  return <canvas ref={canvasRef} style={{ width:'100%',height:'100%',display:'block' }} />;
}

// ─────────────────────────────────────────────────────────
// STOCK CARD (Dashboard)
// ─────────────────────────────────────────────────────────
function StockCard({ symbol, tick, orb, signal, toggleOn, onToggle, masterOn, rrCfg }) {
  const si    = INDIAN_STOCKS.find(s => s.symbol === symbol);
  const ltp   = tick?.ltp || si?.price || 0;
  const chg   = tick?.chg || 0;
  const chgP  = tick?.chgPct || 0;
  const status = signal ? signal.direction : 'WAITING';
  const pnl   = signal ? (
    signal.direction === 'BUY' ? (ltp - signal.entry)*signal.qty : (signal.entry - ltp)*signal.qty
  ) : 0;
  const isActive = toggleOn && masterOn;
  const tradeActive = !!signal;

  // Calculate qty from effective capital
  const ec = (rrCfg?.capital||50000) * (rrCfg?.leverage||5);
  const riskAmt = ec * (rrCfg?.riskPct||2) / 100;
  const slPts = orb?.locked ? Math.abs((orb.high - orb.low)) : ltp * 0.02;
  const calcQty = slPts > 0 ? Math.max(1, Math.floor(riskAmt / slPts)) : 1;

  return (
    <div className={tradeActive ? (signal.direction==='BUY'?'trade-blink':'sell-blink') : ''}
      style={{ background:'#fff',
        border:`1.5px solid ${tradeActive?(signal.direction==='BUY'?G:R):isActive?SB+'40':BD}`,
        borderRadius:12,padding:'13px 14px',position:'relative',transition:'all .2s',
        boxShadow:isActive?'0 2px 12px rgba(30,64,175,.07)':'none' }}>
      {/* Header */}
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8 }}>
        <div>
          <div style={{ fontWeight:700,fontSize:14,color:T1 }}>{shortSym(symbol)}</div>
          <div style={{ fontSize:10,color:T2,marginTop:1 }}>{si?.name?.slice(0,18)}</div>
        </div>
        <div style={{ display:'flex',alignItems:'center',gap:7 }}>
          <span style={{ padding:'2px 8px',borderRadius:20,fontSize:10,fontWeight:700,
            background: status==='BUY'?G+'20':status==='SELL'?R+'20':'#F1F5F9',
            color: status==='BUY'?G:status==='SELL'?R:'#94A3B8' }}>{status}</span>
          <Toggle on={toggleOn} onToggle={onToggle} size="sm" />
        </div>
      </div>

      {/* Price */}
      <div style={{ display:'flex',justifyContent:'space-between',marginBottom:8 }}>
        <div>
          <div style={{ fontSize:10,color:T2 }}>LTP</div>
          <div className="mono" style={{ fontSize:17,fontWeight:700,color:T1 }}>₹{ltp.toFixed(2)}</div>
          <div className="mono" style={{ fontSize:11,color:chg>=0?G:R }}>
            {chg>=0?'+':''}{chg.toFixed(2)} ({chgP.toFixed(2)}%)
          </div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:10,color:T2 }}>Live P&L</div>
          <div className="mono" style={{ fontSize:17,fontWeight:700,color:pnl>=0?G:R }}>
            {pnl>=0?'+':''}{fmtINR(pnl)}
          </div>
        </div>
      </div>

      {/* ORB levels */}
      {orb?.locked && (
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:5,marginBottom:8 }}>
          <div style={{ background:G+'12',borderRadius:6,padding:'4px 8px' }}>
            <div style={{ fontSize:9,color:G }}>ORB HIGH</div>
            <div className="mono" style={{ fontSize:12,fontWeight:700,color:G }}>₹{orb.high?.toFixed(2)}</div>
          </div>
          <div style={{ background:R+'12',borderRadius:6,padding:'4px 8px' }}>
            <div style={{ fontSize:9,color:R }}>ORB LOW</div>
            <div className="mono" style={{ fontSize:12,fontWeight:700,color:R }}>₹{orb.low?.toFixed(2)}</div>
          </div>
        </div>
      )}

      {/* Signal levels */}
      {signal && (
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:4 }}>
          {[{l:'Entry',v:signal.entry,c:'#6366F1'},{l:'SL',v:signal.sl,c:R},{l:'Tgt',v:signal.target,c:G}].map(x=>(
            <div key={x.l} style={{ background:x.c+'12',borderRadius:5,padding:'3px 6px',textAlign:'center' }}>
              <div style={{ fontSize:9,color:x.c }}>{x.l}</div>
              <div className="mono" style={{ fontSize:11,fontWeight:700,color:x.c }}>₹{x.v?.toFixed(2)||'—'}</div>
            </div>
          ))}
        </div>
      )}

      {/* Qty display */}
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',
        marginTop:6,paddingTop:5,borderTop:`1px solid ${BD}` }}>
        <span style={{ fontSize:9,color:T2 }}>CALC QTY</span>
        <span className="mono" style={{ fontSize:11,fontWeight:700,color:SB }}>{signal?.qty||calcQty} shares</span>
        <span style={{ fontSize:9,color:T2 }}>EC: {fmtINR(ec)}</span>
      </div>

      {!isActive && (
        <div style={{ position:'absolute',inset:0,borderRadius:12,background:'rgba(255,255,255,.55)',
          display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(1px)' }}>
          <span style={{ fontSize:11,color:T2,fontWeight:600 }}>Disabled</span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// ALERT ITEM
// ─────────────────────────────────────────────────────────
function AlertItem({ alert }) {
  const isBuy = alert.type === 'BUY';
  const isBlock = ['SL_HIT','BLOCKED_RISK','ORDER_FAILED'].includes(alert.type);
  const color = isBuy ? G : isBlock ? R : alert.type==='TARGET_HIT' ? G : '#6366F1';
  return (
    <div style={{ display:'flex',alignItems:'flex-start',gap:9,padding:'8px 12px',
      borderRadius:8,background:color+'08',border:`1px solid ${color}20`,marginBottom:6 }}>
      <div style={{ width:26,height:26,borderRadius:'50%',background:color+'20',
        display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:1 }}>
        {isBuy?<ArrowUpRight size={13} color={color}/>:<ArrowDownRight size={13} color={color}/>}
      </div>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:12,fontWeight:600,color:T1 }}>
          <span style={{ color }}>[{alert.type}]</span> {shortSym(alert.symbol||'')}
          {alert.price ? ` @ ₹${typeof alert.price==='number'?alert.price.toFixed(2):alert.price}` : ''}
        </div>
        <div style={{ fontSize:11,color:T2,marginTop:1 }}>{alert.msg}</div>
        <div style={{ fontSize:10,color:'#94A3B8',marginTop:1 }}>
          {alert.ts ? new Date(alert.ts).toLocaleTimeString('en-IN') : ''}
        </div>
      </div>
      {alert.status && <Badge text={alert.status}
        color={alert.status==='EXECUTED'?G:alert.status==='PENDING'?W:R} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// SIDEBAR
// ─────────────────────────────────────────────────────────
const NAV = [
  { id:'dashboard', label:'Dashboard',        icon:LayoutDashboard },
  { id:'api',       label:'API Credentials',  icon:Key },
  { id:'chart',     label:'Live Chart',        icon:Monitor },
  { id:'stocks',    label:'Stock Selection',   icon:List },
  { id:'test',      label:'Test Signal',       icon:Zap },
  { id:'rr',        label:'Risk & Reward',     icon:Calculator },
  { id:'syntax',    label:'Syntax Generator',  icon:Code2 },
];

function Sidebar({ active, setActive, socketOk, authOk, masterOn }) {
  return (
    <div style={{ width:210,background:SBg,borderRight:`1.5px solid ${BD}`,
      display:'flex',flexDirection:'column',height:'100%',flexShrink:0 }}>
      <div style={{ padding:'18px 14px 14px',borderBottom:`1.5px solid ${BD}` }}>
        <div style={{ fontSize:13,fontWeight:900,color:SB,letterSpacing:.5 }}>ALGO_BOT</div>
        <div style={{ fontSize:10,fontWeight:800,color:SB+'90',letterSpacing:1 }}>ORB_10_STOCK</div>
        <div style={{ marginTop:8,display:'flex',flexDirection:'column',gap:4 }}>
          {[
            { dot:socketOk, label: socketOk?'Server Connected':'Server Offline' },
            { dot:authOk,   label: authOk  ?'Fyers Auth OK'  :'Fyers: Not Auth' },
          ].map((item,i)=>(
            <div key={i} style={{ display:'flex',alignItems:'center',gap:5 }}>
              <div style={{ width:6,height:6,borderRadius:'50%',background:item.dot?G:'#CBD5E1',
                boxShadow:item.dot?`0 0 5px ${G}`:'none' }} className={item.dot?'live-dot':''} />
              <span style={{ fontSize:10,color:item.dot?G:T2,fontWeight:600 }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
      <nav style={{ flex:1,padding:'8px 6px',overflowY:'auto' }}>
        {NAV.map(item => {
          const Icon=item.icon, isActive=active===item.id;
          return (
            <button key={item.id} onClick={()=>setActive(item.id)} style={{
              width:'100%',display:'flex',alignItems:'center',gap:9,padding:'9px 10px',
              borderRadius:8,marginBottom:2,border:'none',cursor:'pointer',textAlign:'left',
              background:isActive?'#E0E7FF':'transparent',
              color:isActive?SB:T2,fontWeight:isActive?700:500,fontSize:13,transition:'.15s',
              fontFamily:"'Outfit',sans-serif"
            }}
            onMouseEnter={e=>{if(!isActive)e.currentTarget.style.background='#E8EDF5';}}
            onMouseLeave={e=>{if(!isActive)e.currentTarget.style.background='transparent';}}>
              <Icon size={15} style={{ flexShrink:0 }} />
              <span style={{ lineHeight:1.2 }}>{item.label}</span>
              {item.id==='test' && (
                <span style={{ marginLeft:'auto',fontSize:8,fontWeight:700,padding:'2px 5px',
                  borderRadius:3,background:'#8B5CF6',color:'#fff' }}>LIVE</span>
              )}
              {item.id==='dashboard' && masterOn && (
                <span style={{ marginLeft:'auto',width:6,height:6,borderRadius:'50%',background:G,flexShrink:0 }} className="live-dot" />
              )}
            </button>
          );
        })}
      </nav>
      <div style={{ padding:'10px 12px',borderTop:`1px solid ${BD}`,fontSize:10,color:T2 }}>
        <div className="mono">09:15 — 15:30 IST</div>
        <div style={{ color:G,fontWeight:600,marginTop:2 }}>NSE · Fyers API v2</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// VIEWS
// ─────────────────────────────────────────────────────────
function DashboardView({ masterOn, setMasterOn, selectedSymbols, ticks, orbLevels,
  activeSignals, stockToggles, onToggleStock, alerts, riskStatus, rrConfig }) {

  const totalPnl = Object.entries(activeSignals).reduce((acc,[sym,sig])=>{
    const ltp = ticks[sym]?.ltp || sig.entry;
    const p = sig.direction==='BUY' ? (ltp-sig.entry)*sig.qty : (sig.entry-ltp)*sig.qty;
    return acc+p;
  },0);

  const handleMaster = async () => {
    const next = !masterOn;
    setMasterOn(next);
    try { await api.post('/api/control/master', { enabled: next }); } catch(e) {}
  };

  return (
    <div style={{ padding:'18px 22px',height:'100%',overflowY:'auto' }}>
      {/* Master Toggle */}
      <div style={{ background:masterOn?'#EEF2FF':'#F8FAFC',border:`2px solid ${masterOn?SB:BD}`,
        borderRadius:13,padding:'14px 18px',marginBottom:18,
        display:'flex',alignItems:'center',justifyContent:'space-between',transition:'all .3s' }}>
        <div style={{ display:'flex',alignItems:'center',gap:10 }}>
          <div style={{ width:9,height:9,borderRadius:'50%',background:masterOn?G:'#CBD5E1',
            boxShadow:masterOn?`0 0 8px ${G}`:'none' }} className={masterOn?'live-dot':''} />
          <div>
            <div style={{ fontWeight:800,fontSize:15,color:masterOn?SB:T2 }}>MASTER TRADE CONTROL</div>
            <div style={{ fontSize:11,color:T2 }}>
              {masterOn?'✓ Live signals → Fyers API order execution':'Signals paused — no orders will be placed'}
            </div>
          </div>
        </div>
        <div style={{ display:'flex',alignItems:'center',gap:14 }}>
          <span style={{ padding:'4px 13px',borderRadius:20,fontWeight:700,fontSize:12,
            background:masterOn?G+'20':'#F1F5F9',color:masterOn?G:T2 }}>
            {masterOn?'● LIVE':'○ OFF'}</span>
          <Toggle on={masterOn} onToggle={handleMaster} size="lg" label />
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:18 }}>
        <StatCard label="Effective Capital" value={fmtINR(riskStatus?.computed?.effectiveCapital||50000)}
          sub="After Leverage" icon={Shield} color={SB} />
        <StatCard label="Live P&L" value={(totalPnl>=0?'+':'')+fmtINR(totalPnl)}
          sub={totalPnl>=0?'▲ Profitable':'▼ In loss'} icon={Activity} color={totalPnl>=0?G:R} />
        <StatCard label="Active Trades" value={`${Object.keys(activeSignals).length}/10`}
          sub={`${selectedSymbols.filter(s=>stockToggles[s]!==false).length} enabled`} icon={BarChart2} color="#8B5CF6" />
        <StatCard label="Risk / Trade" value={fmtINR(riskStatus?.computed?.riskPerTrade||1000)}
          sub={`Daily limit: ${fmtINR(riskStatus?.computed?.dailyLossLimit||3000)}`} icon={Target} color={W} />
      </div>

      {/* Risk halt warning */}
      {riskStatus?.daily?.tradingHalted && (
        <div style={{ background:'#FFF1F2',border:`1px solid #FECDD3`,borderRadius:10,
          padding:'10px 14px',marginBottom:16,display:'flex',gap:8,alignItems:'center' }}>
          <AlertTriangle size={16} color={R} />
          <span style={{ fontSize:13,fontWeight:600,color:R }}>
            🛑 Trading HALTED: {riskStatus.daily.haltReason}
          </span>
          <button onClick={()=>api.post('/api/risk/resume',{})} style={{
            marginLeft:'auto',padding:'4px 12px',borderRadius:7,border:`1px solid ${R}`,
            background:'#fff',color:R,fontSize:12,fontWeight:600,cursor:'pointer' }}>
            Resume
          </button>
        </div>
      )}

      {/* Stock Cards */}
      <div style={{ marginBottom:16 }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10 }}>
          <h3 style={{ fontWeight:700,fontSize:14,color:T1 }}>
            📊 ORB Stock Monitor
            <span style={{ color:T2,fontWeight:400,fontSize:12,marginLeft:8 }}>(10 slots · live)</span>
          </h3>
          <div style={{ display:'flex',gap:7 }}>
            {['ON','OFF'].map(v=>(
              <button key={v} onClick={()=>selectedSymbols.forEach(s=>onToggleStock(s,v==='ON'))}
                style={{ padding:'4px 11px',borderRadius:7,border:`1px solid ${v==='ON'?G:R}`,
                  background:v==='ON'?'#F0FDF4':'#FFF1F2',color:v==='ON'?G:R,
                  fontSize:11,fontWeight:600,cursor:'pointer' }}>All {v}</button>
            ))}
          </div>
        </div>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:9 }}>
          {Array.from({length:10},(_,i)=>{
            const sym = selectedSymbols[i];
            return sym ? (
              <StockCard key={sym} symbol={sym} tick={ticks[sym]} orb={orbLevels[sym]}
                signal={activeSignals[sym]} toggleOn={stockToggles[sym]!==false}
                onToggle={()=>onToggleStock(sym, stockToggles[sym]===false)} masterOn={masterOn}
                rrCfg={rrConfig || riskStatus?.config} />
            ) : (
              <div key={i} style={{ border:`2px dashed ${BD}`,borderRadius:12,padding:18,
                display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                gap:6,color:T2,minHeight:150 }}>
                <Plus size={18} color="#CBD5E1" />
                <span style={{ fontSize:11 }}>Slot {i+1}</span>
                <span style={{ fontSize:10 }}>Add via Stock List</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Alerts */}
      <SCard title="Alert Feed" icon={Bell}
        action={<span style={{ fontSize:12,color:T2 }}>{alerts.length} today</span>}>
        {alerts.length===0
          ? <div style={{ textAlign:'center',color:T2,fontSize:13,padding:'16px 0' }}>No alerts yet…</div>
          : <div style={{ maxHeight:220,overflowY:'auto' }}>{alerts.slice().reverse().map((a,i)=><AlertItem key={i} alert={a}/>)}</div>
        }
      </SCard>
    </div>
  );
}

// ── API Credentials View ──────────────────────────────────
function ApiCredView({ authStatus }) {
  const [appId, setAppId]     = useState(import.meta.env.VITE_APP_ID || '');
  const [secret, setSecret]   = useState('');
  const [token, setToken]     = useState('');
  const [showS, setShowS]     = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]         = useState(null);

  const handleGetUrl = async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/auth/url');
      window.open(r.url, '_blank');
      setMsg({ type:'info', text:'Fyers login opened in new tab. After login, token auto-saves.' });
    } catch(e) { setMsg({ type:'error', text: e.message }); }
    setLoading(false);
  };

  const handleManualToken = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const r = await api.post('/api/auth/token', { token });
      setMsg({ type:'success', text: r.message });
    } catch(e) { setMsg({ type:'error', text: e.message }); }
    setLoading(false);
  };

  return (
    <div style={{ padding:'22px',maxWidth:640,margin:'0 auto' }}>
      <h2 style={{ fontSize:19,fontWeight:800,color:SB,marginBottom:4 }}>API Credentials</h2>
      <p style={{ fontSize:13,color:T2,marginBottom:18 }}>Connect Fyers broker account for live data & order execution</p>

      <SCard title="Connection Status" icon={Wifi}>
        <div style={{ display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderRadius:9,
          background:authStatus?.isAuthenticated?'#F0FDF4':'#FFF7ED',
          border:`1px solid ${authStatus?.isAuthenticated?'#BBF7D0':'#FED7AA'}` }}>
          {authStatus?.isAuthenticated
            ? <CheckCircle size={16} color={G} />
            : <AlertCircle size={16} color={W} />}
          <div>
            <div style={{ fontSize:13,fontWeight:700,color:authStatus?.isAuthenticated?G:W }}>
              {authStatus?.isAuthenticated ? '✓ Fyers API Connected' : 'Not Connected'}
            </div>
            {authStatus?.profile && (
              <div style={{ fontSize:11,color:T2 }}>
                {authStatus.profile.name} · {authStatus.profile.email}
              </div>
            )}
            {authStatus?.expiresAt && (
              <div style={{ fontSize:10,color:T2 }}>
                Token expires: {new Date(authStatus.expiresAt).toLocaleTimeString('en-IN')}
              </div>
            )}
          </div>
        </div>
      </SCard>

      <SCard title="Step 1 — Login via Fyers OAuth" icon={Key}>
        <p style={{ fontSize:12,color:T2,marginBottom:14 }}>
          Clicking the button below will open the Fyers login page. After you log in and authorise,
          you'll be redirected back and the access token will be automatically saved.
        </p>
        <button onClick={handleGetUrl} disabled={loading} style={{
          width:'100%',padding:'11px',borderRadius:9,fontWeight:700,fontSize:14,
          border:'none',cursor:'pointer',background:SB,color:'#fff',
          display:'flex',alignItems:'center',justifyContent:'center',gap:8 }}>
          {loading?<RefreshCw size={15} style={{ animation:'spin 1s linear infinite' }} />:<Wifi size={15}/>}
          Open Fyers Login Page
        </button>
      </SCard>

      <SCard title="Step 2 — Or Paste Access Token Manually" icon={Edit3}>
        <p style={{ fontSize:12,color:T2,marginBottom:10 }}>
          If you already have a valid Fyers access token (from today), paste it here.
        </p>
        <div style={{ display:'flex',gap:8 }}>
          <div style={{ flex:1,display:'flex',alignItems:'center',border:`1.5px solid ${BD}`,borderRadius:8,overflow:'hidden' }}>
            <input type={showS?'text':'password'} value={token} onChange={e=>setToken(e.target.value)}
              placeholder="Paste access token here…"
              style={{ flex:1,padding:'9px 12px',border:'none',background:'transparent',
                fontSize:13,fontFamily:'JetBrains Mono,monospace',color:T1 }} />
            <button onClick={()=>setShowS(p=>!p)} style={{ padding:'0 10px',border:'none',background:'transparent',cursor:'pointer' }}>
              {showS?<EyeOff size={14} color={T2}/>:<Eye size={14} color={T2}/>}
            </button>
          </div>
          <button onClick={handleManualToken} disabled={!token||loading} style={{
            padding:'9px 16px',borderRadius:9,border:'none',background:G,color:'#fff',
            fontWeight:700,fontSize:13,cursor:'pointer' }}>Save</button>
        </div>
      </SCard>

      {msg && (
        <div style={{ background:msg.type==='success'?'#F0FDF4':msg.type==='error'?'#FFF1F2':'#EEF2FF',
          border:`1px solid ${msg.type==='success'?'#BBF7D0':msg.type==='error'?'#FECDD3':'#C7D2FE'}`,
          borderRadius:9,padding:'10px 14px',fontSize:13,
          color:msg.type==='success'?G:msg.type==='error'?R:SB }}>
          {msg.text}
        </div>
      )}
    </div>
  );
}

// ── Live Chart View ───────────────────────────────────────
function LiveChartView({ selectedSymbols, ticks, orbLevels, activeSignals, authStatus }) {
  const [chartSym,    setChartSym]    = useState(selectedSymbols[0] || 'NSE:RELIANCE-EQ');
  const [tf,          setTf]          = useState('5');
  const [candles,     setCandles]     = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [livePrice,   setLivePrice]   = useState(null);

  // Map timeframe label to Fyers resolution
  const TF_MAP = { '1':'1','3':'3','5':'5','15':'15','30':'30','60':'60','D':'D','W':'W' };
  const TF_LABELS = [
    {k:'1',l:'1M'},{k:'3',l:'3M'},{k:'5',l:'5M'},{k:'15',l:'15M'},
    {k:'30',l:'30M'},{k:'60',l:'1H'},{k:'D',l:'1D'},{k:'W',l:'1W'}
  ];

  // Fetch history from Fyers API
  const loadChart = async () => {
    if (!chartSym) return;
    setLoading(true);
    try {
      // First try Fyers historical API
      if (authStatus?.isAuthenticated) {
        const days = ['D','W'].includes(tf) ? 365 : tf==='60' ? 30 : 10;
        const r = await api.get(
          `/api/stocks/history?symbol=${encodeURIComponent(chartSym)}&resolution=${tf}&days=${days}`
        );
        if (r.candles?.length > 0) {
          setCandles(r.candles);
          setLoading(false);
          return;
        }
      }
      // Fallback: intraday candles from orbEngine
      const r2 = await api.get(`/api/stocks/candles/${encodeURIComponent(chartSym)}?tf=5M`);
      setCandles(r2.candles || []);
    } catch(e) {
      setCandles([]);
    }
    setLoading(false);
  };

  useEffect(()=>{ loadChart(); },[chartSym, tf]);

  // Live price ticker — update every second from ticks or REST quote
  useEffect(()=>{
    const tick = ticks[chartSym];
    if (tick?.ltp) { setLivePrice(tick); return; }
    // Poll REST quote every 3s when market open
    const t = setInterval(async () => {
      try {
        const r = await api.get(`/api/stocks/quote/${encodeURIComponent(chartSym)}`);
        if (r.quote?.ltp) setLivePrice(r.quote);
      } catch(_) {}
    }, 3000);
    return () => clearInterval(t);
  }, [chartSym, ticks]);

  // Update last candle with live tick
  useEffect(()=>{
    const tick = ticks[chartSym];
    if (!tick?.ltp || candles.length === 0) return;
    setCandles(prev => {
      const updated = [...prev];
      const last = { ...updated[updated.length-1] };
      last.close  = tick.ltp;
      last.high   = Math.max(last.high, tick.ltp);
      last.low    = Math.min(last.low, tick.ltp);
      updated[updated.length-1] = last;
      return updated;
    });
  }, [ticks[chartSym]?.ltp]);

  const orb    = orbLevels[chartSym] || null;
  const signal = activeSignals[chartSym] || null;
  const tick   = ticks[chartSym] || null;

  return (
    <div style={{ padding:'18px 22px',height:'100%',overflowY:'auto' }}>
      <h2 style={{ fontSize:19,fontWeight:800,color:SB,marginBottom:14 }}>Live Chart</h2>

      <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:14,
        background:'#F8FAFC',border:`1px solid ${BD}`,borderRadius:9,padding:'9px 12px',flexWrap:'wrap' }}>
        <select value={chartSym} onChange={e=>setChartSym(e.target.value)}
          style={{ padding:'7px 10px',border:`1.5px solid ${BD}`,borderRadius:7,fontSize:13,
            fontWeight:600,color:T1,background:'#fff',cursor:'pointer',minWidth:220 }}>
          {(selectedSymbols.length>0?selectedSymbols:INDIAN_STOCKS.slice(0,10).map(s=>s.symbol))
            .map(sym=>(
              <option key={sym} value={sym}>{shortSym(sym)} — {INDIAN_STOCKS.find(s=>s.symbol===sym)?.name?.slice(0,28)}</option>
            ))}
        </select>
        <div style={{ display:'flex',gap:3,flexWrap:'wrap' }}>
          {TF_LABELS.map(({k,l})=>(
            <button key={k} onClick={()=>setTf(k)} style={{
              padding:'6px 10px',borderRadius:6,border:`1.5px solid ${k===tf?SB:BD}`,
              background:k===tf?SB:'#fff',color:k===tf?'#fff':T2,
              fontSize:11,fontWeight:600,cursor:'pointer',transition:'.15s' }}>{l}</button>
          ))}
        </div>
        <div style={{ marginLeft:'auto',display:'flex',alignItems:'center',gap:8 }}>
          <div style={{ width:7,height:7,borderRadius:'50%',background:G }} className="live-dot" />
          <span className="mono" style={{ fontSize:14,fontWeight:700,color:T1 }}>
            ₹{(livePrice?.ltp||ticks[chartSym]?.ltp||INDIAN_STOCKS.find(s=>s.symbol===chartSym)?.price||0).toFixed(2)}
          </span>
          <span className="mono" style={{ fontSize:12,color:(livePrice?.chg||0)>=0?G:R }}>
            {(livePrice?.chg||0)>=0?'+':''}{(livePrice?.chg||0).toFixed(2)}
          </span>
          <button onClick={loadChart} style={{ padding:'4px 8px',borderRadius:5,border:`1px solid ${BD}`,
            background:'#fff',fontSize:11,cursor:'pointer',color:T2 }}>↺ Reload</button>
        </div>
      </div>

      {/* ORB Info */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:9,marginBottom:14 }}>
        {[
          { l:'ORB High',   v: orb?.high?.toFixed(2)||'—',     c:G           },
          { l:'ORB Low',    v: orb?.low?.toFixed(2)||'—',      c:R           },
          { l:'Entry',      v: signal?.entry?.toFixed(2)||'—', c:'#6366F1'   },
          { l:'Status',     v: orb?.locked?'LOCKED':'WAITING', c:orb?.locked?G:T2 },
        ].map(item=>(
          <div key={item.l} style={{ background:item.c+'10',border:`1px solid ${item.c}25`,
            borderRadius:9,padding:'9px 13px' }}>
            <div style={{ fontSize:10,color:item.c,fontWeight:600,marginBottom:3 }}>{item.l}</div>
            <div className="mono" style={{ fontSize:17,fontWeight:700,color:T1 }}>
              {item.v !== '—' && item.v !== 'LOCKED' && item.v !== 'WAITING' ? `₹${item.v}` : item.v}
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div style={{ border:`1.5px solid ${BD}`,borderRadius:12,overflow:'hidden',height:400,marginBottom:14 }}>
        <div style={{ padding:'9px 14px',borderBottom:`1px solid ${BD}`,background:'#FAFBFF',
          display:'flex',justifyContent:'space-between',alignItems:'center' }}>
          <span style={{ fontWeight:700,fontSize:13,color:T1 }}>{shortSym(chartSym)} · {tf} · NSE</span>
          {loading && <RefreshCw size={14} color={T2} style={{ animation:'spin 1s linear infinite' }} />}
        </div>
        <div style={{ height:'calc(100% - 42px)' }}>
          {candles.length>0
            ? <LiveCandleChart candles={candles} orbHigh={orb?.high} orbLow={orb?.low}
                tradeInfo={signal} symbol={chartSym} />
            : <div style={{ display:'flex',alignItems:'center',justifyContent:'center',
                height:'100%',color:T2,fontSize:13 }}>
                {loading?'Loading chart data…':'No candle data yet. Market may not be open.'}
              </div>
          }
        </div>
      </div>
    </div>
  );
}

// ── Stock Selection View ──────────────────────────────────
function StockListView({ selectedSymbols, setSelectedSymbols, onSaveToServer }) {
  const [slots,     setSlots]     = useState(() => {
    const s = Array(10).fill('');
    selectedSymbols.forEach((sym,i) => { s[i]=sym||''; });
    return s;
  });
  const [allStocks, setAllStocks] = useState(INDIAN_STOCKS);
  const [loadingStocks, setLoadingStocks] = useState(false);

  // Load all NSE stocks from Fyers instruments
  useEffect(() => {
    const load = async () => {
      setLoadingStocks(true);
      try {
        const r = await api.get('/api/instruments');
        if (r.stocks?.length > 0) {
          // Merge with INDIAN_STOCKS (keep prices from fallback)
          const merged = r.stocks.map(s => ({
            symbol: s.symbol,
            name:   s.name,
            price:  INDIAN_STOCKS.find(i=>i.symbol===s.symbol)?.price || 0
          }));
          setAllStocks(merged);
        }
      } catch(e) {}
      setLoadingStocks(false);
    };
    load();
  }, []);

  const handleSave = async () => {
    const syms = slots.filter(Boolean);
    setSelectedSymbols(syms);
    await onSaveToServer(syms, Object.fromEntries(syms.map(s=>[s,true])));
  };

  return (
    <div style={{ padding:'22px',height:'100%',overflowY:'auto' }}>
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4 }}>
        <h2 style={{ fontSize:19,fontWeight:800,color:SB }}>Stock Selection</h2>
        {loadingStocks
          ? <span style={{ fontSize:12,color:T2 }}>Loading NSE instruments…</span>
          : <span style={{ fontSize:12,color:G,fontWeight:600 }}>✓ {allStocks.length} stocks loaded</span>
        }
      </div>
      <p style={{ fontSize:13,color:T2,marginBottom:14 }}>
        Select up to 10 NSE stocks for ORB strategy. First 5-min candle H/L = entry levels.
      </p>
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:16 }}>
        {slots.map((sym,i)=>(
          <div key={i} style={{ border:`1.5px solid ${sym?SB+'50':BD}`,borderRadius:10,
            padding:'12px 14px',background:sym?'#FAFBFF':'#fff' }}>
            <div style={{ display:'flex',alignItems:'center',gap:7,marginBottom:9 }}>
              <div style={{ width:22,height:22,borderRadius:5,background:sym?SB:'#F1F5F9',
                color:sym?'#fff':T2,display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:11,fontWeight:700,flexShrink:0 }}>{i+1}</div>
              <span style={{ fontSize:12,fontWeight:600,color:sym?SB:T2 }}>
                {sym?`${shortSym(sym)} — Active`:`Slot ${i+1} — Empty`}
              </span>
            </div>
            <StockDropdown value={sym}
              onChange={v=>setSlots(p=>{const n=[...p];n[i]=v;return n;})}
              placeholder="Search & select stock…"
              stockList={allStocks} />
          </div>
        ))}
      </div>
      <button onClick={handleSave} style={{
        padding:'11px 28px',borderRadius:9,border:'none',background:SB,color:'#fff',
        fontWeight:700,fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',gap:8 }}>
        <CheckCircle size={15} /> Save & Subscribe to Feed
      </button>
    </div>
  );
}

// ── Test Signal View ──────────────────────────────────────
function TestSignalView({ authStatus, funds: globalFunds, setFunds: setGlobalFunds }) {
  const [sym,    setSym]    = useState('NSE:RELIANCE-EQ');
  const [side,   setSide]   = useState('BUY');
  const [qty,    setQty]    = useState('10');
  const [ot,     setOt]     = useState('MARKET');
  const [price,  setPrice]  = useState('');
  const [res,    setRes]    = useState(null);
  const [hist,   setHist]   = useState([]);
  const [load,   setLoad]   = useState(false);
  const [fLoad,  setFLoad]  = useState(false);
  const [fErr,   setFErr]   = useState(null);

  const funds = globalFunds || [];

  // Fetch balance from Fyers — updates global state
  const fetchBalance = async () => {
    setFLoad(true); setFErr(null);
    try {
      const r = await api.get('/api/portfolio/funds');
      if (r.funds) setGlobalFunds(r.funds);
      else setFErr('No fund data returned.');
    } catch(e) { setFErr('Could not fetch balance. Check Fyers connection.'); }
    setFLoad(false);
  };

  // Auto-fetch if not already loaded
  useEffect(() => {
    if (authStatus?.isAuthenticated && funds.length === 0) fetchBalance();
  }, [authStatus?.isAuthenticated]);

  const send = async () => {
    setLoad(true);
    try {
      const r = await api.post('/api/orders/test', { symbol:sym, side, qty:parseInt(qty)||1, orderType:ot, price:parseFloat(price)||0 });
      setRes(r);
      setHist(p=>[r,...p].slice(0,10));
    } catch(e) { setRes({ success:false, error:e.message }); }
    setLoad(false);
  };

  // Parse key fund fields
  const equity   = funds?.find(f => f.title === 'Equity' || f.title === 'Total Balance' || f.id === 'equity');
  const avail    = funds?.find(f => f.title === 'Available Balance' || f.id === 'free_balance' || f.title === 'Available Margin');
  const used     = funds?.find(f => f.title === 'Used Margin' || f.id === 'utilized_amount');
  const total    = funds?.find(f => f.title === 'Total Balance' || f.id === 'total_balance');

  const getVal = (obj) => {
    if (!obj) return null;
    return obj.equityAmount ?? obj.value ?? obj.currentValue ?? obj.val ?? null;
  };

  return (
    <div style={{ padding:'22px',height:'100%',overflowY:'auto' }}>
      <div style={{ marginBottom:16 }}>
        <h2 style={{ fontSize:19,fontWeight:800,color:SB,marginBottom:4 }}>Test Signal</h2>
        <div style={{ display:'flex',alignItems:'center',gap:8 }}>
          <p style={{ fontSize:13,color:T2 }}>Standalone test — bypasses master toggle</p>
          <Badge text="STANDALONE" color="#8B5CF6" />
        </div>
      </div>

      {/* ── BALANCE CARD ── */}
      <div style={{ marginBottom:18 }}>
        <SCard title="Current Balance — Fyers Account" icon={Shield}
          action={
            <button onClick={fetchBalance} disabled={fLoad} style={{
              display:'flex',alignItems:'center',gap:5,padding:'4px 10px',borderRadius:6,
              border:`1px solid ${BD}`,background:'#fff',color:T2,fontSize:11,cursor:'pointer' }}>
              <RefreshCw size={11} style={{ animation:fLoad?'spin 1s linear infinite':'none' }} />
              Refresh
            </button>
          }>
          {!authStatus?.isAuthenticated ? (
            <div style={{ display:'flex',alignItems:'center',gap:8,padding:'10px 14px',
              borderRadius:9,background:'#FFF7ED',border:'1px solid #FED7AA' }}>
              <AlertCircle size={15} color={W} />
              <span style={{ fontSize:13,color:W,fontWeight:600 }}>
                Fyers not connected. Go to API Credentials to login first.
              </span>
            </div>
          ) : fLoad ? (
            <div style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:8,padding:'18px 0',color:T2 }}>
              <RefreshCw size={14} style={{ animation:'spin 1s linear infinite' }} />
              <span style={{ fontSize:13 }}>Fetching balance from Fyers…</span>
            </div>
          ) : fErr ? (
            <div style={{ padding:'10px 14px',borderRadius:9,background:'#FFF1F2',
              border:'1px solid #FECDD3',fontSize:13,color:R }}>{fErr}</div>
          ) : funds && funds.length > 0 ? (
            <div>
              {/* Main balance grid */}
              <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:12 }}>
                {funds.slice(0,8).map((f,i) => {
                  const val = f.equityAmount ?? f.value ?? f.currentValue ?? f.val ?? 0;
                  const isPos = parseFloat(val) >= 0;
                  return (
                    <div key={i} style={{ background:'#F8FAFC',border:`1px solid ${BD}`,
                      borderRadius:9,padding:'10px 13px' }}>
                      <div style={{ fontSize:10,color:T2,fontWeight:600,marginBottom:4,
                        textTransform:'uppercase',letterSpacing:.3 }}>
                        {f.title || f.id || `Fund ${i+1}`}
                      </div>
                      <div className="mono" style={{ fontSize:16,fontWeight:700,
                        color: typeof val==='number'&&val<0 ? R : T1 }}>
                        ₹{typeof val==='number' ? val.toLocaleString('en-IN',{maximumFractionDigits:2}) : val}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Raw fund table */}
              <details style={{ cursor:'pointer' }}>
                <summary style={{ fontSize:12,color:T2,fontWeight:600,userSelect:'none',marginBottom:6 }}>
                  View all fund details ({funds.length} entries)
                </summary>
                <div style={{ border:`1px solid ${BD}`,borderRadius:8,overflow:'hidden',marginTop:6 }}>
                  <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',
                    background:'#F8FAFC',padding:'6px 10px',borderBottom:`1px solid ${BD}` }}>
                    <span style={{ fontSize:11,fontWeight:700,color:T2 }}>Fund Type</span>
                    <span style={{ fontSize:11,fontWeight:700,color:T2 }}>Amount (₹)</span>
                  </div>
                  {funds.map((f,i) => {
                    const val = f.equityAmount ?? f.value ?? f.currentValue ?? f.val ?? '—';
                    return (
                      <div key={i} style={{ display:'grid',gridTemplateColumns:'1fr 1fr',
                        padding:'7px 10px',borderBottom:`1px solid ${BD}`,
                        background:i%2===0?'#fff':'#FAFBFF' }}>
                        <span style={{ fontSize:12,color:T1 }}>{f.title || f.id || `Entry ${i+1}`}</span>
                        <span className="mono" style={{ fontSize:12,fontWeight:600,
                          color:typeof val==='number'&&val<0?R:T1 }}>
                          {typeof val==='number'?`₹${val.toLocaleString('en-IN',{maximumFractionDigits:2})}`:val}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </details>
            </div>
          ) : (
            <div style={{ textAlign:'center',padding:'16px 0',color:T2,fontSize:13 }}>
              No fund data. Click Refresh to load.
            </div>
          )}
        </SCard>
      </div>

      <div style={{ display:'grid',gridTemplateColumns:'380px 1fr',gap:18,alignItems:'start' }}>
        <div>
          <SCard title="Signal Builder" icon={Send}>
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:12,fontWeight:600,color:T2,display:'block',marginBottom:5 }}>Stock</label>
              <StockDropdown value={sym} onChange={setSym} />
            </div>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12 }}>
              {['BUY','SELL'].map(s=>(
                <button key={s} onClick={()=>setSide(s)} style={{
                  padding:'9px',borderRadius:8,fontWeight:700,
                  border:`2px solid ${s==='BUY'?G:R}`,
                  background:side===s?(s==='BUY'?G:R):'#fff',
                  color:side===s?'#fff':(s==='BUY'?G:R),cursor:'pointer',
                  display:'flex',alignItems:'center',justifyContent:'center',gap:5 }}>
                  {s==='BUY'?<ArrowUpRight size={14}/>:<ArrowDownRight size={14}/>}{s}
                </button>
              ))}
            </div>
            <SelectField label="Order Type" value={ot} onChange={setOt}
              options={['MARKET','LIMIT','STOP_LOSS','STOP_LOSS_MARKET'].map(v=>({value:v,label:v}))} />
            <Field label="Quantity" value={qty} onChange={setQty} type="number" />
            {ot!=='MARKET' && <Field label="Price ₹" value={price} onChange={setPrice} prefix="₹" type="number"
              placeholder={INDIAN_STOCKS.find(s=>s.symbol===sym)?.price?.toFixed(2)} />}
            <button onClick={send} disabled={load||!sym||!qty} style={{
              width:'100%',padding:'11px',borderRadius:9,fontWeight:700,fontSize:14,border:'none',
              cursor:'pointer',background:side==='BUY'?G:R,color:'#fff',
              display:'flex',alignItems:'center',justifyContent:'center',gap:8,
              opacity:(load||!sym||!qty)?0.6:1 }}>
              {load?<RefreshCw size={14} style={{ animation:'spin 1s linear infinite' }}/>:<Send size={14}/>}
              Send {side} Signal
            </button>
          </SCard>
          {res && (
            <div style={{ border:`1.5px solid ${res.success?G:R}`,borderRadius:10,padding:'12px 14px',
              background:res.success?'#F0FDF4':'#FFF1F2' }}>
              <div style={{ display:'flex',alignItems:'center',gap:7,marginBottom:8 }}>
                {res.success?<CheckCircle size={16} color={G}/>:<XCircle size={16} color={R}/>}
                <span style={{ fontWeight:700,color:res.success?G:R }}>
                  {res.success?'Signal Sent':'Failed'}
                </span>
                {res.simulated && <Badge text="SIMULATED" color="#8B5CF6" />}
              </div>
              {res.orderId && <div className="mono" style={{ fontSize:12,color:T2 }}>ID: {res.orderId}</div>}
              {res.error && <div style={{ fontSize:12,color:R }}>{res.error}</div>}
            </div>
          )}
        </div>
        <SCard title="Signal History" icon={Clock}>
          {hist.length===0
            ? <div style={{ textAlign:'center',color:T2,fontSize:13,padding:'24px 0' }}>No signals sent yet</div>
            : hist.map((h,i)=>(
              <div key={i} style={{ display:'flex',alignItems:'center',justifyContent:'space-between',
                padding:'9px 11px',borderRadius:8,marginBottom:5,background:'#F8FAFC',border:`1px solid ${BD}` }}>
                <div style={{ display:'flex',alignItems:'center',gap:7 }}>
                  <Badge text={h.order?.side||'?'} color={h.order?.side==='BUY'?G:R} />
                  <div>
                    <div style={{ fontSize:12,fontWeight:600 }}>{shortSym(h.order?.symbol||'')} × {h.order?.qty}</div>
                    <div className="mono" style={{ fontSize:10,color:T2 }}>{h.orderId}</div>
                  </div>
                </div>
                <Badge text={h.order?.status||'?'} color={h.success?G:R} />
              </div>
            ))}
        </SCard>
      </div>
    </div>
  );
}

// ── Risk & Reward View ────────────────────────────────────
function RiskRewardView({ rrConfig, setRrConfig, selectedSymbols, ticks, authStatus, funds: globalFunds, setFunds: setGlobalFunds }) {
  const [cfg,   setCfg]  = useState(rrConfig);
  const [bLoad, setBLoad]= useState(false);

  const funds = globalFunds || [];

  // Sync cfg whenever parent rrConfig changes (including capital from balance)
  useEffect(()=>{ setCfg(prev => ({ ...prev, ...rrConfig })); }, [rrConfig.capital, rrConfig.leverage, rrConfig.riskPct, rrConfig.rrRatio, rrConfig.maxSLPerDay]);

  // Fetch live balance and auto-fill capital from broker
  const fetchAndFill = async () => {
    if (!authStatus?.isAuthenticated) return;
    setBLoad(true);
    try {
      const r = await api.get('/api/portfolio/funds');
      if (r.funds?.length > 0) {
        setGlobalFunds(r.funds);
        const avail = r.funds.find(f =>
          (f.title||'').toLowerCase().includes('available') ||
          (f.title||'').toLowerCase().includes('free') ||
          f.id === 'free_balance'
        );
        const val = avail ? (avail.equityAmount??avail.value??avail.currentValue??0) : 0;
        if (val > 0) setCfg(p => ({ ...p, capital: Math.floor(val) }));
      }
    } catch(e) {}
    setBLoad(false);
  };

  // Auto-fill on mount — use global funds if available
  useEffect(() => {
    if (funds.length > 0) {
      const avail = funds.find(f =>
        (f.title||'').toLowerCase().includes('available') ||
        (f.title||'').toLowerCase().includes('free')
      ) || funds[0];
      const val = Math.floor(avail?.equityAmount??avail?.value??avail?.currentValue??0);
      if (val > 0) setCfg(p => ({ ...p, capital: val }));
    } else if (authStatus?.isAuthenticated) {
      fetchAndFill();
    }
  }, [funds.length]);

  const ec  = cfg.capital * cfg.leverage;
  const rpt = (ec * cfg.riskPct) / 100;
  const dll = rpt * cfg.maxSLPerDay;
  const rwd = rpt * cfg.rrRatio;

  const save = async () => {
    setRrConfig(cfg);
    try { await api.post('/api/risk/config', cfg); } catch(e) {}
  };

  return (
    <div style={{ padding:'22px',height:'100%',overflowY:'auto' }}>
      <h2 style={{ fontSize:19,fontWeight:800,color:SB,marginBottom:4 }}>Risk & Reward Calculator</h2>
      <p style={{ fontSize:13,color:T2,marginBottom:16 }}>Configure position sizing & rule-based risk controls</p>
      <div style={{ display:'grid',gridTemplateColumns:'400px 1fr',gap:18,alignItems:'start' }}>
        <div>
          <SCard title="Capital & Leverage" icon={Calculator}>
            <Field label="Invested Capital (₹)" value={cfg.capital}
              onChange={v=>setCfg(p=>({...p,capital:parseFloat(v)||0}))} prefix="₹" type="number" />
            <SelectField label="Intraday Leverage" value={String(cfg.leverage)}
              onChange={v=>setCfg(p=>({...p,leverage:parseInt(v)}))}
              options={[1,2,3,4,5].map(v=>({value:String(v),label:`${v}x Leverage`}))}
              tooltip="MIS leverage multiplier from Fyers" />
            {/* Live balance indicator */}
            {funds.length > 0 && (
              <div style={{ background:'#F0FDF4',border:'1px solid #BBF7D0',borderRadius:8,
                padding:'8px 12px',marginBottom:10,display:'flex',alignItems:'center',gap:8 }}>
                <div style={{ width:7,height:7,borderRadius:'50%',background:G }} className="live-dot"/>
                <span style={{ fontSize:11,color:G,fontWeight:600 }}>✓ Balance linked from Fyers broker</span>
                <button onClick={fetchAndFill} disabled={bLoad} style={{ marginLeft:'auto',
                  padding:'2px 8px',borderRadius:5,border:`1px solid ${G}`,background:'transparent',
                  color:G,fontSize:10,cursor:'pointer' }}>
                  {bLoad?'Fetching..':'↺ Refresh'}
                </button>
              </div>
            )}
            {funds.length === 0 && authStatus?.isAuthenticated && (
              <div style={{ background:'#FFF7ED',border:'1px solid #FED7AA',borderRadius:8,
                padding:'8px 12px',marginBottom:10,display:'flex',alignItems:'center',gap:8 }}>
                <AlertCircle size={13} color={W}/>
                <span style={{ fontSize:11,color:W,fontWeight:600 }}>Could not fetch balance</span>
                <button onClick={fetchAndFill} disabled={bLoad} style={{ marginLeft:'auto',
                  padding:'2px 8px',borderRadius:5,border:`1px solid ${W}`,background:'transparent',
                  color:W,fontSize:10,cursor:'pointer' }}>Retry</button>
              </div>
            )}
            <div style={{ background:'#EEF2FF',borderRadius:8,padding:'10px 13px',
              display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4 }}>
              <span style={{ fontSize:13,color:SB }}>Effective Capital</span>
              <span className="mono" style={{ fontSize:18,fontWeight:700,color:SB }}>{fmtINR(ec)}</span>
            </div>
          </SCard>

          <SCard title="Risk Configuration" icon={Shield}>
            <div style={{ marginBottom:13 }}>
              <div style={{ display:'flex',justifyContent:'space-between',marginBottom:5 }}>
                <label style={{ fontSize:12,fontWeight:600,color:T2 }}>Risk % Per Trade</label>
                <span className="mono" style={{ fontSize:13,fontWeight:700,color:R }}>{cfg.riskPct}%</span>
              </div>
              <input type="range" min="0.5" max="10" step="0.5" value={cfg.riskPct}
                onChange={e=>setCfg(p=>({...p,riskPct:parseFloat(e.target.value)}))}
                style={{ width:'100%',accentColor:SB }} />
              <div style={{ display:'flex',justifyContent:'space-between',fontSize:11,color:T2,marginTop:3 }}>
                <span>0.5% (Safe)</span>
                <span style={{ color:rpt>5000?R:T2 }}>Risk: {fmtINR(rpt)}</span>
                <span>10% (Aggressive)</span>
              </div>
            </div>
            <SelectField label="Risk : Reward Ratio" value={String(cfg.rrRatio)}
              onChange={v=>setCfg(p=>({...p,rrRatio:parseFloat(v)}))}
              options={[1,1.5,2,2.5,3,3.5,4].map(v=>({value:String(v),label:`1:${v}`}))}
              tooltip="For every ₹1 risked, target ₹R reward" />
          </SCard>

          <SCard title="Rule-Based Controls" icon={AlertTriangle}>
            <Field label="Max SL Hits / Day" value={cfg.maxSLPerDay}
              onChange={v=>setCfg(p=>({...p,maxSLPerDay:parseInt(v)||1}))} type="number"
              tooltip="Trading halts after this many SL hits (max 3 recommended)" />
            <div style={{ background:'#FFF7ED',border:`1px solid #FED7AA`,borderRadius:8,
              padding:'9px 12px',marginBottom:10,display:'flex',justifyContent:'space-between',alignItems:'center' }}>
              <div>
                <div style={{ fontSize:11,color:W,fontWeight:600 }}>Daily Risk Cap</div>
                <div style={{ fontSize:11,color:T2 }}>Halt when this ₹ loss is hit</div>
              </div>
              <span className="mono" style={{ fontSize:17,fontWeight:700,color:W }}>{fmtINR(dll)}</span>
            </div>
          </SCard>

          <button onClick={save} style={{
            width:'100%',padding:'11px',borderRadius:9,border:'none',background:SB,
            color:'#fff',fontWeight:700,fontSize:14,cursor:'pointer',
            display:'flex',alignItems:'center',justifyContent:'center',gap:8 }}>
            <CheckCircle size={14} /> Save & Apply Config
          </button>
        </div>

        <div>
          <SCard title="Per-Stock Position Calculator" icon={BarChart2}>
            <div style={{ border:`1px solid ${BD}`,borderRadius:8,overflow:'hidden' }}>
              <div style={{ display:'grid',gridTemplateColumns:'1.5fr 1fr 1fr 1fr 1fr',
                background:'#F8FAFC',padding:'7px 10px',borderBottom:`1px solid ${BD}` }}>
                {['Symbol','CMP','SL Pts','Qty','Trade Value'].map(h=>(
                  <div key={h} style={{ fontSize:11,fontWeight:700,color:T2 }}>{h}</div>
                ))}
              </div>
              {selectedSymbols.filter(Boolean).map((sym,i)=>{
                const si   = INDIAN_STOCKS.find(s=>s.symbol===sym);
                const cmp  = ticks[sym]?.ltp || si?.price || 1000;
                const slPts= cmp * (cfg.riskPct/100);
                const qty  = Math.max(1, Math.floor(rpt/slPts));
                return (
                  <div key={i} style={{ display:'grid',gridTemplateColumns:'1.5fr 1fr 1fr 1fr 1fr',
                    padding:'7px 10px',borderBottom:`1px solid ${BD}`,background:i%2===0?'#fff':'#FAFBFF' }}>
                    <div style={{ fontWeight:700,fontSize:12 }}>{shortSym(sym)}</div>
                    <div className="mono" style={{ fontSize:12 }}>₹{cmp.toFixed(0)}</div>
                    <div className="mono" style={{ fontSize:12,color:R }}>₹{slPts.toFixed(1)}</div>
                    <div className="mono" style={{ fontSize:12,fontWeight:700 }}>{qty}</div>
                    <div className="mono" style={{ fontSize:12 }}>{fmtINR(cmp*qty)}</div>
                  </div>
                );
              })}
              {selectedSymbols.filter(Boolean).length===0 && (
                <div style={{ padding:'16px',textAlign:'center',color:T2,fontSize:13 }}>
                  Add stocks in Stock List to see calculations
                </div>
              )}
            </div>
          </SCard>
        </div>
      </div>
    </div>
  );
}

// ── Syntax Generator View ─────────────────────────────────
function SyntaxGenView({ selectedSymbols }) {
  const [sym,  setSym]  = useState(selectedSymbols[0]||'NSE:RELIANCE-EQ');
  const [side, setSide] = useState('BUY');
  const [qty,  setQty]  = useState('10');
  const [ot,   setOt]   = useState('MARKET');
  const [sl,   setSl]   = useState('');
  const [tgt,  setTgt]  = useState('');
  const [copied,setCp]  = useState('');

  const doCopy = (txt, k) => {
    navigator.clipboard.writeText(txt).then(()=>{setCp(k);setTimeout(()=>setCp(''),2000);});
  };

  const fyersJson = JSON.stringify({
    symbol: sym, qty:parseInt(qty)||1,
    type: ot==='MARKET'?2:ot==='LIMIT'?1:ot==='STOP_LOSS'?4:3,
    side: side==='BUY'?1:-1,
    productType:'INTRADAY',
    limitPrice: ot!=='MARKET'?0:0,
    stopPrice: sl?parseFloat(sl):0,
    disclosedQty:0, validity:'DAY',
    offlineOrder:false, stopLoss:sl||0, takeProfit:tgt||0
  }, null, 2);

  const webhookJson = JSON.stringify({
    symbol: sym, action:side, qty:parseInt(qty)||1,
    price:'{{close}}', sl:sl||'{{low}}', target:tgt||'{{high}}',
    orderType:ot, strategy:'ORB', timestamp:'{{time}}'
  }, null, 2);

  const pine = `// Pine Script v5 · ORB ${shortSym(sym)}
//@version=5
strategy("ORB ${shortSym(sym)}", overlay=true)

orb_high = request.security("${sym.replace('-EQ','')}", "5", high[1], lookahead=barmerge.lookahead_on)
orb_low  = request.security("${sym.replace('-EQ','')}", "5", low[1],  lookahead=barmerge.lookahead_on)

plot(orb_high, "ORB High", color.new(color.green,0), 2)
plot(orb_low,  "ORB Low",  color.new(color.red,0),   2)

buy_signal  = ta.crossover(close,  orb_high)
sell_signal = ta.crossunder(close, orb_low)

if buy_signal
    strategy.entry("BUY", strategy.long)
    alert('{"symbol":"${sym}","action":"BUY","qty":${qty||1}}', alert.freq_once_per_bar_close)
if sell_signal
    strategy.entry("SELL", strategy.short)
    alert('{"symbol":"${sym}","action":"SELL","qty":${qty||1}}', alert.freq_once_per_bar_close)`;

  const CodeBlock = ({code,id,lang}) => (
    <div style={{ marginBottom:12 }}>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',
        background:'#1E293B',padding:'7px 12px',borderRadius:'8px 8px 0 0' }}>
        <span style={{ fontSize:11,color:'#94A3B8',fontFamily:'monospace' }}>{lang}</span>
        <button onClick={()=>doCopy(code,id)} style={{
          display:'flex',alignItems:'center',gap:4,padding:'3px 9px',borderRadius:5,
          border:'1px solid #334155',background:'transparent',
          color:copied===id?G:'#94A3B8',fontSize:11,cursor:'pointer' }}>
          {copied===id?<CheckCircle size={11}/>:<Copy size={11}/>}
          {copied===id?'Copied':'Copy'}
        </button>
      </div>
      <pre style={{ background:'#0F172A',color:'#E2E8F0',padding:'12px',borderRadius:'0 0 8px 8px',
        fontSize:12,fontFamily:'JetBrains Mono,monospace',overflowX:'auto',
        margin:0,lineHeight:1.6,maxHeight:210,overflowY:'auto' }}>{code}</pre>
    </div>
  );

  return (
    <div style={{ padding:'22px',height:'100%',overflowY:'auto' }}>
      <h2 style={{ fontSize:19,fontWeight:800,color:SB,marginBottom:16 }}>Syntax Generator</h2>
      <div style={{ display:'grid',gridTemplateColumns:'320px 1fr',gap:18,alignItems:'start' }}>
        <SCard title="Parameters" icon={Edit3}>
          <div style={{ marginBottom:11 }}>
            <label style={{ fontSize:12,fontWeight:600,color:T2,display:'block',marginBottom:5 }}>Stock</label>
            <StockDropdown value={sym} onChange={setSym} />
          </div>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:7,marginBottom:11 }}>
            {['BUY','SELL'].map(s=>(
              <button key={s} onClick={()=>setSide(s)} style={{
                padding:'8px',borderRadius:7,fontWeight:700,
                border:`2px solid ${s==='BUY'?G:R}`,
                background:side===s?(s==='BUY'?G:R):'#fff',
                color:side===s?'#fff':(s==='BUY'?G:R),cursor:'pointer',fontSize:13 }}>{s}</button>
            ))}
          </div>
          <SelectField label="Order Type" value={ot} onChange={setOt}
            options={['MARKET','LIMIT','STOP_LOSS','STOP_LOSS_MARKET'].map(v=>({value:v,label:v}))} />
          <Field label="Quantity" value={qty} onChange={setQty} type="number" />
          <Field label="Stop Loss ₹" value={sl} onChange={setSl} prefix="₹" type="number" placeholder="Optional" />
          <Field label="Target ₹" value={tgt} onChange={setTgt} prefix="₹" type="number" placeholder="Optional" />
        </SCard>
        <div>
          <SCard title="Fyers API Payload" icon={Code2}>
            <CodeBlock code={fyersJson} id="fyers" lang="JSON · Fyers Place Order" />
          </SCard>
          <SCard title="Webhook JSON (TradingView → Server)" icon={Send}>
            <CodeBlock code={webhookJson} id="webhook" lang="JSON · Webhook Body" />
          </SCard>
          <SCard title="Pine Script v5 Alert" icon={BarChart2}>
            <CodeBlock code={pine} id="pine" lang="Pine Script v5 · TradingView" />
          </SCard>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────
export default function App() {
  const { socket, connected: socketConnected } = useSocket(SOCKET_URL);

  // State from server
  const [authStatus,     setAuthStatus]     = useState({ isAuthenticated:false });
  const [masterOn,       setMasterOn]       = useState(false);
  const [selectedSymbols,setSelectedSymbols]= useState([]);
  const [stockToggles,   setStockToggles]   = useState({});
  const [ticks,          setTicks]          = useState({});
  const [orbLevels,      setOrbLevels]      = useState({});
  const [activeSignals,  setActiveSignals]  = useState({});
  const [alerts,         setAlerts]         = useState([]);
  const [riskStatus,     setRiskStatus]     = useState({});
  const [rrConfig,       setRrConfig]       = useState({ capital:50000,leverage:5,riskPct:2,rrRatio:2,maxSLPerDay:3 });
  const [sysAlerts,      setSysAlerts]      = useState([]);
  const [funds,          setFunds]          = useState([]);   // global broker balance

  const [activeView, setActiveView] = useState('dashboard');
  const [time, setTime] = useState(new Date());

  // Clock
  useEffect(()=>{ const t=setInterval(()=>setTime(new Date()),1000); return ()=>clearInterval(t); },[]);

  // Helper: extract available balance from funds array
  const extractBalance = (fundsArr) => {
    if (!fundsArr?.length) return 0;
    // Try to find available/free balance field
    const avail = fundsArr.find(f =>
      (f.title||'').toLowerCase().includes('available') ||
      (f.title||'').toLowerCase().includes('free balance') ||
      (f.title||'').toLowerCase().includes('cash avail') ||
      f.id === 'free_balance' || f.id === 'available_balance'
    ) || fundsArr[0]; // fallback to first entry
    return Math.floor(avail?.equityAmount ?? avail?.value ?? avail?.currentValue ?? avail?.val ?? 0);
  };

  // Pull initial state from server
  useEffect(()=>{
    // 1. Get auth status
    api.get('/api/auth/status').then(r=>{
      setAuthStatus(r);
    }).catch(()=>{});

    // 2. Get risk/server config
    api.get('/api/risk/status').then(r=>{
      setRiskStatus(r);
      // Only use server config if no balance fetched yet
      if(r.config) setRrConfig(p => ({ ...p, ...r.config }));
    }).catch(()=>{});
  },[]);

  // Separate effect: fetch balance whenever auth changes
  useEffect(()=>{
    if(!authStatus?.isAuthenticated) return;
    api.get('/api/portfolio/funds').then(fr=>{
      if(fr.funds?.length > 0) {
        setFunds(fr.funds);
        const bal = extractBalance(fr.funds);
        if(bal > 0) {
          // Balance overrides server config capital — this is the live broker balance
          setRrConfig(p => ({ ...p, capital: bal }));
        }
      }
    }).catch(()=>{});
  },[authStatus?.isAuthenticated]);

  // Socket event listeners
  useEffect(()=>{
    if(!socket) return;

    socket.on('initState', state => {
      if(state.masterEnabled!==undefined) setMasterOn(state.masterEnabled);
      if(state.selectedSymbols)           setSelectedSymbols(state.selectedSymbols);
      if(state.stockToggles)              setStockToggles(state.stockToggles);
      // Only update rrConfig from server if no live balance loaded yet
      if(state.rrConfig) setRrConfig(p => {
        // If capital was already set from broker balance (>0), keep it
        // Otherwise use server config
        return { ...state.rrConfig, capital: p.capital || state.rrConfig.capital };
      });
      if(state.authStatus)                setAuthStatus(state.authStatus);
      if(state.riskStatus)                setRiskStatus(state.riskStatus);
      if(state.ticks)                     setTicks(state.ticks);
      if(state.alerts)                    setAlerts(state.alerts);
    });

    socket.on('tick', ({ symbol, tick }) => {
      setTicks(p => ({ ...p, [symbol]: tick }));
    });

    socket.on('orbLocked', ({ symbol, high, low }) => {
      setOrbLevels(p => ({ ...p, [symbol]: { high, low, locked:true } }));
    });

    socket.on('signal', (sig) => {
      setAlerts(p => [sig, ...p].slice(0,100));
    });

    socket.on('orderExecuted', ({ signal }) => {
      setActiveSignals(p => ({ ...p, [signal.symbol]: signal }));
    });

    socket.on('tradeExit', ({ symbol }) => {
      setActiveSignals(p => { const n={...p}; delete n[symbol]; return n; });
    });

    socket.on('slTrailed', ({ symbol, newSl }) => {
      setActiveSignals(p => p[symbol] ? { ...p, [symbol]: {...p[symbol], sl:newSl, trailed:true } } : p);
    });

    socket.on('pnlUpdate', ({ stats, riskStatus: rs }) => {
      if(stats?.orbLevels) setOrbLevels(stats.orbLevels);
      if(rs) setRiskStatus(p => ({ ...p, daily: rs }));
    });

    socket.on('masterToggle', ({ enabled }) => setMasterOn(enabled));

    socket.on('configUpdated', (cfg) => setRrConfig(cfg));

    socket.on('tradingHalted', ({ reason }) => {
      setSysAlerts(p => [{ type:'error', msg:`🛑 Trading halted: ${reason}`, ts:Date.now() }, ...p].slice(0,5));
    });

    socket.on('systemAlert', (a) => {
      setSysAlerts(p => [{ ...a, ts:Date.now() }, ...p].slice(0,5));
    });

    socket.on('authSuccess', () => {
      api.get('/api/auth/status').then(r=>setAuthStatus(r)).catch(()=>{});
    });

    return () => socket.removeAllListeners();
  }, [socket]);

  const handleStockToggle = async (sym, val) => {
    const next = { ...stockToggles, [sym]: val };
    setStockToggles(next);
    try { await api.post('/api/control/stock-toggle', { symbol:sym, enabled:val }); } catch(e){}
  };

  const handleSaveStocks = async (syms, toggles) => {
    setSelectedSymbols(syms);
    setStockToggles(toggles);
    try { await api.post('/api/stocks/select', { symbols:syms, toggles }); } catch(e){}
  };

  return (
    <div style={{ display:'flex',flexDirection:'column',height:'100vh',fontFamily:"'Outfit',sans-serif" }}>
      <GlobalStyles />

      {/* Header */}
      <div style={{ height:50,background:'#fff',borderBottom:`1.5px solid ${BD}`,
        display:'flex',alignItems:'center',padding:'0 18px',
        justifyContent:'space-between',flexShrink:0,zIndex:100 }}>
        <div style={{ display:'flex',alignItems:'center',gap:10 }}>
          <div style={{ background:SB,color:'#fff',width:30,height:30,borderRadius:7,
            display:'flex',alignItems:'center',justifyContent:'center' }}>
            <Activity size={16} />
          </div>
          <div>
            <h1 style={{ fontSize:15,fontWeight:900,color:SB,letterSpacing:.4 }}>
              ALGO_BOT_ORB_10_STOCK
            </h1>
            <div style={{ fontSize:10,color:T2 }}>
              Opening Range Breakout · NSE · Fyers API v2
            </div>
          </div>
        </div>

        <div style={{ display:'flex',alignItems:'center',gap:14 }}>
          {/* System alerts */}
          {sysAlerts.slice(0,1).map((a,i)=>(
            <div key={i} style={{ padding:'4px 10px',borderRadius:7,fontSize:11,fontWeight:600,
              background:a.type==='error'?R+'15':a.type==='SUCCESS'?G+'15':'#EEF2FF',
              color:a.type==='error'?R:a.type==='SUCCESS'?G:SB,
              maxWidth:300,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
              {a.msg}
            </div>
          ))}

          <div className="mono" style={{ fontSize:13,color:T1,fontWeight:600 }}>
            {time.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}
          </div>

          {/* Socket status */}
          <div style={{ display:'flex',alignItems:'center',gap:5,padding:'3px 9px',
            borderRadius:20,background:socketConnected?'#F0FDF4':'#FFF7ED',
            border:`1px solid ${socketConnected?'#BBF7D0':'#FED7AA'}` }}>
            <div style={{ width:6,height:6,borderRadius:'50%',
              background:socketConnected?G:W }} className={socketConnected?'live-dot':''} />
            <span style={{ fontSize:11,fontWeight:600,color:socketConnected?G:W }}>
              {socketConnected?'Live':'Reconnecting'}
            </span>
          </div>

          <div style={{ display:'flex',alignItems:'center',gap:7 }}>
            <span style={{ fontSize:12,color:T2,fontWeight:600 }}>Trade</span>
            <Toggle on={masterOn} onToggle={()=>{
              const next=!masterOn; setMasterOn(next);
              api.post('/api/control/master',{enabled:next}).catch(()=>{});
            }} size="md" label />
          </div>

          <div style={{ position:'relative',cursor:'pointer' }}>
            <Bell size={16} color={T2} />
            {alerts.length>0 && (
              <div style={{ position:'absolute',top:-3,right:-3,width:14,height:14,
                background:R,borderRadius:'50%',fontSize:9,color:'#fff',
                display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700 }}>
                {Math.min(alerts.length,99)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ display:'flex',flex:1,overflow:'hidden' }}>
        <Sidebar active={activeView} setActive={setActiveView}
          socketOk={socketConnected} authOk={authStatus?.isAuthenticated} masterOn={masterOn} />

        <div style={{ flex:1,overflow:'hidden',background:'#fff' }} className="slide-in">
          {activeView==='dashboard' && (
            <DashboardView masterOn={masterOn} setMasterOn={setMasterOn}
              selectedSymbols={selectedSymbols} ticks={ticks} orbLevels={orbLevels}
              activeSignals={activeSignals} stockToggles={stockToggles}
              onToggleStock={handleStockToggle} alerts={alerts} riskStatus={riskStatus}
              rrConfig={rrConfig} />
          )}
          {activeView==='api' && <ApiCredView authStatus={authStatus} />}
          {activeView==='chart' && (
            <LiveChartView selectedSymbols={selectedSymbols} ticks={ticks}
              orbLevels={orbLevels} activeSignals={activeSignals} authStatus={authStatus} />
          )}
          {activeView==='stocks' && (
            <StockListView selectedSymbols={selectedSymbols}
              setSelectedSymbols={setSelectedSymbols} onSaveToServer={handleSaveStocks} />
          )}
          {activeView==='test'   && <TestSignalView authStatus={authStatus} funds={funds} setFunds={setFunds} />}
          {activeView==='rr'     && (
            <RiskRewardView rrConfig={rrConfig} setRrConfig={setRrConfig}
              selectedSymbols={selectedSymbols} ticks={ticks} authStatus={authStatus}
              funds={funds} setFunds={setFunds} />
          )}
          {activeView==='syntax' && <SyntaxGenView selectedSymbols={selectedSymbols} />}
        </div>
      </div>
    </div>
  );
}
