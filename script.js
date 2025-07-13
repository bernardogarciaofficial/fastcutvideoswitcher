// Fastcut Two Channels Music Video Maker
// Author: Bernardo Garcia

const NUM_TRACKS = 2;

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

// Update the timeline clock every animation frame when playing or recording
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
  requestAnimationFrame(updateTimelineClock);
}

// Start updating the clock when preview/recording starts
audio.addEventListener('play', () => requestAnimationFrame(updateTimelineClock));
masterOutputVideo.addEventListener('play', () => requestAnimationFrame(updateTimelineClock));

// Reset clock when stopped
audio.addEventListener('pause', () => timelineClock.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`);
masterOutputVideo.addEventListener('pause', () => timelineClock.textContent = `${formatTime(masterOutputVideo.currentTime)} / ${formatTime(masterOutputVideo.duration)}`);

// Initial clock value
timelineClock.textContent = '00:00 / 00:00';
function logDebug(msg) {
  if (debuglog) {
    debuglog.textContent += msg + "\n";
    debuglog.scrollTop = debuglog.scrollHeight;
  }
  console.log(msg);
}

const videoTracks = Array(NUM_TRACKS).fill(null);
const tempVideos = Array(NUM_TRACKS).fill(null); // For playback/drawing
let activeTrackIndex = 0;
let isRecording = false;
let isPlaying = false;
let mediaRecorder = null;
let recordedChunks = [];
let animationFrameId = null;
let audioContext = null;
let livePreviewStream = null;
let webcamStreams = Array(NUM_TRACKS).fill(null); // For previewing webcams per track

// --- AUDIO MASTER BUTTONS LOGIC ---

// On song upload, show Play/Pause buttons
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

// Play Song
audioPlayBtn.addEventListener('click', function() {
  audio.play();
  audioPlayBtn.disabled = true;
  audioPauseBtn.disabled = false;
});

// Pause Song
audioPauseBtn.addEventListener('click', function() {
  audio.pause();
  audioPlayBtn.disabled = false;
  audioPauseBtn.disabled = true;
});

// Keep buttons in sync with audio state
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

  // RADIO BUTTON TO SELECT TRACK FOR RECORDING
  const radio = document.createElement('input');
  radio.type = 'radio';
  radio.name = 'selectTrackForRecording';
  radio.value = index;
  // Default to track 0 armed
  if (index === 0) radio.checked = true;
  radio.addEventListener('change', updateRecordButtonStates);
  card.appendChild(radio);

  // LABEL
  const label = document.createElement('label');
  label.textContent = `Camera ${index + 1}`;
  card.appendChild(label);

  // REMOVE per-track Record Button
  // Instead, add "Preview Webcam" button for live preview only
  const previewBtn = document.createElement('button');
  previewBtn.className = 'preview-btn';
  previewBtn.textContent = 'Preview Webcam';
  card.appendChild(previewBtn);

  // UPLOAD BUTTON
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'video/*';
  card.appendChild(input);

  // VIDEO PREVIEW
  const preview = document.createElement('video');
  preview.className = 'track-preview';
  preview.controls = true;
  preview.style.width = '180px';
  preview.style.height = '100px';
  preview.style.background = '#111';
  preview.style.display = 'block';
  preview.muted = true;
  card.appendChild(preview);

  // Update preview when a video is loaded/uploaded
  card.updatePreview = function() {
    if (webcamStreams[index]) {
      preview.srcObject = webcamStreams[index];
      preview.muted = true;
      preview.controls = false;
      preview.style.display = 'block';
      if (preview.paused) preview.play().catch(()=>{});
    } else if (videoTracks[index] && videoTracks[index].url) {
      preview.srcObject = null;
      preview.src = videoTracks[index].url;
      preview.style.display = 'block';
      preview.controls = true;
      preview.muted = true;
      preview.load();
    } else {
      preview.src = '';
      preview.srcObject = null;
      preview.style.display = 'block'; // Always visible!
      preview.poster = '';
    }
  };

  // Webcam preview logic
  previewBtn.addEventListener('click', function() {
    if (webcamStreams[index]) {
      // Stop preview
      webcamStreams[index].getTracks().forEach(t=>t.stop());
      webcamStreams[index] = null;
      card.updatePreview();
      previewBtn.textContent = "Preview Webcam";
      return;
    }
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
      webcamStreams[index] = stream;
      card.updatePreview();
      previewBtn.textContent = "Stop Webcam";
    }).catch((err) => {
      alert("Could not access camera/microphone.");
      logDebug("getUserMedia error: " + (err.message || err));
    });
  });

  // UPLOAD BUTTON event
  input.addEventListener('change', function (e) {
    handleVideoUpload(index, e.target.files[0]);
    card.updatePreview();
  });

  switcherTracks.appendChild(card);
  card.updatePreview();
}

// Helper: Update which track is armed for recording
function updateRecordButtonStates() {
  const radios = document.querySelectorAll('input[name="selectTrackForRecording"]');
  // Also update activeTrackIndex for preview logic
  const checked = Array.from(radios).findIndex(r => r.checked);
  if (checked !== -1) setActiveTrack(checked);
}

// Helper: Handle video file upload for one track
function handleVideoUpload(index, file) {
  if (!file) return;
  const url = URL.createObjectURL(file);
  videoTracks[index] = { file, url, name: file.name };
  prepareTempVideo(index, url, file.name);
  updateSwitcherBtns();
  if (index === activeTrackIndex) previewInOutput(index);
  logDebug(`Camera ${index + 1} video loaded: ${file.name}`);
}

// Helper: Prepare hidden video for playback
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
    btn.disabled = !track && !webcamStreams[i];
    btn.addEventListener('click', function () {
      setActiveTrack(i);
      logDebug(`Switched to Camera ${i + 1}`);
    });
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
  // If we are recording, the output video is showing the canvas stream.
  if (isRecording || isPlaying) return;
  if (videoTracks[idx]) {
    masterOutputVideo.srcObject = null;
    masterOutputVideo.src = videoTracks[idx].url;
    masterOutputVideo.style.display = 'block';
    masterOutputVideo.currentTime = 0;
  } else if (webcamStreams[idx]) {
    masterOutputVideo.src = "";
    masterOutputVideo.srcObject = webcamStreams[idx];
    masterOutputVideo.style.display = 'block';
  }
}

// ===== INIT =====
for (let i = 0; i < NUM_TRACKS; i++) createTrackCard(i);
updateSwitcherBtns();
masterOutputVideo.style.display = 'block';
exportBtn.disabled = true;

// ===== LIVE MIXING/RECORDING LOGIC =====
function getCurrentDrawVideo() {
  // If webcam is armed for this track, use live webcam
  if (webcamStreams[activeTrackIndex]) {
    // Create a hidden <video> element for drawing (one per armed webcam)
    if (!webcamStreams[activeTrackIndex].__videoEl) {
      const videoEl = document.createElement('video');
      videoEl.style.display = "none";
      videoEl.muted = true;
      videoEl.autoplay = true;
      videoEl.playsInline = true;
      videoEl.srcObject = webcamStreams[activeTrackIndex];
      hiddenVideos.appendChild(videoEl);
      webcamStreams[activeTrackIndex].__videoEl = videoEl;
      // Play the webcam video element
      videoEl.play().catch(()=>{});
    }
    return webcamStreams[activeTrackIndex].__videoEl;
  }
  if (tempVideos[activeTrackIndex]) return tempVideos[activeTrackIndex];
  for (let i = 0; i < tempVideos.length; i++) {
    if (tempVideos[i]) return tempVideos[i];
  }
  return null;
}

recordFullEditBtn.addEventListener('click', async function () {
  if (!audio.src) {
    alert('Please upload a song first.');
    logDebug('Attempted to record with no audio uploaded.');
    return;
  }
  // Only allow if at least one video track or webcam is available
  if (![...videoTracks, ...webcamStreams].some(Boolean)) {
    alert('Please upload, record, or arm at least one video take.');
    logDebug('Attempted to record with no video takes uploaded.');
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

  // Prepare tempVideos
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
  let currentVideo = getCurrentDrawVideo();
  if (!currentVideo) {
    alert('Please upload or arm at least one video take.');
    isRecording = false; isPlaying = false; recIndicator.style.display = 'none';
    logDebug('No tempVideos or webcam available for drawing.');
    return;
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

  // Try to play all tempVideos and webcam preview videos
  for (let i = 0; i < tempVideos.length; i++) {
    if (tempVideos[i]) {
      try {
        tempVideos[i].currentTime = 0;
        await tempVideos[i].play();
        logDebug(`Playing tempVideo ${i}`);
      } catch (err) {
        logDebug(`Error playing tempVideo ${i}: ${err.message || err}`);
      }
    }
  }
  for (let i = 0; i < webcamStreams.length; i++) {
    if (webcamStreams[i] && webcamStreams[i].__videoEl) {
      try { await webcamStreams[i].__videoEl.play(); } catch(e){}
    }
  }

  // Fade-in/out config
  const FADE_DURATION = 1.5; // seconds

  function drawFrame() {
    if (!isRecording) return;
    const vid = getCurrentDrawVideo();
    const audioTime = audio.currentTime;
    if (vid && !vid.ended && vid.readyState >= 2) {
      // Seek the video to match audio timeline for uploaded/recorded videos
      if (vid.srcObject === null && Math.abs(vid.currentTime - audioTime) > 0.04) {
        vid.currentTime = audioTime;
      }
      ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    // Fade-in/out logic
    if (audioTime < FADE_DURATION) {
      let alpha = 1 - (audioTime / FADE_DURATION);
      ctx.fillStyle = `rgba(0,0,0,${alpha})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (audio.duration && audioTime > audio.duration - FADE_DURATION) {
      let alpha = (audioTime - (audio.duration - FADE_DURATION)) / FADE_DURATION;
      ctx.fillStyle = `rgba(0,0,0,${alpha})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    animationFrameId = requestAnimationFrame(drawFrame);
  }
  drawFrame();

  // Live preview in main output video
  try {
    livePreviewStream = canvas.captureStream(30);
    masterOutputVideo.srcObject = livePreviewStream;
    masterOutputVideo.src = "";
    masterOutputVideo.play();
  } catch (e) {
    logDebug("Live preview error: " + e.message);
  }

  switcherBtnsContainer.querySelectorAll('.switcher-btn').forEach((btn, idx) => {
    btn.onclick = function() {
      setActiveTrack(idx);
      const vid = getCurrentDrawVideo();
      if (vid) {
        vid.play()
          .then(() => {
            logDebug(`Switched & played video ${idx}`);
          })
          .catch(err => {
            logDebug(`Error playing video after switch ${idx}: ${err.message || err}`);
          });
      }
    };
  });

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

  // Start all webcam preview videos if any
  for (let i = 0; i < webcamStreams.length; i++) {
    if (webcamStreams[i] && webcamStreams[i].__videoEl) {
      webcamStreams[i].__videoEl.currentTime = 0;
      try { webcamStreams[i].__videoEl.play(); } catch(e){}
    }
  }

  audio.currentTime = 0;
  audio.play().catch((err) => {
    logDebug('Audio play error: ' + err.message);
    alert('Unable to start audio playback. Please interact with the page first (e.g., click on the page) then try again.');
  });

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
