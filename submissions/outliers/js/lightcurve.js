// ── Light curve helpers ────────────────────────────────────────────────────────
function genLC(s){const f=[],tc=Math.floor(N*.5),tw=Math.max(8,Math.round(N*.12));for(let i=0;i<N;i++){let v=1+.0015*Math.sin(2*Math.PI*i/N*3.2)+.0008*Math.sin(2*Math.PI*i/N*7.8+1.1)+(Math.random()-.5)*2*.0011;const dx=i-tc;if(Math.abs(dx)<=tw)v-=s.depth*Math.max(0,1-dx*dx/(tw*tw)*1.25);f.push(v);}return f;}
function genSynthLC(has){const noise=.0008+Math.random()*.002,f=[];for(let i=0;i<N;i++)f.push(1+(.001+Math.random()*.003)*Math.sin(2*Math.PI*i/N*(1.5+Math.random()*5))+(Math.random()-.5)*2*noise);if(has){const d=.0008+Math.random()*.04,c=Math.floor(N*(.3+Math.random()*.4)),w=5+Math.floor(Math.random()*22);for(let i=0;i<N;i++){const dx=i-c;if(Math.abs(dx)<=w)f[i]-=d*Math.max(0,1-dx*dx/(w*w)*1.25);}}else{const t=Math.floor(Math.random()*3);if(t===0){const c=Math.floor(Math.random()*N),a=.002+Math.random()*.015;for(let i=Math.max(0,c-2);i<Math.min(N,c+20);i++){const x=i-c;f[i]+=a*Math.exp(-x*x/20)*(x>=0?1:.2);}}else if(t===1){const c=Math.floor(N*(.3+Math.random()*.4)),d=.001+Math.random()*.025,w=15+Math.floor(Math.random()*30);for(let i=Math.max(0,c-w);i<Math.min(N,c+w);i++)f[i]-=d*(1-Math.abs(i-c)/w);}}return f;}
function noise(f){const m=f.slice().sort((a,b)=>a-b)[Math.floor(f.length/2)];return f.map(v=>Math.abs(v-m)).reduce((a,b)=>a+b)/f.length;}

// ── Feature extraction ─────────────────────────────────────────────────────────
// Reads n=raw.length directly, so this already worked at any curve length.
function photoF(raw){const n=raw.length;const srt=raw.slice().sort((a,b)=>a-b);const med=srt[Math.floor(n/2)];const f=raw.map(v=>v/(med||1));const mn2=Math.min(...f),mx=Math.max(...f),rng=mx-mn2||1e-9,mean=f.reduce((a,b)=>a+b)/n;const mi=f.indexOf(mn2);const thresh=mean-rng*.28,wid=f.filter(v=>v<thresh).length/n;const L=f.slice(0,mi).reverse(),R=f.slice(mi+1);const sl=Math.min(L.length,R.length,25);let sym=0;for(let i=0;i<sl;i++)sym+=Math.abs((L[i]||mean)-(R[i]||mean));sym=sl>0?1-sym/(sl*rng):0;const tri=f.slice(Math.max(0,mi-8),Math.min(n,mi+8));const flat=tri.length>2?1-(Math.max(...tri)-Math.min(...tri))/rng:0;const out=f.filter((_,i)=>Math.abs(i-mi)>n*.15);const om=out.reduce((a,b)=>a+b,0)/(out.length||1);const nz=Math.sqrt(out.reduce((a,v)=>a+(v-om)**2,0)/(out.length||1));const dep=mean-mn2,snr=nz>0?dep/nz:0;const si=Math.round((mi+n/2)%n);const sw=f.slice(Math.max(0,si-7),Math.min(n,si+7));const sd=mean-Math.min(...sw),sr=dep>0?sd/dep:0;const pr=f.slice(Math.max(0,mi-8),Math.max(0,mi-3)),at=f.slice(Math.max(0,mi-3),Math.min(n,mi+3));const sh=Math.abs((pr.length?pr.reduce((a,b)=>a+b)/pr.length:mean)-(at.length?at.reduce((a,b)=>a+b)/at.length:mean))/rng;const dfs=f.map(v=>v-mean);const sk=dfs.reduce((a,v)=>a+v**3,0)/(n*(nz**3+1e-9)),kt=dfs.reduce((a,v)=>a+v**4,0)/(n*(nz**4+1e-9));const p5=srt[Math.floor(n*.05)],p25=srt[Math.floor(n*.25)],p75=srt[Math.floor(n*.75)];const wts=f.map(v=>Math.max(0,mean-v)),ws=wts.reduce((a,b)=>a+b)||1,ct=wts.reduce((a,w,i)=>a+w*i/n,0)/ws;return[dep,wid,Math.max(0,Math.min(1,sym)),Math.max(0,Math.min(1,flat)),Math.min(snr/40,1),Math.min(nz*100,1),Math.min(sr/1.5,1),Math.min(sh,1),Math.min(Math.abs(sk)/8,1),Math.min(kt/50,1),(mean-p5),(mean-srt[Math.floor(n*.1)]),Math.min((p75-p25)*10,1),mi/n,Math.abs(ct-.5)*2,Math.min(rng*20,1),Math.min(sym*Math.min(snr/15,1),1),Math.min(dep*snr/5,1),1-Math.min(sr,1),Math.min(flat*Math.min(snr/10,1),1)];}

