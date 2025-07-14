// Fastcut Two Channels Music Video Maker
// Author: Bernardo Garcia

const NUM_TRACKS = 2;
const FPS = 30; // Set your intended output frame rate here.

const songInput = document.getElementById('songInput');
const audioStatus = document.getElementById('audioStatus');
const audio = document.getElementById('audio');
const switcherTracks = document.getElementById('switcherTracks');
const switcherBtnsContainer = document.getElementById('switcherBtnsContainer');
const masterOutputVideo = document.getElementById('masterOutputVideo');
const recIndicator = document.getElementById('recIndicator');
const recordFullEditBtn = document.getElementById('recordFullEditBtn');
const stopPreviewBtn = document.getElementById('stopPreviewBtn');
const exportBtn = document.getElementById('exportMusicVideoBtn');
const exportStatus = document.getElementById('exportStatus');
const hiddenVideos = document.getElementById('hiddenVideos');
const debuglog = document.getElementById('debuglog');
const timelineClock = document.getElementById('timelineClock');
const audioPlayBtn = document.getElementById('audioPlayBtn');
const audioPauseBtn = document.getElementById('audioPauseBtn');

// Helper function to format seconds as mm:ss
function formatTime(secs) {
  secs = Math.floor(secs || 0);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
}

// Timeline logic
let isRecording = false;
let isPlaying = false;
let animationFrameId = null;

function updateTimelineClock() {
  let current = 0, total = 0;
  if (isRecording || isPlaying) {
    current = audio.currentTime;
    total = audio.duration || audio.seekable?.end(0) || 0;
  } else if (masterOutputVideo.src && masterOutputVideo.currentTime) {
    current = masterOutputVideo.currentTime;
    total = masterOutputVideo.duration || 0;
  }
  timelineClock.textContent = `${formatTime(current)} / ${formatTime(total)}`;
  animationFrameId = requestAnimationFrame(updateTimelineClock);
}

audio.addEventListener('play', () => {
  isPlaying = true;
  updateTimelineClock();
});
masterOutputVideo.addEventListener('play', () => updateTimelineClock());
audio.addEventListener('pause', () => {
  isPlaying = false;
  timelineClock.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
});
masterOutputVideo.addEventListener('pause', () => {
  timelineClock.textContent = `${formatTime(masterOutputVideo.currentTime)} / ${formatTime(masterOutputVideo.duration)}`;
});
timelineClock.textContent = '00:00 / 00:00';

function logDebug(msg) {
  if (debuglog) {
    debuglog.textContent += msg + "\n";
    debuglog.scrollTop = debuglog.scrollHeight;
  }
}

const videoTracks = Array(NUM_TRACKS).fill(null);
const tempVideos = Array(NUM_TRACKS).fill(null); // For playback/drawing
let activeTrackIndex = 0;

// --- AUDIO MASTER BUTTONS LOGIC ---

songInput.addEventListener('change', function (e) {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  audio.src = url;
  audio.style.display = 'block';
  audioStatus.textContent = `Loaded: ${file.name}`;
  audio.load();
  logDebug(`Audio file loaded: ${file.name}`);
  audioPlayBtn.style.display = 'inline-block';
  audioPauseBtn.style.display = 'inline-block';
  audioPlayBtn.disabled = false;
  audioPauseBtn.disabled = true;
});

