// ── PDF export ────────────────────────────────────────────────────────────────
function hexRGB(hex){const n=parseInt(hex,16);return[(n>>16)&255,(n>>8)&255,n&255];}

async function downloadPDF(){
  if(typeof window.jspdf==='undefined'||typeof window.jspdf.jsPDF==='undefined'){alert('The PDF library did not load — check your internet connection and try again.');return;}
  const btn=document.getElementById('btnPPT');const oldTxt=btn.textContent;btn.disabled=true;btn.textContent='Building PDF…';
  try{
    const {jsPDF}=window.jspdf;
    const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'}); // 297 x 210 mm
    const PW=297,PH=210;
    const BRAND=hexRGB('2563EB'),DARK=hexRGB('1E293B'),MUTE=hexRGB('64748B'),LIGHT=[244,247,252],GOOD=hexRGB('16A34A'),BAD=hexRGB('DC2626'),WHITE=[255,255,255];
    const txt=el=>el?el.textContent.replace(/\s+/g,' ').trim():'';
    const grab=sel=>Array.from(document.querySelectorAll(sel));
    const img=id=>{const c=document.getElementById(id);try{return c?c.toDataURL('image/png'):null;}catch(e){return null;}};

    function headerBar(title){
      doc.setFillColor(...BRAND);
      doc.rect(0,0,PW,19,'F');
      doc.setTextColor(...WHITE);
      doc.setFont('times','bold');doc.setFontSize(18);
      doc.text(title,9,13);
    }
    function newPage(title){doc.addPage('a4','landscape');headerBar(title);}
    function table(body,opts={}){
      doc.autoTable(Object.assign({
        startY:opts.y||26,margin:{left:opts.x||9,right:PW-(opts.x||9)-(opts.w||120)},
        tableWidth:opts.w||120,body,theme:opts.theme||'grid',
        styles:{fontSize:opts.fontSize||10,textColor:DARK,lineColor:[219,227,238],cellPadding:2.2},
        headStyles:{fillColor:BRAND,textColor:WHITE,fontStyle:'bold'},
      },opts.extra||{}));
    }

    const candName=txt(document.querySelector('#rankBody tr td'))||'Candidate';
    const prob=txt(document.getElementById('rProb'));
    const verdict=txt(document.getElementById('rVerdict'));
    const detail=txt(document.getElementById('rDetail'));
    const isNo=/no transit/i.test(verdict);

    // Page 1 — Title
    doc.setFillColor(...LIGHT);doc.rect(0,0,PW,PH,'F');
    doc.setFillColor(...BRAND);doc.rect(0,0,PW,30,'F');
    doc.setTextColor(...WHITE);doc.setFont('times','bold');doc.setFontSize(26);
    doc.text('Exoplanet Detection Report',9,19);
    doc.setTextColor(...DARK);doc.setFontSize(20);
    doc.text(candName,9,46);
    doc.setFontSize(60);doc.setTextColor(...(isNo?BAD:BRAND));
    doc.text(prob,9,86);
    doc.setFontSize(15);doc.setTextColor(...DARK);doc.setFont('times','bold');
    doc.text(verdict,9,100);
    doc.setFont('times','normal');doc.setFontSize(11);doc.setTextColor(...MUTE);
    doc.text(detail,9,108,{maxWidth:270});
    doc.setFontSize(8.5);
    doc.text('Generated '+new Date().toLocaleDateString(),9,203);

    // Page 2 — classification summary + transit curve
    newPage('Transit Detection & Classification');
    const sumImg=img('sumC');
    if(sumImg)doc.addImage(sumImg,'PNG',9,26,150,72);
    let sy=28;
    grab('#pptSummaryBox .stat-box').forEach(b=>{
      doc.setTextColor(...MUTE);doc.setFont('times','normal');doc.setFontSize(9);
      doc.text(txt(b.querySelector('.key')),168,sy);
      doc.setTextColor(...DARK);doc.setFont('times','bold');doc.setFontSize(17);
      doc.text(txt(b.querySelector('.val')),168,sy+8);
      sy+=22;
    });

    // Page 3 — planetary parameters
    newPage('Planetary Parameters');
    const paramRows=grab('#rParams .param-cell').map(c=>[txt(c.querySelector('.pk')),txt(c.querySelector('.pv'))]);
    if(paramRows.length)table(paramRows,{x:9,w:150,extra:{head:[['Parameter','Value']]}});

    // Page 4 — light curve charts
    newPage('Light Curve Analysis');
    const fldImg=img('fldC'),rawImg=img('rawC');
    if(fldImg)doc.addImage(fldImg,'PNG',9,26,138,68);
    if(rawImg)doc.addImage(rawImg,'PNG',150,26,138,68);
    doc.setFont('times','normal');doc.setFontSize(10);doc.setTextColor(...MUTE);
    doc.text('Left: phase-folded transit.  Right: raw light curve with the transit region highlighted.',9,100);

    // Page 5 — evidence & physics
    newPage('Evidence Summary & Physics Consistency');
    const evRows=grab('#evidenceBox .evidence-item').map(it=>{
      const ok=it.querySelector('.evidence-check')!==null;
      return [ok?'\u2713':'\u2717',txt(it.querySelector('span'))];
    });
    if(evRows.length)table(evRows,{x:9,w:165,theme:'plain',extra:{columnStyles:{0:{cellWidth:8,fontStyle:'bold'}}}});
    const physText=txt(document.getElementById('physicsScore'));
    if(physText){doc.setFont('times','normal');doc.setFontSize(12);doc.setTextColor(...DARK);doc.text(physText,190,32,{maxWidth:98});}

    // Page 6 — spectroscopy (only if run)
    if(document.getElementById('specPanel').style.display!=='none'){
      newPage('Atmospheric Retrieval — Spectroscopy');
      const specImg=img('specR');
      if(specImg)doc.addImage(specImg,'PNG',9,26,150,68);
      const gasRows=[];
      grab('#gasAb .gas-item').forEach(gi=>{
        const spans=gi.querySelectorAll('.gi-head span');
        gasRows.push([txt(spans[0]),spans[1]?txt(spans[1]):'']);
      });
      if(gasRows.length)table(gasRows,{x:168,y:26,w:120,fontSize:9});
      const atmosSum=txt(document.getElementById('atmosSum'));
      if(atmosSum){doc.setFont('times','normal');doc.setFontSize(9.5);doc.setTextColor(...MUTE);doc.text(atmosSum,9,102,{maxWidth:279});}
    }

    // Page 7 — biosignature assessment
    newPage('Biosignature Assessment');
    const bioRows=grab('#bioList .bio-row').map(r=>{
      const spans=r.querySelectorAll('span');
      return [txt(spans[0]),spans[1]?txt(spans[1]):''];
    });
    if(bioRows.length)table(bioRows,{x:9,w:170});
    doc.setFont('times','bold');doc.setFontSize(14);doc.setTextColor(...BRAND);
    doc.text('Combined confidence: '+txt(document.getElementById('bScore')),195,32);
    doc.setFont('times','normal');doc.setFontSize(9);doc.setTextColor(...MUTE);
    doc.text(txt(document.getElementById('bSrc')),195,40,{maxWidth:92});

    // Page 8 — follow-up & priority ranking
    newPage('Recommended Follow-up & Priority');
    const followRows=grab('#followUp > div').map(r=>{
      const spans=r.querySelectorAll('span');
      return [txt(spans[0]),txt(spans[1])];
    });
    if(followRows.length)table(followRows,{x:9,w:130,fontSize:9.5});
    const rankHead=grab('#rankTable th').map(txt);
    const rankRows=grab('#rankBody tr').map(tr=>Array.from(tr.children).map(txt));
    if(rankRows.length)table(rankRows,{x:150,y:26,w:138,fontSize:9,extra:{head:[rankHead]}});

    // Page 9 — explainable AI report
    let expl='';
    grab('#pptSummaryText > div').forEach(d=>{if(d.textContent.includes('Key features'))expl=d.innerHTML.replace(/<br\s*\/?>/g,'\n').replace(/<[^>]+>/g,'').trim();});
    if(expl){
      newPage('Explainable AI Report');
      doc.setFont('times','normal');doc.setFontSize(12);doc.setTextColor(...DARK);
      doc.text(expl,9,32,{maxWidth:279,lineHeightFactor:1.35});
    }

    doc.save(candName.replace(/[^a-z0-9]+/gi,'_')+'_exoplanet_report.pdf');
  }catch(err){
    alert('Could not build the PDF: '+err.message);
  }finally{
    btn.disabled=false;btn.textContent=oldTxt;
  }
}
