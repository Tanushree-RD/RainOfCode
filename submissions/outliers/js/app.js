// ── Navigation ─────────────────────────────────────────────────────────────────
function go(n){[1,2,3,4].forEach(i=>{document.getElementById('p'+i).classList.toggle('on',i===n);const b=document.getElementById('nav'+i);b.classList.remove('on','done');if(i===n)b.classList.add('on');else if(i<n)b.classList.add('done');});if(n===4&&aiReady&&lcData)detect();if(n===3)updateArchNote();}
function setLR(v){document.getElementById('lrV').textContent=({'1':'0.0001','2':'0.0005','3':'0.001','4':'0.003','5':'0.01'})[v];}
function curLR(){const v=document.getElementById('lrSlider')?document.getElementById('lrSlider').value:'3';return({'1':.0001,'2':.0005,'3':.001,'4':.003,'5':.01})[v]||.001;}
function updateArchNote(){
  const hs=specData!==null;const nF=hs?32:20;
  const parts=[];
  if(cnnReady)parts.push('CNN (trained, local)');
  if(aiReady)parts.push('LLM (connected)');
  const mode=parts.length===2?'Hybrid — CNN + LLM ensemble':parts.length===1?parts[0]+' only':'Not yet ready';
  const periodNote=` · period search ${minPeriod.toFixed(1)}–${maxPeriod.toFixed(1)}d`;
  document.getElementById('archNote').textContent=`Mode: ${mode} (${hs?'photometric + spectroscopic':'photometric only'} — ${nF} LLM features${cnnReady?`, ${N}-point raw curve for the CNN`:''}${periodNote})`;
}
function updateRunGate(){document.getElementById('btnRun').disabled=!(aiReady||cnnReady);}

// ── Training log (LLM connection panel) ─────────────────────────────────────────
function addLog(msg,cls=''){const el=document.getElementById('trainLog');const d=document.createElement('div');d.className='log-line '+cls;d.textContent=msg;el.appendChild(d);el.scrollTop=el.scrollHeight;}

async function connectAI(){
  const input=document.getElementById('apiKeyInput');
  const key=(input.value||'').replace(/\s+/g,'').trim();
  if(!key){
    addLog('API key box is empty. Paste your Groq key (starts with gsk_) and try again.','log-warn');
    input.focus();
    return;
  }
  if(!key.startsWith('gsk_')){
    addLog('That does not look like a Groq API key. Groq keys normally start with gsk_. Check that you pasted the full key without quotes or spaces.','log-warn');
    input.focus();
    return;
  }
  input.value=key;
  let m=document.getElementById('modelInput').value.trim();
  const btn=document.getElementById('btnTr');
  btn.disabled=true; btn.textContent='Testing…';
  try{
    addLog('Checking which Groq models are available for this key…','log-info');
    const mr=await fetch('https://api.groq.com/openai/v1/models',{headers:{'Authorization':`Bearer ${key}`}});
    if(!mr.ok){const t=await mr.text();throw new Error(`${mr.status}: ${t.slice(0,220)}`);}
    const md=await mr.json();
    const models=(md.data||[]).filter(x=>x.active!==false).map(x=>x.id);
    const preferred=['llama-3.1-8b-instant','llama-3.3-70b-versatile','openai/gpt-oss-20b','openai/gpt-oss-120b'];
    if(!m || !models.includes(m)){
      const found=preferred.find(x=>models.includes(x));
      if(found){m=found;document.getElementById('modelInput').value=m;addLog(`Selected available model: ${m}`,'log-info');}
      else throw new Error('No supported chat model was available to this API key.');
    }
    addLog(`Testing Groq connection with ${m}…`,'log-info');
    const resp=await fetch('https://api.groq.com/openai/v1/chat/completions',{
      method:'POST',
      headers:{'content-type':'application/json','Authorization':`Bearer ${key}`},
      body:JSON.stringify({model:m,max_tokens:20,temperature:0,messages:[{role:'user',content:'Reply with exactly: OK'}]})
    });
    if(!resp.ok){const t=await resp.text();throw new Error(`${resp.status}: ${t.slice(0,220)}`);}
    const data=await resp.json();
    const text=(data.choices?.[0]?.message?.content||'').trim();
    addLog(`Connection successful${text?' — model replied.':''}`,'log-ok');
    aiReady=true;
    const done=document.getElementById('trainDone');done.style.display='block';
    done.textContent='Connected — you can now run detection.';
    updateArchNote();updateRunGate();
  }catch(err){
    aiReady=false;
    addLog(`Connection failed: ${err.message}`,'log-warn');
    addLog('Check that your Groq key is valid and that the selected model is available on Groq.','log-warn');
    updateArchNote();updateRunGate();
  }finally{btn.disabled=false;btn.textContent='Connect & Test';}
}

