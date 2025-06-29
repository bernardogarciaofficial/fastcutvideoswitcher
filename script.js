// FASTCUT STUDIOS - Hollywood Music Video Editor (Robust Sync Version)

const NUM_TRACKS = 6;
const songInput = document.getElementById('songInput');
const audioStatus = document.getElementById('audioStatus');
const audio = document.getElementById('audio');
const masterOutputVideo = document.getElementById('masterOutputVideo');
const recIndicator = document.getElementById('recIndicator');
const recordFullEditBtn = document.getElementById('recordFullEditBtn');
const stopPreviewBtn = document.getElementById('stopPreviewBtn');
const exportBtn = document.getElementById('exportMusicVideoBtn');
const exportStatus = document.getElementById('exportStatus');
const hiddenVideos = document.getElementById('hiddenVideos');
const thumbRow = document.getElementById('thumbRow');
const switcherBtnsContainer = document.getElementById('switcherBtnsContainer');
const switcherTracks = document.getElementById('switcherTracks');
const debuglog = document.getElementById('debuglog');

function logDebug(msg) {
  if (debuglog) {
    debuglog.textContent += msg + '\n';
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
let switchingTrack = false;
let lastGoodFrame = null;

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

// ===== CREATE CAMERA UI =====
function createThumbRow() {
  thumbRow.innerHTML = '';
  for (let i = 0; i < NUM_TRACKS; i++) {
    const col = document.createElement('div');
    col.className = 'thumb-col';
    col.dataset.idx = i;
    // Thumbnail video
    const video = document.createElement('video');
    video.className = 'thumb';
    video.id = 'thumb' + i;
    video.muted = true;
    video.playsInline = true;
    // Controls under thumbnail
    const controls = document.createElement('div');
    controls.className = 'thumb-controls';
    // Record button
    const recordBtn = document.createElement('button');
    recordBtn.className = 'record-btn';
    recordBtn.textContent = 'Record';
    recordBtn.dataset.idx = i;
    // Upload button
    const uploadInput = document.createElement('input');
    uploadInput.type = 'file';
    uploadInput.accept = 'video/*';
    uploadInput.className = 'upload-btn';
    uploadInput.dataset.idx = i;
    // Download button
    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'download-btn';
    downloadBtn.textContent = 'Download';
    downloadBtn.dataset.idx = i;
    downloadBtn.disabled = true;
    // Append controls
    controls.appendChild(recordBtn);
    controls.appendChild(uploadInput);
    controls.appendChild(downloadBtn);
    // Compose
    col.appendChild(video);
    col.appendChild(controls);
    thumbRow.appendChild(col);
  }
}
createThumbRow();

// ... (UNCHANGED CODE ABOVE) ...

for (let i = 0; i < NUM_TRACKS; i++) {
  // Record button
  document.querySelector(`.record-btn[data-idx="${i}"]`).onclick = async (e) => {
    const idx = +e.target.dataset.idx;
    audio.currentTime = 0;
    audio.play().catch(() => {});
    let recStream = null;
    let recChunks = [];
    try {
      recStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch (err) {
      alert('Cannot access camera/microphone.');
      return;
    }
    const recorder = new MediaRecorder(recStream, { mimeType: 'video/webm; codecs=vp9,opus' });
    const preview = document.getElementById('thumb' + idx);
    recorder.ondataavailable = function (e) {
      if (e.data.size > 0) recChunks.push(e.data);
    };
    recorder.onstop = function () {
      const blob = new Blob(recChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      videoTracks[idx] = { file: null, url, name: `Camera${idx + 1}-take.webm`, recordedBlob: blob };
      prepareTempVideo(idx, url, `Camera${idx + 1}-take.webm`);
      preview.srcObject = null;
      preview.src = url;
      preview.autoplay = false;
      preview.muted = true;
      preview.load();
      document.querySelector(`.download-btn[data-idx="${idx}"]`).disabled = false;
      if (recStream) recStream.getTracks().forEach(track => track.stop());
      audio.pause();
      updateSwitcherBtns(); // FIX: update switcher buttons after recording
    };
    // Show webcam
    preview.srcObject = recStream;
    preview.muted = true;
    preview.autoplay = true;
    preview.play().catch(() => {});
    recorder.start();
    // Change btn state
    e.target.disabled = true;
    e.target.textContent = 'Recording...';
    // Stop after song or manual
    audio.onended = function () {
      if (recorder.state === 'recording') recorder.stop();
      audio.onended = null;
    };
    // Click to stop
    preview.onclick = () => {
      if (recorder.state === 'recording') recorder.stop();
    };
    recorder.onstop = () => {
      e.target.disabled = false;
      e.target.textContent = 'Record';
      preview.onclick = null;
    };
  };
  // Upload button
  document.querySelector(`.upload-btn[data-idx="${i}"]`).onchange = (e) => {
    const idx = +e.target.dataset.idx;
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    document.getElementById('thumb' + idx).src = url;
    videoTracks[idx] = { file, url, name: file.name };
    prepareTempVideo(idx, url, file.name);
    document.querySelector(`.download-btn[data-idx="${idx}"]`).disabled = false;
    updateSwitcherBtns(); // FIX: update switcher buttons after upload
  };
  // Download button
  document.querySelector(`.download-btn[data-idx="${i}"]`).onclick = (e) => {
    const idx = +e.target.dataset.idx;
    const track = videoTracks[idx];
    if (!track) return;
    const a = document.createElement('a');
    a.href = track.url;
    a.download = track.name || `track${idx + 1}.webm`;
    a.click();
  };
  // Thumbnail click: switch active track and highlight
  document.getElementById('thumb' + i).onclick = () => {
    setActiveTrack(i);
  };
}

// ... (PREPARE TEMP VIDEO, etc.)

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
    btn.onclick = () => setActiveTrack(i); // always set for non-recording mode
    switcherBtnsContainer.appendChild(btn);
  }
}
function setActiveTrack(idx) {
  activeTrackIndex = idx;
  document.querySelectorAll('.thumb').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
  });
  document.querySelectorAll('.switcher-btn').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
  });
  previewInOutput(idx);
}
function previewInOutput(idx) {
  if (isRecording || isPlaying || !videoTracks[idx]) return;
  masterOutputVideo.srcObject = null;
  masterOutputVideo.src = videoTracks[idx].url;
  masterOutputVideo.style.display = 'block';
  masterOutputVideo.currentTime = 0;
}
updateSwitcherBtns();
setActiveTrack(0);