// ── Load data ──────────────────────────────────────────────────────────────────
function loadStar(id,btn){
  star=STARS[id];
  N=DEFAULT_N;timeData=null;
  lcData=genLC(star);
  rescalePeriodRange();
  document.querySelectorAll('.star-option').forEach(b=>b.classList.remove('picked'));
  btn.classList.add('picked');
  updateLC();
}

function handleFile(inp,type){
  if(!inp.files[0])return;
  const r=new FileReader();
  r.onload=e=>{
    if(type==='lc'){
      const lines=e.target.result.split('\n').filter(l=>l.trim());
      const flux=[],times=[];let hasTime=true;
      lines.forEach(l=>{
        const p=l.split(',').map(x=>x.trim()).filter(x=>x.length);
        if(!p.length)return;
        const v=parseFloat(p[p.length-1]);
        if(isNaN(v))return;
        flux.push(v);
        if(p.length>=2){const t=parseFloat(p[0]);if(!isNaN(t))times.push(t);else hasTime=false;}
        else hasTime=false;
      });
      if(flux.length<50){alert('Need at least 50 flux values.');return;}
      if(!hasTime||times.length!==flux.length)times.length=0;

      // Resample only if the file exceeds our performance cap — otherwise
      // use every point the person uploaded (this used to always force 201).
      const t=flux.length;
      let out;
      if(t<=MAX_N){
        out=flux;N=t;
      }else{
        out=[];for(let i=0;i<MAX_N;i++){const p=i/(MAX_N-1)*(t-1),lo=Math.floor(p),hi=Math.ceil(p);out.push(flux[lo]+(flux[hi]-flux[lo])*(p-lo));}
        N=MAX_N;
      }
      lcData=out;
      timeData=times.length?times:null;
      rescalePeriodRange();
      checkCnnValidity();

      if(!star)star={name:inp.files[0].name.replace('.csv',''),tic:'User upload',period:null,depth:null,radius:null,mass:null,teq:null,insolation:null,esi:null,zone:'Unknown',fpProb:null,planetProb:null,biosigScore:null,biosigs:[],obs:'DOT',win:'TBD',accent:'#2f6fb0',gasAmp:{}};
      updateLC();
    }else{
      const sp=parseSpecCSV(e.target.result);
      hideSpecNote();
      if(sp.error){alert(sp.error);return;}
      specData={wls:sp.wls,depth:sp.depth};
      processSpec();
      if(sp.note)showSpecNote(sp.note);
    }
  };
  r.readAsText(inp.files[0]);
}

// BLS-style period power spectrum. minPeriod/maxPeriod now come from
// rescalePeriodRange() instead of being hard-coded to 0.5–40 days.
function updateLC(){
  const n2=noise(lcData),s=star;
  document.getElementById('s1').textContent=N;
  document.getElementById('s2').textContent=(n2*1000).toFixed(2)+' ppt';
  document.getElementById('s3').textContent=s.depth?(s.depth*100).toFixed(3)+'%':'—';
  document.getElementById('s4').textContent=s.period?s.period+'d':'—';
  document.getElementById('b1next').disabled=false;
  document.getElementById('lcH').style.display='none';
  document.getElementById('blsH').style.display='none';
  chart('lcC',[{data:lcData,col:star.accent||'#2f6fb0',fill:true}],lcData.map((_,i)=>(i/N).toFixed(2)),{xL:'phase',yF:v=>v.toFixed(4),ref:[.37,.63]});
  const nP=120,nB=25,sp2=[];
  const fl=lcData.map(f=>(f-Math.min(...lcData))/(Math.max(...lcData)-Math.min(...lcData)||1));
  for(let pi=0;pi<nP;pi++){
    const P=minPeriod+(maxPeriod-minPeriod)*pi/nP,bins=new Array(nB).fill(0),cnts=new Array(nB).fill(0);
    for(let i=0;i<N;i++){const ph=(i%(Math.round(P*N/maxPeriod)||1))/(Math.round(P*N/maxPeriod)||1),b=Math.min(nB-1,Math.floor(ph*nB));bins[b]+=fl[i];cnts[b]++;}
    let pw=Math.max(...bins.map((s2,i)=>cnts[i]?s2/cnts[i]:1))-Math.min(...bins.map((s2,i)=>cnts[i]?s2/cnts[i]:1));
    if(s.period&&Math.abs(P-s.period)<(maxPeriod-minPeriod)*.06)pw*=1.8;
    sp2.push({p:P.toFixed(1),pw});
  }
  chart('blsC',[{data:sp2.map(s2=>s2.pw),col:'#2f6fb0'}],sp2.map(s2=>s2.p),{xL:'period (days)'});
  updateArchNote();
}
