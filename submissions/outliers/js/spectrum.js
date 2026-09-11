// ── Spectrum ───────────────────────────────────────────────────────────────────
function gauss(wls,c,w,a){return wls.map(v=>a*Math.exp(-Math.pow(v-c,2)/(2*w*w)));}
function genSpecFromStar(s){const wls=Array.from({length:NS},(_,i)=>.5+(20-.5)*i/(NS-1));const depth=new Array(NS).fill(s.depth||.005);wls.forEach((w,i)=>{depth[i]+=s.depth*.0007*Math.pow(w/1.0,-3.5)*Math.min(w,1.5)/1.5;});GASES.forEach(g=>{const a=(s.gasAmp||{})[g.id]||0;g.centers.forEach(c=>{gauss(wls,c,g.width,a).forEach((v,i)=>{depth[i]+=v;});});});const n=s.depth/45;depth.forEach((_,i)=>{depth[i]+=(Math.random()-.5)*2*n;});return{wls,depth};}
// Reference wavelength grids we can fall back to when a CSV has depth values
// but no usable wavelength column of its own. This is not a guess — it's the
// exact grid this app itself uses when generating a spectrum (see NS/genSpecFromStar),
// so a depth-only export from this app's own "Generate spectrum" step will
// still resolve to its real wavelengths.
const KNOWN_WAVELENGTH_GRIDS=[
  {label:`this app's spectrum grid (${NS} pts, 0.5–20 μm)`,points:NS,wls:Array.from({length:NS},(_,i)=>.5+(20-.5)*i/(NS-1))},
];

// Does this column of numbers look like real wavelengths (μm)? Plausible
// transmission-spectroscopy range, and roughly ascending.
function looksLikeWavelength(vals){
  if(vals.length<5)return false;
  const inRange=vals.every(v=>v>0.1&&v<30);
  let asc=0;for(let i=1;i<vals.length;i++)if(vals[i]>=vals[i-1])asc++;
  return inRange&&asc/(vals.length-1)>0.9;
}

// Returns {wls,depth,note?} on success, or {error} if no wavelength data
// could be determined at all.
function parseSpecCSV(txt){
  const lines=txt.split('\n').filter(l=>l.trim()&&!l.startsWith('#'));
  if(!lines.length)return{error:'The file is empty.'};

  const rows=lines.map(l=>l.split(',').map(x=>parseFloat(x.trim()))).filter(r=>r.length&&r.every(v=>!isNaN(v)));
  if(rows.length<5)return{error:'Could not find at least 5 valid numeric rows in this file. Expected columns: wavelength,depth (or depth only, see below).'};

  const nCols=Math.min(...rows.map(r=>r.length));

  if(nCols>=2){
    const col0=rows.map(r=>r[0]);
    if(looksLikeWavelength(col0)){
      const idx=col0.map((_,i)=>i).sort((a,b)=>col0[a]-col0[b]);
      return{wls:idx.map(i=>col0[i]),depth:idx.map(i=>rows[i][1])};
    }
    // Two+ columns, but the first doesn't look like wavelength (could be an
    // index, timestamp, etc.) — fall through and try the depth-only path below.
  }

  // No usable wavelength column — see if the row count matches a known grid.
  const depthCol=rows.map(r=>r[r.length-1]);
  const grid=KNOWN_WAVELENGTH_GRIDS.find(g=>g.points===depthCol.length);
  if(grid){
    return{wls:grid.wls,depth:depthCol,note:`No wavelength column found in this file — matched its ${depthCol.length} rows to ${grid.label} and used those wavelengths.`};
  }

  return{error:`No wavelength column found, and the file's ${depthCol.length} rows don't match a known wavelength grid. Please include wavelength as the first column (wavelength,depth).`};
}

function retrieveAtmos(spec){const{wls,depth}=spec;const n=wls.length;const basis=GASES.map(g=>{const col=new Array(n).fill(0);g.centers.forEach(c=>{wls.forEach((w,i)=>{col[i]+=Math.exp(-Math.pow(w-c,2)/(2*g.width*g.width));});});return col;});const cont=new Array(n).fill(1);const all=[cont,...basis];const K=all.length;let co=new Array(K).fill(.001);for(let it=0;it<800;it++){const res=depth.map((_,i)=>{let m=0;co.forEach((c,k)=>{m+=c*all[k][i];});return depth[i]-m;});const grad=co.map((_,k)=>{let g=0;res.forEach((r,i)=>{g-=r*all[k][i];});return g/n;});co=co.map((c,k)=>k===0?c-.0001*grad[k]:Math.max(0,c-.0001*grad[k]));}let ss_r=0,ss_t=0;const md=depth.reduce((a,b)=>a+b)/n;depth.forEach((_,i)=>{let m=0;co.forEach((c,k)=>{m+=c*all[k][i];});ss_r+=Math.pow(depth[i]-m,2);ss_t+=Math.pow(depth[i]-md,2);});const r2=1-ss_r/ss_t,nz=Math.sqrt(ss_r/n);const gr=GASES.map((g,i)=>{const amp=co[i+1];return{...g,amplitude:amp,vmr:amp*1e6*2.5,detected:amp>md*.003,sig:Math.min(amp/(nz+1e-9),10)};});const model=depth.map((_,i)=>{let m=0;co.forEach((c,k)=>{m+=c*all[k][i];});return m;});return{gr,r2,model};}

