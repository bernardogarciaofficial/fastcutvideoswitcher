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
let requestedTrackIndex = 0;
let isRecording = false;
let isPlaying = false;
let mediaRecorder = null;
let recordedChunks = [];
let animationFrameId = null;
let audioContext = null;
let livePreviewStream = null;

// Crossfade config
const CROSSFADE_DURATION = 0.3; // seconds
let crossfadeProgress = 1;
let crossfading = false;
let crossfadeStartTime = 0;
let lastSwitchTime = 0;
let prevTrackIndex = 0;

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

// ====== THUMB BUTTONS LOGIC ======
for(let i=0; i<NUM_TRACKS; i++) {
  // Record button
  document.querySelector(`.record-btn[data-idx="${i}"]`).onclick = async (e) => {
    const idx = +e.target.dataset.idx;
    audio.currentTime = 0;
    audio.play().catch(()=>{});
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
    recorder.ondataavailable = function(e) {
      if (e.data.size > 0) recChunks.push(e.data);
    };
    recorder.onstop = function() {
      const blob = new Blob(recChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      videoTracks[idx] = { file: null, url, name: `Camera${idx+1}-take.webm`, recordedBlob: blob };
      prepareTempVideo(idx, url, `Camera${idx+1}-take.webm`);
      preview.srcObject = null;
      preview.src = url;
      preview.autoplay = false;
      preview.muted = true;
      preview.load();
      document.querySelector(`.download-btn[data-idx="${idx}"]`).disabled = false;
      if (recStream) recStream.getTracks().forEach(track => track.stop());
      audio.pause();
      updateSwitcherBtns();
    };
    // Show webcam
    preview.srcObject = recStream;
    preview.muted = true;
    preview.autoplay = true;
    preview.play().catch(()=>{});
    recorder.start();
    // Change btn state
    e.target.disabled = true;
    e.target.textContent = 'Recording...';
    // Stop after song or manual
    audio.onended = function() {
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
    updateSwitcherBtns();
  };
  // Download button
  document.querySelector(`.download-btn[data-idx="${i}"]`).onclick = (e) => {
    const idx = +e.target.dataset.idx;
    const track = videoTracks[idx];
    if (!track) return;
    const a = document.createElement('a');
    a.href = track.url;
    a.download = track.name || `track${idx+1}.webm`;
    a.click();
  };
  // Thumbnail click: switch active track and highlight
  document.getElementById('thumb' + i).onclick = () => {
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
  updateSwitcherBtns();
}

// ===== SWITCHER BUTTONS LOGIC =====
function updateSwitcherBtns() {
  switcherBtnsContainer.innerHTML = '';
  for(let i=0; i<NUM_TRACKS; i++) {
    const btn = document.createElement('button');
    btn.className = 'switcher-btn' + (i === activeTrackIndex ? ' active' : '');
    btn.textContent = `Camera ${i+1}`;
    btn.disabled = !videoTracks[i];
    btn.onclick = () => setActiveTrack(i);
    switcherBtnsContainer.appendChild(btn);
  }
}
updateSwitcherBtns();

function setActiveTrack(idx) {
  // Begin crossfade
  if (idx !== activeTrackIndex) {
    prevTrackIndex = activeTrackIndex;
    requestedTrackIndex = idx;
    crossfadeProgress = 0;
    crossfading = true;
    crossfadeStartTime = performance.now();
    lastSwitchTime = audio.currentTime;
  }
  // UI highlight update
  activeTrackIndex = idx;
  switcherBtnsContainer.querySelectorAll('.switcher-btn').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
  });
  document.querySelectorAll('.thumb').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
  });
  // PAUSE all videos except active; SYNC active video to audio
  for (let i = 0; i < tempVideos.length; i++) {
    if (tempVideos[i]) {
      if (i === idx) {
        tempVideos[i].currentTime = audio.currentTime;
        tempVideos[i].play().catch(()=>{});
      } else {
        tempVideos[i].pause();
      }
    }
  }
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

