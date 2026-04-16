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
    const s = io(url, {
      transports: ['polling', 'websocket'],  // polling first — works on Render
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });
    s.on('connect',    () => { setConnected(true); });
    s.on('disconnect', () => { setConnected(false); });
    s.on('connect_error', () => { setConnected(false); });
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
function LiveCandleChart({ candles, orbHigh, orbLow, tradeInfo, symbol, firstCandleHighlight }) {
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

    // ── First candle highlight box ─────────────────────────
    if (firstCandleHighlight && candles.length > 0) {
      const fc = candles[0];
      const x1 = pad.left;
      const x2 = xOf(0) + cw/2 + 2;
      const yTop = yOf(fc.high);
      const yBot = yOf(fc.low);
      ctx.save();
      ctx.fillStyle = 'rgba(255,215,0,0.12)';
      ctx.fillRect(x1, yTop, x2-x1, yBot-yTop);
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.strokeRect(x1, yTop, x2-x1, yBot-yTop);
      ctx.font = 'bold 9px JetBrains Mono,monospace';
      ctx.fillStyle = '#F59E0B';
      ctx.textAlign = 'left';
      ctx.fillText('ORB', x1+3, yTop-3);
      ctx.restore();
    }

    // ORB lines (dashed horizontal)
    [orbHigh, orbLow].forEach((level, isLow) => {
      if (!level) return;
      const color = isLow ? R : G;
      const label = isLow ? `ORB L ${level.toFixed(2)}` : `ORB H ${level.toFixed(2)}`;
      const yp = yOf(level);
      ctx.save(); ctx.strokeStyle=color; ctx.lineWidth=2; ctx.setLineDash([7,4]);
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
  { id:'morning',   label:'Morning Check',     icon:CheckCircle, badge:'GO' },
  { id:'dashboard', label:'Dashboard',          icon:LayoutDashboard },
  { id:'api',       label:'API Credentials',    icon:Key },
  // Live Chart removed — use http://34.47.182.99:3000
  { id:'stocks',    label:'Stock Selection',     icon:List },
  { id:'test',      label:'Test Signal',         icon:Zap },
  // ORB Simulator removed
  { id:'rr',        label:'Risk & Reward',       icon:Calculator },
  { id:'syntax',    label:'Syntax Generator',    icon:Code2 },
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
              {item.badge && item.id!=='test' && (
                <span style={{ marginLeft:'auto',fontSize:8,fontWeight:700,padding:'2px 5px',
                  borderRadius:3,background:G,color:'#fff' }}>{item.badge}</span>
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
  activeSignals, stockToggles, onToggleStock, alerts, riskStatus, rrConfig,
  authStatus, savedApis }) {

  const [activeTab, setActiveTab] = useState('indian'); // 'indian' | 'crypto'

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

  // Connected brokers from savedApis
  const indianApis = (savedApis||[]).filter(a=>a.category==='indian' && a.enabled);
  const cryptoApis = (savedApis||[]).filter(a=>a.category==='crypto' && a.enabled);
  const connectedIndian = indianApis.filter(a=>a.connected || (a.brokerId==='fyers'&&authStatus?.isAuthenticated));
  const connectedCrypto = cryptoApis.filter(a=>a.connected);

  // Indian stats
  const cap = rrConfig?.capital||50000;
  const lev = rrConfig?.leverage||5;
  const rsk = rrConfig?.riskPct||2;
  const rr  = rrConfig?.rrRatio||2;
  const msl = rrConfig?.maxSLPerDay||3;
  const ec  = cap*lev;
  const rpt = ec*rsk/100;
  const dll = rpt*msl;
  const slHits = Object.values(riskStatus?.daily?.stockSLHits||{}).reduce((a,b)=>a+b,0);
  const dayPnl = riskStatus?.daily?.totalPnl||0;

  // Fetch active trades from server
  const [activeTrades, setActiveTrades] = React.useState([]);
  React.useEffect(()=>{
    const fetchTrades = ()=>{
      api.get('/api/trades/active').then(d=>{ if(d.success) setActiveTrades(d.trades||[]); }).catch(()=>{});
    };
    fetchTrades();
    const t=setInterval(fetchTrades,2000); // refresh every 2s for live PnL
    return ()=>clearInterval(t);
  },[]);

  return (
    <div style={{ padding:'18px 22px',height:'100%',overflowY:'auto' }}>

      {/* ── ACTIVE TRADES ──────────────────────────────────── */}
      {activeTrades.length>0 && (
        <div style={{ background:'#fff',border:'1.5px solid #e0e7ef',borderRadius:12,padding:'14px 16px',marginBottom:16 }}>
          <div style={{ fontWeight:800,fontSize:14,color:'#1e293b',marginBottom:10 }}>
            🔴 Active Trades ({activeTrades.length})
          </div>
          {activeTrades.map((t,i)=>{
            const sym = t.symbol;
            const ltp = ticks[sym.replace('NSE:','').replace('-EQ','.NS')]?.ltp || t.entry;
            const pnl = t.side==='BUY' ? (ltp-t.entry)*t.qty : (t.entry-ltp)*t.qty;
            const pnlPct = ((pnl / (t.entry * t.qty)) * 100).toFixed(2);
            return (
              <div key={i} style={{ padding:'8px 10px',borderRadius:8,background:pnl>=0?'#f0fdf4':'#fff1f2',
                border:`1px solid ${pnl>=0?'#86efac':'#fca5a5'}`,marginBottom:6 }}>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                  <div>
                    <span style={{ fontWeight:800,fontSize:13 }}>{sym}</span>
                    <span style={{ marginLeft:8,fontSize:11,padding:'2px 6px',borderRadius:4,
                      background:t.side==='BUY'?'#dcfce7':'#fee2e2',
                      color:t.side==='BUY'?'#15803d':'#dc2626',fontWeight:700 }}>{t.side}</span>
                    <span style={{ marginLeft:8,fontSize:10,color:'#64748b' }}>×{t.qty} @ {t.entry}</span>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontWeight:800,fontSize:14,color:pnl>=0?'#15803d':'#dc2626' }}>
                      {pnl>=0?'+':''}₹{pnl.toFixed(2)} ({pnlPct}%)
                    </div>
                    <div style={{ fontSize:10,color:'#64748b' }}>LTP: {ltp.toFixed(2)}</div>
                  </div>
                </div>
                <div style={{ display:'flex',gap:12,marginTop:5,fontSize:10,color:'#64748b' }}>
                  <span>🔴 SL: <b>{t.sl||'—'}</b></span>
                  <span>🟢 TGT: <b>{t.tgt||'—'}</b></span>
                  <span>📅 {t.time?new Date(t.time).toLocaleTimeString('en-IN'):''}</span>
                  <span>🏦 {(t.broker||'').toUpperCase()}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── RR SUMMARY ─────────────────────────────────────── */}
      <div style={{ background:'#f0f4ff',border:'1.5px solid #c7d7f5',borderRadius:12,padding:'12px 16px',marginBottom:16 }}>
        <div style={{ fontWeight:800,fontSize:13,color:'#1e293b',marginBottom:8 }}>⚡ R&R Config (Active)</div>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,fontSize:11 }}>
          <div>Capital: <b>₹{(rrConfig?.capital||50000).toLocaleString()}</b></div>
          <div>Leverage: <b>{rrConfig?.leverage||5}×</b></div>
          <div>Risk: <b>{rrConfig?.riskPct||2}%</b></div>
          <div>R:R Ratio: <b>1:{rrConfig?.rrRatio||2}</b></div>
          <div>Max SL/Day: <b>{rrConfig?.maxSLPerDay||3}</b></div>
          <div>Crypto Risk: <b>{rrConfig?.cryptoRiskPct||0.5}%</b></div>
        </div>
      </div>

      {/* ── MASTER TOGGLE ──────────────────────────────────── */}
      <div style={{ background:masterOn?'#EEF2FF':'#F8FAFC',border:`2px solid ${masterOn?SB:BD}`,
        borderRadius:13,padding:'14px 18px',marginBottom:16,
        display:'flex',alignItems:'center',justifyContent:'space-between',transition:'all .3s' }}>
        <div style={{ display:'flex',alignItems:'center',gap:10 }}>
          <div style={{ width:9,height:9,borderRadius:'50%',background:masterOn?G:'#CBD5E1',
            boxShadow:masterOn?`0 0 8px ${G}`:'none' }} className={masterOn?'live-dot':''} />
          <div>
            <div style={{ fontWeight:800,fontSize:15,color:masterOn?SB:T2 }}>MASTER TRADE CONTROL</div>
            <div style={{ fontSize:11,color:T2 }}>
              {masterOn?'✓ All enabled brokers active — live order execution':'All trading paused — no orders will be placed'}
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

      {/* ── CONNECTED BROKERS ROW ─────────────────────────── */}
      {(savedApis||[]).length > 0 && (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontWeight:700,fontSize:12,color:T2,marginBottom:8,textTransform:'uppercase',letterSpacing:.5 }}>
            Connected Brokers
          </div>
          <div style={{ display:'flex',gap:8,flexWrap:'wrap' }}>
            {(savedApis||[]).filter(a=>a.enabled).map(a=>{
              const isConn = a.connected || (a.brokerId==='fyers'&&authStatus?.isAuthenticated);
              return (
                <div key={a.id} style={{ display:'flex',alignItems:'center',gap:7,
                  padding:'7px 13px',borderRadius:9,
                  background:isConn?a.color+'12':'#F8FAFC',
                  border:`1.5px solid ${isConn?a.color+'40':BD}` }}>
                  <div style={{ width:8,height:8,borderRadius:'50%',
                    background:isConn?a.color:'#CBD5E1',
                    boxShadow:isConn?`0 0 5px ${a.color}`:'none' }}/>
                  <span style={{ fontSize:12,fontWeight:700,color:isConn?a.color:T2 }}>{a.name}</span>
                  {a.alwaysOn && <span style={{ fontSize:9,color:'#8B5CF6',fontWeight:700 }}>24/7</span>}
                  <span style={{ fontSize:10,color:isConn?G:R,fontWeight:600 }}>
                    {isConn?'●':'○'}{isConn?' Live':' Offline'}
                  </span>
                </div>
              );
            })}
            {(savedApis||[]).filter(a=>a.enabled).length===0 && (
              <div style={{ fontSize:12,color:T2,padding:'7px 0' }}>
                No brokers connected. Go to API Credentials → Add API.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB SWITCHER ─────────────────────────────────── */}
      <div style={{ display:'flex',gap:2,marginBottom:16,background:'#F1F5F9',borderRadius:10,padding:3 }}>
        {[
          { id:'indian', label:'🇮🇳 Indian Markets', count: connectedIndian.length },
          { id:'crypto', label:'₿ Crypto (24/7)',    count: connectedCrypto.length },
        ].map(tab=>(
          <button key={tab.id} onClick={()=>setActiveTab(tab.id)} style={{
            flex:1,padding:'9px 0',borderRadius:8,border:'none',cursor:'pointer',
            fontWeight:700,fontSize:13,transition:'all .2s',
            background:activeTab===tab.id?'#fff':'transparent',
            color:activeTab===tab.id?SB:T2,
            boxShadow:activeTab===tab.id?'0 1px 4px rgba(0,0,0,.08)':'none' }}>
            {tab.label}
            <span style={{ marginLeft:6,fontSize:10,padding:'1px 6px',borderRadius:4,
              background:activeTab===tab.id?SB+'20':'transparent',
              color:activeTab===tab.id?SB:T2 }}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* ── INDIAN TAB ───────────────────────────────────── */}
      {activeTab==='indian' && (
        <div>
          {/* Stats row */}
          <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:16 }}>
            <StatCard label="Effective Capital" value={fmtINR(ec)}
              sub={authStatus?.isAuthenticated?`₹${cap.toLocaleString('en-IN')} × ${lev}x`:'Login to sync'}
              icon={Shield} color={authStatus?.isAuthenticated?G:SB} />
            <StatCard label="Live P&L"
              value={(totalPnl>=0?'+':'')+fmtINR(totalPnl)}
              sub={totalPnl>=0?'▲ Profitable':'▼ In loss'}
              icon={Activity} color={totalPnl>=0?G:R} />
            <StatCard label="Active Trades"
              value={`${Object.keys(activeSignals).length}/10`}
              sub={`${selectedSymbols.filter(s=>stockToggles[s]!==false).length} stocks enabled`}
              icon={BarChart2} color="#8B5CF6" />
            <StatCard label="Risk / Trade"
              value={fmtINR(rpt)}
              sub={`Daily cap: ${fmtINR(dll)}`}
              icon={Target} color={W} />
          </div>

          {/* Connected Indian broker panels */}
          {connectedIndian.length > 0 && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontWeight:700,fontSize:13,color:T1,marginBottom:8 }}>Broker Summary</div>
              <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:9 }}>
                {connectedIndian.map(a=>{
                  const brokerEc = cap*lev;
                  const brokerRpt = brokerEc*rsk/100;
                  return (
                    <div key={a.id} style={{ background:'#fff',border:`1.5px solid ${a.color}30`,
                      borderRadius:11,padding:'12px 14px' }}>
                      <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:10 }}>
                        <div style={{ width:32,height:32,borderRadius:8,background:a.color,
                          display:'flex',alignItems:'center',justifyContent:'center',
                          fontSize:14,fontWeight:800,color:'#fff' }}>{a.name[0]}</div>
                        <div>
                          <div style={{ fontWeight:700,fontSize:13,color:T1 }}>{a.name}</div>
                          <div style={{ fontSize:10,color:G,fontWeight:600 }}>● Live</div>
                        </div>
                        <div style={{ marginLeft:'auto',fontSize:10,color:T2 }}>
                          {a.fields['Client ID']||''}
                        </div>
                      </div>
                      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:6 }}>
                        <div style={{ background:a.color+'10',borderRadius:7,padding:'6px 9px' }}>
                          <div style={{ fontSize:9,color:T2,fontWeight:600 }}>Eff. Capital</div>
                          <div className="mono" style={{ fontSize:13,fontWeight:700,color:a.color }}>{fmtINR(brokerEc)}</div>
                        </div>
                        <div style={{ background:'#F0FDF4',borderRadius:7,padding:'6px 9px' }}>
                          <div style={{ fontSize:9,color:T2,fontWeight:600 }}>Risk/Trade</div>
                          <div className="mono" style={{ fontSize:13,fontWeight:700,color:G }}>{fmtINR(brokerRpt)}</div>
                        </div>
                        <div style={{ background:'#FFF7ED',borderRadius:7,padding:'6px 9px' }}>
                          <div style={{ fontSize:9,color:T2,fontWeight:600 }}>Leverage</div>
                          <div className="mono" style={{ fontSize:13,fontWeight:700,color:W }}>{lev}x</div>
                        </div>
                        <div style={{ background:'#EEF2FF',borderRadius:7,padding:'6px 9px' }}>
                          <div style={{ fontSize:9,color:T2,fontWeight:600 }}>Active Trades</div>
                          <div className="mono" style={{ fontSize:13,fontWeight:700,color:SB }}>
                            {Object.keys(activeSignals).length}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Rules panel */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontWeight:700,fontSize:12,color:T2,marginBottom:7,textTransform:'uppercase',letterSpacing:.5 }}>
              Active Rules
            </div>
            <div style={{ display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:7 }}>
              {[
                { label:'Fyers Auth',      ok:authStatus?.isAuthenticated, val:authStatus?.isAuthenticated?'✓ Connected':'✗ Not logged in', color:authStatus?.isAuthenticated?G:R },
                { label:'Capital',         ok:cap>1000, val:`₹${cap.toLocaleString('en-IN')}`, color:SB },
                { label:'Leverage',        ok:lev>0,    val:`${lev}x → ₹${(ec/100000).toFixed(1)}L`, color:SB },
                { label:'Risk/Trade',      ok:rpt>0,    val:`₹${rpt.toFixed(0)} (${rsk}%)`, color:W },
                { label:'R:R',             ok:rr>=1,    val:`1:${rr}`, color:G },
                { label:'SL Hits',         ok:slHits<msl, val:`${slHits}/${msl} used`, color:slHits>=msl?R:G },
                { label:'Day Loss',        ok:dayPnl>-dll, val:`₹${Math.abs(dayPnl).toFixed(0)} / ₹${dll.toFixed(0)}`, color:dayPnl<=-dll*0.7?R:W },
                { label:'Master',          ok:masterOn, val:masterOn?'ON':'OFF', color:masterOn?G:R },
                { label:'Stocks',          ok:selectedSymbols.length>0, val:`${selectedSymbols.length} selected`, color:selectedSymbols.length>0?G:W },
                { label:'Auto Squareoff',  ok:true,     val:'15:25 PM', color:G },
              ].map((r,i)=>(
                <div key={i} style={{ background:r.color+'10',border:`1.5px solid ${r.color}30`,
                  borderRadius:8,padding:'7px 10px' }}>
                  <div style={{ fontSize:9,color:T2,fontWeight:600,marginBottom:2 }}>{r.label}</div>
                  <div style={{ fontSize:11,fontWeight:700,color:r.color }}>{r.val}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Risk halt */}
          {riskStatus?.daily?.tradingHalted && (
            <div style={{ background:'#FFF1F2',border:`1px solid #FECDD3`,borderRadius:10,
              padding:'10px 14px',marginBottom:14,display:'flex',gap:8,alignItems:'center' }}>
              <AlertTriangle size={16} color={R}/>
              <span style={{ fontSize:13,fontWeight:600,color:R }}>🛑 Trading HALTED: {riskStatus.daily.haltReason}</span>
              <button onClick={()=>api.post('/api/risk/resume',{})} style={{ marginLeft:'auto',
                padding:'4px 12px',borderRadius:7,border:`1px solid ${R}`,
                background:'#fff',color:R,fontSize:12,fontWeight:600,cursor:'pointer' }}>Resume</button>
            </div>
          )}

          {/* Stock Cards */}
          <div style={{ marginBottom:14 }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:9 }}>
              <h3 style={{ fontWeight:700,fontSize:13,color:T1,display:'flex',alignItems:'center',gap:6 }}>
                <BarChart2 size={14} color={SB}/> ORB Stock Monitor
                <span style={{ color:T2,fontWeight:400,fontSize:11 }}>(10 slots · live)</span>
              </h3>
              <div style={{ display:'flex',gap:6 }}>
                {['ON','OFF'].map(v=>(
                  <button key={v} onClick={()=>selectedSymbols.forEach(s=>onToggleStock(s,v==='ON'))}
                    style={{ padding:'3px 10px',borderRadius:6,border:`1px solid ${v==='ON'?G:R}`,
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
                    rrCfg={rrConfig||riskStatus?.config} />
                ) : (
                  <div key={i} style={{ border:`2px dashed ${BD}`,borderRadius:12,padding:18,
                    display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                    gap:6,color:T2,minHeight:140 }}>
                    <Plus size={18} color="#CBD5E1"/>
                    <span style={{ fontSize:11 }}>Slot {i+1}</span>
                    <span style={{ fontSize:10 }}>Add via Stock List</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── CRYPTO TAB ───────────────────────────────────── */}
      {activeTab==='crypto' && (
        <div>
          {cryptoApis.length === 0 ? (
            <div style={{ textAlign:'center',padding:'40px 0',border:`2px dashed ${BD}`,borderRadius:12 }}>
              <div style={{ fontSize:40,marginBottom:8 }}>₿</div>
              <div style={{ fontWeight:600,fontSize:14,color:T1 }}>No Crypto APIs added</div>
              <div style={{ fontSize:12,color:T2,marginTop:4 }}>Go to API Credentials → Add API → Crypto → Delta Exchange</div>
            </div>
          ) : (
            <div>
              {cryptoApis.map(a=>{
                const isConn = a.connected;
                // Delta Exchange crypto panel
                return (
                  <div key={a.id} style={{ background:'#fff',border:`2px solid ${a.color}30`,
                    borderRadius:14,padding:'18px',marginBottom:14 }}>
                    {/* Header */}
                    <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:16 }}>
                      <div style={{ width:40,height:40,borderRadius:10,background:a.color,
                        display:'flex',alignItems:'center',justifyContent:'center',
                        fontSize:18,fontWeight:800,color:'#fff' }}>₿</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:800,fontSize:15,color:T1 }}>{a.name}</div>
                        <div style={{ fontSize:11,color:T2 }}>Crypto · 24/7 Markets</div>
                      </div>
                      <div style={{ display:'flex',alignItems:'center',gap:5,
                        padding:'4px 10px',borderRadius:7,
                        background:isConn?'#F5F3FF':'#F8FAFC',
                        border:`1px solid ${isConn?a.color+'40':BD}` }}>
                        <div style={{ width:6,height:6,borderRadius:'50%',
                          background:isConn?a.color:'#CBD5E1',
                          boxShadow:isConn?`0 0 5px ${a.color}`:'none' }}/>
                        <span style={{ fontSize:11,fontWeight:700,color:isConn?a.color:T2 }}>
                          {isConn?'Connected 24/7':'Not Connected'}
                        </span>
                      </div>
                    </div>

                    {/* Stats grid */}
                    {(()=>{
                      // Show real balances if connected
                      const balances = a.balance || [];
                      const usdtBal = balances.find(b=>(b.asset_symbol||b.currency||'').toUpperCase()==='USDT');
                      const btcBal  = balances.find(b=>(b.asset_symbol||b.currency||'').toUpperCase()==='BTC');
                      const availUSDT = parseFloat(usdtBal?.available_balance||usdtBal?.balance||a.availableBalance||0);
                      return (
                        <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:9,marginBottom:14 }}>
                          {[
                            { label:'Available Balance', val: availUSDT>0?`$${availUSDT.toFixed(2)}`:'—', sub: availUSDT>0?'USDT Wallet':'Connect to sync', color:a.color },
                            { label:'Active Strategy',   val:'ORB', sub:'Opening Range Breakout', color:'#10B981' },
                            { label:'Leverage',          val:'—x', sub:'Set in R&R Crypto', color:W },
                            { label:'Open Positions',    val:'0', sub:'No open positions', color:SB },
                          ].map((s,i)=>(
                            <div key={i} style={{ background:s.color+'10',border:`1px solid ${s.color}20`,
                              borderRadius:9,padding:'10px 12px' }}>
                              <div style={{ fontSize:10,color:T2,fontWeight:600,marginBottom:4 }}>{s.label}</div>
                              <div className="mono" style={{ fontSize:16,fontWeight:700,color:s.color }}>{s.val}</div>
                              <div style={{ fontSize:10,color:T2,marginTop:2 }}>{s.sub}</div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Wallet breakdown */}
                    {isConn && a.balance && a.balance.length > 0 && (
                      <div style={{ marginBottom:14 }}>
                        <div style={{ fontWeight:700,fontSize:12,color:T2,marginBottom:7,textTransform:'uppercase',letterSpacing:.5 }}>
                          Wallet Balances
                        </div>
                        <div style={{ display:'flex',gap:7,flexWrap:'wrap' }}>
                          {a.balance.filter(b=>parseFloat(b.available_balance||b.balance||0)>0).slice(0,8).map((b,i)=>{
                            const asset = b.asset_symbol||b.currency||'?';
                            const bal   = parseFloat(b.available_balance||b.balance||0);
                            return (
                              <div key={i} style={{ background:'#F5F3FF',border:'1px solid #DDD6FE',
                                borderRadius:8,padding:'7px 12px',minWidth:100 }}>
                                <div style={{ fontSize:10,color:'#7C3AED',fontWeight:700 }}>{asset}</div>
                                <div className="mono" style={{ fontSize:13,fontWeight:700,color:T1 }}>
                                  {bal.toFixed(4)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Crypto slots — 5 positions */}
                    <div style={{ fontWeight:700,fontSize:12,color:T2,marginBottom:8,textTransform:'uppercase',letterSpacing:.5 }}>
                      Crypto Positions (5 slots)
                    </div>
                    <div style={{ display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:8 }}>
                      {Array.from({length:5},(_,i)=>(
                        <div key={i} style={{ border:`2px dashed ${a.color}30`,borderRadius:10,
                          padding:14,display:'flex',flexDirection:'column',alignItems:'center',
                          justifyContent:'center',gap:5,minHeight:100,background:a.color+'05' }}>
                          <span style={{ fontSize:18 }}>₿</span>
                          <span style={{ fontSize:10,color:T2 }}>Crypto {i+1}</span>
                          <span style={{ fontSize:9,color:T2 }}>Add via Crypto Selection</span>
                        </div>
                      ))}
                    </div>

                    {!isConn && (
                      <div style={{ marginTop:12,padding:'9px 12px',borderRadius:8,
                        background:'#FFF7ED',border:'1px solid #FED7AA',
                        fontSize:12,color:W }}>
                        ⚠️ Connect Delta Exchange in API Credentials to enable live data and trading.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── ALERT FEED (always visible) ────────────────── */}
      <SCard title="Alert Feed" icon={Bell}
        action={<span style={{ fontSize:12,color:T2 }}>{alerts.length} today</span>}>
        {alerts.length===0
          ? <div style={{ textAlign:'center',color:T2,fontSize:13,padding:'16px 0' }}>No alerts yet…</div>
          : <div style={{ maxHeight:220,overflowY:'auto' }}>
              {alerts.slice().reverse().map((a,i)=><AlertItem key={i} alert={a}/>)}
            </div>
        }
      </SCard>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// BROKER CONFIG
// ─────────────────────────────────────────────────────────
const BROKERS = {
  indian: [
    { id:'fyers',    name:'Fyers',     color:'#6366F1',
      fields:['App ID','Secret Key','Client ID','Redirect URL'],
      autoToken:true, tokenField:'Access Token',
      note:'After saving App ID & Secret Key → click Connect → Fyers login opens → token saves automatically' },
    { id:'dhan',     name:'Dhan',      color:'#0EA5E9',
      fields:['Client ID','Access Token','Partner ID','Partner Name','API Key'] },
    { id:'angelone', name:'AngelOne',  color:'#F59E0B',
      fields:['API Key','Secret Key','Client Code','PIN','TOTP Key'] },
    { id:'upstox',   name:'Upstox',    color:'#10B981',
      fields:['API Key','Secret Key','Redirect URI','User ID'],
      autoToken:true, tokenField:'Access Token' },
  ],
  crypto: [
    { id:'delta', name:'Delta Exchange', color:'#8B5CF6',
      fields:['App Name','API Key','API Secret','Region'],
      alwaysOn:true,
      note:'India users: select India. Global users: select Global. API Key and Secret from delta.exchange → Profile → API Keys' },
  ]
};

// ── API Credentials View ──────────────────────────────────
function ApiCredView({ authStatus, onApisChange }) {
  const [loading,  setLoading]  = useState(false);
  const [msg,      setMsg]      = useState(null);
  const [token,    setToken]    = useState('');
  const [showS,    setShowS]    = useState(false);

  // Multi-broker APIs — persisted in localStorage
  const [apis, setApis] = useState(() => {
    try { return JSON.parse(localStorage.getItem('orb_apis') || '[]'); } catch(_) { return []; }
  });

  // Modal state
  const [showModal,   setShowModal]   = useState(false);
  const [modalStep,   setModalStep]   = useState(1);
  const [selCategory, setSelCategory] = useState(null);
  const [selBroker,   setSelBroker]   = useState(null);
  const [formData,    setFormData]    = useState({});
  const [apiName,     setApiName]     = useState('');
  const [showPwd,     setShowPwd]     = useState({});

  // Edit modal state
  const [editApi,     setEditApi]     = useState(null);
  const [editData,    setEditData]    = useState({});
  const [editName,    setEditName]    = useState('');

  // Connect status per api
  const [connStatus, setConnStatus]  = useState({});

  const saveApis = (updated) => {
    setApis(updated);
    localStorage.setItem('orb_apis', JSON.stringify(updated));
    if (onApisChange) onApisChange(updated); // sync parent immediately
  };

  // ── Add flow ──────────────────────────────────────────────
  const openModal = () => {
    setShowModal(true); setModalStep(1);
    setSelCategory(null); setSelBroker(null);
    setFormData({}); setApiName(''); setShowPwd({});
  };
  const closeModal  = () => setShowModal(false);
  const selCat      = (c) => { setSelCategory(c); setModalStep(2); };
  const selBrok     = (b) => {
    setSelBroker(b); setModalStep(3);
    setApiName(b.name + ' API ' + (apis.filter(a=>a.brokerId===b.id).length+1));
  };

  const addApi = () => {
    if (!selBroker) return;
    const newApi = {
      id: Date.now(), brokerId: selBroker.id, name: apiName||selBroker.name,
      category: selCategory, color: selBroker.color,
      fields: formData, enabled: true,
      alwaysOn: selBroker.alwaysOn||false,
      connected: false, addedAt: new Date().toISOString()
    };
    saveApis([...apis, newApi]);
    closeModal();
    setMsg({ type:'success', text: selBroker.name + ' API added!' });
  };

  // ── Edit flow ─────────────────────────────────────────────
  const openEdit = (a) => {
    setEditApi(a); setEditData({...a.fields}); setEditName(a.name);
  };
  const closeEdit = () => setEditApi(null);
  const saveEdit  = () => {
    saveApis(apis.map(a => a.id===editApi.id
      ? { ...a, name: editName, fields: editData } : a));
    closeEdit();
    setMsg({ type:'success', text: 'API updated' });
  };

  // ── Toggle / Delete ───────────────────────────────────────
  const toggleApi = (id) => saveApis(apis.map(a => a.id===id ? {...a, enabled:!a.enabled} : a));
  const deleteApi = (id) => {
    if (window.confirm('Delete this API? This cannot be undone.'))
      saveApis(apis.filter(a => a.id!==id));
  };

  // ── Connect — push credentials to backend then open OAuth ──
  const connectApi = async (a) => {
    setConnStatus(p => ({...p, [a.id]: 'connecting'}));
    try {
      if (a.brokerId === 'fyers') {
        // Step 1: Push App ID + Secret to backend first
        const appId    = a.fields['App ID'];
        const secretKey = a.fields['Secret Key'];
        const clientId  = a.fields['Client ID'];
        const redirectUrl = a.fields['Redirect URL'] ||
          `${window.location.protocol}//${window.location.host}/api/auth/callback`;

        if (!appId || !secretKey) {
          setMsg({ type:'error', text: 'Please edit this API and fill in App ID and Secret Key first.' });
          setConnStatus(p => ({...p, [a.id]: 'idle'}));
          return;
        }

        // Push credentials to backend
        await api.post('/api/auth/credentials', {
          appId, secretKey, redirectUri: redirectUrl
        });

        // Step 2: Open Fyers OAuth
        const r = await api.get('/api/auth/url');
        window.open(r.url, '_blank');
        setMsg({ type:'success', text: '✅ Credentials saved! Fyers login opened in new tab. After login, token saves automatically.' });

        // Check auth status after 10 seconds
        setTimeout(async () => {
          try {
            const status = await api.get('/api/auth/status');
            if (status.isAuthenticated) {
              setConnStatus(p => ({...p, [a.id]: 'connected'}));
              saveApis(apis.map(x => x.id===a.id ? {...x, connected:true} : x));
              setMsg({ type:'success', text: '✅ Fyers connected successfully!' });
            }
          } catch(_) {}
        }, 10000);

      } else if (a.brokerId === 'delta') {
        const apiKey    = a.fields['API Key'];
        const apiSecret = a.fields['API Secret'];
        const appName   = a.fields['App Name'] || a.name;
        if (!apiKey || !apiSecret) {
          setMsg({ type:'error', text: 'Please edit this API and fill in API Key and API Secret first.' });
          setConnStatus(p => ({...p, [a.id]: 'idle'}));
          return;
        }
        // Call backend to verify and fetch balance
        try {
          const region = (a.fields['Region']||'india').toLowerCase().includes('india')?'india':'global';
          const r = await api.post('/api/delta/connect', {
            id: String(a.id), name: appName, apiKey, apiSecret, region
          });
          if (r.success) {
            saveApis(apis.map(x => x.id===a.id
              ? { ...x, connected:true, balance: r.balance, availableBalance: r.availableBalance }
              : x
            ));
            setConnStatus(p => ({...p, [a.id]: 'connected'}));
            setMsg({ type:'success', text: `✅ Delta Exchange connected! Balance: $${parseFloat(r.availableBalance||0).toFixed(2)}` });
          } else {
            // Show full error details
            const errMsg = r.error || (r.details && JSON.stringify(r.details)) || 'Connection failed';
            throw new Error(errMsg);
          }
        } catch(err) {
          setConnStatus(p => ({...p, [a.id]: 'error'}));
          const errText = err?.message || String(err);
          setMsg({ type:'error', text: '❌ Delta: ' + errText });
        }
      } else {
        setMsg({ type:'info', text: a.name + ' — paste access token in the edit form.' });
        setConnStatus(p => ({...p, [a.id]: 'idle'}));
      }
    } catch(e) {
      setConnStatus(p => ({...p, [a.id]: 'error'}));
      setMsg({ type:'error', text: e.message });
    }
  };

  // ── Fyers active connection ───────────────────────────────
  const handleGetUrl = async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/auth/url');
      window.open(r.url, '_blank');
      setMsg({ type:'info', text: 'Fyers login opened. After login token auto-saves.' });
    } catch(e) { setMsg({ type:'error', text: e.message }); }
    setLoading(false);
  };
  const handleManualToken = async () => {
    if (!token) return; setLoading(true);
    try {
      const r = await api.post('/api/auth/token', { token });
      setMsg({ type:'success', text: r.message });
    } catch(e) { setMsg({ type:'error', text: e.message }); }
    setLoading(false);
  };

  const brokerList = selCategory ? BROKERS[selCategory] : [];

  const connIcon = (apiId, connected) => {
    const st = connStatus[apiId];
    if (st === 'connecting') return '⏳';
    if (st === 'connected' || connected) return '🟢';
    if (st === 'error') return '🔴';
    return '⚫';
  };

  const getBrokerDef = (brokerId) =>
    [...BROKERS.indian, ...BROKERS.crypto].find(b => b.id===brokerId);

  return (
    <div style={{ padding:'22px', height:'100%', overflowY:'auto' }}>
      {/* Header */}
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
        <div>
          <h2 style={{ fontSize:19,fontWeight:800,color:SB,margin:0 }}>API Credentials</h2>
          <p style={{ fontSize:13,color:T2,marginTop:2 }}>Manage broker connections for live trading</p>
        </div>
        <button onClick={openModal} style={{ display:'flex',alignItems:'center',gap:7,
          padding:'9px 18px',borderRadius:9,border:'none',background:SB,color:'#fff',
          fontWeight:700,fontSize:13,cursor:'pointer' }}>
          <span style={{ fontSize:18,lineHeight:1 }}>+</span> ADD API
        </button>
      </div>

      {/* Active Bot Connection (Fyers) */}
      <SCard title="Active Bot Connection (Fyers)" icon={Wifi}>
        <div style={{ display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderRadius:9,
          background:authStatus?.isAuthenticated?'#F0FDF4':'#FFF7ED',
          border:`1px solid ${authStatus?.isAuthenticated?'#BBF7D0':'#FED7AA'}`,marginBottom:12 }}>
          {authStatus?.isAuthenticated ? <CheckCircle size={16} color={G}/> : <AlertCircle size={16} color={W}/>}
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13,fontWeight:700,color:authStatus?.isAuthenticated?G:W }}>
              {authStatus?.isAuthenticated ? '✓ Fyers Connected' : '✗ Not Connected'}
            </div>
            {authStatus?.profile && <div style={{ fontSize:11,color:T2 }}>{authStatus.profile.name} · {authStatus.profile.email}</div>}
            {authStatus?.expiresAt && <div style={{ fontSize:10,color:T2 }}>Expires: {new Date(authStatus.expiresAt).toLocaleTimeString('en-IN')}</div>}
          </div>
          <button onClick={handleGetUrl} disabled={loading} style={{ padding:'6px 14px',borderRadius:7,
            border:'none',background:SB,color:'#fff',fontWeight:600,fontSize:12,cursor:'pointer' }}>
            {loading?'...':'Login to Fyers'}
          </button>
        </div>
        <div style={{ fontSize:11,color:T2,marginBottom:6,fontWeight:600 }}>Or paste access token manually:</div>
        <div style={{ display:'flex',gap:8 }}>
          <div style={{ flex:1,display:'flex',alignItems:'center',border:`1.5px solid ${BD}`,borderRadius:8,overflow:'hidden' }}>
            <input type={showS?'text':'password'} value={token} onChange={e=>setToken(e.target.value)}
              placeholder="Paste Fyers access token…"
              style={{ flex:1,padding:'8px 12px',border:'none',background:'transparent',fontSize:12,color:T1 }} />
            <button onClick={()=>setShowS(p=>!p)} style={{ padding:'0 10px',border:'none',background:'transparent',cursor:'pointer' }}>
              {showS?<EyeOff size={13} color={T2}/>:<Eye size={13} color={T2}/>}
            </button>
          </div>
          <button onClick={handleManualToken} disabled={!token||loading} style={{ padding:'8px 14px',
            borderRadius:8,border:'none',background:G,color:'#fff',fontWeight:700,fontSize:12,cursor:'pointer' }}>Save</button>
        </div>
      </SCard>

      {/* API List */}
      <div style={{ fontWeight:700,fontSize:13,color:T1,marginBottom:8 }}>
        Saved APIs ({apis.length}/5 max per broker)
      </div>

      {apis.length === 0 ? (
        <div style={{ textAlign:'center',padding:'32px 0',color:T2,
          border:`1.5px dashed ${BD}`,borderRadius:12,marginBottom:14 }}>
          <div style={{ fontSize:32,marginBottom:8 }}>🔌</div>
          <div style={{ fontWeight:600,fontSize:14 }}>No APIs added yet</div>
          <div style={{ fontSize:12,marginTop:4 }}>Click + ADD API to connect a broker</div>
        </div>
      ) : (
        <div style={{ marginBottom:14 }}>
          {apis.map(a => {
            const bDef = getBrokerDef(a.brokerId);
            const filledFields = Object.values(a.fields||{}).filter(Boolean).length;
            const totalFields  = bDef?.fields?.length || 0;
            const isConnected  = connStatus[a.id]==='connected' || a.connected;
            return (
              <div key={a.id} style={{ background:'#fff',border:`1.5px solid ${a.enabled?a.color+'40':BD}`,
                borderRadius:12,padding:'12px 14px',marginBottom:10 }}>
                {/* Top row */}
                <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:8 }}>
                  {/* Broker logo */}
                  <div style={{ width:36,height:36,borderRadius:9,background:a.color,
                    display:'flex',alignItems:'center',justifyContent:'center',
                    fontSize:14,fontWeight:800,color:'#fff',flexShrink:0 }}>
                    {a.name[0]}
                  </div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontWeight:700,fontSize:13,color:T1 }}>{a.name}</div>
                    <div style={{ fontSize:11,color:T2 }}>
                      {a.category==='indian'?'🇮🇳':'₿'} {a.brokerId} · {filledFields}/{totalFields} fields
                      {a.alwaysOn && <span style={{ marginLeft:6,background:'#F5F3FF',color:'#8B5CF6',
                        padding:'1px 5px',borderRadius:3,fontSize:9,fontWeight:700 }}>24/7</span>}
                    </div>
                  </div>
                  {/* Status dot + label */}
                  <div style={{ display:'flex',alignItems:'center',gap:4,fontSize:11,
                    color:isConnected?G:T2,fontWeight:600 }}>
                    <div style={{ width:7,height:7,borderRadius:'50%',
                      background:isConnected?G:'#CBD5E1',
                      boxShadow:isConnected?`0 0 5px ${G}`:'none' }}/>
                    {isConnected?'Connected':'Not connected'}
                  </div>
                </div>

                {/* Actions row */}
                <div style={{ display:'flex',alignItems:'center',gap:7,borderTop:`1px solid ${BD}`,paddingTop:9 }}>
                  {/* Enable/Disable toggle */}
                  <div style={{ display:'flex',alignItems:'center',gap:5,flex:1 }}>
                    <Toggle on={a.enabled} onToggle={()=>toggleApi(a.id)} size="sm" />
                    <span style={{ fontSize:11,fontWeight:700,color:a.enabled?SB:T2 }}>
                      {a.enabled?'Active':'Inactive'}
                    </span>
                  </div>

                  {/* Connect button */}
                  <button onClick={()=>connectApi(a)} style={{ padding:'5px 11px',borderRadius:7,
                    border:`1px solid ${G}`,background:isConnected?'#F0FDF4':'#fff',
                    color:G,fontWeight:600,fontSize:11,cursor:'pointer',
                    display:'flex',alignItems:'center',gap:4 }}>
                    {connIcon(a.id, a.connected)} {isConnected?'Reconnect':'Connect'}
                  </button>

                  {/* Edit button */}
                  <button onClick={()=>openEdit(a)} style={{ padding:'5px 11px',borderRadius:7,
                    border:`1px solid ${SB}`,background:'#EEF2FF',
                    color:SB,fontWeight:600,fontSize:11,cursor:'pointer' }}>
                    ✏ Edit
                  </button>

                  {/* Delete button */}
                  <button onClick={()=>deleteApi(a.id)} style={{ padding:'5px 11px',borderRadius:7,
                    border:`1px solid ${R}30`,background:'#FFF1F2',
                    color:R,fontWeight:700,fontSize:11,cursor:'pointer' }}>
                    ✕ Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Message */}
      {msg && (
        <div onClick={()=>setMsg(null)} style={{ cursor:'pointer',
          background:msg.type==='success'?'#F0FDF4':msg.type==='error'?'#FFF1F2':'#EEF2FF',
          border:`1px solid ${msg.type==='success'?'#BBF7D0':msg.type==='error'?'#FECDD3':'#C7D2FE'}`,
          borderRadius:9,padding:'10px 14px',fontSize:13,marginBottom:8,
          color:msg.type==='success'?G:msg.type==='error'?R:SB }}>
          {msg.text} <span style={{ float:'right',opacity:.5 }}>✕</span>
        </div>
      )}

      {/* ── ADD API MODAL ─────────────────────────────────── */}
      {showModal && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',
          display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000 }}
          onClick={e=>e.target===e.currentTarget&&closeModal()}>
          <div style={{ background:'#fff',borderRadius:16,width:500,maxHeight:'85vh',
            overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding:'18px 20px',borderBottom:`1px solid ${BD}`,
              display:'flex',justifyContent:'space-between',alignItems:'center' }}>
              <div>
                <div style={{ fontWeight:800,fontSize:16,color:T1 }}>
                  {modalStep===1?'Select Market':modalStep===2?'Select Broker':'Add API Credentials'}
                </div>
                <div style={{ fontSize:11,color:T2,marginTop:2 }}>
                  {modalStep===1?'Indian markets or Crypto 24/7':
                   modalStep===2?`${selCategory==='indian'?'🇮🇳 Indian':'₿ Crypto'} Brokers`:
                   `Enter credentials for ${selBroker?.name}`}
                </div>
              </div>
              <button onClick={closeModal} style={{ background:'none',border:'none',
                fontSize:22,cursor:'pointer',color:T2,lineHeight:1 }}>×</button>
            </div>

            <div style={{ padding:'20px' }}>
              {/* Step 1 — Category */}
              {modalStep===1 && (
                <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
                  {[
                    { id:'indian', emoji:'🇮🇳', label:'Indian', sub:'NSE/BSE · 9:15 AM–3:30 PM', color:'#10B981' },
                    { id:'crypto', emoji:'₿',   label:'Crypto',  sub:'Global · 24/7 Markets',    color:'#8B5CF6' },
                  ].map(cat=>(
                    <button key={cat.id} onClick={()=>selCat(cat.id)} style={{
                      padding:'24px 16px',borderRadius:12,border:`2px solid ${cat.color}30`,
                      background:cat.color+'08',cursor:'pointer',textAlign:'center',transition:'all .15s' }}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor=cat.color;e.currentTarget.style.background=cat.color+'12'}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor=cat.color+'30';e.currentTarget.style.background=cat.color+'08'}}>
                      <div style={{ fontSize:36,marginBottom:8 }}>{cat.emoji}</div>
                      <div style={{ fontWeight:700,fontSize:15,color:T1 }}>{cat.label}</div>
                      <div style={{ fontSize:11,color:T2,marginTop:3 }}>{cat.sub}</div>
                    </button>
                  ))}
                </div>
              )}

              {/* Step 2 — Broker */}
              {modalStep===2 && (
                <div>
                  <button onClick={()=>setModalStep(1)} style={{ background:'none',border:'none',
                    color:SB,fontSize:12,cursor:'pointer',marginBottom:14,padding:0 }}>← Back</button>
                  <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
                    {brokerList.map(b=>(
                      <button key={b.id} onClick={()=>selBrok(b)} style={{
                        padding:'16px',borderRadius:11,border:`2px solid ${b.color}30`,
                        background:b.color+'08',cursor:'pointer',textAlign:'left',transition:'all .15s' }}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor=b.color}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor=b.color+'30'}}>
                        <div style={{ width:34,height:34,borderRadius:8,background:b.color,
                          display:'flex',alignItems:'center',justifyContent:'center',
                          marginBottom:8,fontSize:15,fontWeight:800,color:'#fff' }}>{b.name[0]}</div>
                        <div style={{ fontWeight:700,fontSize:13,color:T1 }}>{b.name}</div>
                        <div style={{ fontSize:10,color:T2,marginTop:2 }}>
                          {b.fields.length} credential fields
                          {b.autoToken && <span style={{ color:G,marginLeft:4 }}>· auto-token</span>}
                          {b.alwaysOn  && <span style={{ color:'#8B5CF6',marginLeft:4 }}>· 24/7</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 3 — Form */}
              {modalStep===3 && selBroker && (
                <div>
                  <button onClick={()=>setModalStep(2)} style={{ background:'none',border:'none',
                    color:SB,fontSize:12,cursor:'pointer',marginBottom:14,padding:0 }}>← Back</button>

                  {/* Auto-token note for supported brokers */}
                  {selBroker.autoToken && (
                    <div style={{ background:'#F0FDF4',border:'1px solid #BBF7D0',borderRadius:8,
                      padding:'9px 12px',marginBottom:14,fontSize:12,color:G }}>
                      ✅ <b>{selBroker.name}</b> supports auto-token. After saving App ID & Secret Key,
                      click <b>Connect</b> on the API card — token fetches automatically via OAuth.
                      No manual copy-paste needed.
                    </div>
                  )}

                  {/* API Name */}
                  <div style={{ marginBottom:12 }}>
                    <label style={{ fontSize:12,fontWeight:600,color:T2,display:'block',marginBottom:5 }}>API Name</label>
                    <input value={apiName} onChange={e=>setApiName(e.target.value)}
                      style={{ width:'100%',padding:'9px 12px',border:`1.5px solid ${BD}`,
                        borderRadius:8,fontSize:13,color:T1,boxSizing:'border-box' }} />
                  </div>

                  {/* Fields — skip Access Token for auto-token brokers (fetched automatically) */}
                  {selBroker.fields.filter(f =>
                    !(selBroker.autoToken && f === (selBroker.tokenField||'Access Token'))
                  ).map((field,i) => {
                    const isSecret = field.toLowerCase().includes('secret')||
                                     field.toLowerCase().includes('key')||
                                     field.toLowerCase().includes('token')||
                                     field.toLowerCase().includes('pin')||
                                     field.toLowerCase().includes('totp');
                    // Special handling for Region field
                    if (field === 'Region') {
                      return (
                        <div key={i} style={{ marginBottom:11 }}>
                          <label style={{ fontSize:12,fontWeight:600,color:T2,display:'block',marginBottom:4 }}>Region</label>
                          <select value={formData['Region']||'India'}
                            onChange={e=>setFormData(p=>({...p,Region:e.target.value}))}
                            style={{ width:'100%',padding:'9px 12px',border:`1.5px solid ${BD}`,
                              borderRadius:8,fontSize:13,color:T1,background:'#fff' }}>
                            <option value="India">🇮🇳 India (api.india.delta.exchange)</option>
                            <option value="Global">🌍 Global (api.delta.exchange)</option>
                          </select>
                          <div style={{ fontSize:10,color:T2,marginTop:3 }}>
                            Select India if you are using Delta Exchange India account
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={i} style={{ marginBottom:11 }}>
                        <label style={{ fontSize:12,fontWeight:600,color:T2,display:'block',marginBottom:4 }}>
                          {field}
                        </label>
                        <div style={{ display:'flex',alignItems:'center',
                          border:`1.5px solid ${BD}`,borderRadius:8,overflow:'hidden' }}>
                          <input
                            type={isSecret&&!showPwd[field]?'password':'text'}
                            value={formData[field]||''}
                            onChange={e=>setFormData(p=>({...p,[field]:e.target.value}))}
                            placeholder={`Enter ${field}`}
                            style={{ flex:1,padding:'9px 12px',border:'none',background:'transparent',
                              fontSize:12,color:T1,fontFamily:'JetBrains Mono,monospace' }} />
                          {isSecret && (
                            <button onClick={()=>setShowPwd(p=>({...p,[field]:!p[field]}))}
                              style={{ padding:'0 10px',border:'none',background:'transparent',cursor:'pointer' }}>
                              {showPwd[field]?<EyeOff size={12} color={T2}/>:<Eye size={12} color={T2}/>}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {selBroker.alwaysOn && (
                    <div style={{ background:'#F5F3FF',border:'1px solid #DDD6FE',borderRadius:8,
                      padding:'9px 12px',marginBottom:12,fontSize:12,color:'#7C3AED' }}>
                      ⏰ Delta Exchange trades 24/7 — this API stays active round the clock
                    </div>
                  )}

                  <button onClick={addApi} style={{ width:'100%',padding:'11px',borderRadius:9,
                    border:'none',background:selBroker.color,color:'#fff',
                    fontWeight:700,fontSize:14,cursor:'pointer',marginTop:4 }}>
                    Add {selBroker.name} API
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT API MODAL ─────────────────────────────────── */}
      {editApi && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',
          display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000 }}
          onClick={e=>e.target===e.currentTarget&&closeEdit()}>
          <div style={{ background:'#fff',borderRadius:16,width:500,maxHeight:'85vh',
            overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding:'18px 20px',borderBottom:`1px solid ${BD}`,
              display:'flex',justifyContent:'space-between',alignItems:'center' }}>
              <div>
                <div style={{ fontWeight:800,fontSize:16,color:T1 }}>Edit API Credentials</div>
                <div style={{ fontSize:11,color:T2,marginTop:2 }}>{editApi.name}</div>
              </div>
              <button onClick={closeEdit} style={{ background:'none',border:'none',
                fontSize:22,cursor:'pointer',color:T2 }}>×</button>
            </div>
            <div style={{ padding:'20px' }}>
              <div style={{ marginBottom:12 }}>
                <label style={{ fontSize:12,fontWeight:600,color:T2,display:'block',marginBottom:5 }}>API Name</label>
                <input value={editName} onChange={e=>setEditName(e.target.value)}
                  style={{ width:'100%',padding:'9px 12px',border:`1.5px solid ${BD}`,
                    borderRadius:8,fontSize:13,color:T1,boxSizing:'border-box' }} />
              </div>
              {(getBrokerDef(editApi.brokerId)?.fields||[]).map((field,i)=>{
                const isSecret = field.toLowerCase().includes('secret')||
                                 field.toLowerCase().includes('key')||
                                 field.toLowerCase().includes('token')||
                                 field.toLowerCase().includes('pin');
                return (
                  <div key={i} style={{ marginBottom:11 }}>
                    <label style={{ fontSize:12,fontWeight:600,color:T2,display:'block',marginBottom:4 }}>{field}</label>
                    <div style={{ display:'flex',alignItems:'center',
                      border:`1.5px solid ${BD}`,borderRadius:8,overflow:'hidden' }}>
                      <input
                        type={isSecret&&!showPwd['edit_'+field]?'password':'text'}
                        value={editData[field]||''}
                        onChange={e=>setEditData(p=>({...p,[field]:e.target.value}))}
                        placeholder={`Enter ${field}`}
                        style={{ flex:1,padding:'9px 12px',border:'none',background:'transparent',
                          fontSize:12,color:T1,fontFamily:'JetBrains Mono,monospace' }} />
                      {isSecret && (
                        <button onClick={()=>setShowPwd(p=>({...p,['edit_'+field]:!p['edit_'+field]}))}
                          style={{ padding:'0 10px',border:'none',background:'transparent',cursor:'pointer' }}>
                          {showPwd['edit_'+field]?<EyeOff size={12} color={T2}/>:<Eye size={12} color={T2}/>}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:4 }}>
                <button onClick={closeEdit} style={{ padding:'10px',borderRadius:8,
                  border:`1.5px solid ${BD}`,background:'#fff',color:T2,fontWeight:600,cursor:'pointer' }}>
                  Cancel
                </button>
                <button onClick={saveEdit} style={{ padding:'10px',borderRadius:8,border:'none',
                  background:SB,color:'#fff',fontWeight:700,cursor:'pointer' }}>
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ── Live Chart View ───────────────────────────────────────
function LiveChartView({ selectedSymbols, ticks, orbLevels, activeSignals, authStatus }) {
  const [chartSym,  setChartSym]  = useState(selectedSymbols[0] || 'NSE:RELIANCE-EQ');
  const [tf,        setTf]        = useState('5');
  const [candles,   setCandles]   = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [livePrice, setLivePrice] = useState(null);
  const [chartOrb,  setChartOrb]  = useState({ high:null, low:null }); // computed from chart data

  const TF_LABELS = [
    {k:'1',l:'1M'},{k:'3',l:'3M'},{k:'5',l:'5M'},{k:'15',l:'15M'},
    {k:'30',l:'30M'},{k:'60',l:'1H'},{k:'D',l:'1D'},{k:'W',l:'1W'}
  ];

  // ── Compute ORB from first 5-min candle of today ──────────
  const computeORBFromCandles = (candleList) => {
    if (!candleList?.length) return { high:null, low:null };
    
    // Find today's date
    const today = new Date();
    const todayStr = today.toDateString();
    
    // Find candles from today only
    const todayCandles = candleList.filter(c => {
      const d = new Date(c.time);
      return d.toDateString() === todayStr;
    });
    
    if (todayCandles.length === 0) return { high:null, low:null };
    
    // First candle of today = 9:15 AM candle
    const firstCandle = todayCandles[0];
    
    // For 5M resolution — first candle IS the ORB candle (9:15-9:20)
    // For 1M — take first 5 candles (9:15, 9:16, 9:17, 9:18, 9:19)
    // For 15M+ — take first candle
    let orbCandles = [];
    if (tf === '5') {
      orbCandles = [todayCandles[0]]; // first 5M candle
    } else if (tf === '1' || tf === '3') {
      // Take candles from 9:15 to 9:20
      orbCandles = todayCandles.filter(c => {
        const d = new Date(c.time);
        const mins = d.getHours()*60 + d.getMinutes();
        return mins >= 9*60+15 && mins < 9*60+20;
      });
      if (!orbCandles.length) orbCandles = [todayCandles[0]];
    } else {
      orbCandles = [todayCandles[0]];
    }
    
    const orbHigh = Math.max(...orbCandles.map(c => c.high));
    const orbLow  = Math.min(...orbCandles.map(c => c.low));
    
    return { high: orbHigh, low: orbLow };
  };

  // ── Fetch historical candles ──────────────────────────────
  const loadChart = async () => {
    if (!chartSym) return;
    setLoading(true);
    try {
      const days = ['D','W'].includes(tf) ? 365 : tf==='60' ? 60 : 10;
      const r = await api.get(
        `/api/stocks/history?symbol=${encodeURIComponent(chartSym)}&resolution=${tf}&days=${days}`
      );
      if (r.success && r.candles?.length > 0) {
        setCandles(r.candles);
        // Compute ORB from fetched candles
        const orb = computeORBFromCandles(r.candles);
        setChartOrb(orb);
      } else {
        setCandles([]);
        setChartOrb({ high:null, low:null });
      }
    } catch(e) {
      setCandles([]);
      setChartOrb({ high:null, low:null });
    }
    setLoading(false);
  };

  useEffect(()=>{ loadChart(); },[chartSym, tf]);
  useEffect(()=>{ if(authStatus?.isAuthenticated) loadChart(); },[authStatus?.isAuthenticated]);

  // ── Live price update ─────────────────────────────────────
  useEffect(()=>{
    const tick = ticks[chartSym];
    if (tick?.ltp) { setLivePrice(tick); return; }
    const t = setInterval(async () => {
      try {
        const r = await api.get(`/api/stocks/quote/${encodeURIComponent(chartSym)}`);
        if (r.quote?.ltp) setLivePrice(r.quote);
      } catch(_) {}
    }, 3000);
    return () => clearInterval(t);
  }, [chartSym, ticks]);

  // ── Update last candle with live tick ─────────────────────
  useEffect(()=>{
    const tick = ticks[chartSym];
    if (!tick?.ltp || candles.length === 0) return;
    setCandles(prev => {
      const updated = [...prev];
      const last = { ...updated[updated.length-1] };
      last.close = tick.ltp;
      last.high  = Math.max(last.high, tick.ltp);
      last.low   = Math.min(last.low,  tick.ltp);
      updated[updated.length-1] = last;
      return updated;
    });
  }, [ticks[chartSym]?.ltp]);

  // Use chartOrb (from candles) if orbLevels not locked yet
  const orb = orbLevels[chartSym]?.locked
    ? orbLevels[chartSym]
    : chartOrb;

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
          { l:'Status',     v: orbLevels[chartSym]?.locked?'LOCKED':orb?.high?'COMPUTED':'WAITING',
            c: orbLevels[chartSym]?.locked?G:orb?.high?'#F59E0B':T2 },
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
                tradeInfo={signal} symbol={chartSym} firstCandleHighlight={true} />
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

  // Load all NSE stocks from Fyers instruments API
  useEffect(() => {
    const load = async () => {
      setLoadingStocks(true);
      try {
        const r = await api.get('/api/instruments');
        if (r.stocks?.length > 0) {
          const merged = r.stocks.map(s => ({
            symbol: s.symbol,
            name:   s.name,
            price:  INDIAN_STOCKS.find(i=>i.symbol===s.symbol)?.price || 0
          }));
          // Sort alphabetically by symbol
          merged.sort((a,b) => a.symbol.localeCompare(b.symbol));
          setAllStocks(merged);
        } else {
          // Fallback: keep INDIAN_STOCKS if API fails
          setAllStocks(INDIAN_STOCKS);
        }
      } catch(e) {
        setAllStocks(INDIAN_STOCKS);
      }
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
function TestSignalView({ authStatus, funds: globalFunds, setFunds: setGlobalFunds, savedApis }) {
  const [tab,     setTab]     = useState('indian'); // 'indian' | 'crypto'

  // ── INDIAN ────────────────────────────────────────────────
  const [sym,     setSym]     = useState('NSE:RELIANCE-EQ');
  const [side,    setSide]    = useState('BUY');
  const [qty,     setQty]     = useState('1');
  const [ot,      setOt]      = useState('MARKET');
  const [price,   setPrice]   = useState('');
  const [selApi,  setSelApi]  = useState(''); // selected Indian API
  const [res,     setRes]     = useState(null);
  const [realRes, setRealRes] = useState(null);
  const [load,    setLoad]    = useState(false);
  const [realLoad,setRealLoad]= useState(false);
  const [hist,    setHist]    = useState([]);

  // ── CRYPTO ────────────────────────────────────────────────
  const [cSym,    setCsym]    = useState('BTCUSD');
  const [cSide,   setCside]   = useState('buy');
  const [cQty,    setCqty]    = useState('1');
  const [cApi,    setCapi]    = useState(''); // selected Delta API
  const [cRes,    setCres]    = useState(null);
  const [cLoad,   setCload]   = useState(false);

  const funds = globalFunds || [];
  // Read directly from localStorage — always fresh
  const allApis    = (() => { try { return JSON.parse(localStorage.getItem('orb_apis')||'[]'); } catch(_){ return []; }})();
  const indianApis = allApis.filter(a=>a.category==='indian'&&a.enabled);
  const cryptoApis = allApis.filter(a=>a.category==='crypto'&&a.enabled);

  // Delta Exchange correct symbols (perpetual futures)
  const [deltaProducts, setDeltaProducts] = useState([
    'BTCUSD','ETHUSD','SOLUSD','BNBUSD','XRPUSD',
    'DOGEUSD','ADAUSD','AVAXUSD','MATICUSD','LINKUSD'
  ]);

  // Load actual products from Delta when API is selected
  useEffect(() => {
    if (!cApi) return;
    const selApiObj = allApis.find(a=>String(a.id)===String(cApi));
    const region = (selApiObj?.fields?.['Region']||'india').toLowerCase().includes('india')?'india':'global';
    api.get(`/api/delta/products/${cApi}?region=${region}`)
      .then(r => { if (r.success && r.products?.length > 0) {
        setDeltaProducts(r.products.map(p => p.symbol));
        setCsym(r.products[0]?.symbol || 'BTCUSD');
      }})
      .catch(()=>{});
  }, [cApi]);

  // ── Indian simulated test ──────────────────────────────────
  const send = async () => {
    setLoad(true);
    try {
      const r = await api.post('/api/orders/test', {
        symbol:sym, side, qty:parseInt(qty)||1, orderType:ot, price:parseFloat(price)||0
      });
      setRes(r); setHist(p=>[r,...p].slice(0,10));
    } catch(e) { setRes({ success:false, error:e.message }); }
    setLoad(false);
  };

  // ── Indian real order ──────────────────────────────────────
  const sendReal = async () => {
    if (!window.confirm(`Place REAL ${side} order: ${qty} × ${sym}?`)) return;
    setRealLoad(true); setRealRes(null);
    try {
      const r = await api.post('/api/orders/place', {
        symbol:sym, side, qty:parseInt(qty)||1, orderType:ot,
        price:parseFloat(price)||0, productType:'INTRADAY'
      });
      setRealRes(r); setHist(p=>[{...r,real:true},...p].slice(0,10));
    } catch(e) { setRealRes({ success:false, error:e.message }); }
    setRealLoad(false);
  };

  // ── Crypto test order ──────────────────────────────────────
  const sendCrypto = async () => {
    if (!cApi) { setCres({ success:false, error:'Select a Delta Exchange API first' }); return; }
    if (!window.confirm(`Place REAL ${cSide.toUpperCase()} order: ${cQty} × ${cSym} on Delta Exchange?`)) return;
    setCload(true); setCres(null);
    try {
      // Find the selected API to pass credentials (handles server restart)
      const selApiObj = allApis.find(a=>String(a.id)===String(cApi));
      const r = await api.post('/api/delta/order', {
        apiId:     String(cApi),
        symbol:    cSym,
        side:      cSide,
        size:      parseInt(cQty)||1,
        apiKey:    selApiObj?.fields?.['API Key'],
        apiSecret: selApiObj?.fields?.['API Secret'],
        region:    (selApiObj?.fields?.['Region']||'india').toLowerCase().includes('india')?'india':'global'
      });
      setCres(r);
    } catch(e) { setCres({ success:false, error:e.message }); }
    setCload(false);
  };

  return (
    <div style={{ padding:'22px', height:'100%', overflowY:'auto' }}>
      <h2 style={{ fontSize:19,fontWeight:800,color:SB,marginBottom:4 }}>Test Signal</h2>
      <p style={{ fontSize:13,color:T2,marginBottom:14 }}>Test order placement for Indian brokers and Crypto exchanges</p>

      {/* Tab switcher */}
      <div style={{ display:'flex',gap:2,marginBottom:18,background:'#F1F5F9',borderRadius:10,padding:3 }}>
        {[{id:'indian',label:'🇮🇳 Indian'},{id:'crypto',label:'₿ Crypto'}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            flex:1,padding:'8px 0',borderRadius:8,border:'none',cursor:'pointer',
            fontWeight:700,fontSize:13,
            background:tab===t.id?'#fff':'transparent',
            color:tab===t.id?SB:T2,
            boxShadow:tab===t.id?'0 1px 4px rgba(0,0,0,.08)':'none' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── INDIAN TAB ───────────────────────────────────── */}
      {tab==='indian' && (
        <div style={{ display:'grid',gridTemplateColumns:'360px 1fr',gap:16,alignItems:'start' }}>
          <div>
            <SCard title="Signal Builder" icon={Zap}>
              {!authStatus?.isAuthenticated && (
                <div style={{ padding:'10px 12px',borderRadius:8,background:'#FFF7ED',
                  border:'1px solid #FED7AA',marginBottom:12,fontSize:12,color:W }}>
                  ⚠️ Login to Fyers first to place real orders
                </div>
              )}

              {/* API selector */}
              {indianApis.length > 0 && (
                <div style={{ marginBottom:12 }}>
                  <label style={{ fontSize:12,fontWeight:600,color:T2,display:'block',marginBottom:5 }}>Select API</label>
                  <select value={selApi} onChange={e=>setSelApi(e.target.value)}
                    style={{ width:'100%',padding:'8px 10px',border:`1.5px solid ${BD}`,
                      borderRadius:8,fontSize:13,color:T1,background:'#fff' }}>
                    <option value="">Default (active Fyers)</option>
                    {indianApis.map(a=>(
                      <option key={a.id} value={a.id}>{a.name} — {a.brokerId}</option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ marginBottom:10 }}>
                <label style={{ fontSize:12,fontWeight:600,color:T2,display:'block',marginBottom:5 }}>Stock</label>
                <StockDropdown value={sym} onChange={setSym} />
              </div>
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:7,marginBottom:10 }}>
                {['BUY','SELL'].map(s=>(
                  <button key={s} onClick={()=>setSide(s)} style={{
                    padding:'9px',borderRadius:8,fontWeight:700,
                    border:`2px solid ${s==='BUY'?G:R}`,
                    background:side===s?(s==='BUY'?G:R):'#fff',
                    color:side===s?'#fff':(s==='BUY'?G:R),cursor:'pointer' }}>
                    {s==='BUY'?'▲ BUY':'▼ SELL'}
                  </button>
                ))}
              </div>
              <SelectField label="Order Type" value={ot} onChange={setOt}
                options={['MARKET','LIMIT','STOP_LOSS','STOP_LOSS_MARKET'].map(v=>({value:v,label:v}))} />
              <Field label="Quantity" value={qty} onChange={setQty} type="number" />
              {ot!=='MARKET' && <Field label="Price ₹" value={price} onChange={setPrice} prefix="₹" type="number" />}

              <button onClick={send} disabled={load} style={{
                width:'100%',padding:'9px',borderRadius:8,fontWeight:700,fontSize:13,
                border:`2px solid #8B5CF6`,background:'#F5F3FF',color:'#8B5CF6',
                cursor:'pointer',marginBottom:7,display:'flex',alignItems:'center',
                justifyContent:'center',gap:6 }}>
                {load?<RefreshCw size={13} style={{animation:'spin 1s linear infinite'}}/>:<Zap size={13}/>}
                Test Signal (Simulated)
              </button>
              <button onClick={sendReal} disabled={realLoad||!authStatus?.isAuthenticated} style={{
                width:'100%',padding:'9px',borderRadius:8,fontWeight:700,fontSize:13,
                border:'none',background:side==='BUY'?G:R,color:'#fff',
                cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6,
                opacity:authStatus?.isAuthenticated?1:0.6 }}>
                {realLoad?<RefreshCw size={13} style={{animation:'spin 1s linear infinite'}}/>:<Send size={13}/>}
                {side==='BUY'?'▲':'▼'} Place REAL {side} Order
              </button>
            </SCard>

            {res && (
              <div style={{ border:`1.5px solid #8B5CF6`,borderRadius:10,padding:'11px 13px',
                background:'#F5F3FF',marginBottom:8 }}>
                <div style={{ fontWeight:700,color:'#8B5CF6',marginBottom:4 }}>✓ Test Signal Sent</div>
                {res.orderId && <div className="mono" style={{ fontSize:11,color:T2 }}>ID: {res.orderId}</div>}
                {res.error && <div style={{ fontSize:12,color:R }}>{res.error}</div>}
              </div>
            )}
            {realRes && (
              <div style={{ border:`1.5px solid ${realRes.success?G:R}`,borderRadius:10,padding:'11px 13px',
                background:realRes.success?'#F0FDF4':'#FFF1F2' }}>
                <div style={{ fontWeight:700,color:realRes.success?G:R,marginBottom:4 }}>
                  {realRes.success?'✅ Real Order Placed!':'❌ Order Failed'}
                </div>
                {realRes.orderId && <div className="mono" style={{ fontSize:11,color:T1,fontWeight:700 }}>ID: {realRes.orderId}</div>}
                {realRes.error && <div style={{ fontSize:12,color:R,marginTop:3 }}>{realRes.error}</div>}
              </div>
            )}
          </div>

          {/* Signal History */}
          <SCard title="Signal History" icon={Clock}>
            {hist.length===0
              ? <div style={{ textAlign:'center',color:T2,fontSize:13,padding:'24px 0' }}>No signals yet</div>
              : hist.map((h,i)=>(
                <div key={i} style={{ display:'flex',alignItems:'center',justifyContent:'space-between',
                  padding:'8px 10px',borderRadius:8,marginBottom:5,background:'#F8FAFC',border:`1px solid ${BD}` }}>
                  <div style={{ display:'flex',alignItems:'center',gap:7 }}>
                    <Badge text={h.order?.side||h.real?'REAL':'SIM'} color={h.order?.side==='BUY'?G:h.order?.side==='SELL'?R:'#8B5CF6'} />
                    <div>
                      <div style={{ fontSize:12,fontWeight:600 }}>{shortSym(h.order?.symbol||sym)} × {h.order?.qty||qty}</div>
                      <div className="mono" style={{ fontSize:10,color:T2 }}>{h.orderId||'—'}</div>
                    </div>
                  </div>
                  <Badge text={h.success?'OK':'FAIL'} color={h.success?G:R} />
                </div>
              ))
            }
          </SCard>
        </div>
      )}

      {/* ── CRYPTO TAB ───────────────────────────────────── */}
      {tab==='crypto' && (
        <div style={{ display:'grid',gridTemplateColumns:'360px 1fr',gap:16,alignItems:'start' }}>
          <div>
            <SCard title="Delta Exchange Signal" icon={Zap}>
              {cryptoApis.length === 0 ? (
                <div style={{ padding:'16px',background:'#FFF7ED',borderRadius:8,
                  border:'1px solid #FED7AA',fontSize:12,color:W }}>
                  ⚠️ No Delta Exchange API added. Go to API Credentials → Add API → Crypto → Delta Exchange
                </div>
              ) : (
                <>
                  <div style={{ marginBottom:12 }}>
                    <label style={{ fontSize:12,fontWeight:600,color:T2,display:'block',marginBottom:5 }}>Delta Exchange API</label>
                    <select value={cApi} onChange={e=>setCapi(e.target.value)}
                      style={{ width:'100%',padding:'8px 10px',border:`1.5px solid ${BD}`,
                        borderRadius:8,fontSize:13,color:T1,background:'#fff' }}>
                      <option value="">Select API</option>
                      {cryptoApis.map(a=>(
                        <option key={a.id} value={String(a.id)}>{a.name}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginBottom:12 }}>
                    <label style={{ fontSize:12,fontWeight:600,color:T2,display:'block',marginBottom:5 }}>Crypto Pair</label>
                    <select value={cSym} onChange={e=>setCsym(e.target.value)}
                      style={{ width:'100%',padding:'8px 10px',border:`1.5px solid ${BD}`,
                        borderRadius:8,fontSize:13,color:T1,background:'#fff' }}>
                      {deltaProducts.map(p=><option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>

                  <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:7,marginBottom:10 }}>
                    {['buy','sell'].map(s=>(
                      <button key={s} onClick={()=>setCside(s)} style={{
                        padding:'9px',borderRadius:8,fontWeight:700,textTransform:'uppercase',
                        border:`2px solid ${s==='buy'?G:R}`,
                        background:cSide===s?(s==='buy'?G:R):'#fff',
                        color:cSide===s?'#fff':(s==='buy'?G:R),cursor:'pointer' }}>
                        {s==='buy'?'▲ BUY':'▼ SELL'}
                      </button>
                    ))}
                  </div>

                  <Field label="Quantity (contracts)" value={cQty} onChange={setCqty} type="number" />

                  <button onClick={sendCrypto} disabled={cLoad||!cApi} style={{
                    width:'100%',padding:'10px',borderRadius:9,fontWeight:700,fontSize:13,
                    border:'none',background:cSide==='buy'?'#8B5CF6':'#EC4899',color:'#fff',
                    cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6,
                    opacity:cApi?1:0.5 }}>
                    {cLoad?<RefreshCw size={13} style={{animation:'spin 1s linear infinite'}}/>:<Send size={13}/>}
                    Place {cSide.toUpperCase()} on Delta Exchange
                  </button>
                </>
              )}

              {cRes && (
                <div style={{ marginTop:10,border:`1.5px solid ${cRes.success?G:R}`,
                  borderRadius:10,padding:'11px 13px',
                  background:cRes.success?'#F0FDF4':'#FFF1F2' }}>
                  <div style={{ fontWeight:700,color:cRes.success?G:R,marginBottom:4 }}>
                    {cRes.success?'✅ Crypto Order Placed!':'❌ Order Failed'}
                  </div>
                  {cRes.orderId && <div className="mono" style={{ fontSize:11 }}>ID: {cRes.orderId}</div>}
                  {cRes.error && <div style={{ fontSize:12,color:R }}>{cRes.error}</div>}
                </div>
              )}
            </SCard>
          </div>

          <SCard title="About Delta Exchange" icon={Info}>
            <div style={{ fontSize:12,color:T2,lineHeight:1.7 }}>
              <div style={{ marginBottom:8,fontWeight:700,color:T1 }}>₿ Crypto markets are 24/7</div>
              <div>• No market hours restriction</div>
              <div>• Leverage up to 100x available</div>
              <div>• USDT-settled contracts</div>
              <div>• Orders go directly to Delta Exchange</div>
              <div style={{ marginTop:12,padding:'9px',background:'#F5F3FF',borderRadius:8,color:'#7C3AED' }}>
                Make sure your Delta API has <b>Order Placement</b> permission enabled.
              </div>
            </div>
          </SCard>
        </div>
      )}
    </div>
  );
}

function RiskRewardView({ rrConfig, setRrConfig, selectedSymbols, ticks, authStatus, funds: globalFunds, setFunds: setGlobalFunds, savedApis }) {
  const [bLoad,   setBLoad]   = useState(false);
  const [tab,     setTab]     = useState('indian');
  const funds = globalFunds || [];

  // ── Fetch Fyers balance ───────────────────────────────────
  const fetchAndFill = async () => {
    setBLoad(true);
    try {
      const r = await api.get('/api/portfolio/funds');
      if (r.success) {
        if (r.funds?.length > 0) setGlobalFunds(r.funds);
        const bal = parseFloat(r.availableBalance||0);
        if (bal > 100) setRrConfig(p=>({...p, capital: Math.floor(bal)}));
      }
    } catch(e) {}
    setBLoad(false);
  };

  useEffect(()=>{ if(authStatus?.isAuthenticated) fetchAndFill(); },[authStatus?.isAuthenticated]);

  const capital     = rrConfig.capital     || 50000;
  const leverage    = rrConfig.leverage    || 5;
  const riskPct     = rrConfig.riskPct     || 2;
  const rrRatio     = rrConfig.rrRatio     || 2;
  const maxSLPerDay = rrConfig.maxSLPerDay || 3;
  const ec  = capital * leverage;
  const rpt = ec * riskPct / 100;
  const dll = rpt * maxSLPerDay;
  const update = (field, val) => setRrConfig(p=>({...p, [field]:val}));
  const save   = async () => { try { await api.post('/api/risk/config', rrConfig); } catch(e){} };

  const allApis2    = (() => { try { return JSON.parse(localStorage.getItem('orb_apis')||'[]'); } catch(_){ return []; }})();
  const indianApis  = allApis2.filter(a=>a.category==='indian'&&a.enabled);
  const cryptoApis  = allApis2.filter(a=>a.category==='crypto'&&a.enabled);

  return (
    <div style={{ padding:'22px',height:'100%',overflowY:'auto' }}>
      <h2 style={{ fontSize:19,fontWeight:800,color:SB,marginBottom:4 }}>Risk & Reward Calculator</h2>
      <p style={{ fontSize:13,color:T2,marginBottom:14 }}>Configure position sizing per market</p>

      {/* Tab switcher */}
      <div style={{ display:'flex',gap:2,marginBottom:18,background:'#F1F5F9',borderRadius:10,padding:3 }}>
        {[{id:'indian',label:'🇮🇳 Indian'},{id:'crypto',label:'₿ Crypto'}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            flex:1,padding:'8px 0',borderRadius:8,border:'none',cursor:'pointer',
            fontWeight:700,fontSize:13,
            background:tab===t.id?'#fff':'transparent',color:tab===t.id?SB:T2,
            boxShadow:tab===t.id?'0 1px 4px rgba(0,0,0,.08)':'none' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── INDIAN TAB ───────────────────────────────────── */}
      {tab==='indian' && (
        <div>
          {/* Common settings note */}
          <div style={{ background:'#EEF2FF',borderRadius:9,padding:'9px 13px',marginBottom:14,
            fontSize:12,color:SB,fontWeight:600 }}>
            ℹ️ Risk, Reward and Max SL settings below apply to ALL Indian brokers
          </div>

          {/* Broker summary table */}
          {indianApis.length > 0 && (
            <SCard title="Broker Summary" icon={BarChart2}>
              <div style={{ border:`1px solid ${BD}`,borderRadius:9,overflow:'hidden' }}>
                <div style={{ display:'grid',gridTemplateColumns:'1.5fr 1.5fr 1fr 1fr 1.5fr 1fr',
                  background:'#F8FAFC',padding:'8px 12px',borderBottom:`1px solid ${BD}` }}>
                  {['Broker','API Connected','Actual Margin','Leverage','Eff. Capital','Risk/Trade'].map(h=>(
                    <span key={h} style={{ fontSize:11,fontWeight:700,color:T2 }}>{h}</span>
                  ))}
                </div>
                {indianApis.map((a,i)=>{
                  const isConn = a.connected||(a.brokerId==='fyers'&&authStatus?.isAuthenticated);
                  const margin = a.brokerId==='fyers'?capital:0;
                  const aEc    = margin * leverage;
                  const aRpt   = aEc * riskPct / 100;
                  return (
                    <div key={a.id} style={{ display:'grid',gridTemplateColumns:'1.5fr 1.5fr 1fr 1fr 1.5fr 1fr',
                      padding:'9px 12px',borderBottom:`1px solid ${BD}`,background:i%2===0?'#fff':'#FAFBFF' }}>
                      <div style={{ display:'flex',alignItems:'center',gap:7 }}>
                        <div style={{ width:8,height:8,borderRadius:'50%',background:a.color }}/>
                        <span style={{ fontWeight:700,fontSize:12 }}>{a.name}</span>
                      </div>
                      <div style={{ fontSize:12 }}>
                        <span style={{ color:isConn?G:R,fontWeight:600 }}>{isConn?'✓ Connected':'✗ Offline'}</span>
                        <div style={{ fontSize:10,color:T2 }}>{a.name}</div>
                      </div>
                      <div className="mono" style={{ fontSize:12 }}>{isConn?fmtINR(capital):'—'}</div>
                      <div className="mono" style={{ fontSize:12 }}>{leverage}x</div>
                      <div className="mono" style={{ fontSize:12,fontWeight:700,color:SB }}>{isConn?fmtINR(aEc):'—'}</div>
                      <div className="mono" style={{ fontSize:12,color:R }}>{isConn?fmtINR(aRpt):'—'}</div>
                    </div>
                  );
                })}
                {indianApis.length===0 && (
                  <div style={{ padding:'16px',textAlign:'center',color:T2,fontSize:12 }}>
                    No Indian broker APIs added
                  </div>
                )}
              </div>
            </SCard>
          )}

          <div style={{ display:'grid',gridTemplateColumns:'400px 1fr',gap:16,alignItems:'start' }}>
            <div>
              <SCard title="Capital & Leverage" icon={Calculator}>
                {/* Balance sync */}
                <div style={{ background:funds.length>0?'#F0FDF4':'#F8FAFC',
                  border:`1px solid ${funds.length>0?'#BBF7D0':BD}`,borderRadius:8,
                  padding:'9px 12px',marginBottom:12 }}>
                  <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:funds.length>0?6:0 }}>
                    <span style={{ fontSize:11,fontWeight:700,color:funds.length>0?G:T2 }}>
                      {funds.length>0?'✓ Fyers Balance':'Fyers Balance'}
                    </span>
                    <button onClick={fetchAndFill} disabled={bLoad} style={{ padding:'3px 10px',
                      borderRadius:5,border:`1px solid ${SB}`,background:SB,
                      color:'#fff',fontSize:11,cursor:'pointer',fontWeight:600 }}>
                      {bLoad?'Fetching...':'↺ Sync'}
                    </button>
                  </div>
                  {funds.length>0 && (
                    <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:4 }}>
                      {funds.slice(0,3).map((f,i)=>{
                        const v = parseFloat(f.equityAmount??f.value??f.currentValue??0);
                        return (
                          <div key={i} style={{ background:'#fff',borderRadius:5,padding:'4px 7px',border:`1px solid ${BD}` }}>
                            <div style={{ fontSize:9,color:T2 }}>{f.title||`Fund ${i+1}`}</div>
                            <div className="mono" style={{ fontSize:11,fontWeight:700 }}>₹{v.toLocaleString('en-IN',{maximumFractionDigits:0})}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <Field label="Invested Capital (₹)" value={capital}
                  onChange={v=>update('capital',parseFloat(v)||0)} prefix="₹" type="number" />
                <SelectField label="Intraday Leverage" value={String(leverage)}
                  onChange={v=>update('leverage',parseInt(v))}
                  options={[1,2,3,4,5].map(v=>({value:String(v),label:`${v}x Leverage`}))} />
                <div style={{ background:'#EEF2FF',borderRadius:8,padding:'10px 13px',
                  display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                  <span style={{ fontSize:13,color:SB,fontWeight:600 }}>Effective Capital</span>
                  <span className="mono" style={{ fontSize:18,fontWeight:700,color:SB }}>{fmtINR(ec)}</span>
                </div>
              </SCard>

              <SCard title="Risk Configuration" icon={Shield}>
                <div style={{ marginBottom:13 }}>
                  <div style={{ display:'flex',justifyContent:'space-between',marginBottom:5 }}>
                    <label style={{ fontSize:12,fontWeight:600,color:T2 }}>Risk % Per Trade</label>
                    <span className="mono" style={{ fontSize:13,fontWeight:700,color:R }}>{riskPct}%</span>
                  </div>
                  <input type="range" min="0.5" max="10" step="0.5" value={riskPct}
                    onChange={e=>update('riskPct',parseFloat(e.target.value))}
                    style={{ width:'100%',accentColor:SB }} />
                  <div style={{ display:'flex',justifyContent:'space-between',fontSize:11,color:T2,marginTop:3 }}>
                    <span>0.5% (Safe)</span>
                    <span style={{ color:rpt>5000?R:T2 }}>Risk/Trade: {fmtINR(rpt)}</span>
                    <span>10% (Aggressive)</span>
                  </div>
                </div>
                <SelectField label="Risk : Reward Ratio" value={String(rrRatio)}
                  onChange={v=>update('rrRatio',parseFloat(v))}
                  options={[1,1.5,2,2.5,3,3.5,4].map(v=>({value:String(v),label:`1:${v}`}))} />
              </SCard>

              <SCard title="Rule-Based Controls" icon={AlertTriangle}>
                <Field label="Max SL Hits / Day" value={maxSLPerDay}
                  onChange={v=>update('maxSLPerDay',parseInt(v)||1)} type="number" />
                <div style={{ background:'#FFF7ED',border:`1px solid #FED7AA`,borderRadius:8,
                  padding:'9px 12px',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                  <div>
                    <div style={{ fontSize:11,color:W,fontWeight:600 }}>Daily Risk Cap</div>
                    <div style={{ fontSize:11,color:T2 }}>Halt when this ₹ loss is hit</div>
                  </div>
                  <span className="mono" style={{ fontSize:17,fontWeight:700,color:W }}>{fmtINR(dll)}</span>
                </div>
              </SCard>

              <button onClick={save} style={{ width:'100%',padding:'11px',borderRadius:9,border:'none',
                background:SB,color:'#fff',fontWeight:700,fontSize:14,cursor:'pointer',
                display:'flex',alignItems:'center',justifyContent:'center',gap:8 }}>
                <CheckCircle size={14}/> Save & Apply to Bot
              </button>
            </div>

            {/* Per-stock calculator */}
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
                  const slPts= cmp * (riskPct/100);
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
                    Add stocks in Stock Selection to see calculations
                  </div>
                )}
              </div>
            </SCard>
          </div>
        </div>
      )}

      {/* ── CRYPTO TAB ───────────────────────────────────── */}
      {tab==='crypto' && (
        <div>
          {cryptoApis.length === 0 ? (
            <div style={{ textAlign:'center',padding:'40px 0',border:`2px dashed ${BD}`,borderRadius:12 }}>
              <div style={{ fontSize:40,marginBottom:8 }}>₿</div>
              <div style={{ fontWeight:600,fontSize:14,color:T1 }}>No Crypto APIs added</div>
              <div style={{ fontSize:12,color:T2,marginTop:4 }}>Go to API Credentials → Add API → Crypto → Delta Exchange</div>
            </div>
          ) : (
            <div>
              <div style={{ background:'#F5F3FF',borderRadius:9,padding:'9px 13px',marginBottom:14,
                fontSize:12,color:'#7C3AED',fontWeight:600 }}>
                ℹ️ Crypto Risk & Reward settings are separate from Indian markets
              </div>
              {cryptoApis.map(a=>(
                <div key={a.id} style={{ background:'#fff',border:`1.5px solid ${a.color}30`,
                  borderRadius:12,padding:'18px',marginBottom:14 }}>
                  <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:16 }}>
                    <div style={{ width:36,height:36,borderRadius:9,background:a.color,
                      display:'flex',alignItems:'center',justifyContent:'center',
                      fontSize:16,fontWeight:800,color:'#fff' }}>₿</div>
                    <div>
                      <div style={{ fontWeight:700,fontSize:14,color:T1 }}>{a.name}</div>
                      <div style={{ fontSize:11,color:a.connected?G:R,fontWeight:600 }}>
                        {a.connected?'● Connected 24/7':'○ Not connected'}
                      </div>
                    </div>
                    <div className="mono" style={{ marginLeft:'auto',fontSize:16,fontWeight:800,color:a.color }}>
                      {a.availableBalance?`$${parseFloat(a.availableBalance).toFixed(2)}`:'—'}
                    </div>
                  </div>

                  <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:14 }}>
                    <div>
                      <label style={{ fontSize:12,fontWeight:600,color:T2,display:'block',marginBottom:5 }}>Leverage</label>
                      <select value={String(rrConfig.cryptoLeverage||10)}
                        onChange={e=>update('cryptoLeverage',parseInt(e.target.value))}
                        style={{ width:'100%',padding:'8px 10px',border:`1.5px solid ${BD}`,borderRadius:8,fontSize:13,color:T1,background:'#fff' }}>
                        {[10,20,25,50,100].map(v=><option key={v} value={String(v)}>{v}x</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize:12,fontWeight:600,color:T2,display:'block',marginBottom:5 }}>Risk % / Trade</label>
                      <input type="number" min="0.5" max="10" step="0.5"
                        value={rrConfig.cryptoRiskPct||2}
                        onChange={e=>update('cryptoRiskPct',parseFloat(e.target.value))}
                        style={{ width:'100%',padding:'8px 10px',border:`1.5px solid ${BD}`,borderRadius:8,fontSize:13,color:T1,boxSizing:'border-box' }} />
                    </div>
                    <div>
                      <label style={{ fontSize:12,fontWeight:600,color:T2,display:'block',marginBottom:5 }}>R:R Ratio</label>
                      <select value={String(rrConfig.cryptoRRRatio||2)}
                        onChange={e=>update('cryptoRRRatio',parseFloat(e.target.value))}
                        style={{ width:'100%',padding:'8px 10px',border:`1.5px solid ${BD}`,borderRadius:8,fontSize:13,color:T1,background:'#fff' }}>
                        {[1,1.5,2,2.5,3].map(v=><option key={v} value={String(v)}>1:{v}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Computed values */}
                  {a.availableBalance > 0 && (
                    <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:9 }}>
                      {[
                        { label:'Available',   val:`$${parseFloat(a.availableBalance).toFixed(2)}`, color:G },
                        { label:'Leverage',    val:`${rrConfig.cryptoLeverage||10}x`, color:SB },
                        { label:'Eff. Capital',val:`$${(parseFloat(a.availableBalance)*(rrConfig.cryptoLeverage||10)).toFixed(2)}`, color:'#8B5CF6' },
                        { label:'Risk/Trade',  val:`$${(parseFloat(a.availableBalance)*(rrConfig.cryptoLeverage||10)*(rrConfig.cryptoRiskPct||2)/100).toFixed(2)}`, color:R },
                      ].map((s,i)=>(
                        <div key={i} style={{ background:s.color+'10',border:`1px solid ${s.color}20`,
                          borderRadius:8,padding:'9px 11px' }}>
                          <div style={{ fontSize:10,color:T2,fontWeight:600,marginBottom:3 }}>{s.label}</div>
                          <div className="mono" style={{ fontSize:14,fontWeight:700,color:s.color }}>{s.val}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ marginTop:12,borderTop:`1px solid ${BD}`,paddingTop:12 }}>
                    <Field label="Max SL Hits / Day (Crypto)" value={rrConfig.cryptoMaxSL||3}
                      onChange={v=>update('cryptoMaxSL',parseInt(v)||3)} type="number" />
                  </div>
                </div>
              ))}

              <button onClick={save} style={{ width:'100%',padding:'11px',borderRadius:9,border:'none',
                background:'#8B5CF6',color:'#fff',fontWeight:700,fontSize:14,cursor:'pointer' }}>
                <CheckCircle size={14} style={{marginRight:6}}/> Save Crypto R&R Config
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ── Morning Check View ───────────────────────────────────
function MorningCheckView({ authStatus, selectedSymbols, ticks, orbLevels, riskStatus, rrConfig, masterOn, socketConnected, savedApis }) {
  const [checks,  setChecks]  = useState([]);
  const [running, setRunning] = useState(false);
  const [orbData, setOrbData] = useState(null);
  const [loginLoading, setLoginLoading] = useState({});

  // Quick login handler — pushes credentials then opens OAuth
  const handleFyersLogin = async (apiEntry) => {
    setLoginLoading(p=>({...p, [apiEntry?.id||'main']: true}));
    try {
      if (apiEntry) {
        // Push saved credentials first
        const appId     = apiEntry.fields['App ID'];
        const secretKey = apiEntry.fields['Secret Key'];
        const redirect  = apiEntry.fields['Redirect URL'] ||
          `${window.location.protocol}//${window.location.host}/api/auth/callback`;
        if (appId && secretKey) {
          await api.post('/api/auth/credentials', { appId, secretKey, redirectUri: redirect });
        }
      }
      const r = await api.get('/api/auth/url');
      window.open(r.url, '_blank');
    } catch(e) { alert('Login error: ' + e.message); }
    setLoginLoading(p=>({...p, [apiEntry?.id||'main']: false}));
  };

  const runChecks = async () => {
    setRunning(true);
    const results = [];

    // 1. Server connection
    try {
      const h = await api.get('/api/health');
      results.push({ label:'Server Online', ok: h.status==='ok', val: h.status==='ok'?'✓ Running':'✗ Offline' });
      results.push({ label:'Live Feed', ok: h.dataFeed, val: h.dataFeed?'✓ Connected':'✗ Disconnected',
        action: !h.dataFeed?'api/feed/reconnect':null });
      results.push({ label:'Stocks Subscribed', ok: h.subscribedStocks>0,
        val: `${h.subscribedStocks} stocks`,
        action: h.subscribedStocks===0?'Go to Stock Selection':null });
    } catch(e) {
      results.push({ label:'Server Online', ok:false, val:'✗ Cannot reach server' });
    }

    // 2. Check each saved API broker
    const fyersApis = (savedApis||[]).filter(a=>a.brokerId==='fyers');
    const deltaApis = (savedApis||[]).filter(a=>a.brokerId==='delta');

    if (fyersApis.length > 0) {
      const authOk = authStatus?.isAuthenticated;
      fyersApis.forEach(a => {
        results.push({
          label: `Fyers: ${a.name}`,
          ok: authOk,
          val: authOk?`✓ Connected · ${authStatus?.profile?.name||''}`:
               '✗ Not logged in',
          action: !authOk?'Login below':null,
          loginBtn: !authOk ? a : null
        });
      });
    } else {
      // No Fyers API added — check default auth
      const authOk = authStatus?.isAuthenticated;
      results.push({
        label: 'Fyers Auth',
        ok: authOk,
        val: authOk?`✓ Connected · ${authStatus?.profile?.name||''}`:
             '✗ Not logged in',
        action: !authOk?'Add Fyers API first in API Credentials':null,
        loginBtn: !authOk ? null : null
      });
    }

    if (deltaApis.length > 0) {
      deltaApis.forEach(a => {
        const hasKeys = a.fields['API Key'] && a.fields['API Secret'];
        results.push({
          label: `Delta: ${a.name}`,
          ok: hasKeys && a.connected,
          val: hasKeys && a.connected?'✓ Connected 24/7':
               hasKeys?'Keys saved — click Connect in API section':
               '✗ API Key/Secret missing',
          action: !hasKeys?'Edit API in API Credentials':null
        });
      });
    }

    // 3. ORB levels
    try {
      const o = await api.get('/api/stocks/orb');
      setOrbData(o.levels);
      const lockedCount = Object.values(o.levels||{}).filter(v=>v?.locked).length;
      const totalStocks = Object.keys(o.levels||{}).length;
      results.push({ label:'ORB Levels Locked', ok: lockedCount>0,
        val: `${lockedCount}/${totalStocks} locked`,
        action: lockedCount===0?'Save stocks to fetch ORB':null });
    } catch(e) {
      results.push({ label:'ORB Levels', ok:false, val:'Could not fetch' });
    }

    // 4. Capital
    const cap = rrConfig?.capital||0;
    results.push({ label:'Capital Set', ok: cap>1000,
      val: cap>1000?`₹${cap.toLocaleString('en-IN')} ready`:'Sync balance in Risk & Reward',
      action: cap<=1000?'Go to Risk & Reward':null });

    // 5. Master toggle
    results.push({ label:'Master Toggle', ok: masterOn,
      val: masterOn?'✓ Bot Active':'✗ Toggle is OFF',
      action: !masterOn?'Turn ON from Dashboard':null });

    // 6. Market hours
    const now = new Date();
    const hh = now.getHours(), mm = now.getMinutes();
    const isMarket = (hh>9||(hh===9&&mm>=15)) && (hh<15||(hh===15&&mm<=25));
    results.push({ label:'Market Hours', ok: isMarket,
      val: isMarket?'✓ Market Open':'Market Closed (9:15-15:25)' });

    setChecks(results);
    setRunning(false);
  };

  const allGreen = checks.length>0 && checks.every(c=>c.ok);
  const redCount = checks.filter(c=>!c.ok).length;

  return (
    <div style={{ padding:'22px', height:'100%', overflowY:'auto' }}>
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16 }}>
        <div>
          <h2 style={{ fontSize:19,fontWeight:800,color:SB,marginBottom:4 }}>🌅 Morning Checklist</h2>
          <p style={{ fontSize:13,color:T2 }}>Run this every morning at 9:00 AM before trading</p>
        </div>
        <button onClick={runChecks} disabled={running} style={{
          padding:'10px 22px',borderRadius:9,border:'none',
          background:running?T2:SB,color:'#fff',fontWeight:700,fontSize:14,cursor:'pointer',
          display:'flex',alignItems:'center',gap:8 }}>
          {running
            ? <><RefreshCw size={14} style={{animation:'spin 1s linear infinite'}}/> Checking...</>
            : <><CheckCircle size={14}/> Run All Checks</>}
        </button>
      </div>

      {/* Overall status */}
      {checks.length > 0 && (
        <div style={{ background: allGreen?'#F0FDF4':redCount>2?'#FFF1F2':'#FFF7ED',
          border:`2px solid ${allGreen?G:redCount>2?R:W}`,
          borderRadius:12,padding:'14px 18px',marginBottom:18,
          display:'flex',alignItems:'center',gap:12 }}>
          <div style={{ fontSize:32 }}>{allGreen?'🟢':redCount>2?'🔴':'🟡'}</div>
          <div>
            <div style={{ fontWeight:800,fontSize:16,color:allGreen?G:redCount>2?R:W }}>
              {allGreen?'ALL SYSTEMS GO — Safe to trade!':redCount>2?`${redCount} ISSUES — Fix before trading`:`${redCount} WARNINGS — Check items below`}
            </div>
            <div style={{ fontSize:12,color:T2,marginTop:2 }}>
              {checks.filter(c=>c.ok).length}/{checks.length} checks passed
            </div>
          </div>
        </div>
      )}

      {/* Check items */}
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:18 }}>
        {checks.map((check,i) => (
          <div key={i} style={{ background:'#fff',border:`1.5px solid ${check.ok?G+'50':R+'50'}`,
            borderRadius:10,padding:'12px 16px',
            display:'flex',alignItems:'center',justifyContent:'space-between',gap:10 }}>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex',alignItems:'center',gap:7,marginBottom:3 }}>
                <div style={{ width:8,height:8,borderRadius:'50%',background:check.ok?G:R,flexShrink:0 }}/>
                <span style={{ fontWeight:700,fontSize:13,color:T1 }}>{check.label}</span>
              </div>
              <div style={{ fontSize:12,color:check.ok?G:R,marginLeft:15 }}>{check.val}</div>
              {check.action && (
                <div style={{ fontSize:11,color:W,marginLeft:15,marginTop:3 }}>→ {check.action}</div>
              )}
              {check.loginBtn && (
                <button onClick={()=>handleFyersLogin(check.loginBtn)}
                  disabled={loginLoading[check.loginBtn.id]}
                  style={{ marginLeft:15,marginTop:6,padding:'5px 12px',borderRadius:6,
                    border:'none',background:'#6366F1',color:'#fff',fontWeight:600,
                    fontSize:11,cursor:'pointer',display:'flex',alignItems:'center',gap:5 }}>
                  {loginLoading[check.loginBtn.id]
                    ?<RefreshCw size={10} style={{animation:'spin 1s linear infinite'}}/>:'🔑'}
                  Login Now
                </button>
              )}
            </div>
            <div style={{ fontSize:20 }}>{check.ok?'✅':'❌'}</div>
          </div>
        ))}
      </div>

      {/* ORB levels table */}
      {orbData && Object.keys(orbData).length > 0 && (
        <div style={{ background:'#fff',border:`1.5px solid ${BD}`,borderRadius:12,overflow:'hidden',marginBottom:16 }}>
          <div style={{ padding:'10px 16px',background:'#FAFBFF',borderBottom:`1px solid ${BD}`,fontWeight:700,fontSize:13,color:T1 }}>
            📊 ORB Levels Status
          </div>
          <div style={{ display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr',
            background:'#F8FAFC',padding:'7px 16px',borderBottom:`1px solid ${BD}` }}>
            {['Symbol','ORB High','ORB Low','Status'].map(h=>(
              <span key={h} style={{ fontSize:11,fontWeight:700,color:T2 }}>{h}</span>
            ))}
          </div>
          {Object.entries(orbData).map(([sym,orb],i)=>(
            <div key={i} style={{ display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr',
              padding:'8px 16px',borderBottom:`1px solid ${BD}`,background:i%2===0?'#fff':'#FAFBFF' }}>
              <span style={{ fontWeight:700,fontSize:12 }}>{sym.replace('NSE:','').replace('-EQ','')}</span>
              <span className="mono" style={{ fontSize:12,color:G }}>{orb?.high?`₹${orb.high}`:'—'}</span>
              <span className="mono" style={{ fontSize:12,color:R }}>{orb?.low?`₹${orb.low}`:'—'}</span>
              <span style={{ fontSize:11,fontWeight:700,color:orb?.locked?G:W }}>
                {orb?.locked?'🔒 LOCKED':'⏳ WAITING'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Quick action buttons */}
      <div style={{ marginTop:8 }}>
        <div style={{ fontWeight:700,fontSize:13,color:T1,marginBottom:10 }}>Quick Actions</div>
        <div style={{ display:'flex',gap:9,flexWrap:'wrap' }}>
          {/* Login buttons for each Fyers API */}
          {(savedApis||[]).filter(a=>a.brokerId==='fyers').map(a=>(
            <button key={a.id} onClick={()=>handleFyersLogin(a)}
              disabled={loginLoading[a.id]}
              style={{ padding:'9px 16px',borderRadius:8,border:`1.5px solid #6366F1`,
                background:'#EEF2FF',color:'#6366F1',fontWeight:600,fontSize:13,cursor:'pointer',
                display:'flex',alignItems:'center',gap:6 }}>
              {loginLoading[a.id]?<RefreshCw size={12} style={{animation:'spin 1s linear infinite'}}/>:'🔑'}
              Login {a.name}
            </button>
          ))}
          {/* If no Fyers API added */}
          {(savedApis||[]).filter(a=>a.brokerId==='fyers').length===0 && (
            <button onClick={()=>handleFyersLogin(null)} style={{
              padding:'9px 16px',borderRadius:8,border:`1.5px solid #6366F1`,
              background:'#EEF2FF',color:'#6366F1',fontWeight:600,fontSize:13,cursor:'pointer' }}>
              🔑 Login Fyers
            </button>
          )}
          <button onClick={()=>api.get('/api/feed/reconnect').then(()=>alert('Feed reconnecting...'))} style={{
            padding:'9px 16px',borderRadius:8,border:`1.5px solid ${SB}`,
            background:'#EEF2FF',color:SB,fontWeight:600,fontSize:13,cursor:'pointer' }}>
            📡 Reconnect Feed
          </button>
          <button onClick={runChecks} style={{
            padding:'9px 16px',borderRadius:8,border:`1.5px solid ${G}`,
            background:'#F0FDF4',color:G,fontWeight:600,fontSize:13,cursor:'pointer' }}>
            🔄 Run Checks Again
          </button>
        </div>
      </div>

      {checks.length === 0 && (
        <div style={{ textAlign:'center',padding:'40px 0',color:T2 }}>
          <div style={{ fontSize:48,marginBottom:12 }}>🌅</div>
          <div style={{ fontSize:15,fontWeight:600 }}>Click "Run All Checks" to verify system status</div>
          <div style={{ fontSize:13,marginTop:6 }}>Run this every morning at 9:00 AM before trading</div>
        </div>
      )}
    </div>
  );
}

// ── ORB Simulator View ───────────────────────────────────
// Test entry/exit logic WITHOUT real market hours or broker
function ORBSimulatorView({ rrConfig, alerts, setAlerts }) {
  const [sym,       setSym]       = useState('NSE:RELIANCE-EQ');
  const [orbHigh,   setOrbHigh]   = useState('');
  const [orbLow,    setOrbLow]    = useState('');
  const [direction, setDirection] = useState('BUY');
  const [ltp,       setLtp]       = useState('');
  const [log,       setLog]       = useState([]);
  const [trade,     setTrade]     = useState(null);

  const addLog = (msg, color=T1) => {
    setLog(p => [{ msg, color, ts: new Date().toLocaleTimeString('en-IN') }, ...p].slice(0,50));
  };

  const ec      = (rrConfig?.capital||50000) * (rrConfig?.leverage||5);
  const riskAmt = ec * (rrConfig?.riskPct||2) / 100;

  // ── Simulate ORB lock ──────────────────────────────────
  const lockORB = () => {
    const h = parseFloat(orbHigh), l = parseFloat(orbLow);
    if (!h || !l || h <= l) { addLog('❌ Invalid ORB levels', R); return; }
    addLog(`🔒 ORB LOCKED → High: ₹${h} | Low: ₹${l}`, SB);
  };

  // ── Simulate breakout signal ───────────────────────────
  const fireSignal = () => {
    const h = parseFloat(orbHigh), l = parseFloat(orbLow);
    const entry = parseFloat(ltp) || (direction==='BUY' ? h+1 : l-1);
    if (!h || !l) { addLog('❌ Lock ORB levels first', R); return; }

    const sl     = direction==='BUY' ? l : h;
    const slPts  = Math.abs(entry - sl);
    const target = direction==='BUY' ? entry + slPts*(rrConfig?.rrRatio||2) : entry - slPts*(rrConfig?.rrRatio||2);
    const qty    = Math.max(1, Math.floor(riskAmt / slPts));

    const t = { sym, direction, entry, sl, target, qty, slPts, trailed: false };
    setTrade(t);

    addLog(`🚀 ${direction} SIGNAL → Entry:₹${entry.toFixed(2)} SL:₹${sl.toFixed(2)} Tgt:₹${target.toFixed(2)} Qty:${qty}`, direction==='BUY'?G:R);
    addLog(`   Risk: ₹${(slPts*qty).toFixed(2)} | Reward: ₹${(slPts*qty*(rrConfig?.rrRatio||2)).toFixed(2)}`, T2);

    // Add to global alert feed
    setAlerts(p => [{
      type: direction, symbol: sym,
      msg: `[SIM] ${direction} Entry:₹${entry.toFixed(2)} SL:₹${sl.toFixed(2)} Tgt:₹${target.toFixed(2)} Qty:${qty}`,
      status: 'SIMULATED', ts: new Date().toISOString(), id: 'SIM_'+Date.now()
    }, ...p]);
  };

  // ── Simulate price movement ────────────────────────────
  const simulatePrice = (price) => {
    if (!trade) { addLog('❌ Fire a signal first', R); return; }
    const p = parseFloat(price);
    if (!p) return;
    const { direction: dir, entry, sl, target, qty, trailed } = trade;

    // Check trail
    const halfTgt = dir==='BUY' ? entry+(target-entry)*0.5 : entry-(entry-target)*0.5;
    if (!trailed && ((dir==='BUY' && p>=halfTgt) || (dir==='SELL' && p<=halfTgt))) {
      setTrade(prev => ({ ...prev, sl: entry, trailed: true }));
      addLog(`📌 SL TRAILED to entry ₹${entry.toFixed(2)} at price ₹${p.toFixed(2)}`, W);
    }

    // Check SL
    const curSL = trade.trailed ? entry : sl;
    if ((dir==='BUY' && p<=curSL) || (dir==='SELL' && p>=curSL)) {
      const pnl = dir==='BUY' ? (curSL-entry)*qty : (entry-curSL)*qty;
      addLog(`🛑 SL HIT at ₹${curSL.toFixed(2)} | PnL: ₹${pnl.toFixed(2)}`, R);
      setTrade(null);
      setAlerts(prev => [{ type:'SL_HIT', symbol:trade.sym,
        msg:`[SIM] SL Hit ₹${curSL.toFixed(2)} | PnL ₹${pnl.toFixed(2)}`,
        status:'SL_HIT', ts:new Date().toISOString(), id:'SIM_'+Date.now() }, ...prev]);
      return;
    }

    // Check Target
    if ((dir==='BUY' && p>=target) || (dir==='SELL' && p<=target)) {
      const pnl = dir==='BUY' ? (target-entry)*qty : (entry-target)*qty;
      addLog(`🎯 TARGET HIT at ₹${target.toFixed(2)} | PnL: +₹${pnl.toFixed(2)}`, G);
      setTrade(null);
      setAlerts(prev => [{ type:'TARGET_HIT', symbol:trade.sym,
        msg:`[SIM] Target Hit ₹${target.toFixed(2)} | PnL +₹${pnl.toFixed(2)}`,
        status:'TARGET_HIT', ts:new Date().toISOString(), id:'SIM_'+Date.now() }, ...prev]);
      return;
    }

    const unreal = dir==='BUY' ? (p-entry)*qty : (entry-p)*qty;
    addLog(`📊 Price: ₹${p.toFixed(2)} | Unrealised: ${unreal>=0?'+':''}₹${unreal.toFixed(2)}`, unreal>=0?G:R);
  };

  const [simPrice, setSimPrice] = useState('');

  return (
    <div style={{ padding:'22px', height:'100%', overflowY:'auto' }}>
      <h2 style={{ fontSize:19,fontWeight:800,color:SB,marginBottom:4 }}>ORB Strategy Simulator</h2>
      <p style={{ fontSize:13,color:T2,marginBottom:16 }}>
        Test entry/exit logic without real market. Simulates ORB breakout, SL trail, and P&L.
        Results appear in Dashboard Alert Feed.
      </p>

      <div style={{ display:'grid',gridTemplateColumns:'360px 1fr',gap:18,alignItems:'start' }}>
        {/* Controls */}
        <div>
          <SCard title="Step 1 — Set ORB Levels" icon={Target}>
            <div style={{ marginBottom:10 }}>
              <label style={{ fontSize:12,fontWeight:600,color:T2,display:'block',marginBottom:5 }}>Stock</label>
              <StockDropdown value={sym} onChange={setSym} />
            </div>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8 }}>
              <Field label="ORB High ₹" value={orbHigh} onChange={setOrbHigh} type="number" prefix="₹" />
              <Field label="ORB Low ₹"  value={orbLow}  onChange={setOrbLow}  type="number" prefix="₹" />
            </div>
            <button onClick={lockORB} style={{ width:'100%',padding:'9px',borderRadius:8,
              border:`2px solid ${SB}`,background:'#EEF2FF',color:SB,fontWeight:700,fontSize:13,cursor:'pointer' }}>
              🔒 Lock ORB Levels
            </button>
          </SCard>

          <SCard title="Step 2 — Fire Breakout Signal" icon={Zap}>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:7,marginBottom:10 }}>
              {['BUY','SELL'].map(s=>(
                <button key={s} onClick={()=>setDirection(s)} style={{
                  padding:'9px',borderRadius:8,fontWeight:700,
                  border:`2px solid ${s==='BUY'?G:R}`,
                  background:direction===s?(s==='BUY'?G:R):'#fff',
                  color:direction===s?'#fff':(s==='BUY'?G:R),cursor:'pointer' }}>
                  {s==='BUY'?'▲ BUY':'▼ SELL'}
                </button>
              ))}
            </div>
            <Field label="Entry Price (optional)" value={ltp} onChange={setLtp} type="number" prefix="₹"
              placeholder={direction==='BUY'?`Above ${orbHigh||'ORB High'}`:`Below ${orbLow||'ORB Low'}`} />
            <button onClick={fireSignal} style={{ width:'100%',padding:'9px',borderRadius:8,border:'none',
              background:direction==='BUY'?G:R,color:'#fff',fontWeight:700,fontSize:13,cursor:'pointer' }}>
              🚀 Fire {direction} Signal
            </button>
          </SCard>

          {trade && (
            <SCard title="Step 3 — Simulate Price Movement" icon={Activity}>
              <div style={{ background:'#F8FAFC',borderRadius:8,padding:'10px 12px',marginBottom:10 }}>
                <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6 }}>
                  {[{l:'Entry',v:trade.entry,c:'#6366F1'},{l:'SL',v:trade.trailed?trade.entry:trade.sl,c:R},{l:'Target',v:trade.target,c:G}].map(x=>(
                    <div key={x.l} style={{ background:x.c+'12',borderRadius:6,padding:'5px 8px',textAlign:'center' }}>
                      <div style={{ fontSize:9,color:x.c,fontWeight:600 }}>{x.l}{x.l==='SL'&&trade.trailed?' ✓':''}</div>
                      <div className="mono" style={{ fontSize:13,fontWeight:700,color:x.c }}>₹{x.v.toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </div>
              <Field label="Simulate Current Price ₹" value={simPrice} onChange={setSimPrice} type="number" prefix="₹"
                placeholder="Enter any price to check SL/Target/Trail" />
              <button onClick={()=>simulatePrice(simPrice)} style={{ width:'100%',padding:'9px',borderRadius:8,
                border:'none',background:SB,color:'#fff',fontWeight:700,fontSize:13,cursor:'pointer' }}>
                ▶ Check Price Action
              </button>
              <button onClick={()=>{setTrade(null);addLog('❌ Trade manually exited',R);}} style={{ width:'100%',
                padding:'7px',borderRadius:8,border:`1px solid ${R}`,background:'#fff',
                color:R,fontWeight:600,fontSize:12,cursor:'pointer',marginTop:6 }}>
                Exit Trade
              </button>
            </SCard>
          )}

          {/* Config summary */}
          <div style={{ background:'#EEF2FF',borderRadius:9,padding:'10px 14px',fontSize:12 }}>
            <div style={{ fontWeight:700,color:SB,marginBottom:5 }}>Config from R&R Settings</div>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,color:T2 }}>
              <span>Capital: <b style={{color:T1}}>{fmtINR(rrConfig?.capital||50000)}</b></span>
              <span>Leverage: <b style={{color:T1}}>{rrConfig?.leverage||5}x</b></span>
              <span>Risk/trade: <b style={{color:R}}>{fmtINR(riskAmt)}</b></span>
              <span>R:R Ratio: <b style={{color:G}}>1:{rrConfig?.rrRatio||2}</b></span>
            </div>
          </div>
        </div>

        {/* Simulation Log */}
        <SCard title="Simulation Log" icon={Bell}
          action={<button onClick={()=>setLog([])} style={{ fontSize:11,color:R,background:'none',
            border:`1px solid ${R}`,borderRadius:5,padding:'2px 8px',cursor:'pointer' }}>Clear</button>}>
          {log.length===0
            ? <div style={{ textAlign:'center',color:T2,padding:'32px 0',fontSize:13 }}>
                Lock ORB levels and fire a signal to start simulation
              </div>
            : log.map((l,i)=>(
              <div key={i} style={{ display:'flex',gap:10,padding:'6px 8px',borderRadius:6,
                marginBottom:4,background:'#F8FAFC',borderLeft:`3px solid ${l.color||T1}` }}>
                <span className="mono" style={{ fontSize:10,color:T2,flexShrink:0 }}>{l.ts}</span>
                <span style={{ fontSize:12,color:l.color||T1,fontWeight:500 }}>{l.msg}</span>
              </div>
            ))
          }
        </SCard>
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
  const [rrConfig, setRrConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('orb_rr_config');
      if (saved) return JSON.parse(saved);
    } catch(_) {}
    return { capital:50000, leverage:5, riskPct:2, rrRatio:2, maxSLPerDay:3,
             cryptoLeverage:10, cryptoRiskPct:2, cryptoRRRatio:2, cryptoMaxSL:3 };
  });

  // Saved APIs from localStorage (read-only in main App — ApiCredView manages writes)
  const [savedApis, setSavedApis] = useState(() => {
    try { return JSON.parse(localStorage.getItem('orb_apis') || '[]'); } catch(_) { return []; }
  });

  // Keep savedApis in sync when localStorage changes (e.g. from ApiCredView)
  useEffect(() => {
    const sync = () => {
      try { setSavedApis(JSON.parse(localStorage.getItem('orb_apis') || '[]')); } catch(_) {}
    };
    window.addEventListener('storage', sync);
    // Also poll every 3s for same-tab changes
    const t = setInterval(sync, 3000);
    return () => { window.removeEventListener('storage', sync); clearInterval(t); };
  }, []);

  // Auto-save rrConfig to localStorage whenever it changes
  useEffect(() => {
    try { localStorage.setItem('orb_rr_config', JSON.stringify(rrConfig)); } catch(_) {}
  }, [JSON.stringify(rrConfig)]);

  // Load RR from server on boot — server is source of truth
  useEffect(() => {
    api.get('/api/risk/config').then(d => {
      if (d.success && d.config) {
        setRrConfig(prev => ({ ...prev, ...d.config }));
      }
    }).catch(() => {});
  }, []);
  const [sysAlerts,      setSysAlerts]      = useState([]);
  const [funds,          setFunds]          = useState([]);   // global broker balance

  const [activeView, setActiveView] = useState('dashboard');
  const [time, setTime] = useState(new Date());

  // Clock
  useEffect(()=>{ const t=setInterval(()=>setTime(new Date()),1000); return ()=>clearInterval(t); },[]);

  // ── Load balance and update capital ─────────────────────
  const loadBalance = useCallback(async () => {
    try {
      const fr = await api.get('/api/portfolio/funds');
      if (fr.success && fr.funds?.length > 0) {
        setFunds(fr.funds);
        // Use backend-computed availableBalance (most reliable)
        const bal = parseFloat(fr.availableBalance || 0);
        if (bal > 100) {
          setRrConfig(p => ({ ...p, capital: Math.floor(bal) }));
          return Math.floor(bal);
        }
        // Fallback: find equityAmount in any fund entry
        for (const f of fr.funds) {
          const v = parseFloat(f.equityAmount ?? f.equity_amount ?? f.value ?? 0);
          if (v > 100) {
            setRrConfig(p => ({ ...p, capital: Math.floor(v) }));
            return Math.floor(v);
          }
        }
      }
    } catch(e) { console.error('Balance error:', e); }
    return 0;
  }, []);

  // ── Initial load ─────────────────────────────────────────
  useEffect(()=>{
    // Auth status
    api.get('/api/auth/status').then(r=>{
      setAuthStatus(r);
      if (r.isAuthenticated) loadBalance();
    }).catch(()=>{});

    // Risk config
    api.get('/api/risk/status').then(r=>{
      setRiskStatus(r);
      if (r.config) setRrConfig(p => ({ ...p, ...r.config }));
    }).catch(()=>{});

    // Alert polling fallback — fetch alerts every 5s via REST
    // This ensures alerts show even if Socket.io drops
    const alertPoll = setInterval(async () => {
      try {
        const r = await api.get('/api/alerts');
        if (r.alerts?.length > 0) setAlerts(r.alerts);
      } catch(_) {}
    }, 5000);

    return () => clearInterval(alertPoll);
  },[]);

  // ── Re-fetch balance when auth changes ───────────────────
  useEffect(()=>{
    if (authStatus?.isAuthenticated) loadBalance();
  },[authStatus?.isAuthenticated]);

  // Socket event listeners
  useEffect(()=>{
    if(!socket) return;

    socket.on('initState', state => {
      if(state.masterEnabled!==undefined) setMasterOn(state.masterEnabled);
      if(state.selectedSymbols)           setSelectedSymbols(state.selectedSymbols);
      if(state.stockToggles)              setStockToggles(state.stockToggles);
      // Merge rrConfig but NEVER overwrite capital — it comes from broker balance
      if(state.rrConfig) setRrConfig(p => ({
        leverage:    state.rrConfig.leverage    || p.leverage,
        riskPct:     state.rrConfig.riskPct     || p.riskPct,
        rrRatio:     state.rrConfig.rrRatio     || p.rrRatio,
        maxSLPerDay: state.rrConfig.maxSLPerDay || p.maxSLPerDay,
        capital:     p.capital  // always keep current capital — don't overwrite
      }));
      if(state.authStatus) {
        setAuthStatus(state.authStatus);
        if(state.authStatus.isAuthenticated) loadBalance();
      }
      if(state.riskStatus)                setRiskStatus(state.riskStatus);
      if(state.ticks)                     setTicks(state.ticks);
      if(state.alerts?.length>0)          setAlerts(state.alerts);
    });

    socket.on('tick', ({ symbol, tick }) => {
      setTicks(p => ({ ...p, [symbol]: tick }));
    });

    socket.on('orbLocked', ({ symbol, high, low }) => {
      setOrbLevels(p => ({ ...p, [symbol]: { high, low, locked:true } }));
    });

    socket.on('signal', (sig) => {
      setAlerts(p => {
        const exists = p.find(a => a.id === sig.id);
        return exists ? p : [sig, ...p].slice(0,200);
      });
    });

    socket.on('testSignalResult', (sig) => {
      const alert = {
        type:    sig.order?.side || 'TEST',
        symbol:  sig.order?.symbol || sig.symbol || '—',
        msg:     `Test signal: ${sig.order?.side} ${sig.order?.qty} ${sig.order?.symbol} [${sig.orderId}]`,
        status:  'SIMULATED',
        ts:      new Date().toISOString(),
        id:      sig.orderId
      };
      setAlerts(p => [alert, ...p].slice(0,200));
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
    // Save to localStorage permanently
    try { localStorage.setItem('orb_selected_symbols', JSON.stringify(syms)); } catch(_){}
    try { localStorage.setItem('orb_stock_toggles', JSON.stringify(toggles)); } catch(_){}
    try { await api.post('/api/stocks/select', { symbols:syms, toggles }); } catch(e){}
  };

  // ── On startup: restore stocks from localStorage and push to server ──
  useEffect(() => {
    const restoreStocks = async () => {
      try {
        const saved = localStorage.getItem('orb_selected_symbols');
        const savedToggles = localStorage.getItem('orb_stock_toggles');
        if (saved) {
          const syms = JSON.parse(saved);
          const toggles = savedToggles ? JSON.parse(savedToggles) : {};
          if (syms.length > 0) {
            setSelectedSymbols(syms);
            setStockToggles(toggles);
            // Push to server to ensure subscription
            await api.post('/api/stocks/select', { symbols:syms, toggles });
            logger.info && logger.info('Restored ' + syms.length + ' stocks from localStorage');
          }
        }
      } catch(_) {}
    };
    // Run after short delay to ensure server is ready
    setTimeout(restoreStocks, 2000);
  }, []);

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
              rrConfig={rrConfig} authStatus={authStatus} savedApis={savedApis} />
          )}
          {activeView==='api' && <ApiCredView authStatus={authStatus} onApisChange={setSavedApis} />}
          {false && (
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
          {activeView==='morning' && (
            <MorningCheckView authStatus={authStatus} selectedSymbols={selectedSymbols}
              ticks={ticks} orbLevels={orbLevels} riskStatus={riskStatus}
              rrConfig={rrConfig} masterOn={masterOn} socketConnected={socketConnected} />
          )}
          {false && (
            <ORBSimulatorView rrConfig={rrConfig} alerts={alerts} setAlerts={setAlerts} />
          )}
          {activeView==='syntax' && <SyntaxGenView selectedSymbols={selectedSymbols} />}
        </div>
      </div>
    </div>
  );
}