function specF(gr){if(!gr)return new Array(12).fill(0);const g=Object.fromEntries(gr.map(r=>[r.id,r.amplitude]));const e=1e-9;return[Math.min((g.H2O||0)*200,1),Math.min((g.CO2||0)*200,1),Math.min((g.CH4||0)*200,1),Math.min((g.O3||0)*200,1),Math.min((g.O2||0)*200,1),Math.min((g.N2O||0)*200,1),Math.min((g.DMS||0)*200,1),Math.min((g.SO2||0)*200,1),Math.min((g.CH4||0)/((g.CO2||0)+e)*2,1),Math.min((g.O3||0)/((g.H2O||0)+e)*3,1),Math.min((g.O2||0)/((g.SO2||0)+e)/10,1),Math.min((g.DMS||0)*500,1)];}
function allF(lc,gr){return[...photoF(lc),...specF(gr)];}
function synthF(has){const p=photoF(genSynthLC(has));const s=has?GASES.map(()=>Math.random()*.3+.05).concat([Math.random()*.5,Math.random()*.4,Math.random()*.6,Math.random()*.3]):new Array(12).fill(0).map(()=>Math.random()*.04);return[...p,...s.slice(0,12)];}

function showSpecNote(msg){const el=document.getElementById('specNote');el.textContent=msg;el.style.display='block';}
function hideSpecNote(){const el=document.getElementById('specNote');el.style.display='none';}
function genSpec(){if(!star){alert('Select a star first.');return;}hideSpecNote();specData=genSpecFromStar(star);processSpec();}
function processSpec(){if(!specData)return;const{wls,depth}=specData;const ret=retrieveAtmos(specData);gasResults=ret.gr;document.getElementById('ss1').textContent=`${wls[0].toFixed(1)}–${wls[wls.length-1].toFixed(1)} μm`;document.getElementById('ss2').textContent=wls.length;const sn=(Math.max(...depth)-Math.min(...depth))/(noise(depth)||.0001);document.getElementById('ss3').textContent=sn.toFixed(1);document.getElementById('ss4').textContent=ret.gr.filter(g=>g.detected).length+'/'+GASES.length;document.getElementById('specH').style.display='none';const labs=wls.map(w=>w.toFixed(1));const bands=[];ret.gr.filter(g=>g.detected).forEach(g=>{g.centers.slice(0,1).forEach(c=>{const ci=wls.findIndex(w=>Math.abs(w-c)<.2);if(ci>=0){const w2=Math.round(g.width*wls.length/(wls[wls.length-1]-wls[0]));bands.push({i1:Math.max(0,ci-w2),i2:Math.min(wls.length-1,ci+w2),c:g.color,lb:g.label});}});});chart('specC',[{data:depth,col:'#64748b',lw:1.2},{data:ret.model,col:'#0d9488',lw:2,dash:[4,2]}],labs,{xL:'wavelength (μm)',yF:v=>v.toFixed(4),bands});renderGasBars(ret.gr,'abC');document.getElementById('gasRes').innerHTML=ret.gr.map(g=>{const ppm=g.vmr.toFixed(g.vmr>1?1:3);return`<div class="bio-row"><div class="bio-dot" style="background:${g.detected?g.color:'#cbd5e1'}"></div><span style="color:${g.detected?'#1e3a5a':'#64748b'};font-weight:${g.detected?'bold':'normal'}">${g.label} — ${g.name}</span>${g.detected?`<span class="bio-note">~${ppm} ppm · ${g.sig.toFixed(1)}σ${g.biosig?' · biosignature':''}</span>`:''}</div>`;}).join('')+`<div style="margin-top:8px;color:#64748b;font-size:10.5px">Model fit R² = ${ret.r2.toFixed(3)}</div>`;document.getElementById('b2next').disabled=false;updateArchNote();}
function renderGasBars(gr,cid){const el=document.getElementById(cid);const mA=Math.max(...gr.map(g=>g.amplitude),1e-5);el.innerHTML=gr.map(g=>{const pct=Math.min(g.amplitude/mA*100,100);const ppm=g.vmr.toFixed(g.vmr>10?0:g.vmr>1?1:3);return`<div class="gas-item"><div class="gi-head"><span style="color:${g.detected?g.color:'#64748b'};font-weight:${g.detected?'bold':'normal'}">${g.label} <span style="font-weight:normal;font-size:10px;color:#64748b">${g.name}</span></span><span style="color:${g.detected?g.color:'#64748b'};font-size:10.5px">${g.detected?ppm+' ppm':'below limit'}</span></div><div class="gas-track"><div class="gas-fill" style="width:${g.detected?pct:0}%;background:${g.color}"></div></div></div>`;}).join('');}
