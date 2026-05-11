import { useState, useEffect, useRef } from "react";

// ── GOOGLE MAPS API KEY — enable Maps JS · Street View · Places · Geocoding ──
const GOOGLE_MAPS_API_KEY = "AIzaSyAofAL2EBnvvgUd4kk4jwyXfPf654KdBGQ";

// ── Region presets {sw:[lat,lng], ne:[lat,lng]} ───────────────────────────────
const PRESETS = {
  "World":           {sw:[-55,-170],ne:[75, 179]}, "Europe":          {sw:[35, -25], ne:[71,  45]},
  "Argentina":       {sw:[-55,-74], ne:[-21,-53]}, "Australia":       {sw:[-44, 113],ne:[-10,154]},
  "Brazil":          {sw:[-34,-74], ne:[5,  -34]}, "Canada":          {sw:[41,-141], ne:[84, -52]},
  "Chile":           {sw:[-56,-76], ne:[-17,-66]}, "China":           {sw:[18,  73], ne:[53, 135]},
  "Colombia":        {sw:[-4, -79], ne:[13, -66]}, "Czech Republic":  {sw:[48,  12], ne:[51,  19]},
  "Denmark":         {sw:[54,   8], ne:[58,  15]}, "Finland":         {sw:[59,  20], ne:[70,  31]},
  "France":          {sw:[41,  -5], ne:[51,  10]}, "Germany":         {sw:[47,   6], ne:[55,  15]},
  "Ghana":           {sw:[4,   -4], ne:[11,   1]}, "Greece":          {sw:[35,  20], ne:[42,  27]},
  "India":           {sw:[8,   68], ne:[37,  97]}, "Indonesia":       {sw:[-11, 95], ne:[6,  141]},
  "Italy":           {sw:[36,   6], ne:[47,  19]}, "Japan":           {sw:[30, 129], ne:[46, 146]},
  "Kenya":           {sw:[-5,  33], ne:[5,   42]}, "Mexico":          {sw:[14,-118], ne:[33, -86]},
  "Netherlands":     {sw:[50,   3], ne:[54,   8]}, "New Zealand":     {sw:[-47,166], ne:[-34,178]},
  "Nigeria":         {sw:[4,    3], ne:[14,  15]}, "Norway":          {sw:[57,   4], ne:[71,  31]},
  "Peru":            {sw:[-18,-82], ne:[0,  -68]}, "Philippines":     {sw:[5,  116], ne:[21, 127]},
  "Poland":          {sw:[49,  14], ne:[55,  24]}, "Portugal":        {sw:[36, -10], ne:[42,  -6]},
  "Romania":         {sw:[43,  20], ne:[48,  30]}, "Russia":          {sw:[41,  27], ne:[82, 180]},
  "South Africa":    {sw:[-35, 16], ne:[-22, 33]}, "South Korea":     {sw:[34, 126], ne:[38, 130]},
  "Spain":           {sw:[36,  -9], ne:[44,   4]}, "Sweden":          {sw:[55,  11], ne:[69,  24]},
  "Switzerland":     {sw:[45,   5], ne:[48,  11]}, "Thailand":        {sw:[5,   97], ne:[21, 106]},
  "Turkey":          {sw:[35,  25], ne:[43,  45]}, "Uganda":          {sw:[-2,  29], ne:[4,   35]},
  "Ukraine":         {sw:[44,  22], ne:[52,  40]}, "United Kingdom":  {sw:[49,  -8], ne:[61,   2]},
  "United States":   {sw:[24,-125], ne:[50, -66]}, "Uruguay":         {sw:[-35,-58], ne:[-30,-53]},
};
const GROUPS = {
  "Global":   ["World","Europe"],
  "Americas": ["Argentina","Brazil","Canada","Chile","Colombia","Mexico","Peru","United States","Uruguay"],
  "Europe":   ["Czech Republic","Denmark","Finland","France","Germany","Greece","Italy","Netherlands","Norway","Poland","Portugal","Romania","Spain","Sweden","Switzerland","Ukraine","United Kingdom"],
  "Asia":     ["China","India","Indonesia","Japan","Philippines","South Korea","Thailand","Turkey"],
  "Africa":   ["Ghana","Kenya","Nigeria","South Africa","Uganda"],
  "Oceania":  ["Australia","New Zealand"],
  "Other":    ["Russia"],
};

// ── Utilities ─────────────────────────────────────────────────────────────────

