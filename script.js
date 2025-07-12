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
let livePreviewStream = null;  // for live canvas preview

// ===== SONG UPLOAD =====
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

// ===== VIDEO TAKES UI (new, simplified) =====

function createTrackCard(index) {
  const card = document.createElement('div');
  card.className = 'track-card';

  // RADIO BUTTON TO SELECT TRACK FOR RECORDING
  const radio = document.createElement('input');
  radio.type = 'radio';
  radio.name = 'selectTrackForRecording';
  radio.value = index;
  if (index === 0) radio.checked = true; // Default to first track selected
  radio.addEventListener('change', function() {
    updateRecordButtonStates();
  });
  card.appendChild(radio);

  // LABEL
  const label = document.createElement('label');
  label.textContent = `Camera ${index + 1}`;
  card.appendChild(label);

  // RECORD BUTTON
  const recordBtn = document.createElement('button');
  recordBtn.className = 'record-btn';
  recordBtn.textContent = 'Record';
  recordBtn.disabled = !radio.checked;
  recordBtn.addEventListener('click', function() {
    startRecordingForTrack(index);
  });
  card.appendChild(recordBtn);

  // UPLOAD BUTTON
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'video/*';
  input.addEventListener('change', function (e) {
    handleVideoUpload(index, e.target.files[0]);
  });
  card.appendChild(input);

  switcherTracks.appendChild(card);
}

// Helper: Update which record button is enabled
function updateRecordButtonStates() {
  const radios = document.querySelectorAll('input[name="selectTrackForRecording"]');
  const recordBtns = document.querySelectorAll('.track-card .record-btn');
  radios.forEach((radio, idx) => {
    if (recordBtns[idx]) recordBtns[idx].disabled = !radio.checked;
  });
  // Also update activeTrackIndex for preview logic
  const checked = Array.from(radios).findIndex(r => r.checked);
  if (checked !== -1) setActiveTrack(checked);
}

// Helper: Start recording video for one track (simple webcam logic)
function startRecordingForTrack(index) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert("Camera/microphone not available.");
    return;
  }
  logDebug(`Start recording for track ${index + 1}`);
  // We'll make a simple video recording and store it as a Blob
  navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9,opus' });
      const chunks = [];
      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        videoTracks[index] = { file: null, url, name: `Camera${index + 1}-recorded.webm`, recordedBlob: blob };
        prepareTempVideo(index, url, `Camera${index + 1}-recorded.webm`);
        updateSwitcherBtns();
        if (index === activeTrackIndex) previewInOutput(index);
        logDebug(`Camera ${index + 1} - video recorded and loaded.`);
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.start();
      alert("Recording started. Click OK to stop.");
      mediaRecorder.stop();
    })
    .catch(() => {
      alert("Could not access camera/microphone.");
    });
}

// Helper: Handle video file upload for one track (stub)
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
  if (!videoTracks[idx]) return;
  masterOutputVideo.srcObject = null;
  masterOutputVideo.src = videoTracks[idx].url;
  masterOutputVideo.style.display = 'block';
  masterOutputVideo.currentTime = 0;
}

// ===== INIT =====
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

  // Ensure tempVideos are loaded and ready
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
    alert('Please upload or record at least one video take.');
    isRecording = false; isPlaying = false; recIndicator.style.display = 'none';
    logDebug('No tempVideos available for drawing.');
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

  // Try to play all tempVideos
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

  // Also play the currentVideo again to be sure
  try {
    await currentVideo.play();
  } catch (e) {
    logDebug(`Error playing initial currentVideo: ${e.message || e}`);
  }

  // Fade-in/out config
  const FADE_DURATION = 1.5; // seconds

  function drawFrame() {
    if (!isRecording) return;
    const vid = getCurrentDrawVideo();
    if (vid && !vid.ended && vid.readyState >= 2) {
      ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    // Fade-in/out logic
    const currentTime = audio.currentTime;
    const totalDuration = audio.duration || (audio.seekable && audio.seekable.length ? audio.seekable.end(0) : 0);
    if (currentTime < FADE_DURATION) {
      // Fade in
      let alpha = 1 - (currentTime / FADE_DURATION);
      ctx.fillStyle = `rgba(0,0,0,${alpha})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (totalDuration && currentTime > totalDuration - FADE_DURATION) {
      // Fade out
      let alpha = (currentTime - (totalDuration - FADE_DURATION)) / FADE_DURATION;
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
            logDebug(`Switched & played tempVideo ${idx}`);
          })
          .catch(err => {
            logDebug(`Error playing tempVideo after switch ${idx}: ${err.message || err}`);
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

  audio.currentTime = 0;
  audio.play();
  // Play all tempVideos again to be sure
  for (let i = 0; i < tempVideos.length; i++) {
    if (tempVideos[i]) { 
      try { 
        tempVideos[i].currentTime = 0; 
        await tempVideos[i].play(); 
      } catch(e) { 
        logDebug(`Could not play tempVideo ${i}: ${e.message || e}`);
      }
    }
  }
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
