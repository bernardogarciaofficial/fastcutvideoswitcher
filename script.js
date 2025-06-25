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

const videoTracks = Array(NUM_TRACKS).fill(null);
const tempVideos = Array(NUM_TRACKS).fill(null); // For playback/drawing
let activeTrackIndex = 0;
let isRecording = false;
let isPlaying = false;
let mediaRecorder = null;
let recordedChunks = [];
let animationFrameId = null;
let audioContext = null;

// ========== UTILITY ==========
function logDebug(msg) {
  debuglog.textContent += msg + "\n";
  debuglog.scrollTop = debuglog.scrollHeight;
  console.log(msg);
}

// ========== THUMBNAIL GRID (6 preview video screens with controls) ==========
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

    // Controls row
    const controls = document.createElement('div');
    controls.style.display = 'flex';
    controls.style.justifyContent = 'center';
    controls.style.alignItems = 'center';
    controls.style.marginBottom = '6px';
    controls.style.gap = '6px';

    // Record button
    const recordBtn = document.createElement('button');
    recordBtn.textContent = 'Record';
    recordBtn.style.fontSize = '0.95em';
    recordBtn.style.padding = '2px 7px';
    recordBtn.style.cursor = 'pointer';
    controls.appendChild(recordBtn);

    // Upload/Choose File button
    const uploadInput = document.createElement('input');
    uploadInput.type = 'file';
    uploadInput.accept = 'video/*';
    uploadInput.style.fontSize = '0.95em';
    uploadInput.title = 'Choose file';
    controls.appendChild(uploadInput);

    // Download button
    const downloadBtn = document.createElement('button');
    downloadBtn.textContent = 'Download';
    downloadBtn.style.fontSize = '0.95em';
    downloadBtn.style.padding = '2px 7px';
    downloadBtn.style.cursor = 'pointer';
    downloadBtn.disabled = true;
    controls.appendChild(downloadBtn);

    col.appendChild(controls);

    // Status label
    const statusLabel = document.createElement('div');
    statusLabel.style.textAlign = 'center';
    statusLabel.style.fontSize = '0.85em';
    statusLabel.style.color = '#888';
    statusLabel.style.minHeight = '1.5em';
    statusLabel.textContent = 'No video';
    col.appendChild(statusLabel);

    // Click to select track
    video.onclick = () => setActiveTrack(i);

    // --- BUTTON LOGIC ---

    // Record button logic
    let trackRecorder = null;
    let recStream = null;
    let recChunks = [];
    recordBtn.onclick = async function () {
      if (trackRecorder && trackRecorder.state === 'recording') return; // Already recording

      recordBtn.disabled = true;
      recordBtn.textContent = 'Recording...';
      statusLabel.textContent = 'Recording...';

      try {
        recStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch (err) {
        alert('Cannot access camera/microphone.');
        recordBtn.disabled = false;
        recordBtn.textContent = 'Record';
        statusLabel.textContent = 'Camera/mic access denied';
        logDebug(`Camera ${i + 1} - access denied to webcam/mic.`);
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
        videoTracks[i] = { file: null, url, name: `Camera${i+1}-take.webm`, recordedBlob: blob };
        prepareTempVideo(i, url, `Camera${i+1}-take.webm`);
        video.src = url;
        video.load();
        statusLabel.textContent = 'Recorded Take';
        downloadBtn.disabled = false;
        recordBtn.disabled = false;
        recordBtn.textContent = 'Record';
        if (recStream) recStream.getTracks().forEach(track => track.stop());
        logDebug(`Camera ${i + 1} - video recorded and loaded.`);
      };
      trackRecorder.start();
      setTimeout(() => {
        if (trackRecorder.state === 'recording') trackRecorder.stop();
      }, 120000); // Auto-stop after 2 min
    };

    // Upload/choose file logic
    uploadInput.onchange = function (e) {
      const file = e.target.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      videoTracks[i] = { file, url, name: file.name };
      prepareTempVideo(i, url, file.name);
      video.src = url;
      video.load();
      statusLabel.textContent = file.name;
      downloadBtn.disabled = false;
      logDebug(`Camera ${i + 1} video loaded: ${file.name}`);
    };

    // Download logic
    downloadBtn.onclick = function() {
      if (videoTracks[i] && videoTracks[i].url) {
        const a = document.createElement('a');
        a.href = videoTracks[i].url;
        a.download = videoTracks[i].name || `track${i+1}.webm`;
        a.click();
        logDebug(`Camera ${i + 1} take downloaded.`);
      }
    };

    // Update on load for already set src
    if (videoTracks[i]) {
      video.src = videoTracks[i].url;
      video.load();
      statusLabel.textContent = videoTracks[i].name || 'Recorded Take';
      downloadBtn.disabled = false;
    }

    thumbRow.appendChild(col);
  }
}
createThumbRow();

function updateThumbVideos() {
  for (let i = 0; i < NUM_TRACKS; i++) {
    const thumb = document.getElementById('thumb' + i);
    if (thumb && videoTracks[i]) {
      thumb.src = videoTracks[i].url;
      thumb.style.background = '#000';
      thumb.load();
    } else if (thumb) {
      thumb.src = '';
      thumb.style.background = '#222';
    }
  }
}

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

// ========== VIDEO PREP ==========
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

// ========== ACTIVE TRACK ==========
function setActiveTrack(idx) {
  activeTrackIndex = idx;
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

// (Rest of your app: switcherBtns, export, recordFullEditBtn, etc. goes here)
