(() => {

const NUM_TRACKS = 6;
const FPS = 30;
const WIDTH = 960;
const HEIGHT = 540;

const audioInput = document.getElementById("songInput");
const audio = document.getElementById("audio");
const audioStatus = document.getElementById("audioStatus");

const bpmInput = document.getElementById("bpmInput");
const barsInput = document.getElementById("barsInput");

const rollBtn = document.getElementById("rollDiceBtn");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");

const diceStatus = document.getElementById("diceStatus");
const errorStatus = document.getElementById("errorStatus");
const exportStatus = document.getElementById("exportStatus");

const outputVideo = document.getElementById("outputVideo");
const canvas = document.getElementById("mixCanvas");
const ctx = canvas.getContext("2d");

canvas.width = WIDTH;
canvas.height = HEIGHT;

let masterAudioFile = null;
let videos = [];
let videoLoaded = Array(NUM_TRACKS).fill(false);
let dicePlan = [];
let isRunning = false;
let recorder = null;
let chunks = [];
let rafId = null;

/* ---------- CREATE TRACK UI ---------- */
const tracksContainer = document.getElementById("tracksContainer");

for(let i=0;i<NUM_TRACKS;i++){
  const div = document.createElement("div");
  div.className="track";
  div.innerHTML = `
    <h4>Track ${i+1}</h4>
    <video id="video-${i}" muted playsinline></video>
    <input type="file" id="file-${i}" accept="video/*">
  `;
  tracksContainer.appendChild(div);

  const vid = div.querySelector("video");
  const input = div.querySelector("input");

  videos.push(vid);

  input.onchange = e=>{
    const file = e.target.files[0];
    if(!file) return;
    vid.src = URL.createObjectURL(file);
    vid.onloadeddata = ()=>{
      videoLoaded[i]=true;
    };
    vid.load();
  };
}

/* ---------- AUDIO ---------- */
audioInput.onchange = e=>{
  const file = e.target.files[0];
  masterAudioFile=file;
  if(file){
    audio.src = URL.createObjectURL(file);
    audio.load();
    audioStatus.textContent="Audio Loaded";
  }
};

/* ---------- DICE ---------- */
function segmentSeconds(){
  const bpm = Number(bpmInput.value)||120;
  const bars = Number(barsInput.value)||8;
  return (60/bpm)*4*bars;
}

function buildPlan(duration){
  const seg=segmentSeconds();
  let t=0;
  let plan=[];
  let last=-1;
  while(t<duration){
    let pick=Math.floor(Math.random()*NUM_TRACKS);
    while(pick===last) pick=Math.floor(Math.random()*NUM_TRACKS);
    plan.push({
      start:t*1000,
      end:Math.min(duration,t+seg)*1000,
      track:pick
    });
    last=pick;
    t+=seg;
  }
  return plan;
}

function getTrack(ms){
  for(let s of dicePlan){
    if(ms>=s.start && ms<s.end) return s.track;
  }
  return 0;
}

rollBtn.onclick=async()=>{
  if(!masterAudioFile){ diceStatus.textContent="Load audio first"; return; }
  if(videoLoaded.includes(false)){ diceStatus.textContent="Upload all 6 videos"; return; }

  await new Promise(r=>{
    if(!isNaN(audio.duration)&&audio.duration>0) r();
    else audio.onloadedmetadata=()=>r();
  });

  dicePlan=buildPlan(audio.duration);
  diceStatus.textContent=`Plan ready (${dicePlan.length} segments)`;
};

/* ---------- START ---------- */
startBtn.onclick=async()=>{
  if(isRunning) return;
  if(!dicePlan.length){ errorStatus.textContent="Roll Dice first"; return; }

  errorStatus.textContent="";
  exportStatus.textContent="";

  for(let v of videos){
    v.currentTime=0;
    await v.play().catch(()=>{});
  }

  audio.currentTime=0;
  await audio.play();

  const canvasStream = canvas.captureStream(FPS);

  let combinedStream = canvasStream;
  if(audio.captureStream){
    const aStream=audio.captureStream();
    combinedStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...aStream.getAudioTracks()
    ]);
  }

  chunks=[];
  recorder=new MediaRecorder(combinedStream,{mimeType:"video/webm"});
  recorder.ondataavailable=e=>{
    if(e.data.size>0) chunks.push(e.data);
  };
  recorder.onstop=()=>{
    const blob=new Blob(chunks,{type:"video/webm"});
    const url=URL.createObjectURL(blob);
    outputVideo.srcObject=null;
    outputVideo.src=url;
    outputVideo.load();

    const a=document.createElement("a");
    a.href=url;
    a.download="dicecut_music_video.webm";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    exportStatus.textContent="Export Complete";
  };

  outputVideo.srcObject=combinedStream;
  outputVideo.muted=true;
  outputVideo.play();

  recorder.start();

  isRunning=true;
  startBtn.disabled=true;
  stopBtn.disabled=false;

  function draw(){
    if(!isRunning) return;

    const ms=audio.currentTime*1000;
    const track=getTrack(ms);
    const v=videos[track];

    ctx.fillStyle="black";
    ctx.fillRect(0,0,WIDTH,HEIGHT);

    if(v.readyState>=2){
      ctx.drawImage(v,0,0,WIDTH,HEIGHT);
    }

    if(audio.currentTime>=audio.duration){
      stopBtn.click();
      return;
    }

    rafId=requestAnimationFrame(draw);
  }

  draw();
};

/* ---------- STOP ---------- */
stopBtn.onclick=()=>{
  if(!isRunning) return;

  isRunning=false;
  startBtn.disabled=false;
  stopBtn.disabled=true;

  audio.pause();
  videos.forEach(v=>v.pause());

  if(rafId) cancelAnimationFrame(rafId);
  if(recorder && recorder.state!=="inactive") recorder.stop();
};

})();
