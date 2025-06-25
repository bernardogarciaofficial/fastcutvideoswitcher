// Fastcut Music Video Maker - SYNC LOGIC REMOVED (to be re-added cleanly)

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

const videoTracks = Array(NUM_TRACKS).fill(null);
const tempVideos = Array(NUM_TRACKS).fill(null);
let activeTrackIndex = 0;
let isRecording = false;
let isPlaying = false;
let mediaRecorder = null;
let recordedChunks = [];
let animationFrameId = null;
let audioContext = null;
let livePreviewStream = null;

// --- Per-track recording state ---
let mediaRecorders = Array(NUM_TRACKS).fill(null);
let recStreams = Array(NUM_TRACKS).fill(null);
let recChunksArr = Array(NUM_TRACKS).fill(null);

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

// ===== THUMBNAIL ROW WITH BUTTONS =====
function createThumbRow() {
  thumbRow.innerHTML = '';
  for(let i=0; i<NUM_TRACKS; i++) {
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

    // Stop button
    const stopBtn = document.createElement('button');
    stopBtn.className = 'stop-btn';
    stopBtn.textContent = 'Stop';
    stopBtn.dataset.idx = i;
    stopBtn.disabled = true;

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
    controls.appendChild(stopBtn);
    controls.appendChild(uploadInput);
    controls.appendChild(downloadBtn);

    // Compose
    col.appendChild(video);
    col.appendChild(controls);
    thumbRow.appendChild(col);
  }
}
createThumbRow();

// ====== THUMB BUTTONS LOGIC ======
for(let i=0; i<NUM_TRACKS; i++) {
  const recordBtn = document.querySelector(`.record-btn[data-idx="${i}"]`);
  const stopBtn = document.querySelector(`.stop-btn[data-idx="${i}"]`);
  const uploadInput = document.querySelector(`.upload-btn[data-idx="${i}"]`);
  const downloadBtn = document.querySelector(`.download-btn[data-idx="${i}"]`);
  const thumbVideo = document.getElementById('thumb' + i);

  // Record button
  recordBtn.onclick = async () => {
    audio.currentTime = 0;
    audio.play();

    recChunksArr[i] = [];
    try {
      recStreams[i] = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch (err) {
      alert('Cannot access camera/microphone.');
      return;
    }
    thumbVideo.srcObject = recStreams[i];
    thumbVideo.src = '';
    thumbVideo.muted = true;
    thumbVideo.autoplay = true;
    thumbVideo.play();

    mediaRecorders[i] = new MediaRecorder(recStreams[i], { mimeType: 'video/webm; codecs=vp9,opus' });
    mediaRecorders[i].ondataavailable = e => {
      if (e.data.size > 0) recChunksArr[i].push(e.data);
    };
    mediaRecorders[i].onstop = () => {
      const blob = new Blob(recChunksArr[i], { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      thumbVideo.srcObject = null;
      thumbVideo.src = url;
      thumbVideo.load();
      thumbVideo.play();
      videoTracks[i] = { file: null, url, blob, name: `Camera${i+1}-take.webm` };
      prepareTempVideo(i, url, `Camera${i+1}-take.webm`);
      downloadBtn.disabled = false;
      if (recStreams[i]) recStreams[i].getTracks().forEach(track => track.stop());
      audio.pause();
      audio.currentTime = 0;
      recordBtn.disabled = false;
      stopBtn.disabled = true;
    };
    mediaRecorders[i].start();
    recordBtn.disabled = true;
    stopBtn.disabled = false;

    // Stop automatically when music ends
    audio.onended = () => {
      if (mediaRecorders[i] && mediaRecorders[i].state === 'recording') mediaRecorders[i].stop();
      audio.onended = null;
    };
  };

  // Stop button
  stopBtn.onclick = () => {
    if (mediaRecorders[i] && mediaRecorders[i].state === 'recording') {
      mediaRecorders[i].stop();
      audio.pause();
      audio.currentTime = 0;
    }
    recordBtn.disabled = false;
    stopBtn.disabled = true;
  };

  // Upload button
  uploadInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    thumbVideo.srcObject = null;
    thumbVideo.src = url;
    thumbVideo.load();
    videoTracks[i] = { file, url, name: file.name };
    prepareTempVideo(i, url, file.name);
    downloadBtn.disabled = false;
  };

  // Download button
  downloadBtn.onclick = () => {
    const track = videoTracks[i];
    if (!track) return;
    const a = document.createElement('a');
    a.href = track.url;
    a.download = track.name || `track${i+1}.webm`;
    a.click();
  };

  // Thumbnail click: switch active track and highlight
  thumbVideo.onclick = () => {
    setActiveTrack(i);
  };
}

// ===== PREPARE TEMP VIDEO =====
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

// ===== SWITCHER BUTTONS LOGIC =====
switcherBtnsContainer.querySelectorAll('.switcher-btn').forEach((btn, idx) => {
  btn.onclick = function() {
    setActiveTrack(idx);
  };
});

function setActiveTrack(idx) {
  activeTrackIndex = idx;
  // Highlight switcher btns
  switcherBtnsContainer.querySelectorAll('.switcher-btn').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
  });
  // Highlight thumbnail
  document.querySelectorAll('.thumb').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
  });
  // Main output preview
  previewInOutput(idx);
}
function previewInOutput(idx) {
  if (isRecording || isPlaying) return;
  if (!videoTracks[idx]) return;
  masterOutputVideo.srcObject = null;
  masterOutputVideo.src = videoTracks[idx].url;
  masterOutputVideo.style.display = 'block';
  masterOutputVideo.currentTime = 0;
}
// Set default
setActiveTrack(0);

// ====== FULL EDIT RECORD & EXPORT (NO SYNC) ======
recordFullEditBtn.addEventListener('click', async function () {
  if (!audio.src) {
    alert('Please upload a song first.');
    return;
  }
  if (!videoTracks.some(Boolean)) {
    alert('Please upload or record at least one video take.');
    return;
  }
  if (!tempVideos[activeTrackIndex]) {
    alert('Selected camera has no video.');
    return;
  }

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

  // Just use the active video, play both audio and video independently (NO SYNC)
  const vid = tempVideos[activeTrackIndex];
  vid.currentTime = 0;
  audio.currentTime = 0;
  try {
    await Promise.all([audio.play(), vid.play()]);
  } catch (e) {
    alert("Please interact with the page to allow playback.");
    isRecording = false;
    isPlaying = false;
    recIndicator.style.display = 'none';
    return;
  }

  function drawFrame() {
    if (!isRecording) return;
    if (vid && vid.readyState >= 2 && !vid.ended) {
      ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
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
  } catch (e) {}

  // Setup audio routing for MediaRecorder
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
  };

  mediaRecorder.start();

  // When audio ends, stop recording
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

// ===== EXPORT =====
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
