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
const tempVideos = Array(NUM_TRACKS).fill(null); // For playback/drawing
let activeTrackIndex = 0;
let isRecording = false;
let isPlaying = false;
let mediaRecorder = null;
let recordedChunks = [];
let animationFrameId = null;
let audioContext = null;
let livePreviewStream = null;

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
    // Music playback (slave to video)
    audio.currentTime = 0;
    audio.play();
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
      preview.srcObject = null;
      preview.src = url;
      preview.autoplay = false;
      preview.muted = true;
      preview.load();
      preview.play();
      videoTracks[idx] = { file: null, url, blob, name: `Camera${idx+1}-take.webm` };
      prepareTempVideo(idx, url, `Camera${idx+1}-take.webm`);
      document.querySelector(`.download-btn[data-idx="${idx}"]`).disabled = false;
      if (recStream) recStream.getTracks().forEach(track => track.stop());
      audio.pause();
      audio.currentTime = 0;
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
      audio.pause();
      audio.currentTime = 0;
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

// ====== LIVE RECORDING LOGIC (Main Output) ======
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
  // Prepare all videos
  for (let i = 0; i < tempVideos.length; i++) {
    if (tempVideos[i]) {
      if (!tempVideos[i].parentNode) hiddenVideos.appendChild(tempVideos[i]);
      try { 
        tempVideos[i].pause(); 
        tempVideos[i].currentTime = 0; 
        tempVideos[i].load(); 
      } catch(e) {}
    }
  }
  let currentVideo = getCurrentDrawVideo();
  if (!currentVideo) {
    alert('Please upload or record at least one video take.');
    isRecording = false; isPlaying = false; recIndicator.style.display = 'none';
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
      } catch (err) {}
    }
  }
  try {
    await currentVideo.play();
  } catch (e) {}
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
      let alpha = 1 - (currentTime / FADE_DURATION);
      ctx.fillStyle = `rgba(0,0,0,${alpha})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (totalDuration && currentTime > totalDuration - FADE_DURATION) {
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
  } catch (e) {}
  switcherBtnsContainer.querySelectorAll('.switcher-btn').forEach((btn, idx) => {
    btn.onclick = function() {
      setActiveTrack(idx);
      const vid = getCurrentDrawVideo();
      if (vid) {
        vid.play().catch(()=>{});
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
  };
  audio.currentTime = 0;
  audio.play();
  for (let i = 0; i < tempVideos.length; i++) {
    if (tempVideos[i]) { 
      try { 
        tempVideos[i].currentTime = 0; 
        await tempVideos[i].play(); 
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