function haversineKm(a, b) {
  const R = 6371, dLat=(b.lat-a.lat)*Math.PI/180, dLng=(b.lng-a.lng)*Math.PI/180;
  const s = Math.sin(dLat/2)**2 + Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(s),Math.sqrt(1-s));
}
function diagKm({sw,ne}) { return haversineKm({lat:sw[0],lng:sw[1]},{lat:ne[0],lng:ne[1]}); }
function calcScore(km, dKm) {
  if (km<=0.01) return 5000;
  return Math.max(0, Math.round(5000*Math.exp(-km/Math.max(dKm*0.05, 0.5))));
}
function randPt({sw,ne}) { return {lat:sw[0]+Math.random()*(ne[0]-sw[0]), lng:sw[1]+Math.random()*(ne[1]-sw[1])}; }
function randInGmBounds(b) { const sw=b.getSouthWest(),ne=b.getNorthEast(); return {lat:sw.lat()+Math.random()*(ne.lat()-sw.lat()),lng:sw.lng()+Math.random()*(ne.lng()-sw.lng())}; }
function fmtTime(s) { return `${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`; }
function genCode() { return Math.random().toString(36).substring(2,8).toUpperCase(); }

// ── Loaders ───────────────────────────────────────────────────────────────────

let _gm=null;
function loadGoogleMaps(key) {
  if (_gm) return _gm;
  _gm = new Promise((resolve,reject) => {
    if (window.google?.maps) { resolve(window.google.maps); return; }
    const cb="__gm"+Date.now(); window[cb]=()=>{resolve(window.google.maps);delete window[cb];};
    const s=document.createElement("script");
    s.src=`https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&callback=${cb}`;
    s.async=true; s.onerror=()=>reject(new Error("Maps load failed"));
    document.head.appendChild(s);
  });
  return _gm;
}
let _pj=null;
function loadPeerJS() {
  if (_pj) return _pj;
  _pj = new Promise((resolve,reject) => {
    if (window.Peer) { resolve(window.Peer); return; }
    const s=document.createElement("script");
    s.src="https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js";
    s.onload=()=>resolve(window.Peer); s.onerror=()=>reject(new Error("PeerJS load failed"));
    document.head.appendChild(s);
  });
  return _pj;
}

// ── Find Street View panorama ─────────────────────────────────────────────────

function findPano(maps, getPoint, attempts=14) {
  return new Promise((resolve,reject) => {
    const svc=new maps.StreetViewService(); let tried=0;
    function next() {
      if (tried++>=attempts) { reject(new Error("No Street View coverage found. Try a different region.")); return; }
      svc.getPanorama({location:getPoint(),radius:5000,source:maps.StreetViewSource.OUTDOOR},(data,status)=>{
        if (status===maps.StreetViewStatus.OK) { const l=data.location.latLng; resolve({lat:l.lat(),lng:l.lng()}); }
        else next();
      });
    }
    next();
  });
}

// ── Style tokens ─────────────────────────────────────────────────────────────

const S = {
  card: "bg-[#161920] border border-white/[0.08] rounded-xl",
  btn: "font-sans text-sm px-4 py-2 rounded-lg border border-white/[0.12] bg-transparent text-[#f0f0f0] hover:bg-white/[0.06] transition-all duration-200 cursor-pointer",
  btnAccent: "font-sans text-sm px-5 py-2.5 rounded-lg border border-[#4ade80]/30 bg-[#4ade80]/10 text-[#4ade80] hover:bg-[#4ade80]/20 transition-all duration-200 cursor-pointer",
  label: "font-sans text-xs text-[#6b7280]",
  frosted: "backdrop-blur-[12px] bg-[#0d0f14]/75 border border-white/[0.08] rounded-lg",
};

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({label, checked, onChange}) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
      <span className="font-sans text-xs text-[#f0f0f0]/80">{label}</span>
      <button role="switch" aria-checked={checked} onClick={()=>onChange(!checked)}
        className={`relative w-9 h-5 rounded-full transition-colors duration-200 border-0 cursor-pointer ${checked?"bg-[#4ade80]":"bg-[#2a2d35]"}`}>
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-[#0d0f14] transition-transform duration-200 ${checked?"translate-x-4":"translate-x-0"}`}/>
      </button>
    </label>
  );
}

// ── MODE SELECT ───────────────────────────────────────────────────────────────