// ==== Play Song button now records webcam for ARMED TRACK and PREVIEWS it ONLY in the correct track preview, never the master output ====
audioPlayBtn.addEventListener('click', async function() {
  const radios = document.querySelectorAll('input[name="selectTrackForRecording"]');
  const armedIndex = Array.from(radios).findIndex(r => r.checked);
  if (armedIndex === -1) {
    alert('Please select a track to record.');
    return;
  }

  let webcamStream;
  try {
    webcamStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  } catch (err) {
    alert("Could not access camera/microphone.");
    return;
  }

  const trackCards = document.querySelectorAll('.track-card');
  const previewVideo = trackCards[armedIndex].querySelector('video');
  previewVideo.srcObject = webcamStream;
  previewVideo.src = "";
  previewVideo.muted = true;
  previewVideo.controls = false;
  previewVideo.play();

  const mediaRecorder = new MediaRecorder(webcamStream, { mimeType: 'video/webm; codecs=vp9,opus' });
  let chunks = [];
  mediaRecorder.ondataavailable = e => e.data.size && chunks.push(e.data);

  mediaRecorder.start();
  audio.currentTime = 0;
  audio.play();

  audioPlayBtn.disabled = true;
  audioPauseBtn.style.display = 'none';
  recIndicator.style.display = 'block';
  isRecording = true;
  updateTimelineClock();

  function stopEverything() {
    if (mediaRecorder.state === "recording") {
      mediaRecorder.stop();
    }
    webcamStream.getTracks().forEach(track => track.stop());
    previewVideo.srcObject = null;
    previewVideo.controls = true;
    previewVideo.muted = true;
    audioPlayBtn.disabled = false;
    recIndicator.style.display = 'none';
    isRecording = false;
    cancelAnimationFrame(animationFrameId);
    timelineClock.textContent = `${formatTime(audio.duration)} / ${formatTime(audio.duration)}`;
  }

  audio.onended = function() {
    stopEverything();
  };

  stopPreviewBtn.onclick = function () {
    if (isRecording) {
      audio.pause();
      stopEverything();
      exportStatus.textContent = 'Recording stopped.';
      logDebug('Recording stopped by user.');
    }
  };

  mediaRecorder.onstop = function() {
    const blob = new Blob(chunks, { type: 'video/webm' });
    videoTracks[armedIndex] = { file: null, url: URL.createObjectURL(blob), name: 'Recorded Webcam Video' };
    prepareTempVideo(armedIndex, videoTracks[armedIndex].url, 'Recorded Webcam Video');
    trackCards[armedIndex].updatePreview();
    updateSwitcherBtns();
    setActiveTrack(armedIndex);
    // After recording, do NOT autoplay the finished take in the main output
    masterOutputVideo.pause();
    masterOutputVideo.srcObject = null;
    masterOutputVideo.src = videoTracks[armedIndex].url;
    masterOutputVideo.load();
    // masterOutputVideo.play().catch(()=>{}); // <-- REMOVE AUTOPLAY
    logDebug(`Webcam recording finished for Camera ${armedIndex + 1}`);
  };
});

audioPauseBtn.addEventListener('click', function() {
  audio.pause();
  audioPlayBtn.disabled = false;
  audioPauseBtn.disabled = true;
});
audio.addEventListener('play', function() {
  audioPlayBtn.disabled = true;
  audioPauseBtn.disabled = false;
});
audio.addEventListener('pause', function() {
  audioPlayBtn.disabled = false;
  audioPauseBtn.disabled = true;
});

// ===== VIDEO TAKES UI WITH PREVIEW =====

function createTrackCard(index) {
  const card = document.createElement('div');
  card.className = 'track-card';

  const radio = document.createElement('input');
  radio.type = 'radio';
  radio.name = 'selectTrackForRecording';
  radio.value = index;
  if (index === 0) radio.checked = true;
  radio.addEventListener('change', updateRecordButtonStates);
  card.appendChild(radio);

  const label = document.createElement('label');
  label.textContent = `Camera ${index + 1}`;
  card.appendChild(label);

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'video/*';
  card.appendChild(input);

  const preview = document.createElement('video');
  preview.className = 'track-preview';
  preview.controls = true;
  preview.style.width = '180px';
  preview.style.height = '100px';
  preview.style.background = '#111';
  preview.style.display = 'block';
  preview.muted = true;
  card.appendChild(preview);

  card.updatePreview = function() {
    if (videoTracks[index] && videoTracks[index].url) {
      preview.srcObject = null;
      preview.src = videoTracks[index].url;
      preview.style.display = 'block';
      preview.controls = true;
      preview.muted = true;
      preview.load();
    } else {
      preview.srcObject = null;
      preview.src = '';
      preview.style.display = 'block';
      preview.poster = '';
    }
  };

  input.addEventListener('change', function (e) {
    handleVideoUpload(index, e.target.files[0]);
    card.updatePreview();
  });

  switcherTracks.appendChild(card);
  card.updatePreview();
}

