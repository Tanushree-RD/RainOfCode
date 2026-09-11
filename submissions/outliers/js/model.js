// ── Matrix & MLP (small dependency-free NN used for scratch math elsewhere) ────
class Mat{constructor(r,c,d){this.rows=r;this.cols=c;this.d=d||new Float32Array(r*c);}get(r,c){return this.d[r*this.cols+c];}set(r,c,v){this.d[r*this.cols+c]=v;}static zeros(r,c){return new Mat(r,c);}static rand(r,c,s){const m=new Mat(r,c);for(let i=0;i<m.d.length;i++)m.d[i]=(Math.random()*2-1)*s;return m;}static mul(A,B){const m=new Mat(A.rows,B.cols);for(let i=0;i<A.rows;i++)for(let j=0;j<B.cols;j++){let s=0;for(let k=0;k<A.cols;k++)s+=A.get(i,k)*B.get(k,j);m.set(i,j,s);}return m;}addRow(b){const m=new Mat(this.rows,this.cols);for(let i=0;i<this.rows;i++)for(let j=0;j<this.cols;j++)m.set(i,j,this.get(i,j)+b.get(0,j));return m;}apply(fn){const m=new Mat(this.rows,this.cols);for(let i=0;i<this.d.length;i++)m.d[i]=fn(this.d[i]);return m;}T(){const m=new Mat(this.cols,this.rows);for(let i=0;i<this.rows;i++)for(let j=0;j<this.cols;j++)m.set(j,i,this.get(i,j));return m;}mulElem(o){const m=new Mat(this.rows,this.cols);for(let i=0;i<this.d.length;i++)m.d[i]=this.d[i]*o.d[i];return m;}sumRows(){const m=Mat.zeros(1,this.cols);for(let i=0;i<this.rows;i++)for(let j=0;j<this.cols;j++)m.set(0,j,m.get(0,j)+this.get(i,j));return m;}}
class MLP{constructor(nIn,h1,h2){const s1=Math.sqrt(2/nIn),s2=Math.sqrt(2/h1),s3=Math.sqrt(2/h2);this.W=[Mat.rand(nIn,h1,s1),Mat.rand(h1,h2,s2),Mat.rand(h2,1,s3)];this.b=[Mat.zeros(1,h1),Mat.zeros(1,h2),Mat.zeros(1,1)];this.mW=this.W.map(w=>Mat.zeros(w.rows,w.cols));this.vW=this.W.map(w=>Mat.zeros(w.rows,w.cols));this.mb=this.b.map(b=>Mat.zeros(b.rows,b.cols));this.vb=this.b.map(b=>Mat.zeros(b.rows,b.cols));this.t=0;}relu(x){return Math.max(0,x);}sig(x){return 1/(1+Math.exp(-Math.max(-500,Math.min(500,x))));}drelu(x){return x>0?1:0;}forward(X){this.cache=[X];let A=X;for(let l=0;l<2;l++){const Z=Mat.mul(A,this.W[l]).addRow(this.b[l]);A=Z.apply(x=>this.relu(x));this.cache.push(Z,A);}const Zo=Mat.mul(A,this.W[2]).addRow(this.b[2]);const Ao=Zo.apply(x=>this.sig(x));this.cache.push(Zo,Ao);return Ao;}backward(Y,lr){const b1=.9,b2=.999,eps=1e-8;this.t++;const m=Y.rows;const Ao=this.cache[this.cache.length-1];const dA=new Mat(m,1);for(let i=0;i<m;i++)dA.set(i,0,(Ao.get(i,0)-Y.get(i,0))/m);let up=dA;for(let l=2;l>=0;l--){const Ap=this.cache[l===0?0:l*2];const dW=Mat.mul(Ap.T(),up),db=up.sumRows();const adam=(W,dW,mW,vW)=>{const out=new Mat(W.rows,W.cols);for(let i=0;i<W.d.length;i++){mW.d[i]=b1*mW.d[i]+(1-b1)*dW.d[i];vW.d[i]=b2*vW.d[i]+(1-b2)*dW.d[i]*dW.d[i];const mh=mW.d[i]/(1-Math.pow(b1,this.t)),vh=vW.d[i]/(1-Math.pow(b2,this.t));out.d[i]=W.d[i]-lr*mh/(Math.sqrt(vh)+eps);}return out;};this.W[l]=adam(this.W[l],dW,this.mW[l],this.vW[l]);this.b[l]=adam(this.b[l],db,this.mb[l],this.vb[l]);if(l>0){const Z=this.cache[l*2-1];up=Mat.mul(up,this.W[l].T()).mulElem(Z.apply(x=>this.drelu(x)));}}};trainBatch(Xa,ya,lr){const m=Xa.length,nI=Xa[0].length;const X=new Mat(m,nI),Y=new Mat(m,1);for(let i=0;i<m;i++){for(let j=0;j<nI;j++)X.set(i,j,Xa[i][j]);Y.set(i,0,ya[i]);}const pred=this.forward(X);let loss=0,acc=0;for(let i=0;i<m;i++){const p=pred.get(i,0),y=ya[i];loss-=y*Math.log(p+1e-9)+(1-y)*Math.log(1-p+1e-9);if((p>.5)===(y>.5))acc++;}this.backward(Y,lr);return{loss:loss/m,acc:acc/m};}predict(x){const X=new Mat(1,x.length);for(let i=0;i<x.length;i++)X.set(0,i,x[i]);return this.forward(X).get(0,0);}}