function ModeSelectScreen({onSelect}) {
  const [search, setSearch] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const inputRef = useRef(null);
  const placeRef = useRef(null);

  useEffect(() => { loadGoogleMaps(GOOGLE_MAPS_API_KEY); }, []);

  useEffect(() => {
    if (!showCustom || !inputRef.current) return;
    loadGoogleMaps(GOOGLE_MAPS_API_KEY).then(maps => {
      const ac = new maps.places.Autocomplete(inputRef.current, {types:["(cities)"]});
      ac.addListener("place_changed", () => { placeRef.current = ac.getPlace(); });
    });
  }, [showCustom]);

  function selectPreset(name) {
    const p = PRESETS[name];
    onSelect({name, preset:p, diagKm:diagKm(p), gmBounds:null});
  }

  function selectCustom() {
    const place = placeRef.current;
    if (!place?.geometry) return;
    const maps = window.google.maps;
    const b = place.geometry.viewport || new maps.LatLngBounds(place.geometry.location, place.geometry.location);
    const sw=[b.getSouthWest().lat(),b.getSouthWest().lng()], ne=[b.getNorthEast().lat(),b.getNorthEast().lng()];
    onSelect({name:place.name, preset:{sw,ne}, diagKm:diagKm({sw,ne}), gmBounds:b});
  }

  const q = search.toLowerCase();
  const filtered = Object.keys(PRESETS).filter(k=>k.toLowerCase().includes(q));

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#0d0f14] relative overflow-y-auto py-8">
      <div className="absolute inset-0 opacity-[0.035] pointer-events-none" style={{backgroundImage:"linear-gradient(#4ade80 1px,transparent 1px),linear-gradient(90deg,#4ade80 1px,transparent 1px)",backgroundSize:"60px 60px"}}/>
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full opacity-[0.08] pointer-events-none" style={{background:"radial-gradient(circle,#4ade80 0%,transparent 70%)"}}/>
      <div className={`relative z-10 ${S.card} p-6 w-full max-w-lg shadow-2xl`}>
        <p className="font-mono text-[#4ade80] text-[10px] tracking-[0.35em] uppercase mb-1">City Explorer</p>
        <h1 className="font-mono text-2xl font-bold text-[#f0f0f0] mb-5">Select Region</h1>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Filter regions…"
          className="w-full mb-4 bg-[#0d0f14] border border-white/[0.12] rounded-lg px-4 py-2 text-sm text-[#f0f0f0] placeholder-[#6b7280] outline-none focus:border-[#4ade80]/40 transition-colors font-sans"/>
        <div className="max-h-[52vh] overflow-y-auto space-y-3 pr-1">
          {Object.entries(GROUPS).map(([grp,keys])=>{
            const hits=keys.filter(k=>filtered.includes(k));
            if (!hits.length) return null;
            return (
              <div key={grp}>
                <p className="text-[10px] font-mono text-[#6b7280] uppercase tracking-widest mb-1.5">{grp}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {hits.map(k=><button key={k} onClick={()=>selectPreset(k)} className={`${S.btn} text-left text-xs px-3 py-2`}>{k}</button>)}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 pt-4 border-t border-white/[0.05]">
          <button onClick={()=>setShowCustom(v=>!v)} className={`${S.btn} w-full text-xs text-left`}>
            ＋ Custom City {showCustom?"▲":"▼"}
          </button>
          {showCustom && (
            <div className="flex gap-2 mt-2">
              <input ref={inputRef} type="text" placeholder="Search city…"
                className="flex-1 bg-[#0d0f14] border border-white/[0.12] rounded-lg px-3 py-2 text-sm text-[#f0f0f0] placeholder-[#6b7280] outline-none focus:border-[#4ade80]/40 transition-colors font-sans"/>
              <button onClick={selectCustom} className={S.btnAccent}>Go</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── LOBBY ─────────────────────────────────────────────────────────────────────

function LobbyScreen({locData, onStart, onBack}) {
  const [noMove, setNoMove] = useState(false);
  const [noPan, setNoPan] = useState(false);
  const [timerOn, setTimerOn] = useState(false);
  const [timerSecs, setTimerSecs] = useState(60);
  const [rounds, setRounds] = useState(3);
  const [mpMode, setMpMode] = useState("none"); // none | hosting | joining | joined
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [mpStatus, setMpStatus] = useState("idle"); // idle|loading|ready|error
  const [mpErr, setMpErr] = useState("");
  const [playerCount, setPlayerCount] = useState(1);
  const [starting, setStarting] = useState(false);
  const peerRef = useRef(null);
  const connsRef = useRef([]);
  const myName = useRef("Player"+Math.floor(Math.random()*9000+1000));

  function getPointFn() { return locData.gmBounds ? randInGmBounds(locData.gmBounds) : randPt(locData.preset); }

  async function pickLocations(n) {
    const maps = await loadGoogleMaps(GOOGLE_MAPS_API_KEY);
    const locs = [];
    for (let i=0;i<n;i++) locs.push(await findPano(maps, getPointFn, 14));
    return locs;
  }

  async function handleHostCreate() {
    setMpStatus("loading"); setMpErr("");
    try {
      const Peer = await loadPeerJS();
      const code = genCode();
      const peer = new Peer(code, {debug:0});
      peerRef.current = peer;
      peer.on("open", ()=>{ setRoomCode(code); setMpMode("hosting"); setMpStatus("ready"); });
      peer.on("error", e=>{ setMpStatus("error"); setMpErr(e.type||String(e)); });
      peer.on("connection", conn=>{
        connsRef.current.push(conn);
        setPlayerCount(c=>c+1);
        conn.on("close",()=>{ connsRef.current=connsRef.current.filter(c=>c!==conn); setPlayerCount(c=>Math.max(1,c-1)); });
      });
    } catch(e) { setMpStatus("error"); setMpErr(e.message); }
  }

  async function handleJoin() {
    if (!joinCode.trim()) return;
    setMpStatus("loading"); setMpErr("");
    try {
      const Peer = await loadPeerJS();
      const peer = new Peer({debug:0});
      peerRef.current = peer;
      peer.on("open", ()=>{
        const conn = peer.connect(joinCode.trim().toUpperCase());
        conn.on("open", ()=>{
          conn.send({type:"JOIN", name:myName.current});
          setMpMode("joined"); setMpStatus("ready");
          conn.on("data", data=>{
            if (data.type==="GAME_CONFIG") {
              onStart(data.cfg, {type:"guest",peer,conn,myName:myName.current,conns:[]});
            }
          });
        });
        conn.on("error",()=>{ setMpStatus("error"); setMpErr("Could not connect to room "+joinCode); });
      });
      peer.on("error", e=>{ setMpStatus("error"); setMpErr(e.type||String(e)); });
    } catch(e) { setMpStatus("error"); setMpErr(e.message); }
  }

  async function handleStartGame() {
    setStarting(true);
    try {
      const locations = await pickLocations(rounds);
      const cfg = {noMove,noPan,timerOn,timerSecs,rounds,locData,locations};
      if (mpMode==="hosting") {
        const multi = {type:"host",peer:peerRef.current,conns:connsRef.current,myName:myName.current};
        connsRef.current.forEach(c=>c.send({type:"GAME_CONFIG",cfg}));
        onStart(cfg, multi);
      } else {
        onStart(cfg, null);
      }
    } catch(e) { setStarting(false); setMpErr(e.message); }
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#0d0f14] overflow-y-auto py-8">
      <div className={`${S.card} p-5 w-full max-w-sm shadow-2xl`}>
        <div className="flex items-center gap-3 mb-5">
          <button onClick={onBack} className={`${S.btn} px-2.5 py-1.5 text-xs`}>← Back</button>
          <div>
            <p className="font-mono text-[#4ade80] text-[10px] tracking-widest uppercase">Playing in</p>
            <p className="font-mono text-sm text-[#f0f0f0]">{locData.name}</p>
          </div>
        </div>

        <div className={`${S.card} p-4 space-y-3 mb-3`}>
          <p className={S.label}>Settings</p>
          <div className="flex items-center justify-between">
            <span className="font-sans text-xs text-[#f0f0f0]/80">Rounds</span>
            <div className="flex gap-1.5">
              {[1,3,5].map(n=>(
                <button key={n} onClick={()=>setRounds(n)}
                  className={`w-8 h-7 rounded text-xs font-mono border transition-all duration-200 ${rounds===n?"border-[#4ade80]/40 bg-[#4ade80]/10 text-[#4ade80]":"border-white/[0.08] text-[#6b7280] hover:text-[#f0f0f0]"}`}>{n}</button>
              ))}
            </div>
          </div>
          <Toggle label="No Move" checked={noMove} onChange={setNoMove}/>
          <Toggle label="No Pan" checked={noPan} onChange={setNoPan}/>
          <Toggle label="Timer" checked={timerOn} onChange={setTimerOn}/>
          {timerOn && (
            <div className="flex items-center justify-between">
              <span className="font-sans text-xs text-[#f0f0f0]/80">Seconds / round</span>
              <div className="flex gap-1.5">
                {[30,60,120,180].map(n=>(
                  <button key={n} onClick={()=>setTimerSecs(n)}
                    className={`px-2 h-7 rounded text-[10px] font-mono border transition-all duration-200 ${timerSecs===n?"border-[#4ade80]/40 bg-[#4ade80]/10 text-[#4ade80]":"border-white/[0.08] text-[#6b7280] hover:text-[#f0f0f0]"}`}>{n}s</button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={`${S.card} p-4 mb-4`}>
          <p className={`${S.label} mb-3`}>Multiplayer</p>
          {mpMode==="none" && (
            <div className="flex gap-2">
              <button onClick={handleHostCreate} className={`${S.btn} flex-1 text-xs`}>Create Room</button>
              <button onClick={()=>setMpMode("joining")} className={`${S.btn} flex-1 text-xs`}>Join Room</button>
            </div>
          )}
          {mpMode==="joining" && (
            <div className="flex gap-2">
              <input value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())} maxLength={6} placeholder="ROOM CODE"
                className="flex-1 bg-[#0d0f14] border border-white/[0.12] rounded-lg px-3 py-2 text-sm font-mono text-[#4ade80] placeholder-[#6b7280] outline-none focus:border-[#4ade80]/40 tracking-widest"/>
              <button onClick={handleJoin} className={S.btnAccent}>Join</button>
            </div>
          )}
          {mpMode==="hosting" && mpStatus==="ready" && (
            <div className="text-center py-1">
              <p className={S.label}>Room Code</p>
              <p className="font-mono text-3xl text-[#4ade80] tracking-[0.2em] mt-0.5">{roomCode}</p>
              <p className={`${S.label} mt-1`}>{playerCount} player{playerCount!==1?"s":""} in room</p>
            </div>
          )}
          {mpMode==="joined" && mpStatus==="ready" && (
            <p className="text-xs font-sans text-[#4ade80] text-center py-2">✓ Connected — waiting for host…</p>
          )}
          {mpStatus==="loading" && <p className={`${S.label} text-center py-2`}>Connecting…</p>}
          {mpErr && <p className="text-xs text-[#f87171] mt-2">{mpErr}</p>}
        </div>

        {(mpMode==="none" || mpMode==="hosting") && (
          <button onClick={handleStartGame} disabled={starting}
            className={`w-full py-3 font-mono text-sm tracking-wider rounded-lg border transition-all duration-200 ${starting?"border-white/[0.06] text-[#6b7280] cursor-wait":"border-[#4ade80]/40 bg-[#4ade80]/10 text-[#4ade80] hover:bg-[#4ade80]/20"}`}>
            {starting?"LOADING LOCATIONS…":mpMode==="hosting"?"START GAME":"PLAY SOLO"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── MINI-MAP ──────────────────────────────────────────────────────────────────

function MiniMap({maps, preset, gmBounds, onPin, pinPlaced, onGuess, canGuess}) {
  const mapRef = useRef(null);
  const instRef = useRef(null);
  const markerRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const w = expanded ? 340 : 240;

  useEffect(() => {
    if (!maps || !mapRef.current) return;
    const sw=new maps.LatLng(preset.sw[0],preset.sw[1]), ne=new maps.LatLng(preset.ne[0],preset.ne[1]);
    const bounds = gmBounds || new maps.LatLngBounds(sw,ne);
    const m = new maps.Map(mapRef.current, {center:bounds.getCenter().toJSON(), zoom:5, disableDefaultUI:true, styles:darkMapStyles, clickableIcons:false});
    m.fitBounds(bounds);
    m.addListener("click", e=>{
      const pos={lat:e.latLng.lat(),lng:e.latLng.lng()};
      if (markerRef.current) markerRef.current.setMap(null);
      markerRef.current=new maps.Marker({position:pos,map:m,icon:{path:maps.SymbolPath.CIRCLE,scale:8,fillColor:"#4ade80",fillOpacity:1,strokeColor:"#0d0f14",strokeWeight:2}});
      onPin(pos);
    });
    instRef.current = m;
  }, [maps]);

  useEffect(() => { if (instRef.current) maps.event.trigger(instRef.current,"resize"); }, [expanded]);

  return (
    <div className="absolute bottom-4 right-4 z-20 flex flex-col items-stretch gap-1.5"
      style={{width:w,transition:"width 200ms ease"}}
      onMouseEnter={()=>setExpanded(true)} onMouseLeave={()=>setExpanded(false)}
      onTouchStart={()=>setExpanded(v=>!v)}>
      <div ref={mapRef} style={{width:"100%",height:w,borderRadius:12,overflow:"hidden",transition:"height 200ms ease",
        border:pinPlaced?"1.5px solid rgba(74,222,128,0.5)":"1px solid rgba(255,255,255,0.08)",
        boxShadow:pinPlaced?"0 0 18px rgba(74,222,128,0.12)":"none"}}/>
      <button onClick={onGuess} disabled={!canGuess}
        className={`w-full py-2.5 rounded-lg font-mono text-sm tracking-wider border transition-all duration-200 ${canGuess?"border-[#4ade80]/40 bg-[#4ade80]/10 text-[#4ade80] hover:bg-[#4ade80]/20 cursor-pointer":"border-white/[0.06] text-[#6b7280] cursor-not-allowed"}`}>
        GUESS
      </button>
    </div>
  );
}

// ── GAME SCREEN ───────────────────────────────────────────────────────────────

function GameScreen({config, roundNum, totalRounds, onResult}) {
  const {noMove, noPan, timerOn, timerSecs, locations, locData} = config;
  const svRef = useRef(null);
  const [maps, setMaps] = useState(null);
  const [pin, setPin] = useState(null);
  const [timeLeft, setTimeLeft] = useState(timerSecs);
  const [err, setErr] = useState("");
  const submittedRef = useRef(false);
  const timerRef = useRef(null);
  const pt = locations[roundNum-1];

  useEffect(() => { loadGoogleMaps(GOOGLE_MAPS_API_KEY).then(setMaps).catch(e=>setErr(e.message)); }, []);

  useEffect(() => {
    if (!maps || !svRef.current || !pt) return;
    const initialPov = {heading:Math.random()*360, pitch:0};
    const pano = new maps.StreetViewPanorama(svRef.current, {
      position:pt, pov:initialPov, zoom:1,
      disableDefaultUI:true, showRoadLabels:false, motionTracking:false,
      linksControl:!noMove, clickToGo:!noMove, scrollwheel:!noMove, panControl:!noPan,
    });
    if (noPan) {
      let locking=false;
      pano.addListener("pov_changed", ()=>{
        if (locking) return;
        locking=true; pano.setPov(initialPov); locking=false;
      });
    }
  }, [maps]);

  useEffect(() => {
    if (!maps || !timerOn) return;
    setTimeLeft(timerSecs);
    timerRef.current = setInterval(()=>{
      setTimeLeft(t=>{ if(t<=1){clearInterval(timerRef.current);submit(null);return 0;} return t-1; });
    }, 1000);
    return ()=>clearInterval(timerRef.current);
  }, [maps]);

  function submit(guessPin) {
    if (submittedRef.current) return;
    submittedRef.current=true; clearInterval(timerRef.current);
    const g=guessPin??pin;
    const dist=g?haversineKm(pt,g):null;
    onResult({actualPt:pt, guessPt:g, dist, score:g?calcScore(dist,locData.diagKm):0});
  }

  if (err) return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#0d0f14] gap-4 p-8">
      <p className="font-mono text-[#f87171] text-sm text-center max-w-xs">{err}</p>
      <button onClick={()=>submit(null)} className={S.btn}>Skip Round</button>
    </div>
  );

  const urgent=timerOn&&timeLeft<=10;
  return (
    <div className="w-full h-full relative overflow-hidden bg-[#0d0f14]">
      <div ref={svRef} className="w-full h-full"/>
      <div className={`absolute top-4 left-4 z-20 ${S.frosted} px-3 py-1.5 flex items-center gap-3`}>
        <span className="font-sans text-xs text-[#f0f0f0]/70">📍 {locData.name}</span>
        <span className="font-mono text-[10px] text-[#6b7280]">{roundNum}/{totalRounds}</span>
      </div>
      <div className={`absolute top-4 right-4 z-20 ${S.frosted} px-3 py-2 flex flex-col items-end gap-1`}>
        {timerOn && <p className={`font-mono text-sm tracking-widest ${urgent?"text-[#f87171] animate-pulse":"text-[#4ade80]"}`}>{fmtTime(timeLeft)}</p>}
        <div className="flex gap-1.5">
          {noMove && <span className="font-mono text-[9px] text-[#6b7280] border border-white/[0.06] rounded px-1.5 py-0.5">NO MOVE</span>}
          {noPan  && <span className="font-mono text-[9px] text-[#6b7280] border border-white/[0.06] rounded px-1.5 py-0.5">NO PAN</span>}
        </div>
      </div>
      {maps && pt && (
        <MiniMap maps={maps} preset={locData.preset} gmBounds={locData.gmBounds}
          onPin={setPin} pinPlaced={!!pin} onGuess={()=>submit(pin)} canGuess={!!pin}/>
      )}
    </div>
  );
}

// ── COUNT-UP HOOK ─────────────────────────────────────────────────────────────

function useCountUp(target, dur=1200) {
  const [v, setV] = useState(0);
  useEffect(()=>{
    let t0=null;
    const step=ts=>{if(!t0)t0=ts;const p=Math.min((ts-t0)/dur,1);setV(Math.round(p*target));if(p<1)requestAnimationFrame(step);};
    requestAnimationFrame(step);
  },[target]);
  return v;
}

function mkMarker(maps, m, pos, color, scale) {
  return new maps.Marker({position:pos,map:m,icon:{path:maps.SymbolPath.CIRCLE,scale,fillColor:color,fillOpacity:1,strokeColor:"#0d0f14",strokeWeight:2}});
}

// ── ROUND RESULT ──────────────────────────────────────────────────────────────

function RoundResult({result, roundNum, totalRounds, allScores, onNext, onQuit}) {
  const {actualPt, guessPt, dist, score} = result;
  const mapRef = useRef(null);
  const displayed = useCountUp(score);

  useEffect(()=>{
    if (!actualPt) return;
    loadGoogleMaps(GOOGLE_MAPS_API_KEY).then(maps=>{
      const center=guessPt?{lat:(actualPt.lat+guessPt.lat)/2,lng:(actualPt.lng+guessPt.lng)/2}:actualPt;
      const m=new maps.Map(mapRef.current,{center,zoom:10,disableDefaultUI:true,styles:darkMapStyles});
      if (guessPt){const b=new maps.LatLngBounds();b.extend(actualPt);b.extend(guessPt);m.fitBounds(b,60);}
      mkMarker(maps,m,actualPt,"#4ade80",10);
      if (guessPt){
        mkMarker(maps,m,guessPt,"#f87171",8);
        new maps.Polyline({path:[actualPt,guessPt],map:m,strokeColor:"#f87171",strokeOpacity:0.75,strokeWeight:2});
      }
    });
  },[]);

  const distStr=!dist?"No guess":dist<1?`${Math.round(dist*1000)} m`:`${dist.toFixed(1)} km`;

  return (
    <div className="w-full h-full flex flex-col bg-[#0d0f14]">
      <div ref={mapRef} className="flex-1 w-full" style={{minHeight:"50vh"}}/>
      <div className={`${S.card} mx-3 mb-3 p-5`}>
        <div className="text-center mb-3">
          <p className="font-mono text-[52px] font-bold text-[#4ade80] leading-none">{displayed.toLocaleString()}</p>
          <p className={`${S.label} mt-0.5`}>pts · round {roundNum}/{totalRounds}</p>
        </div>
        <div className="flex items-center justify-center gap-5 mb-3 flex-wrap">
          <div className="text-center"><p className="font-mono text-sm text-[#f87171]">{distStr}</p><p className={S.label}>distance</p></div>
          {allScores&&allScores.length>1&&<>
            <div className="w-px h-8 bg-white/[0.06]"/>
            <div>
              <p className={`${S.label} mb-1`}>Standings</p>
              {[...allScores].sort((a,b)=>b.total-a.total).map((p,i)=>(
                <p key={i} className="font-mono text-xs text-[#f0f0f0]">{i+1}. {p.name} — {p.total.toLocaleString()}</p>
              ))}
            </div>
          </>}
        </div>
        <div className="flex items-center justify-center gap-4 mb-4 text-xs font-sans text-[#6b7280]">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#4ade80] inline-block"/>Actual</span>
          {guessPt&&<span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#f87171] inline-block"/>Your guess</span>}
        </div>
        <div className="flex gap-2">
          <button onClick={onNext} className={`${S.btnAccent} flex-1 font-mono tracking-wider`}>
            {roundNum<totalRounds?"NEXT ROUND →":"SEE RESULTS"}
          </button>
          <button onClick={onQuit} className={`${S.btn} px-3`}>Quit</button>
        </div>
      </div>
    </div>
  );
}

// ── FINAL RESULT ──────────────────────────────────────────────────────────────

function FinalResult({allRounds, allScores, config, onPlayAgain, onChangeRegion}) {
  const total=allRounds.reduce((s,r)=>s+(r.score||0),0);
  const displayed=useCountUp(total);
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#0d0f14] overflow-y-auto py-8">
      <div className={`${S.card} p-6 w-full max-w-sm shadow-2xl`}>
        <p className="font-mono text-[#4ade80] text-[10px] tracking-[0.3em] uppercase mb-1">Game Over</p>
        <div className="text-center my-4">
          <p className="font-mono text-[64px] font-bold text-[#4ade80] leading-none">{displayed.toLocaleString()}</p>
          <p className={`${S.label} mt-1`}>{config.rounds} rounds · {config.locData.name}</p>
        </div>
        {allScores&&allScores.length>1&&(
          <div className={`${S.card} p-3 mb-4`}>
            <p className={`${S.label} mb-2`}>Final Standings</p>
            {[...allScores].sort((a,b)=>b.total-a.total).map((p,i)=>(
              <div key={i} className="flex justify-between py-1">
                <span className="font-sans text-xs text-[#f0f0f0]">{["🥇","🥈","🥉"][i]||""} {p.name}</span>
                <span className="font-mono text-xs text-[#4ade80]">{p.total.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
        <div className={`${S.card} p-3 mb-5`}>
          <p className={`${S.label} mb-2`}>Round Breakdown</p>
          {allRounds.map((r,i)=>(
            <div key={i} className="flex justify-between items-center py-1 border-b border-white/[0.04] last:border-0">
              <span className={S.label}>Round {i+1}</span>
              <span className="font-mono text-xs text-[#f0f0f0]">
                {r.dist!=null?r.dist<1?`${Math.round(r.dist*1000)}m`:`${r.dist.toFixed(1)}km`:"—"}
              </span>
              <span className={`font-mono text-xs ${r.score>3500?"text-[#4ade80]":r.score>1500?"text-[#f0f0f0]":"text-[#f87171]"}`}>
                {(r.score||0).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onPlayAgain} className={`${S.btnAccent} flex-1 font-mono text-xs tracking-wider`}>PLAY AGAIN</button>
          <button onClick={onChangeRegion} className={`${S.btn} flex-1 text-xs`}>Change Region</button>
        </div>
      </div>
    </div>
  );
}

// ── APP ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState("mode");
  const [locData, setLocData] = useState(null);
  const [gameConfig, setGameConfig] = useState(null);
  const [roundNum, setRoundNum] = useState(1);
  const [roundResults, setRoundResults] = useState([]);
  const [currentResult, setCurrentResult] = useState(null);
  const [allScores, setAllScores] = useState(null);
  const multiRef = useRef(null);

  function updScore(name, score) {
    setAllScores(prev=>{
      if (!prev) return [{name,total:score}];
      const i=prev.findIndex(p=>p.name===name);
      if (i>=0){const u=[...prev];u[i]={...u[i],total:u[i].total+score};return u;}
      return [...prev,{name,total:score}];
    });
  }

  function handleStart(cfg, multi) {
    multiRef.current=multi;
    setGameConfig(cfg); setRoundNum(1); setRoundResults([]);
    if (multi) {
      setAllScores([{name:multi.myName,total:0}]);
      const onData=data=>{ if(data.type==="PEER_SCORE") updScore(data.name,data.score); };
      if (multi.type==="host") {
        multi.conns.forEach(c=>c.on("data",d=>{
          onData(d);
          if(d.type==="PEER_SCORE") multi.conns.filter(x=>x!==c).forEach(x=>x.send(d));
        }));
      } else { multi.conn.on("data",onData); }
    } else { setAllScores(null); }
    setScreen("game");
  }

  function handleRoundResult(res) {
    const m=multiRef.current;
    if (m) {
      const msg={type:"PEER_SCORE",name:m.myName,score:res.score||0};
      if (m.type==="host") m.conns.forEach(c=>c.send(msg)); else m.conn.send(msg);
      updScore(m.myName,res.score||0);
    }
    setRoundResults(prev=>[...prev,res]);
    setCurrentResult(res); setScreen("roundResult");
  }

  function handleNext() {
    if (roundNum<gameConfig.rounds){setRoundNum(r=>r+1);setScreen("game");}
    else setScreen("finalResult");
  }

  function quit() { multiRef.current=null; setScreen("mode"); }

  if (screen==="mode") return <ModeSelectScreen onSelect={d=>{setLocData(d);setScreen("lobby");}}/>;
  if (screen==="lobby") return <LobbyScreen locData={locData} onStart={handleStart} onBack={()=>setScreen("mode")}/>;
  if (screen==="game") return <GameScreen config={gameConfig} roundNum={roundNum} totalRounds={gameConfig.rounds} onResult={handleRoundResult}/>;
  if (screen==="roundResult") return (
    <RoundResult result={currentResult} roundNum={roundNum} totalRounds={gameConfig.rounds}
      allScores={allScores} onNext={handleNext} onQuit={quit}/>
  );
  if (screen==="finalResult") return (
    <FinalResult allRounds={roundResults} allScores={allScores} config={gameConfig}
      onPlayAgain={()=>handleStart(gameConfig,multiRef.current)}
      onChangeRegion={quit}/>
  );
}

// ── Dark map styles ───────────────────────────────────────────────────────────

const darkMapStyles = [
  { elementType: "geometry", stylers: [{ color: "#161920" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#6b7280" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0d0f14" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1e2028" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#0d0f14" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#2a2d35" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#161920" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0d1117" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3d4251" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#2a2d35" }] },
];