function updateRecordButtonStates() {
  const radios = document.querySelectorAll('input[name="selectTrackForRecording"]');
  const checked = Array.from(radios).findIndex(r => r.checked);
  if (checked !== -1) setActiveTrack(checked);
}

function handleVideoUpload(index, file) {
  if (!file) return;
  const url = URL.createObjectURL(file);
  videoTracks[index] = { file, url, name: file.name };
  prepareTempVideo(index, url, file.name);
  updateSwitcherBtns();
  if (index === activeTrackIndex) previewInOutput(index);
  logDebug(`Camera ${index + 1} video loaded: ${file.name}`);
}

function prepareTempVideo(idx, url, name = "") {
  tempVideos[idx] = document.createElement('video');
  tempVideos[idx].src = url;
  tempVideos[idx].crossOrigin = "anonymous";
  tempVideos[idx].muted = true;
  tempVideos[idx].preload = "auto";
  tempVideos[idx].setAttribute('playsinline', '');
  tempVideos[idx].setAttribute('webkit-playsinline', '');
  tempVideos[idx].style.display = "none";
  tempVideos[idx].load();
  tempVideos[idx].addEventListener('loadeddata', () => {
    logDebug(`tempVideos[${idx}] loaded: ${name}`);
    if (idx === activeTrackIndex) previewInOutput(idx);
  });
  tempVideos[idx].addEventListener('error', (e) => {
    logDebug(`tempVideos[${idx}] failed to load: ${e.message || e}`);
  });
  if (!tempVideos[idx].parentNode) hiddenVideos.appendChild(tempVideos[idx]);
}

function updateSwitcherBtns() {
  switcherBtnsContainer.innerHTML = '';
  for (let i = 0; i < NUM_TRACKS; i++) {
    const track = videoTracks[i];
    const btn = document.createElement('button');
    btn.className = 'switcher-btn' + (i === activeTrackIndex ? ' active' : '');
    btn.textContent = `Camera ${i + 1}`;
    btn.disabled = !track;
    btn.onclick = function () {
      setActiveTrack(i);
      previewInOutput(i);
      logDebug(`Switched to Camera ${i + 1}`);
    };
    switcherBtnsContainer.appendChild(btn);
  }
}

function setActiveTrack(idx) {
  activeTrackIndex = idx;
  document.querySelectorAll('.track-card').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
  });
  document.querySelectorAll('.switcher-btn').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
  });
  previewInOutput(idx);
}

function previewInOutput(idx) {
  if (isRecording || isPlaying) return;
  masterOutputVideo.pause();
  masterOutputVideo.srcObject = null;
  masterOutputVideo.src = "";
  if (videoTracks[idx] && videoTracks[idx].url) {
    masterOutputVideo.src = videoTracks[idx].url;
    masterOutputVideo.style.display = 'block';
    masterOutputVideo.currentTime = 0;
    masterOutputVideo.load();
    // Do NOT autoplay when previewing
    // masterOutputVideo.play().catch(()=>{});
  }
}

// ===== INIT =====
masterOutputVideo.srcObject = null;
masterOutputVideo.src = "";
for (let i = 0; i < NUM_TRACKS; i++) createTrackCard(i);
updateSwitcherBtns();
masterOutputVideo.style.display = 'block';
exportBtn.disabled = true;

// ===== LIVE MIXING/RECORDING LOGIC =====
function getCurrentDrawVideo() {
  if (tempVideos[activeTrackIndex]) return tempVideos[activeTrackIndex];
  for (let i = 0; i < tempVideos.length; i++) {
    if (tempVideos[i]) return tempVideos[i];
  }
  return null;
}

