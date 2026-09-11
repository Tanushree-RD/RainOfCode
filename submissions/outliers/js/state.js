// ── Shared state ─────────────────────────────────────────────────────────────
// N used to be a hard-coded 201. It's now dynamic: it tracks however many
// points are in the currently loaded light curve (preset or uploaded), up to
// MAX_N so training/inference stays responsive in the browser.
// Likewise the BLS period search range (minPeriod/maxPeriod) used to be
// hard-coded to 0.5–40 days. It now auto-scales: if the uploaded CSV has a
// time column we use the real observed time span; otherwise we scale the
// search range with N (more points ≈ a longer baseline, same as real
// photometric surveys), preserving the original 0.5–40d range at N=201.

const DEFAULT_N=201;      // point count for the built-in preset candidates
const MAX_N=2000;         // hard cap so training/rendering stays fast in-browser
const NS=280;             // spectrum resolution (unrelated to light curve N)

let N=DEFAULT_N;
let minPeriod=0.5, maxPeriod=40;
let timeData=null;        // real timestamps for the loaded curve, if the CSV supplied them

let star=null, lcData=null, specData=null, gasResults=null;
let aiReady=false, llmReasoning='';
let cnnModel=null, cnnReady=false, cnnTrainedN=null;
const lH=[],vlH=[],aH=[],vaH=[];

// Recompute the period-search range for the currently loaded curve.
function rescalePeriodRange(){
  if(timeData && timeData.length>1){
    const span=Math.max(...timeData)-Math.min(...timeData);
    const cadence=span/(timeData.length-1||1);
    minPeriod=Math.max(cadence*2,0.05);
    maxPeriod=Math.max(minPeriod+0.5,span/2);
  }else{
    minPeriod=0.5;
    maxPeriod=Math.max(40,Math.round(N/DEFAULT_N*40));
  }
}

// If the loaded curve's length changed since the CNN was last trained, the
// trained weights no longer match the model's input shape — flag it instead
// of silently predicting on stale/incompatible data.
function checkCnnValidity(){
  if(cnnReady && cnnTrainedN!==N){
    cnnReady=false;
    const done=document.getElementById('cnnDone');
    if(done)done.style.display='none';
    addCnnLog(`Light curve length changed to ${N} points — please retrain the CNN before running detection.`,'log-warn');
    updateArchNote();updateRunGate();
  }
}