// ── CNN (real, trained locally with TensorFlow.js) ──────────────────────────────
// Input shape now reads the *current* N, so it automatically resizes to
// whatever length light curve is loaded (instead of a hard-coded 201).
function normalizeCurve(raw){const mean=raw.reduce((a,b)=>a+b,0)/raw.length;const sd=Math.sqrt(raw.reduce((a,v)=>a+(v-mean)**2,0)/raw.length)||1e-6;return raw.map(v=>(v-mean)/sd);}
function buildCNN(){
  const m=tf.sequential();
  m.add(tf.layers.conv1d({inputShape:[N,1],filters:16,kernelSize:7,padding:'same',activation:'relu'}));
  m.add(tf.layers.maxPooling1d({poolSize:2}));
  m.add(tf.layers.conv1d({filters:32,kernelSize:5,padding:'same',activation:'relu'}));
  m.add(tf.layers.maxPooling1d({poolSize:2}));
  m.add(tf.layers.conv1d({filters:64,kernelSize:3,padding:'same',activation:'relu'}));
  m.add(tf.layers.globalAveragePooling1d());
  m.add(tf.layers.dense({units:32,activation:'relu'}));
  m.add(tf.layers.dropout({rate:.3}));
  m.add(tf.layers.dense({units:1,activation:'sigmoid'}));
  return m;
}
function makeDataset(n){
  const X=[],Y=[];
  for(let i=0;i<n;i++){const has=Math.random()<.5;X.push(normalizeCurve(genSynthLC(has)));Y.push(has?1:0);}
  return{X,Y};
}
function addCnnLog(msg,cls=''){const el=document.getElementById('cnnLog');const d=document.createElement('div');d.className='log-line '+cls;d.textContent=msg;el.appendChild(d);el.scrollTop=el.scrollHeight;}
async function trainCNN(){
  if(typeof tf==='undefined'){addCnnLog('TensorFlow.js did not load — check your internet connection and try again.','log-warn');return;}
  const btn=document.getElementById('btnCNN');const oldTxt=btn.textContent;btn.disabled=true;
  document.getElementById('lossH').style.display='none';document.getElementById('accH').style.display='none';
  lH.length=0;vlH.length=0;aH.length=0;vaH.length=0;
  const epochs=Math.max(4,Math.min(60,parseInt(document.getElementById('epInput').value)||18));
  const lr=curLR();
  let xsTr,ysTr,xsVa,ysVa;
  try{
    btn.textContent='Generating data…';
    addCnnLog(`Generating 600 training + 150 validation synthetic light curves (${N} points each)…`,'log-info');
    await tf.nextFrame();
    const trn=makeDataset(600),val=makeDataset(150);
    xsTr=tf.tensor3d(trn.X.map(c=>c.map(v=>[v])));ysTr=tf.tensor2d(trn.Y.map(v=>[v]));
    xsVa=tf.tensor3d(val.X.map(c=>c.map(v=>[v])));ysVa=tf.tensor2d(val.Y.map(v=>[v]));
    if(cnnModel)cnnModel.dispose?.();
    cnnModel=buildCNN();
    cnnModel.compile({optimizer:tf.train.adam(lr),loss:'binaryCrossentropy',metrics:['accuracy']});
    addCnnLog(`Model built — ${cnnModel.countParams().toLocaleString()} trainable parameters. Training for ${epochs} epochs at lr=${lr}…`,'log-info');
    btn.textContent='Training…';
    await cnnModel.fit(xsTr,ysTr,{
      epochs,batchSize:32,validationData:[xsVa,ysVa],shuffle:true,
      callbacks:{onEpochEnd:async(ep,logs)=>{
        const acc=logs.acc!==undefined?logs.acc:logs.accuracy;
        const vacc=logs.val_acc!==undefined?logs.val_acc:logs.val_accuracy;
        lH.push(logs.loss);vlH.push(logs.val_loss);aH.push(acc);vaH.push(vacc);
        chart('lossC',[{data:lH,col:'#2563eb',lw:2},{data:vlH,col:'#c07840',lw:2,dash:[4,3]}],lH.map((_,i)=>i+1),{xL:'epoch'});
        chart('accC',[{data:aH,col:'#16a34a',lw:2},{data:vaH,col:'#8060a0',lw:2,dash:[4,3]}],aH.map((_,i)=>i+1),{xL:'epoch',yMin:0,yMax:1,yF:v=>(v*100).toFixed(0)+'%'});
        addCnnLog(`epoch ${ep+1}/${epochs} — loss ${logs.loss.toFixed(3)}, val_loss ${logs.val_loss.toFixed(3)}, val_acc ${(vacc*100).toFixed(1)}%`);
        await tf.nextFrame();
      }}
    });
    cnnReady=true;cnnTrainedN=N;
    const finalAcc=vaH[vaH.length-1];
    addCnnLog(`Training complete — final validation accuracy ${(finalAcc*100).toFixed(1)}%.`,'log-ok');
    const done=document.getElementById('cnnDone');done.style.display='block';
    done.textContent=`CNN trained on ${N}-point curves — ${(finalAcc*100).toFixed(1)}% validation accuracy on synthetic data (${cnnModel.countParams().toLocaleString()} parameters). It will be combined with the LLM (if connected) at detection time.`;
  }catch(err){
    addCnnLog(`Training failed: ${err.message}`,'log-warn');
    cnnReady=false;
  }finally{
    [xsTr,ysTr,xsVa,ysVa].forEach(t=>t&&t.dispose());
    btn.disabled=false;btn.textContent=oldTxt;
    updateArchNote();updateRunGate();
  }
}
function predictCNN(raw){
  if(!cnnModel)return null;
  const norm=normalizeCurve(raw);
  return tf.tidy(()=>{const x=tf.tensor3d([norm.map(v=>[v])]);return cnnModel.predict(x).dataSync()[0];});
}
