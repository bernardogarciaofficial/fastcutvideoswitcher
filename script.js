// FASTCUT STUDIOS - Hollywood Music Video Editor (Smooth, Perfect Sync Edition)
// Author: Bernardo Garcia

const NUM_TRACKS = 6;
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

function logDebug(msg) {
  if (debuglog) {
    debuglog.textContent += msg + "\n";
    debuglog.scrollTop = debuglog.scrollHeight;
  }
  console.log(msg);
}

const videoTracks = Array(NUM_TRACKS).fill(null);
const tempVideos = Array(NUM_TRACKS).fill(null); // Hidden, preloaded, synced
let activeTrackIndex = 0;
let isRecording = false;
let isPlaying = false;
let mediaRecorder = null;
let recordedChunks = [];
let animationFrameId = null;
let audioContext = null;
let livePreviewStream = null;

// ========== SONG UPLOAD ==========
songInput.addEventListener('change', function (e) {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  audio.src = url;
  audio.style.display = 'block';
  audioStatus.textContent = `Loaded: ${file.name}`;
  audio.load();
  logDebug(`Audio file loaded: ${file.name}`);
});

// ========== VIDEO UPLOAD/RECORD/THUMBNAIL UI ==========
function createTrackCard(index) {
  const card = document.createElement('div');
  card.className = 'switcher-track';
  if (index === 0) card.classList.add('active');
  card.style.border = '2px solid #e63946';
  card.style.marginBottom = '16px';
  card.style.padding = '10px';

  const title = document.createElement('div');
  title.className = 'track-title';
  title.textContent = `Camera ${index + 1}`;
  card.appendChild(title);

  // Upload button
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'video/*';
  input.style.margin = '6px 0';
  input.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    videoTracks[index] = { file, url, name: file.name };
    prepareTempVideo(index, url, file.name);
    card.update();
    updateSwitcherBtns();
    if (index === activeTrackIndex) previewInOutput(index);
    logDebug(`Camera ${index + 1} video loaded: ${file.name}`);
  });
  card.appendChild(input);

  // Record button
  const recBtn = document.createElement('button');
  recBtn.textContent = 'Record';
  recBtn.style.marginLeft = '8px';
  let trackRecorder = null;
  let recStream = null;
  let recChunks = [];
  const stopRecBtn = document.createElement('button');
  stopRecBtn.textContent = 'Stop';
  stopRecBtn.style.marginLeft = '8px';
  stopRecBtn.style.display = 'none';
  card.appendChild(recBtn);
  card.appendChild(stopRecBtn);

  recBtn.addEventListener('click', async function () {
    if (trackRecorder && trackRecorder.state === 'recording') return;
    recBtn.disabled = true;
    recBtn.textContent = 'Recording...';
    stopRecBtn.style.display = '';
    const preview = card.querySelector('.track-preview');
    preview.style.display = 'block';

    try {
      recStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch (err) {
      alert('Cannot access camera/microphone.');
      recBtn.disabled = false;
      recBtn.textContent = 'Record';
      stopRecBtn.style.display = 'none';
      logDebug(`Camera ${index + 1} - access denied to webcam/mic.`);
      return;
    }
    trackRecorder = new MediaRecorder(recStream, { mimeType: 'video/webm; codecs=vp9,opus' });
    recChunks = [];
    preview.srcObject = recStream;
    preview.muted = true;
    preview.autoplay = true;
    preview.loop = false;
    preview.play().catch(()=>{});
    trackRecorder.ondataavailable = function(e) {
      if (e.data.size > 0) recChunks.push(e.data);
    };
    trackRecorder.onstop = function() {
      const blob = new Blob(recChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      videoTracks[index] = { file: null, url, name: `Camera${index+1}-take.webm`, recordedBlob: blob };
      prepareTempVideo(index, url, `Camera${index+1}-take.webm`);
      preview.srcObject = null;
      preview.src = url;
      preview.autoplay = false;
      preview.muted = true;
      preview.loop = false;
      preview.load();
      card.update();
      updateSwitcherBtns();
      stopRecBtn.style.display = 'none';
      recBtn.disabled = false;
      recBtn.textContent = 'Record';
      if (recStream) recStream.getTracks().forEach(track => track.stop());
      logDebug(`Camera ${index + 1} - video recorded and loaded.`);
      if (!isRecording) {
        audio.pause();
        audio.currentTime = 0;
      }
    };
    if (audio.src) {
      audio.currentTime = 0;
      audio.volume = 0.4;
      audio.play().catch(()=>{});
      logDebug("Song playback started for camera take recording.");
    }
    trackRecorder.start();
  });

  stopRecBtn.addEventListener('click', function() {
    if (trackRecorder && trackRecorder.state === 'recording') {
      trackRecorder.stop();
      stopRecBtn.style.display = 'none';
      recBtn.disabled = false;
      recBtn.textContent = 'Record';
    }
  });

  // Download button
  const dlBtn = document.createElement('button');
  dlBtn.textContent = 'Download';
  dlBtn.style.marginLeft = '8px';
  dlBtn.style.display = 'none';
  dlBtn.addEventListener('click', function() {
    if (videoTracks[index] && videoTracks[index].url) {
      const a = document.createElement('a');
      a.href = videoTracks[index].url;
      a.download = videoTracks[index].name || `track${index+1}.webm`;
      a.click();
      logDebug(`Camera ${index + 1} take downloaded.`);
    }
  });
  card.appendChild(dlBtn);

  // Video preview (thumbnail)
  const preview = document.createElement('video');
  preview.className = 'track-preview';
  preview.controls = true;
  preview.style.display = 'block';
  preview.style.background = "#000";
  preview.style.width = '80%';
  preview.style.marginTop = '6px';
  preview.autoplay = false;
  preview.muted = true;
  preview.loop = false;
  preview.playsInline = true;
  card.appendChild(preview);

  preview.addEventListener('error', (e) => {
    logDebug(`Preview video for Camera ${index+1} error: (code ${preview.error && preview.error.code})`);
    let msg = "Unknown error";
    if (preview.error) {
      switch (preview.error.code) {
        case 1: msg = "MEDIA_ERR_ABORTED: Video fetching process aborted by user."; break;
        case 2: msg = "MEDIA_ERR_NETWORK: Error occurred when downloading."; break;
        case 3: msg = "MEDIA_ERR_DECODE: Error occurred when decoding."; break;
        case 4: msg = "MEDIA_ERR_SRC_NOT_SUPPORTED: Video format is not supported."; break;
      }
    }
    logDebug(`Camera ${index+1} thumbnail: ${msg}`);
    preview.poster = "";
    preview.style.background = "#900";
  });
  preview.addEventListener('loadeddata', () => {
    logDebug(`Preview video for Camera ${index+1} loaded: ${preview.src}`);
    preview.style.background = "#000";
  });

  // Status label
  const label = document.createElement('div');
  label.className = 'upload-video-label';
  label.textContent = 'No video uploaded or recorded';
  card.appendChild(label);

  card.update = function () {
    if (videoTracks[index]) {
      label.textContent = videoTracks[index].name || 'Recorded Take';
      dlBtn.style.display = '';
      preview.srcObject = null;
      preview.src = videoTracks[index].url;
      preview.autoplay = false;
      preview.muted = true;
      preview.loop = false;
      preview.load();
    } else {
      label.textContent = 'No video uploaded or recorded';
      dlBtn.style.display = 'none';
      preview.srcObject = null;
      preview.src = '';
      preview.style.display = 'block';
      preview.poster = "";
      preview.style.background = "#000";
    }
  };

  card.addEventListener('click', function () {
    setActiveTrack(index);
  });

  switcherTracks.appendChild(card);
  card.update();
}

function prepareTempVideo(idx, url, name = "") {
  tempVideos[idx] = document.createElement('video');
  let el = tempVideos[idx];
  el.src = url;
  el.crossOrigin = "anonymous";
  el.muted = true;
  el.preload = "auto";
  el.setAttribute('playsinline', '');
  el.setAttribute('webkit-playsinline', '');
  el.style.display = "none";
  el.load();
  el.addEventListener('loadeddata', () => {
    logDebug(`tempVideos[${idx}] loaded: ${name}`);
  });
  el.addEventListener('error', (e) => {
    logDebug(`tempVideos[${idx}] failed to load: ${e.message || e}`);
  });
  if (!el.parentNode) hiddenVideos.appendChild(el);
}

// ========== SWITCHER BUTTONS ==========
function updateSwitcherBtns() {
  switcherBtnsContainer.innerHTML = '';
  for (let i = 0; i < NUM_TRACKS; i++) {
    const track = videoTracks[i];
    const btn = document.createElement('button');
    btn.className = 'switcher-btn' + (i === activeTrackIndex ? ' active' : '');
    btn.textContent = `Camera ${i + 1}`;
    btn.disabled = !track;
    btn.addEventListener('click', function () {
      setActiveTrack(i);
      logDebug(`Switched to Camera ${i + 1}`);
    });
    switcherBtnsContainer.appendChild(btn);
  }
}

function setActiveTrack(idx) {
  activeTrackIndex = idx;
  document.querySelectorAll('.switcher-track').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
  });
  document.querySelectorAll('.switcher-btn').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
  });

  if (isRecording || isPlaying) {
    synchronizeVideosToAudio();
  } else {
    previewInOutput(idx);
  }
}