// ====== LIVE RECORDING LOGIC (Main Output) ======
function getCurrentDrawVideo(trackIndex) {
  if (tempVideos[trackIndex]) return tempVideos[trackIndex];
  for (let i = 0; i < tempVideos.length; i++) {
    if (tempVideos[i]) return tempVideos[i];
  }
  return null;
}

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

  // Play all videos (muted), so frames are always available!
  for (let i = 0; i < tempVideos.length; i++) {
    if (tempVideos[i]) {
      tempVideos[i].muted = true;
      try {
        await tempVideos[i].play();
      } catch(e) { console.error("Video play error", e); }
    }
  }
  let currentVideo = getCurrentDrawVideo(activeTrackIndex);
  if (!currentVideo) {
    alert('Please upload or record at least one video take.');
    isRecording = false; isPlaying = false; recIndicator.style.display = 'none';
    return;
  }

  // === FADE CONTROL ===
  let FADE_DURATION = 1.0; // seconds
  let fadeAlpha = 1.0;
  let fadeIn = true;
  let fadeOut = false;
  let previousFrame = null;

  // === DRAW FRAME LOGIC (with crossfade and fade-in/out) ===
  function drawFrame() {
    if (!isRecording) return;
    let now = audio.currentTime;
    let vidA = getCurrentDrawVideo(prevTrackIndex);
    let vidB = getCurrentDrawVideo(requestedTrackIndex);
    let progress = 1;

    if (crossfading) {
      progress = Math.min(1, (audio.currentTime - lastSwitchTime)/CROSSFADE_DURATION);
      crossfadeProgress = progress;
      if (progress >= 1) {
        crossfading = false;
        prevTrackIndex = requestedTrackIndex;
      }
    }

    // Draw crossfade: blend previous and new video
    if (crossfading && vidA && vidB && vidA.readyState >= 2 && vidB.readyState >= 2) {
      try {
        ctx.globalAlpha = 1 - progress;
        ctx.drawImage(vidA, 0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = progress;
        ctx.drawImage(vidB, 0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1.0;
        previousFrame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      } catch(e) {
        console.error("crossfade error", e);
      }
    } else {
      // Not crossfading, draw current camera
      let vid = getCurrentDrawVideo(requestedTrackIndex);
      if (vid && !vid.ended && vid.readyState >= 2) {
        try {
          ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
          previousFrame = ctx.getImageData(0, 0, canvas.width, canvas.height);
        } catch(e) {
          console.error("drawImage error", e);
        }
      } else if (previousFrame) {
        ctx.putImageData(previousFrame, 0, 0);
      } else {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }

    // === FADE IN/OUT LOGIC ===
    if (now < FADE_DURATION) {
      fadeIn = true;
      fadeAlpha = Math.min(1, 1 - (now/FADE_DURATION));
    } else {
      fadeIn = false;
      fadeAlpha = 0;
    }
    if (audio.duration && now > audio.duration - FADE_DURATION) {
      fadeOut = true;
      fadeAlpha = Math.min(1, (now - (audio.duration - FADE_DURATION))/FADE_DURATION);
    } else if (!fadeIn) {
      fadeOut = false;
    }
    // Draw fade overlay if needed
    if (fadeAlpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = fadeAlpha;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
    animationFrameId = requestAnimationFrame(drawFrame);
  }
  drawFrame();

  try {
    livePreviewStream = canvas.captureStream(30);
    masterOutputVideo.srcObject = livePreviewStream;
    masterOutputVideo.src = "";
    masterOutputVideo.play();
  } catch (e) {}

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
  audio.currentTime = 0;
  audio.play();
  for (let i = 0; i < tempVideos.length; i++) {
    if (tempVideos[i]) {
      try {
        tempVideos[i].currentTime = 0;
        tempVideos[i].play().catch(()=>{});
      } catch(e) { }
    }
  }
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
