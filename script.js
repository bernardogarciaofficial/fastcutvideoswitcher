// FASTCUT STUDIOS - Hollywood Music Video Editor
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

// THUMBNAIL GRID (6 preview video screens)
function createThumbRow() {
  let thumbRow = document.getElementById('thumbRow');
  if (!thumbRow) {
    thumbRow = document.createElement('div');
    thumbRow.id = 'thumbRow';
    thumbRow.style.display = 'flex';
    thumbRow.style.flexWrap = 'wrap';
    thumbRow.style.justifyContent = 'space-between';
    thumbRow.style.marginBottom = '24px';
    switcherTracks.parentNode.insertBefore(thumbRow, switcherTracks);
  } else {
    thumbRow.innerHTML = '';
  }
  for (let i = 0; i < NUM_TRACKS; i++) {
    const col = document.createElement('div');
    col.className = 'thumb-col';
    col.style.width = '16%';
    col.style.margin = '0 0.5% 12px 0.5%';
    col.style.boxSizing = 'border-box';
    col.style.border = '2px solid #333';
    col.style.background = '#111';
    col.style.borderRadius = '8px';
    col.style.overflow = 'hidden';

    // Thumbnail video
    const video = document.createElement('video');
    video.className = 'thumb';
    video.id = 'thumb' + i;
    video.muted = true;
    video.playsInline = true;
    video.style.width = '100%';
    video.style.height = 'auto';
    video.style.background = '#000';
    video.controls = false;
    video.style.cursor = 'pointer';
    col.appendChild(video);

    // Label
    const label = document.createElement('div');
    label.style.textAlign = 'center';
    label.style.color = '#ccc';
    label.style.fontSize = '0.95em';
    label.style.padding = '2px 0 7px 0';
    label.textContent = `Camera ${i + 1}`;
    col.appendChild(label);

    // Click to select
    video.onclick = () => setActiveTrack(i);

    thumbRow.appendChild(col);
  }
}
createThumbRow();

function updateThumbVideos() {
  for (let i = 0; i < NUM_TRACKS; i++) {
    const thumb = document.getElementById('thumb' + i);
    if (thumb && window.videoTracks && window.videoTracks[i]) {
      thumb.src = window.videoTracks[i].url;
      thumb.style.background = '#000';
      thumb.load();
    } else if (thumb) {
      thumb.src = '';
      thumb.style.background = '#222';
    }
  }
}

// Rest of your code...
function logDebug(msg) {
  debuglog.textContent += msg + "\n";
  debuglog.scrollTop = debuglog.scrollHeight;
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

// ===== VIDEO TAKES UPLOAD, RECORD, DOWNLOAD & UI =====
function createTrackCard(index) {
  const card = document.createElement('div');
  card.className = 'switcher-track';
  if (index === 0) card.classList.add('active');
  card.style.border = '2px solid #222'; card.style.marginBottom = '16px'; card.style.padding = '10px';

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
    updateThumbVideos();
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
  recBtn.addEventListener('click', async function () {
    if (trackRecorder && trackRecorder.state === 'recording') return; // Already recording

    recBtn.disabled = true;
    recBtn.textContent = 'Recording...';
    const preview = card.querySelector('.track-preview');
    preview.style.display = 'block';

    try {
      recStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch (err) {
      alert('Cannot access camera/microphone.');
      recBtn.disabled = false;
      recBtn.textContent = 'Record';
      logDebug(`Camera ${index + 1} - access denied to webcam/mic.`);
      return;
    }
    trackRecorder = new MediaRecorder(recStream, { mimeType: 'video/webm; codecs=vp9,opus' });
    recChunks = [];
    trackRecorder.ondataavailable = function(e) {
      if (e.data.size > 0) recChunks.push(e.data);
    };
    trackRecorder.onstop = function() {
      const blob = new Blob(recChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      videoTracks[index] = { file: null, url, name: `Camera${index+1}-take.webm`, recordedBlob: blob };
      prepareTempVideo(index, url, `Camera${index+1}-take.webm`);
      card.update();
      updateSwitcherBtns();
      updateThumbVideos();
      recBtn.disabled = false;
      recBtn.textContent = 'Record';
      if (recStream) recStream.getTracks().forEach(track => track.stop());
      logDebug(`Camera ${index + 1} - video recorded and loaded.`);
    };
    trackRecorder.start();
    setTimeout(() => {
      if (trackRecorder.state === 'recording') trackRecorder.stop();
    }, 120000); // Auto-stop after 2 min
  });
  card.appendChild(recBtn);

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
  preview.style.display = 'block'; // always visible!
  preview.style.background = "#000";
  preview.style.width = '80%';
  preview.style.marginTop = '6px';
  card.appendChild(preview);

  // Show error and load events for preview video
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
    preview.poster = ""; // Remove any old poster
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
      preview.src = videoTracks[index].url;
      preview.style.display = 'block';
      preview.load();
    } else {
      label.textContent = 'No video uploaded or recorded';
      dlBtn.style.display = 'none';
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
  document.querySelectorAll('.switcher-track').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
  });
  document.querySelectorAll('.switcher-btn').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
  });
  document.querySelectorAll('.thumb').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
  });
  previewInOutput(idx);
}

function previewInOutput(idx) {
  if (isRecording || isPlaying || !videoTracks[idx]) return;
  masterOutputVideo.src = videoTracks[idx].url;
  masterOutputVideo.style.display = 'block';
  masterOutputVideo.currentTime = 0;
}

// ===== INIT =====
for (let i = 0; i < NUM_TRACKS; i++) createTrackCard(i);
updateSwitcherBtns();
updateThumbVideos();
masterOutputVideo.style.display = 'block';
exportBtn.disabled = true;

// ===== LIVE RECORDING LOGIC =====
function getCurrentDrawVideo() {
  if (tempVideos[activeTrackIndex]) return tempVideos[activeTrackIndex];
  for (let i = 0; i < tempVideos.length; i++) {
    if (tempVideos[i]) return tempVideos[i];
  }
  return null;
}

// ... rest of your code remains unchanged ...