// The core of smooth, flawless synchronization
function synchronizeVideosToAudio() {
  const syncTime = audio.currentTime;
  // Pause all videos, sync time
  tempVideos.forEach((v, i) => {
    if (v) {
      v.pause();
      // Seek time, but only if it's not in the "ended" state
      if (syncTime < v.duration - 0.1) {
        v.currentTime = syncTime;
      } else {
        v.currentTime = v.duration - 0.05;
      }
    }
  });
  // Only play the new active video
  const vid = tempVideos[activeTrackIndex];
  if (vid) {
    vid.currentTime = syncTime;
    vid.play().catch(()=>{});
  }
}

function previewInOutput(idx) {
  if (isRecording || isPlaying) return;
  if (!videoTracks[idx]) return;
  masterOutputVideo.srcObject = null;
  masterOutputVideo.src = videoTracks[idx].url;
  masterOutputVideo.style.display = 'block';
  masterOutputVideo.currentTime = 0;
  masterOutputVideo.play().catch(()=>{});
}

// ========== INIT ==========
for (let i = 0; i < NUM_TRACKS; i++) createTrackCard(i);
updateSwitcherBtns();
masterOutputVideo.style.display = 'block';
exportBtn.disabled = true;

// ========== LIVE RECORDING LOGIC ==========
function getCurrentDrawVideo() {
  return tempVideos[activeTrackIndex] || tempVideos.find(v=>v) || null;
}

