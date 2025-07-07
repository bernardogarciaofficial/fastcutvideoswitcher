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

// State
const videoTracks = Array(NUM_TRACKS).fill(null);
const tempVideos = Array(NUM_TRACKS).fill(null);
let activeTrackIndex = 0;

// ===== SONG UPLOAD =====
songInput.addEventListener('change', function (e) {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  audio.src = url;
  audio.style.display = 'block';
  audioStatus.textContent = `Loaded: ${file.name}`;
  audio.load();
});

// ===== VIDEO TAKES TRACK CARD CREATION =====
function createTrackCard(index) {
  const card = document.createElement('div');
  card.className = 'switcher-track';
  card.style.border = '2px solid #222';
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
  });
  card.appendChild(input);

  // Record/Stop buttons
  const recBtn = document.createElement('button');
  recBtn.textContent = 'Record';
  recBtn.style.marginLeft = '8px';
  let trackRecorder = null, recStream = null, recChunks = [];
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
    const preview = card.querySelector('video.track-preview.thumb');
    preview.style.display = 'block';
    try {
      recStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch (err) {
      alert('Cannot access camera/microphone.');
      recBtn.disabled = false;
      recBtn.textContent = 'Record';
      stopRecBtn.style.display = 'none';
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
    };
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
    }
  });
  card.appendChild(dlBtn);

  // Video preview (thumbnail)
  const preview = document.createElement('video');
  preview.className = 'track-preview thumb'; // Always both classes
  preview.controls = true;
  preview.style.display = 'block';
  preview.style.background = "#000";
  preview.autoplay = false;
  preview.muted = true;
  preview.loop = false;
  preview.playsInline = true;
  card.appendChild(preview);

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
  previewInOutput(idx);
}

function previewInOutput(idx) {
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

// (You can add live-edit, export, or more advanced features below)