// ── LLM classification ────────────────────────────────────────────────────────
async function classifyWithLLM(feats,hs){
  const key=document.getElementById('apiKeyInput').value.trim();
  const modelName=document.getElementById('modelInput').value.trim()||'llama-3.1-8b-instant';
  if(!key)throw new Error('no API key set');
  const lines=feats.map((v,i)=>`- ${FEATURE_LABELS[i]||('feature '+i)}: ${v.toFixed(4)}`).join('\n');
  const prompt=`You are an exoplanet transit classifier. Below are ${feats.length} numeric features extracted from a star's light curve${hs?' and its transmission spectrum':''}:\n\n${lines}\n\nBased on these features, judge how likely this is a genuine planetary transit, as opposed to noise, a stellar flare, an eclipsing binary, or an instrumental artifact.\n\nRespond with ONLY a JSON object, no other text, in exactly this form:\n{"probability": <number between 0 and 1>, "reasoning": "<one or two sentence explanation citing specific feature values>"}`;
  const resp=await fetch('https://api.groq.com/openai/v1/chat/completions',{
    method:'POST',
    headers:{
      'content-type':'application/json',
      'Authorization':`Bearer ${key}`
    },
    body:JSON.stringify({model:modelName,max_tokens:300,temperature:0,messages:[{role:'user',content:prompt}]})
  });
  if(!resp.ok){const t=await resp.text();throw new Error(`Groq API error ${resp.status}: ${t.slice(0,200)}`);}
  const data=await resp.json();
  const text=(data.choices||[]).map(c=>c.message?.content||'').join('\n').trim();
  const cleaned=text.replace(/```json|```/g,'').trim();
  const parsed=JSON.parse(cleaned);
  return{probability:Math.max(0,Math.min(1,Number(parsed.probability))),reasoning:parsed.reasoning||''};
}

// ── Detection ──────────────────────────────────────────────────────────────────
async function detect(){
  document.getElementById('dLoad').style.display='block';document.getElementById('dOut').style.display='none';
  const hs=specData!==null;
  const msgs=['Extracting photometric features from light curve…','Running BLS period search…','Checking for false positives…'];
  if(cnnReady)msgs.push('Running the trained CNN over the raw light curve…');
  if(hs)msgs.push('Fitting atmospheric gas model…','Computing joint biosignature score…');
  if(aiReady)msgs.push('Asking Llama to classify the candidate…');
  for(const m of msgs){document.getElementById('dMsg').textContent=m;await new Promise(r=>setTimeout(r,320));}
  const nF=hs?32:20;const feats=allF(lcData,gasResults).slice(0,nF);
  let raw=0.5;llmReasoning='';
  if(aiReady){
    try{
      const res=await classifyWithLLM(feats,hs);
      raw=res.probability;llmReasoning=res.reasoning;
    }catch(err){
      llmReasoning=`AI request failed (${err.message}). Falling back to the CNN alone if it's trained, or a neutral 50% estimate.`;
    }
  }else{
    llmReasoning='LLM not connected for this run — connect a Groq API key in Step 3 for a text-reasoned explanation.';
  }
  let cnnProb=null;
  if(cnnReady){try{cnnProb=predictCNN(lcData);}catch(err){addCnnLog(`CNN inference failed: ${err.message}`,'log-warn');}}
  let combinedRaw;
  if(cnnProb!=null&&aiReady)combinedRaw=cnnProb*.5+raw*.5;
  else if(cnnProb!=null)combinedRaw=cnnProb;
  else combinedRaw=raw;
  const s=star;const prob=s.planetProb!=null?combinedRaw*.6+s.planetProb*.4:combinedRaw;
  document.getElementById('dLoad').style.display='none';document.getElementById('dOut').style.display='block';
  render(prob,s,hs,{cnn:cnnProb,llm:aiReady?raw:null});}

