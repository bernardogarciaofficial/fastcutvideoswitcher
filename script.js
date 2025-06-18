// FASTCUT MUSIC VIDEO MAKER - Enhanced Sync & Fade Transitions

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
const FADE_DURATION = 0.7; // seconds for fade-in/out

let fadeFromIdx = null;
let fadeToIdx = null;
let fadeStart = null;
let crossfadeResolve = null;
let crossfadeActive = false;

let lastSwitchAudioTime = 0;
const SYNC_THRESHOLD = 0.04; // 40ms

// --- Ensure Audio Plays ---
function ensureAudioPlays() {
  if (audio.src && audio.paused) {
    audio.play().catch(()=>{});
  }
}

// ---- Track Cards ----
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

// ---- Switcher ----
function createSwitcherBtns() {
  switcherBtnsContainer.innerHTML = '';
  for (let i = 0; i < NUM_TRACKS; i++) {
    const btn = document.createElement('button');
    btn.textContent = String(i + 1);
    btn.onclick = function () {
      if (i === activeTrackIndex) return;
      if (isRecording) {
        crossfadeBetweenTracks(activeTrackIndex, i, FADE_DURATION * 1000);
      } else {
        crossfadeBetweenTracks(activeTrackIndex, i, FADE_DURATION * 1000);
        ensureAudioPlays();
      }
      // Update switcher button highlight in all cases
      for (let j = 0; j < NUM_TRACKS; j++) {
        switcherBtnsContainer.children[j].className = (j === i) ? "active-switcher-btn" : "";
      }
    };
    switcherBtnsContainer.appendChild(btn);
  }
  switcherBtnsContainer.children[0].className = "active-switcher-btn";
}

// ---- Crossfade Between Tracks ----
async function crossfadeBetweenTracks(fromIdx, toIdx, duration) {
  if (crossfadeActive) return;
  if (!tempVideos[toIdx]) {
    setActiveTrack(toIdx, false);
    return;
  }
  crossfadeActive = true;
  fadeFromIdx = fromIdx;
  fadeToIdx = toIdx;
  fadeStart = performance.now();

  // Seek both videos to correct audio time
  let t = audio.currentTime || 0;
  if (tempVideos[fromIdx]) tempVideos[fromIdx].currentTime = Math.min(t, tempVideos[fromIdx].duration || t);
  if (tempVideos[toIdx]) tempVideos[toIdx].currentTime = Math.min(t, tempVideos[toIdx].duration || t);

  // Run fade loop
  await runFadeDraw(duration);

  setActiveTrack(toIdx, false);
  crossfadeActive = false;
}

function runFadeDraw(duration) {
  return new Promise((resolve) => {
    function fadeLoop(now) {
      let t = audio.currentTime || 0;
      let elapsed = Math.min((now - fadeStart) / duration, 1);

      // Prepare canvas for blend
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 360;
      const ctx = canvas.getContext('2d');

      // Seek both videos to the correct time
      if (tempVideos[fadeFromIdx]) tempVideos[fadeFromIdx].currentTime = Math.min(t, tempVideos[fadeFromIdx].duration || t);
      if (tempVideos[fadeToIdx]) tempVideos[fadeToIdx].currentTime = Math.min(t, tempVideos[fadeToIdx].duration || t);

      // Draw fade-out old, fade-in new
      // Fade out: (1 - elapsed), fade in: elapsed
      if (tempVideos[fadeFromIdx] && tempVideos[fadeFromIdx].readyState >= 2) {
        ctx.globalAlpha = 1 - elapsed;
        ctx.drawImage(tempVideos[fadeFromIdx], 0, 0, canvas.width, canvas.height);
      }
      if (tempVideos[fadeToIdx] && tempVideos[fadeToIdx].readyState >= 2) {
        ctx.globalAlpha = elapsed;
        ctx.drawImage(tempVideos[fadeToIdx], 0, 0, canvas.width, canvas.height);
      }
      mainOutput.srcObject = canvas.captureStream();
      mainOutput.play().catch(()=>{});

      if (elapsed < 1) {
        requestAnimationFrame(fadeLoop);
      } else {
        resolve();
      }
    }
    requestAnimationFrame(fadeLoop);
  });
}

