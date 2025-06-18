// FASTCUT MUSIC VIDEO MAKER - with Fade Transitions and Precise Audio/Video Synchronization

const NUM_TRACKS = 6;
const songInput = document.getElementById('songInput');
const audio = document.getElementById('audio');
const mainOutput = document.getElementById('mainOutput');
const tracksContainer = document.getElementById('tracksContainer');
const switcherBtnsContainer = document.getElementById('switcherBtnsContainer');
const recordFullEditBtn = document.getElementById('recordFullEditBtn');
const stopPreviewBtn = document.getElementById('stopPreviewBtn');
const exportBtn = document.getElementById('exportMusicVideoBtn');
const exportStatus = document.getElementById('exportStatus');
const warnSong = document.getElementById('warnSong');

const videoTracks = Array(NUM_TRACKS).fill(null);
const tempVideos = Array(NUM_TRACKS).fill(null);
let activeTrackIndex = 0;
let lastTrackIndex = 0;
let isRecording = false;
let animationFrameId = null;
let mediaRecorder = null;
let recordedChunks = [];
let audioContext = null;
let fadeStartTime = null;
let fading = false;
const FADE_DURATION = 0.4; // seconds

// --- FADE STATE ---
let fadeFromIdx = null;
let fadeToIdx = null;
let fadeStart = null;

// -- MUSIC only plays on switch or preview --
function ensureAudioPlays() {
  if (audio.src && audio.paused) {
    audio.play().catch(()=>{});
  }
}