let lastDrawnTime = -1;
function drawFrame(canvas, ctx) {
  if (!isRecording) return;
  const vid = getCurrentDrawVideo();
  // If video is not ready, just fill with black
  if (!(vid && vid.readyState >= 2 && !vid.ended)) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    // If the video is not exactly at the audio time, sync it
    let diff = Math.abs(vid.currentTime - audio.currentTime);
    if (diff > 0.05) {
      vid.currentTime = audio.currentTime;
    }
    ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
  }
  animationFrameId = requestAnimationFrame(() => drawFrame(canvas, ctx));
}

// ========== RECORD ACTION ==========
recordFullEditBtn.addEventListener('click', async function () {
  if (!audio.src) {
    alert('Please upload a song first.');
    logDebug('Attempted to record with no audio uploaded.');
    return;
  }
  if (!videoTracks.some(Boolean)) {
    alert('Please upload or record at least one video take.');
    logDebug('Attempted to record with no video takes uploaded.');
    return;
  }
  if (!tempVideos[activeTrackIndex]) {
    alert('Selected camera has no video.');
    logDebug('Attempted to record with no video in active camera.');
    return;
  }

  isRecording = true;
  isPlaying = true;
  recordedChunks = [];
  exportStatus.textContent = '';
  recIndicator.style.display = 'block';
  exportBtn.disabled = true;
  logDebug('Recording started.');

  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 360;
  const ctx = canvas.getContext('2d');

  // Ensure all temp videos are loaded & sync
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

  // Wait for all tempVideos to be loaded before playing
  for (let i = 0; i < tempVideos.length; i++) {
    if (tempVideos[i]) {
      if (tempVideos[i].readyState < 2) {
        await new Promise(resolve => {
          tempVideos[i].addEventListener('loadeddata', resolve, { once: true });
        });
      }
    }
  }

  synchronizeVideosToAudio();

  // Draw loop: always draw the active, synced video
  drawFrame(canvas, ctx);

  // Live preview in main output video
  try {
    livePreviewStream = canvas.captureStream(30);
    masterOutputVideo.srcObject = livePreviewStream;
    masterOutputVideo.src = "";
    masterOutputVideo.play();
  } catch (e) {
    logDebug("Live preview error: " + e.message);
  }

  // Camera switching: instant, synced
  switcherBtnsContainer.querySelectorAll('.switcher-btn').forEach((btn, idx) => {
    btn.onclick = function() {
      setActiveTrack(idx);
      synchronizeVideosToAudio();
    };
  });

  // Audio context for audio recording
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
    masterOutputVideo.src = URL.createObjectURL(blob);
    masterOutputVideo.srcObject = null;
    masterOutputVideo.controls = true;
    masterOutputVideo.style.display = 'block';
    recIndicator.style.display = 'none';
    exportBtn.disabled = false;
    isRecording = false;
    isPlaying = false;
    livePreviewStream = null;
    exportStatus.textContent = 'Recording finished! Preview your cut below.';
    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }
    logDebug('Recording stopped. Video ready for export.');
  };

  audio.currentTime = 0;
  audio.play();
  synchronizeVideosToAudio();
  mediaRecorder.start();

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

// ========== EXPORT ==========
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