function setActiveTrack(idx, withFade) {
  lastTrackIndex = activeTrackIndex;
  activeTrackIndex = idx;
  for (let j = 0; j < NUM_TRACKS; j++) {
    switcherBtnsContainer.children[j].className = (j === idx) ? "active-switcher-btn" : "";
  }
  // Sync video to audio time
  if (!isRecording && tempVideos[idx]) {
    let t = audio.currentTime || 0;
    tempVideos[idx].currentTime = Math.min(t, tempVideos[idx].duration || t);
    tempVideos[idx].pause();
    if (!withFade) {
      mainOutput.srcObject = null;
      mainOutput.src = videoTracks[idx].url;
      mainOutput.currentTime = t;
      mainOutput.play().catch(()=>{});
    }
  }
}

for (let i = 0; i < NUM_TRACKS; i++) createTrackCard(i);
createSwitcherBtns();

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
  }
});

// ---- Fade Helper ----
function getFadeAlpha(t, duration) {
  if (!duration) return 1;
  if (t < FADE_DURATION) return Math.max(0, t / FADE_DURATION); // fade in
  if (duration && t > duration - FADE_DURATION) return Math.max(0, (duration - t) / FADE_DURATION); // fade out
  return 1;
}

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

  // Ensure all temp videos are loaded, seeked to start, and playing
  for (let i = 0; i < tempVideos.length; i++) {
    if (tempVideos[i]) {
      tempVideos[i].pause();
      tempVideos[i].currentTime = 0;
      await new Promise(resolve => tempVideos[i].addEventListener('seeked', resolve, { once: true }));
      await tempVideos[i].play();
    }
  }

  lastSwitchAudioTime = 0;
  if (tempVideos[activeTrackIndex]) {
    tempVideos[activeTrackIndex].currentTime = 0;
  }

  // Fade/crossfade state for recording
  let pendingSwitch = null;
  let recFadeFrom = null;
  let recFadeTo = null;
  let recFadeStartT = 0;
  let recFadeSwitchT = 0;
  let recFadeActive = false;

  // Track queue for switches: {time, toIdx}
  let switchQueue = [];

  // Monkey-patch switcher for recording: queue requested switches
  switcherBtnsContainer.querySelectorAll('button').forEach((btn, idx) => {
    btn.onclick = () => {
      if (isRecording && activeTrackIndex !== idx) {
        switchQueue.push({ time: audio.currentTime, toIdx: idx });
      }
    };
  });

  function drawFrame() {
    if (!isRecording) return;
    let vid = tempVideos[activeTrackIndex];
    let t = audio.currentTime || 0;

    // Handle pending crossfade
    if (switchQueue.length && t >= switchQueue[0].time) {
      let sw = switchQueue.shift();
      recFadeFrom = activeTrackIndex;
      recFadeTo = sw.toIdx;
      recFadeStartT = t;
      recFadeSwitchT = t + FADE_DURATION;
      recFadeActive = true;
    }

    // Handle fade/crossfade on switch
    if (recFadeActive && recFadeFrom !== null && recFadeTo !== null) {
      let fadeElapsed = t - recFadeStartT;
      let alpha = Math.min(fadeElapsed / FADE_DURATION, 1);

      // Prepare both videos to current time
      let fromVid = tempVideos[recFadeFrom];
      let toVid = tempVideos[recFadeTo];
      if (fromVid) fromVid.currentTime = Math.min(t, fromVid.duration || t);
      if (toVid) toVid.currentTime = Math.min(t, toVid.duration || t);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Fade out fromVid
      if (fromVid && fromVid.readyState >= 2) {
        ctx.globalAlpha = 1 - alpha;
        ctx.drawImage(fromVid, 0, 0, canvas.width, canvas.height);
      }
      // Fade in toVid
      if (toVid && toVid.readyState >= 2) {
        ctx.globalAlpha = alpha;
        ctx.drawImage(toVid, 0, 0, canvas.width, canvas.height);
      }

      // When fade is complete, activate new track
      if (alpha >= 1) {
        activeTrackIndex = recFadeTo;
        recFadeActive = false;
        recFadeFrom = null;
        recFadeTo = null;
      }
    } else {
      // Improved sync: always seek if out of sync
      if (vid && vid.readyState >= 2 && !vid.ended && t < (vid.duration || Infinity)) {
        if (Math.abs(vid.currentTime - t) > SYNC_THRESHOLD) {
          try {
            vid.currentTime = Math.min(t, vid.duration ? vid.duration - 0.033 : t);
          } catch (err) {}
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = getFadeAlpha(t, audio.duration || 0);
        ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
      } else {
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
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