// ---- CARDS ----
function createTrackCard(index) {
  const card = document.createElement('div');
  card.className = 'track-card';

  // Title
  const title = document.createElement('div');
  title.className = "track-title";
  title.textContent = `Camera ${index + 1}`;
  card.appendChild(title);

  // Upload
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

  // Record
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

  // Download button
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

  // Video preview (thumbnail)
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

// ---- SWITCHER ----
function createSwitcherBtns() {
  switcherBtnsContainer.innerHTML = '';
  for (let i = 0; i < NUM_TRACKS; i++) {
    const btn = document.createElement('button');
    btn.textContent = String(i + 1);
    btn.onclick = function () {
      if (i === activeTrackIndex) return;
      // Start fade
      startFadeTransition(activeTrackIndex, i);
      setActiveTrack(i, true); // setActiveTrack will sync video position
      ensureAudioPlays();
    };
    switcherBtnsContainer.appendChild(btn);
  }
  switcherBtnsContainer.children[0].className = "active-switcher-btn";
}

function setActiveTrack(idx, withFade) {
  lastTrackIndex = activeTrackIndex;
  activeTrackIndex = idx;
  // update switcher button highlight
  for (let j = 0; j < NUM_TRACKS; j++) {
    switcherBtnsContainer.children[j].className = (j === idx) ? "active-switcher-btn" : "";
  }
  // Video preview: sync video to audio time
  if (!isRecording && tempVideos[idx]) {
    let t = audio.currentTime || 0;
    tempVideos[idx].currentTime = t;
    tempVideos[idx].pause();
    // Only play main output if not fading
    if (!withFade) {
      mainOutput.srcObject = null;
      mainOutput.src = videoTracks[idx].url;
      mainOutput.currentTime = t;
      mainOutput.play().catch(()=>{});
    }
  }
}

// ---- FADE LOGIC ----
function startFadeTransition(fromIdx, toIdx) {
  if (!tempVideos[fromIdx] || !tempVideos[toIdx]) {
    setActiveTrack(toIdx, false);
    return;
  }
  fadeFromIdx = fromIdx;
  fadeToIdx = toIdx;
  fadeStart = performance.now();
  fading = true;
  requestAnimationFrame(fadeDraw);
}

function fadeDraw(now) {
  if (!fading) return;
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 360;
  const ctx = canvas.getContext('2d');
  let t = audio.currentTime || 0;
  // seek both videos to current audio time
  if (tempVideos[fadeFromIdx]) tempVideos[fadeFromIdx].currentTime = t;
  if (tempVideos[fadeToIdx]) tempVideos[fadeToIdx].currentTime = t;

  // draw blend
  const elapsed = (now - fadeStart) / 1000;
  let alpha = Math.min(elapsed / FADE_DURATION, 1);
  // Draw from video
  if (tempVideos[fadeFromIdx] && tempVideos[fadeFromIdx].readyState >= 2) {
    ctx.globalAlpha = 1 - alpha;
    ctx.drawImage(tempVideos[fadeFromIdx], 0, 0, canvas.width, canvas.height);
  }
  // Draw to video
  if (tempVideos[fadeToIdx] && tempVideos[fadeToIdx].readyState >= 2) {
    ctx.globalAlpha = alpha;
    ctx.drawImage(tempVideos[fadeToIdx], 0, 0, canvas.width, canvas.height);
  }
  mainOutput.srcObject = canvas.captureStream();
  mainOutput.play().catch(()=>{});

  if (alpha < 1) {
    requestAnimationFrame(fadeDraw);
  } else {
    fading = false;
    setActiveTrack(fadeToIdx, false); // Finish transition, play new video
  }
}

for (let i = 0; i < NUM_TRACKS; i++) createTrackCard(i);
createSwitcherBtns();

function getCurrentDrawVideo() {
  return tempVideos[activeTrackIndex] || null;
}

warnSong.style.display = 'none';

// ---- AUDIO ----
songInput.addEventListener('change', function() {
  warnSong.style.display = 'none';
  if (songInput.files.length > 0) {
    const file = songInput.files[0];
    audio.src = URL.createObjectURL(file);
    audio.load();
    audio.currentTime = 0;
    audio.volume = 1;
    // DO NOT auto play!
  }
});

// ---- RECORD FULL EDIT ----
recordFullEditBtn.addEventListener('click', async function () {
  if (!audio.src) {
    warnSong.style.display = '';
    setTimeout(() => { warnSong.style.display = 'none'; }, 2500);
    return;
  }
  if (!videoTracks.some(Boolean)) {
    alert('Please upload or record at least one video.');
    return;
  }
  if (!tempVideos[activeTrackIndex]) {
    alert('Selected camera has no video.');
    return;
  }
  isRecording = true;
  recordedChunks = [];
  if (exportStatus) exportStatus.textContent = '';
  if (exportBtn) exportBtn.disabled = true;

  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 360;
  const ctx = canvas.getContext('2d');

  // Ensure all temp videos are loaded and reset
  for (let i = 0; i < tempVideos.length; i++) {
    if (tempVideos[i]) {
      try {
        tempVideos[i].pause();
        tempVideos[i].currentTime = 0;
        tempVideos[i].load();
      } catch(e) {}
    }
  }
  for (let i = 0; i < tempVideos.length; i++) {
    if (tempVideos[i] && tempVideos[i].readyState < 2) {
      await new Promise(resolve => {
        tempVideos[i].addEventListener('loadeddata', resolve, { once: true });
      });
    }
  }
  // Play all temp videos for instant switching
  for (let i = 0; i < tempVideos.length; i++) {
    if (tempVideos[i]) {
      try {
        tempVideos[i].currentTime = 0;
        await tempVideos[i].play();
      } catch(e) {}
    }
  }

  function drawFrame() {
    if (!isRecording) return;
    // Sync all videos to audio for perfect sync
    let t = audio.currentTime || 0;
    if (tempVideos[activeTrackIndex]) tempVideos[activeTrackIndex].currentTime = t;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const vid = tempVideos[activeTrackIndex];
    if (vid && !vid.ended && vid.readyState >= 2) {
      ctx.globalAlpha = 1;
      ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    animationFrameId = requestAnimationFrame(drawFrame);
  }
  drawFrame();

  // Live preview
  mainOutput.srcObject = canvas.captureStream(30);
  mainOutput.src = "";
  mainOutput.play();

  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const source = audioContext.createMediaElementSource(audio);
  const dest = audioContext.createMediaStreamDestination();
  source.connect(dest);
  source.connect(audioContext.destination);

  const canvasStream = canvas.captureStream(30);
  const combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...dest.stream.getAudioTracks()
  ]);

  mediaRecorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm; codecs=vp9,opus' });
  mediaRecorder.ondataavailable = function(e) {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };
  mediaRecorder.onstop = function() {
    cancelAnimationFrame(animationFrameId);
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    mainOutput.src = URL.createObjectURL(blob);
    mainOutput.srcObject = null;
    mainOutput.controls = true;
    mainOutput.style.display = 'block';
    if (exportBtn) exportBtn.disabled = false;
    isRecording = false;
    if (exportStatus) exportStatus.textContent = 'Recording finished! Preview your cut below.';
    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }
  };

  audio.currentTime = 0;
  audio.play();
  mediaRecorder.start();

  audio.onended = function () {
    if (isRecording && mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      audio.onended = null;
    }
  };

  stopPreviewBtn.onclick = function () {
    if (isRecording && mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      audio.pause();
      if (exportStatus) exportStatus.textContent = 'Recording stopped.';
    }
  };
});

// ---- EXPORT ----
exportBtn.addEventListener('click', function () {
  if (!mainOutput.src) {
    if (exportStatus) exportStatus.textContent = 'Nothing to export yet!';
    return;
  }
  fetch(mainOutput.src)
    .then(res => res.blob())
    .then(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'fastcut-edit.webm';
      a.click();
      if (exportStatus) exportStatus.textContent = 'Video exported – check your downloads!';
    });
});

// -- Always keep audio playing on camera switch or preview, NOT on every click --
mainOutput.addEventListener('play', ensureAudioPlays);
mainOutput.addEventListener('seeking', ensureAudioPlays);
mainOutput.addEventListener('click', ensureAudioPlays);
switcherBtnsContainer.addEventListener('click', ensureAudioPlays);
// document.body.addEventListener('click', ensureAudioPlays, true); // <-- REMOVED!