function render(prob,s,hs,sub={}){
  const pct=(prob*100).toFixed(1),isP=prob>.5,ac=s.accent||'#2f6fb0';
  const col=prob>.85?'#16a34a':prob>.6?'#2f6fb0':prob>.4?'#b45309':'#dc2626';
  document.getElementById('rProb').textContent=pct+'%';document.getElementById('rProb').style.color=col;
  document.getElementById('rVerdict').textContent=isP?'Transit detected — planet candidate':'No transit detected';document.getElementById('rVerdict').style.color=isP?col:'#b91c1c';
  const modelBits=[];
  if(sub.cnn!=null)modelBits.push(`CNN ${(sub.cnn*100).toFixed(1)}%`);
  if(sub.llm!=null)modelBits.push(`LLM ${(sub.llm*100).toFixed(1)}%`);
  const modelStr=modelBits.length?`  ·  ${modelBits.join(' + ')}`:'';
  document.getElementById('rDetail').textContent=`False positive probability: ${(s.fpProb!=null?(s.fpProb*100).toFixed(1):((1-prob)*100).toFixed(1))}%  ·  ${hs?'Photometric + spectroscopic mode':'Photometric mode only'}${modelStr}`;
  const ps=[['Orbital period',s.period?s.period+' d':'—'],['Planet radius',s.radius?s.radius+' R⊕':'—'],['Transit depth',s.depth?(s.depth*100).toFixed(3)+'%':'—'],['Eq. temperature',s.teq?s.teq+' K':'—'],['Insolation',s.insolation!=null?s.insolation+' S⊕':'—'],['ESI',s.esi!=null?s.esi.toFixed(2):'—'],['Habitable zone',s.zone||'—'],['Host distance',s.distance||'—']];
  document.getElementById('rParams').innerHTML=ps.map(([k,v])=>`<div class="param-cell"><div class="pk">${k}</div><div class="pv">${v}</div></div>`).join('');
  const n2=lcData.length,t0=Math.floor(n2*.37),t1=Math.floor(n2*.63);
  setTimeout(()=>{
    chart('fldC',[{data:lcData,col:ac,fill:true}],lcData.map((_,i)=>(i/n2-.5).toFixed(2)),{xL:'phase',yF:v=>v.toFixed(4)});
    chart('rawC',[{data:lcData,col:ac,lw:1.2},{data:lcData.map((v,i)=>i>=t0&&i<=t1?v:null),col:'#8a5030',lw:2.5}],lcData.map((_,i)=>i),{xL:'index',yF:v=>v.toFixed(4)});

    // Evidence checklist (from the PDF approach)
    const pf=photoF(lcData);const snr=pf[4]*40;const sym=pf[2];const flat=pf[3];const depth=pf[0];const fp=pf[6];
    const ev=[
      [isP&&s.period,`Transit repeats every ${s.period||'~unknown'} days`,isP&&s.period?true:null],
      [true,`Transit depth: ${s.depth?(s.depth*100).toFixed(3)+'%':(depth*100).toFixed(3)+'%'}`,depth>.0005],
      [true,`Transit profile shape: ${flat>.5?'U-shaped (consistent with planet)':'V-shaped (check for eclipsing binary)'}`,flat>.5],
      [true,`Transit symmetry score: ${(sym*100).toFixed(0)}%`,sym>.65],
      [true,`Signal-to-noise ratio: ${snr.toFixed(1)}`,snr>7],
      [true,`Secondary eclipse: ${fp<.3?'not detected (good sign)':'possible — check for EB contamination'}`,fp<.3],
      [hs,hs?`Spectroscopic atmospheric retrieval: ${gasResults?.filter(g=>g.detected&&g.biosig).length||0} biosignature gas(es) detected`:null,hs?((gasResults?.filter(g=>g.detected&&g.biosig).length||0)>0):null],
    ].filter(e=>e[1]);
    document.getElementById('evidenceBox').innerHTML=ev.map(([,text,ok])=>`<div class="evidence-item"><div class="${ok===true?'evidence-check':ok===false?'evidence-fail':'evidence-check'}">${ok===false?'✗':'✓'}</div><span>${text}</span></div>`).join('');

    // Physics consistency score
    const physScore=Math.round((sym*.25+flat*.25+Math.min(snr/20,1)*.25+(1-fp)*.25)*100);
    document.getElementById('physicsScore').innerHTML=`<div style="font-size:36px;font-weight:bold;color:${physScore>75?'#16a34a':physScore>50?'#2f6fb0':'#b45309'};margin-bottom:6px">${physScore}<span style="font-size:16px;color:#64748b">/100</span></div><div style="font-size:12px;color:#64748b">${physScore>75?'Strong physical consistency':'Moderate — verify manually'}</div><div style="height:4px;background:#dbe3ee;border-radius:2px;margin-top:10px"><div style="width:${physScore}%;height:100%;background:${physScore>75?'#16a34a':physScore>50?'#2f6fb0':'#b45309'};border-radius:2px"></div></div>`;

    // ── PPT-style "Sample Outputs" summary block ──────────────────────────────
    chart('sumC',[{data:lcData,col:ac,fill:true}],lcData.map((_,i)=>(i/n2-.5).toFixed(2)),{xL:'phase',yF:v=>v.toFixed(4)});
    const confLabel=prob>.85?'High':prob>.6?'Moderate':prob>.4?'Low':'Very low';
    const fpPct=(s.fpProb!=null?s.fpProb*100:(1-prob)*100).toFixed(1);
    const topFeat=FEATURE_LABELS.map((l,i)=>({l,v:pf[i]!==undefined?pf[i]:0})).slice(0,20)
      .sort((a,b)=>Math.abs(b.v)-Math.abs(a.v)).slice(0,3)
      .map(f=>`${f.l} (${f.v.toFixed(3)})`).join('; ');
    const decisionText=llmReasoning||'No AI explanation available for this run — connect the model in Step 3 to get a reasoned explanation here.';
    const followPriority=prob>.99?'Immediate — request time this cycle':prob>.95?'High — next available window':'Standard queue';
    const modelCols=[];
    if(sub.cnn!=null)modelCols.push(`<div class="stat-box" style="text-align:center"><div class="key">CNN probability</div><div class="val" style="color:#2563eb">${(sub.cnn*100).toFixed(1)}%</div></div>`);
    if(sub.llm!=null)modelCols.push(`<div class="stat-box" style="text-align:center"><div class="key">LLM probability</div><div class="val" style="color:#8060a0">${(sub.llm*100).toFixed(1)}%</div></div>`);
    document.getElementById('pptSummaryText').innerHTML=`
      <div class="chart-lbl">2. Candidate classification</div>
      <div style="display:grid;grid-template-columns:repeat(${3+modelCols.length},1fr);gap:8px;margin-bottom:14px">
        <div class="stat-box" style="text-align:center"><div class="key">Planet probability</div><div class="val" style="color:${col}">${pct}%</div></div>
        <div class="stat-box" style="text-align:center"><div class="key">Confidence score</div><div class="val">${confLabel}</div></div>
        <div class="stat-box" style="text-align:center"><div class="key">False positive prob.</div><div class="val">${fpPct}%</div></div>
        ${modelCols.join('')}
      </div>
      <div class="chart-lbl">3. Planetary parameters</div>
      <div style="font-size:12px;color:#1e3a5a;line-height:1.7;margin-bottom:14px">
        Orbital period: ${s.period?s.period+' d':'—'}<br>
        Transit depth: ${s.depth?(s.depth*100).toFixed(3)+'%':'—'}<br>
        Transit duration: ${s.duration?s.duration+' hrs':'—'}<br>
        Estimated planet radius: ${s.radius?s.radius+' R⊕':'—'}
      </div>
      <div class="chart-lbl">4. Stellar activity analysis</div>
      <div style="font-size:12px;color:#64748b;line-height:1.6;margin-bottom:14px">
        UV/optical and X-ray follow-up data were not loaded for this session, so this is based on the photometric light curve alone. No stellar flare events were flagged in the loaded data.
      </div>
      <div class="chart-lbl">5. Explainable AI report</div>
      <div style="font-size:12px;color:#1e3a5a;line-height:1.7;margin-bottom:14px">
        <strong>Key features influencing prediction:</strong> ${topFeat}<br>
        <strong>Classification confidence:</strong> ${pct}%<br>
        <strong>Decision explanation:</strong> ${decisionText}
      </div>
      <div class="chart-lbl">6. Follow-up observation plan</div>
      <div style="font-size:12px;color:#1e3a5a;line-height:1.7">
        Recommended observatory: ${s.obs||'—'}<br>
        Suggested observation window: ${s.win||'—'}<br>
        Priority ranking: ${followPriority}
      </div>`;

    if(hs&&specData){
      document.getElementById('specPanel').style.display='block';
      const ret=retrieveAtmos(specData);const{wls,depth}=specData;
      const bands=[];ret.gr.filter(g=>g.detected).forEach(g=>{g.centers.slice(0,1).forEach(c=>{const ci=wls.findIndex(w=>Math.abs(w-c)<.2);if(ci>=0){const w2=Math.round(g.width*wls.length/(wls[wls.length-1]-wls[0]));bands.push({i1:Math.max(0,ci-w2),i2:Math.min(wls.length-1,ci+w2),c:g.color,lb:g.label});}});});
      chart('specR',[{data:depth,col:'#64748b',lw:1.2},{data:ret.model,col:'#0d9488',lw:2,dash:[4,2]}],wls.map(w=>w.toFixed(1)),{xL:'wavelength (μm)',yF:v=>v.toFixed(4),bands,pad:{t:6,r:10,b:24,l:48}});
      renderGasBars(ret.gr,'gasAb');
      const bg=ret.gr.filter(g=>g.detected&&g.biosig),ig=ret.gr.filter(g=>g.detected&&!g.biosig);const ch4=ret.gr.find(g=>g.id==='CH4'),co2=ret.gr.find(g=>g.id==='CO2'),dms=ret.gr.find(g=>g.id==='DMS');
      let sm=`The atmospheric retrieval model fitted ${GASES.length} gas templates to the observed spectrum. `;
      if(bg.length>0)sm+=`We find ${bg.length} potential biosignature gas${bg.length>1?'es':''}: ${bg.map(g=>g.label).join(', ')}. `;
      if(ch4&&co2&&ch4.detected&&co2.detected){const r=(ch4.vmr/co2.vmr).toFixed(2);sm+=`The CH₄/CO₂ ratio is ${r} — values above 0.1 suggest thermodynamic disequilibrium that is difficult to explain through geological processes alone. `;}
      if(dms&&dms.detected)sm+=`Dimethyl sulphide (DMS) appears at ~${dms.vmr.toFixed(2)} ppm. On Earth, DMS is produced exclusively by marine microorganisms and is considered a strong biosignature. `;
      if(ig.length>0)sm+=`Inert gases also detected: ${ig.map(g=>g.label).join(', ')} (consistent with geochemical sources). `;
      sm+=`Model fit R² = ${ret.r2.toFixed(3)}.`;
      document.getElementById('atmosSum').textContent=sm;
    }else{document.getElementById('specPanel').style.display='none';}
  },40);

  // Biosignatures
  let bios=s.biosigs||[{l:'Pending',s:'none'}];
  if(hs&&gasResults){bios=gasResults.filter(g=>g.detected&&g.biosig).map(g=>({l:`${g.label} at ${g.centers[0].toFixed(2)} μm (~${g.vmr.toFixed(2)} ppm)`,s:g.sig>5?'confirmed':g.sig>2?'detected':'tentative'}));if(bios.length===0)bios=[{l:'No biosignature gases detected above the noise floor',s:'none'}];const inert=gasResults.filter(g=>g.detected&&!g.biosig);if(inert.length>0)bios.push({l:`Inert gases also present: ${inert.map(g=>g.label).join(', ')}`,s:'inert'});}
  const sCol={confirmed:ac,detected:'#2563eb',tentative:'#b45309',inert:'#7a6030',none:'#cbd5e1'};
  document.getElementById('bioList').innerHTML=bios.map(b=>`<div class="bio-row"><div class="bio-dot" style="background:${sCol[b.s]||'#cbd5e1'}"></div><span style="color:${b.s==='none'?'#64748b':'#1e3a5a'}">${b.l}</span><span class="bio-note">${b.s!=='none'?b.s:''}</span></div>`).join('');
  let bsc=s.biosigScore!=null?s.biosigScore:isP?Math.round(prob*65):5;let bSrc='Photometric pipeline only';
  if(hs&&gasResults){const ss=Math.min(100,gasResults.filter(g=>g.detected&&g.biosig).reduce((a,g)=>a+Math.min(g.sig*8,20),0));const dms=gasResults.find(g=>g.id==='DMS');const db=dms&&dms.detected?15:0;bsc=Math.min(100,Math.round(bsc*.5+ss*.4+db));bSrc='Photometric (50%) + spectroscopic retrieval (40%)' + (db?' + DMS bonus':'');}
  document.getElementById('bBar').style.width=bsc+'%';document.getElementById('bBar').style.background=bsc>70?'#16a34a':bsc>45?ac:'#b45309';
  document.getElementById('bScore').textContent=bsc+'/100';document.getElementById('bScore').style.color=bsc>70?'#16a34a':bsc>45?ac:'#b45309';
  document.getElementById('bSrc').textContent=bSrc;

  // Follow-up
  const rows=[['Observatory',s.obs||'DOT'],['Observation window',s.win||'TBD'],['Priority',prob>.99?'Immediate — request time this cycle':prob>.95?'High — next available window':'Standard queue'],['Recommended technique',(s.radius||2)>5?'Radial velocity + photometry':'Transit photometry + radial velocity'],['Confidence tier',(s.fpProb||1-prob)<.01?'Tier 1 — confirmed':(s.fpProb||1-prob)<.03?'Tier 2 — validated':'Tier 3 — candidate'],['Next step',hs&&bsc>70?'Submit for Ariel mission scheduling':'Request JWST follow-up spectrum']];
  document.getElementById('followUp').innerHTML=rows.map(([k,v])=>`<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #eef2f7;font-size:12px"><span style="color:#64748b">${k}</span><span style="color:#1e3a5a;text-align:right;max-width:58%">${v}</span></div>`).join('');

  // Candidate rank table (from the PDF feature)
  const physScore2=Math.round(((photoF(lcData)[2]*.25+photoF(lcData)[3]*.25+Math.min(photoF(lcData)[4]*40/20,1)*.25+(1-photoF(lcData)[6])*.25)*100));
  const hab=s.esi>0.8?'High':s.esi>0.5?'Medium':s.esi>0.2?'Low':'Very low';
  const stars2=[{name:s.name||'Current',conf:prob*100,phys:physScore2,hab,pri:prob>.95&&bsc>70?'⭐⭐⭐⭐⭐':prob>.85?'⭐⭐⭐⭐':prob>.7?'⭐⭐⭐':'⭐⭐'}];
  document.getElementById('rankBody').innerHTML=stars2.map(r=>`<tr><td>${r.name}</td><td style="color:#2563eb">${r.conf.toFixed(1)}%</td><td style="color:#16a34a">${r.phys}/100</td><td>${r.hab}</td><td>${r.pri}</td></tr>`).join('');
}