// ====== SYNC/RENDER/RECORD CORE LOGIC ======
function getCurrentDrawVideo() {
  if (tempVideos[activeTrackIndex]) return tempVideos[activeTrackIndex];
  for (let i = 0; i < tempVideos.length; i++) {
    if (tempVideos[i]) return tempVideos[i];
  }
  return null;
}
function waitForMediaReady(media) {
  return new Promise(resolve => {
    if (media.readyState >= 2) resolve();
    else media.addEventListener('loadeddata', resolve, { once: true });
  });
}
async function switchDrawTrack(newIdx, audioTime) {
  switchingTrack = true;
  let vid = tempVideos[newIdx];
  if (!vid) return;
  try {
    vid.pause();
    vid.currentTime = audioTime;
    await waitForMediaReady(vid);
    await vid.play();
  } catch (e) {}
  switchingTrack = false;
}

recordFullEditBtn.addEventListener('click', async function () {
  if (!audio.src) { alert('Please upload a song first.'); return; }
  if (!videoTracks.some(Boolean)) { alert('Please upload or record at least one video take.'); return; }
  if (!tempVideos[activeTrackIndex]) { alert('Selected camera has no video.'); return; }

  isRecording = true;
  isPlaying = true;
  recordedChunks = [];
  exportStatus.textContent = '';
  recIndicator.style.display = 'block';
  exportBtn.disabled = true;

  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 360;
  const ctx = canvas.getContext('2d');

  // Preload all videos and reset to 0
  for (let i = 0; i < tempVideos.length; i++) {
    if (tempVideos[i]) {
      try { tempVideos[i].pause(); tempVideos[i].currentTime = 0; tempVideos[i].load(); } catch (e) {}
    }
  }
  await Promise.all(
    tempVideos.map(tv => tv ? waitForMediaReady(tv) : Promise.resolve())
  );
  await Promise.all(
    tempVideos.map(tv => tv ? tv.play().catch(() => {}) : Promise.resolve())
  );
  for (let i = 0; i < tempVideos.length; i++) {
    if (tempVideos[i] && i !== activeTrackIndex) tempVideos[i].pause();
  }
  audio.currentTime = 0;
  await audio.play().catch(() => {});
  await switchDrawTrack(activeTrackIndex, audio.currentTime);

  // Setup output canvas for live preview
  livePreviewStream = canvas.captureStream(30);
  masterOutputVideo.srcObject = livePreviewStream;
  masterOutputVideo.src = "";
  masterOutputVideo.play();

  // DRAW LOOP: Only seek videos on switch, draw last good frame while seeking
  function drawFrameRAF() {
    if (!isRecording) return;
    if (switchingTrack) {
      if (lastGoodFrame) ctx.putImageData(lastGoodFrame, 0, 0);
      animationFrameId = requestAnimationFrame(drawFrameRAF);
      return;
    }
    const vid = getCurrentDrawVideo();
    if (vid && vid.readyState >= 2 && !vid.ended) {
      ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
      try { lastGoodFrame = ctx.getImageData(0, 0, canvas.width, canvas.height); } catch (e) { lastGoodFrame = null; }
    } else if (lastGoodFrame) {
      ctx.putImageData(lastGoodFrame, 0, 0);
    } else {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    animationFrameId = requestAnimationFrame(drawFrameRAF);
  }
  drawFrameRAF();

  // FIX: correct switcher handler for live recording
  switcherBtnsContainer.querySelectorAll('.switcher-btn').forEach((btn, idx) => {
    btn.onclick = async function () {
      if (activeTrackIndex === idx) return;
      setActiveTrack(idx);
      await switchDrawTrack(idx, audio.currentTime);
    };
  });

  // Combine canvas video and audio into export stream
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
  mediaRecorder.ondataavailable = function (e) {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };
  mediaRecorder.onstop = function () {
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
  };

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
      recIndicator.style.display = 'none';
      exportStatus.textContent = 'Recording stopped.';
    }
  };
});

// ===== EXPORT BUTTON =====
exportBtn.addEventListener('click', function () {
  if (!masterOutputVideo.src) {
    exportStatus.textContent = 'Nothing to export yet!';
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
    });
});
