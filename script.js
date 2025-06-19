// FASTCUT MUSIC VIDEO MAKER - STRIPPED DOWN (NO RECORD/EXPORT/STOP)

const NUM_TRACKS = 6;
const songInput = document.getElementById('songInput');
const audio = document.getElementById('audio');
const mainOutput = document.getElementById('mainOutput');
const tracksContainer = document.getElementById('tracksContainer');
const switcherBtnsContainer = document.getElementById('switcherBtnsContainer');
const warnSong = document.getElementById('warnSong');

const videoTracks = Array(NUM_TRACKS).fill(null);
const tempVideos = Array(NUM_TRACKS).fill(null);
let activeTrackIndex = 0;
let requestedTrackIndex = 0;
let animationFrameId = null;
const FADE_DURATION = 0.7; // seconds
const SYNC_THRESHOLD = 0.04; // 40ms

let fadeState = null;

// Persistent canvas for compositing
const outputCanvas = document.createElement('canvas');
outputCanvas.width = 640;
outputCanvas.height = 360;
const outputCtx = outputCanvas.getContext('2d');

// ---- Track Cards ----
function createTrackCard(index) {
  const card = document.createElement('div');
  card.className = 'track-card';

  const title = document.createElement('div');
  title.className = "track-title";
  title.textContent = `Camera ${index + 1}`;
  card.appendChild(title);

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'video/*';
  input.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    videoTracks[index] = { file, url, name: file.name };
    prepareTempVideo(index, url);
    preview.src = url;
    preview.load();
    dlBtn.style.display = '';
  });
  card.appendChild(input);

  const recBtn = document.createElement('button');
  recBtn.textContent = 'Rec';
  card.appendChild(recBtn);

  const stopRecBtn = document.createElement('button');
  stopRecBtn.textContent = 'Stop';
  stopRecBtn.style.display = 'none';
  card.appendChild(stopRecBtn);

  let trackRecorder = null;
  let recStream = null;
  let recChunks = [];

  recBtn.addEventListener('click', async function () {
    recBtn.disabled = true;
    stopRecBtn.style.display = '';
    try {
      recStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch (err) {
      recBtn.disabled = false;
      stopRecBtn.style.display = 'none';
      alert("Camera/mic permission denied.");
      return;
    }
    preview.srcObject = recStream;
    preview.muted = true;
    preview.autoplay = true;
    preview.play().catch(()=>{});
    trackRecorder = new MediaRecorder(recStream, { mimeType: 'video/webm; codecs=vp9,opus' });
    recChunks = [];
    trackRecorder.ondataavailable = function(e) {
      if (e.data.size > 0) recChunks.push(e.data);
    };
    trackRecorder.onstop = function() {
      const blob = new Blob(recChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      videoTracks[index] = { file: null, url, name: `Cam${index+1}-take.webm`, recordedBlob: blob };
      prepareTempVideo(index, url);
      preview.srcObject = null;
      preview.src = url;
      preview.load();
      dlBtn.style.display = '';
      recBtn.disabled = false;
      stopRecBtn.style.display = 'none';
      if (recStream) recStream.getTracks().forEach(track => track.stop());
    };
    trackRecorder.start();
  });

  stopRecBtn.addEventListener('click', function() {
    if (trackRecorder && trackRecorder.state === 'recording') {
      trackRecorder.stop();
      stopRecBtn.style.display = 'none';
      recBtn.disabled = false;
    }
  });

  const dlBtn = document.createElement('button');
  dlBtn.textContent = 'DL';
  dlBtn.style.display = 'none';
  dlBtn.addEventListener('click', function() {
    if (videoTracks[index] && videoTracks[index].url) {
      const a = document.createElement('a');
      a.href = videoTracks[index].url;
      a.download = videoTracks[index].name || `track${index+1}.webm`;
      a.click();
    }
  });
  card.appendChild(dlBtn);

  const preview = document.createElement('video');
  preview.controls = true;
  preview.style.background = "#000";
  preview.muted = true;
  preview.playsInline = true;
  card.appendChild(preview);

  tracksContainer.appendChild(card);
}

function prepareTempVideo(idx, url) {
  if (tempVideos[idx]) {
    tempVideos[idx].pause();
    tempVideos[idx].remove();
  }
  const v = document.createElement('video');
  v.src = url;
  v.crossOrigin = "anonymous";
  v.muted = true;
  v.preload = "auto";
  v.playsInline = true;
  v.style.display = "none";
  v.load();
  document.body.appendChild(v);
  tempVideos[idx] = v;
}

// ---- Switcher ----
function createSwitcherBtns() {
  switcherBtnsContainer.innerHTML = '';
  for (let i = 0; i < NUM_TRACKS; i++) {
    const btn = document.createElement('button');
    btn.textContent = String(i + 1);
    btn.onclick = function () {
      if (i === requestedTrackIndex) return;
      startFade(activeTrackIndex, i);
      requestedTrackIndex = i;
      updateSwitcherBtns();
      ensureAudioPlays();
    };
    switcherBtnsContainer.appendChild(btn);
  }
  updateSwitcherBtns();
}

function updateSwitcherBtns() {
  for (let j = 0; j < NUM_TRACKS; j++) {
    switcherBtnsContainer.children[j].className = (j === requestedTrackIndex) ? "active-switcher-btn" : "";
  }
}

// ---- Fade Logic ----
function startFade(fromIdx, toIdx) {
  if (!tempVideos[toIdx]) {
    activeTrackIndex = toIdx;
    requestedTrackIndex = toIdx;
    return;
  }
  fadeState = {
    from: fromIdx,
    to: toIdx,
    startTime: performance.now(),
    duration: FADE_DURATION * 1000
  };
}

function getFadeAlpha(time, duration) {
  if (time < FADE_DURATION) return time / FADE_DURATION;
  if (duration && time > duration - FADE_DURATION) return (duration - time) / FADE_DURATION;
  return 1;
}

// ---- Drawing Loop ----
function drawLoop() {
  let t = audio.currentTime || 0;
  let mainVid = tempVideos[activeTrackIndex];
  let showFade = fadeState !== null;

  if (showFade && fadeState) {
    let elapsed = (performance.now() - fadeState.startTime) / 1000;
    let alpha = Math.min(elapsed / FADE_DURATION, 1);
    let fromVid = tempVideos[fadeState.from];
    let toVid = tempVideos[fadeState.to];

    if (fromVid) fromVid.currentTime = Math.min(t, fromVid.duration || t);
    if (toVid) toVid.currentTime = Math.min(t, toVid.duration || t);

    outputCtx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
    if (fromVid && fromVid.readyState >= 2) {
      outputCtx.globalAlpha = 1 - alpha;
      outputCtx.drawImage(fromVid, 0, 0, outputCanvas.width, outputCanvas.height);
    }
    if (toVid && toVid.readyState >= 2) {
      outputCtx.globalAlpha = alpha;
      outputCtx.drawImage(toVid, 0, 0, outputCanvas.width, outputCanvas.height);
    }
    outputCtx.globalAlpha = 1;

    if (alpha >= 1) {
      activeTrackIndex = fadeState.to;
      fadeState = null;
      updateSwitcherBtns();
    }
  } else if (mainVid && mainVid.readyState >= 2 && t < (mainVid.duration || Infinity)) {
    if (Math.abs(mainVid.currentTime - t) > SYNC_THRESHOLD) {
      try {
        mainVid.currentTime = Math.min(t, mainVid.duration ? mainVid.duration - 0.033 : t);
      } catch (err) {}
    }
    outputCtx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
    outputCtx.globalAlpha = getFadeAlpha(t, audio.duration || 0);
    outputCtx.drawImage(mainVid, 0, 0, outputCanvas.width, outputCanvas.height);
    outputCtx.globalAlpha = 1;
  } else {
    outputCtx.globalAlpha = 1;
    outputCtx.fillStyle = "#000";
    outputCtx.fillRect(0, 0, outputCanvas.width, outputCanvas.height);
  }

  animationFrameId = requestAnimationFrame(drawLoop);
}

// ---- AUDIO ----
songInput.addEventListener('change', function() {
  warnSong.style.display = 'none';
  if (songInput.files.length > 0) {
    const file = songInput.files[0];
    audio.src = URL.createObjectURL(file);
    audio.load();
    audio.currentTime = 0;
    audio.volume = 1;
  }
});

// ---- Always Keep Audio Playing on Switch or Play ----
function ensureAudioPlays() {
  if (audio.src && audio.paused) {
    audio.play().catch(()=>{});
  }
}
mainOutput.addEventListener('play', ensureAudioPlays);
mainOutput.addEventListener('seeking', ensureAudioPlays);
mainOutput.addEventListener('click', ensureAudioPlays);
switcherBtnsContainer.addEventListener('click', ensureAudioPlays);

// ---- Init ----
for (let i = 0; i < NUM_TRACKS; i++) createTrackCard(i);
createSwitcherBtns();
warnSong.style.display = 'none';

// Start preview loop
mainOutput.srcObject = outputCanvas.captureStream(30);
animationFrameId = requestAnimationFrame(drawLoop);
