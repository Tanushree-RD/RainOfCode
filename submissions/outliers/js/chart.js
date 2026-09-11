// ── Canvas chart ───────────────────────────────────────────────────────────────
function chart(id,datasets,labels,opts={}){
  const cv=document.getElementById(id);if(!cv)return;const ctx=cv.getContext('2d');
  const W=cv.width=cv.offsetWidth||550,H=cv.height=cv.offsetHeight||160;
  const p=opts.pad||{t:6,r:10,b:26,l:46};const pw=W-p.l-p.r,ph=H-p.t-p.b;
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,W,H);
  let yMin=Infinity,yMax=-Infinity;datasets.forEach(ds=>ds.data.forEach(v=>{if(v!=null&&isFinite(v)){yMin=Math.min(yMin,v);yMax=Math.max(yMax,v);}}));
  if(yMin===Infinity){yMin=0;yMax=1;}if(yMin===yMax){yMin-=.001;yMax+=.001;}if(opts.yMin!=null)yMin=opts.yMin;if(opts.yMax!=null)yMax=opts.yMax;const yr=yMax-yMin;
  const tx=i=>p.l+(i/((labels.length-1)||1))*pw,ty=v=>p.t+ph-((v-yMin)/yr)*ph;
  for(let i=0;i<=4;i++){const y=p.t+ph*(1-i/4);ctx.strokeStyle='#e7ecf3';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(p.l,y);ctx.lineTo(p.l+pw,y);ctx.stroke();ctx.fillStyle='#64748b';ctx.font='8.5px monospace';ctx.textAlign='right';ctx.fillText(opts.yF?(opts.yF(yMin+(i/4)*yr)):(yMin+(i/4)*yr).toFixed(3),p.l-2,y+3);}
  const xs=Math.ceil(labels.length/7);labels.forEach((l,i)=>{if(i%xs!==0&&i!==labels.length-1)return;const x=tx(i);ctx.strokeStyle='#e7ecf3';ctx.lineWidth=.4;ctx.beginPath();ctx.moveTo(x,p.t);ctx.lineTo(x,p.t+ph);ctx.stroke();ctx.fillStyle='#64748b';ctx.font='8.5px monospace';ctx.textAlign='center';ctx.fillText(String(l).substring(0,6),x,H-p.b+10);});
  if(opts.xL){ctx.fillStyle='#64748b';ctx.font='9px sans-serif';ctx.textAlign='center';ctx.fillText(opts.xL,p.l+pw/2,H-1);}
  if(opts.ref)opts.ref.forEach(rx=>{const x=tx(Math.round(rx*(labels.length-1)));ctx.strokeStyle='#92400e';ctx.lineWidth=1.5;ctx.setLineDash([4,3]);ctx.beginPath();ctx.moveTo(x,p.t);ctx.lineTo(x,p.t+ph);ctx.stroke();ctx.setLineDash([]);});
  if(opts.bands)opts.bands.forEach(b=>{if(b.i1>=b.i2)return;const x1=tx(b.i1),x2=tx(b.i2);ctx.fillStyle=b.c+'1a';ctx.fillRect(x1,p.t,x2-x1,ph);ctx.fillStyle=b.c+'99';ctx.font='7.5px monospace';ctx.textAlign='center';const lx=(x1+x2)/2;if(lx>p.l+4&&lx<p.l+pw-4)ctx.fillText(b.lb,lx,p.t+9);});
  datasets.forEach(ds=>{if(!ds.data||!ds.data.length)return;const col=ds.col||'#2563eb';ctx.strokeStyle=col;ctx.lineWidth=ds.lw||1.5;if(ds.dash)ctx.setLineDash(ds.dash);else ctx.setLineDash([]);if(ds.fill){ctx.beginPath();let st=false;ds.data.forEach((v,i)=>{if(v==null)return;const x=tx(i),y=ty(v);if(!st){ctx.moveTo(x,y);st=true;}else ctx.lineTo(x,y);});ctx.lineTo(tx(ds.data.length-1),ty(yMin));ctx.lineTo(tx(0),ty(yMin));ctx.closePath();ctx.fillStyle=col+'16';ctx.fill();}ctx.beginPath();let st=false;ds.data.forEach((v,i)=>{if(v==null){st=false;return;}const x=tx(i),y=ty(v);if(!st){ctx.moveTo(x,y);st=true;}else ctx.lineTo(x,y);});ctx.stroke();ctx.setLineDash([]);});
  ctx.strokeStyle='#dbe3ee';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(p.l,p.t);ctx.lineTo(p.l,p.t+ph);ctx.lineTo(p.l+pw,p.t+ph);ctx.stroke();}