// === NEW: Fixed FPS draw loop using setInterval ===
let drawIntervalId;
function startFixedFPSDrawLoop(drawFrame) {
  drawIntervalId = setInterval(() => {
    if (!isRecording) return;
    drawFrame();
  }, 1000 / FPS);
}
function stopFixedFPSDrawLoop() {
  clearInterval(drawIntervalId);
}

recordFullEditBtn.addEventListener('click', async function () {
  if (!audio.src) {
    alert('Please upload a song first.');
    logDebug('Attempted to record with no audio uploaded.');
    return;
  }
  if (![...videoTracks].some(Boolean)) {
    alert('Please upload or record at least one video take.');
    logDebug('Attempted to record with no video takes uploaded.');
    return;
  }

  isRecording = true;
  isPlaying = true;
  let recordedChunks = [];
  exportStatus.textContent = '';
  recIndicator.style.display = 'block';
  exportBtn.disabled = true;
  logDebug('Recording started.');

  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 360;
  const ctx = canvas.getContext('2d');

  // Prepare all temp videos for drawing
  for (let i = 0; i < tempVideos.length; i++) {
    if (tempVideos[i]) {
      if (!tempVideos[i].parentNode) hiddenVideos.appendChild(tempVideos[i]);
      try { 
        tempVideos[i].pause(); 
        tempVideos[i].currentTime = 0; 
        tempVideos[i].load(); 
      } catch(e) { 
        logDebug(`Could not reset tempVideo ${i}: ${e.message || e}`); 
      }
    }
  }

  // Wait for all videos to be ready and playing
  for (let i = 0; i < tempVideos.length; i++) {
    if (tempVideos[i]) {
      if (tempVideos[i].readyState < 2) {
        await new Promise(resolve => {
          tempVideos[i].addEventListener('loadeddata', resolve, { once: true });
        });
      }
      try {
        await tempVideos[i].play();
      } catch (err) {
        logDebug(`Error playing tempVideo ${i}: ${err.message || err}`);
      }
    }
  }

  // For smoother output: cache last good frame so we don't draw black unless no frame yet
  const lastGoodFrameCanvas = document.createElement('canvas');
  lastGoodFrameCanvas.width = canvas.width;
  lastGoodFrameCanvas.height = canvas.height;
  const lastGoodFrameCtx = lastGoodFrameCanvas.getContext('2d');
  let hasGoodFrame = false;

  // Diagnostics for draw FPS
  let lastDrawTime = performance.now();
  let frameCount = 0;

  // Canvas mix draw loop - using setInterval for fixed FPS
  const FADE_DURATION = 1.5; // seconds

  function drawFrame() {
    if (!isRecording) return;

    frameCount++;
    if (frameCount % 30 === 0) {
      const now = performance.now();
      logDebug(`Draw FPS: ${(1000 * frameCount / (now - lastDrawTime)).toFixed(2)}`);
      frameCount = 0;
      lastDrawTime = now;
    }

    const vid = getCurrentDrawVideo();
    const audioTime = audio.currentTime;

    // Always sync video to audio time
    let drewVideoFrame = false;

    if (
      vid &&
      vid.readyState >= 2 &&
      !vid.paused &&
      !vid.ended &&
      vid.currentTime > 0 &&
      vid.currentTime < vid.duration
    ) {
      if (Math.abs(vid.currentTime - audioTime) > 0.04) {
        try { vid.currentTime = audioTime; } catch (e) {}
      }
      ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
      lastGoodFrameCtx.drawImage(vid, 0, 0, lastGoodFrameCanvas.width, lastGoodFrameCanvas.height);
      hasGoodFrame = true;
      drewVideoFrame = true;
    } else if (hasGoodFrame) {
      ctx.drawImage(lastGoodFrameCanvas, 0, 0, canvas.width, canvas.height);
      drewVideoFrame = true;
    } else {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Fade in/out
    if (audioTime < FADE_DURATION) {
      let alpha = 1 - (audioTime / FADE_DURATION);
      ctx.fillStyle = `rgba(0,0,0,${alpha})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (audio.duration && audioTime > audio.duration - FADE_DURATION) {
      let alpha = (audioTime - (audio.duration - FADE_DURATION)) / FADE_DURATION;
      ctx.fillStyle = `rgba(0,0,0,${alpha})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  // Use FPS everywhere captureStream is called
  const livePreviewStream = canvas.captureStream(FPS);

  try {
    masterOutputVideo.srcObject = livePreviewStream;
    masterOutputVideo.src = "";
    masterOutputVideo.play();
  } catch (e) {
    logDebug("Live preview error: " + e.message);
  }

  // Switcher buttons live update
  switcherBtnsContainer.querySelectorAll('.switcher-btn').forEach((btn, idx) => {
    btn.onclick = function() {
      setActiveTrack(idx);
      const vid = getCurrentDrawVideo();
      if (vid && vid.paused) {
        vid.play().catch(()=>{});
      }
    };
  });

  let audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const source = audioContext.createMediaElementSource(audio);
  const dest = audioContext.createMediaStreamDestination();
  source.connect(dest);
  source.connect(audioContext.destination);

  // Build combinedStream with the chosen FPS
  const canvasStream = canvas.captureStream(FPS);
  const combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...dest.stream.getAudioTracks()
  ]);

  // Add videoBitsPerSecond for higher quality and better timing
  let mediaRecorder = new MediaRecorder(combinedStream, {
    mimeType: 'video/webm; codecs=vp9,opus',
    videoBitsPerSecond: 5000000 // 5Mbps, adjust if needed
    // frameRate: FPS // You can try this if your browser supports it, but it's not standard
  });

  mediaRecorder.ondataavailable = function(e) {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };
  mediaRecorder.onstop = function() {
    stopFixedFPSDrawLoop();
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    // Clean up old object URL if any
    if (masterOutputVideo.src && masterOutputVideo.src.startsWith('blob:')) {
      URL.revokeObjectURL(masterOutputVideo.src);
    }
    masterOutputVideo.src = URL.createObjectURL(blob);
    masterOutputVideo.srcObject = null;
    masterOutputVideo.controls = true;
    masterOutputVideo.style.display = 'block';
    recIndicator.style.display = 'none';
    exportBtn.disabled = false;
    isRecording = false;
    isPlaying = false;
    exportStatus.textContent = 'Recording finished! Preview your cut below.';
    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }
    logDebug('Recording stopped. Video ready for export.');
  };

  audio.currentTime = 0;
  audio.play().catch((err) => {
    logDebug('Audio play error: ' + err.message);
    alert('Unable to start audio playback. Please interact with the page first (e.g., click on the page) then try again.');
  });

  mediaRecorder.start();

  // Start fixed FPS draw loop!
  startFixedFPSDrawLoop(drawFrame);

  audio.onended = function () {
    if (isRecording && mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      audio.onended = null;
      logDebug('Audio ended, stopping recording.');
    }
  };

  stopPreviewBtn.onclick = function () {
    if (isRecording && mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      audio.pause();
      recIndicator.style.display = 'none';
      exportStatus.textContent = 'Recording stopped.';
      logDebug('Recording stopped by user.');
    }
  };
});

// ===== EXPORT =====
exportBtn.addEventListener('click', function () {
  if (!masterOutputVideo.src) {
    exportStatus.textContent = 'Nothing to export yet!';
    logDebug('Export attempted but no video available.');
    return;
  }
  fetch(masterOutputVideo.src)
    .then(res => res.blob())
    .then(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'fastcut-studios-edit.webm';
      a.click();
      exportStatus.textContent = 'Video exported – check your downloads!';
      logDebug('Video exported.');
    });
});
