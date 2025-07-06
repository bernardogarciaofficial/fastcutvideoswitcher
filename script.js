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
    if (!audio.src) {
      alert("Please choose a song first.");
      return;
    }
    // Browser policy: user must unlock audio via play/pause
    if (audio.paused) {
      alert("Please click play on the audio player below, then pause, before recording.");
      return;
    }

    let recChunks = [];
    let recStream = null;
    let localAudioContext = null;
    let localSourceNode = null;
    let dest = null;

    try {
      recStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    } catch (err) {
      alert('Cannot access camera.');
      return;
    }

    localAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    localSourceNode = localAudioContext.createMediaElementSource(audio);
    dest = localAudioContext.createMediaStreamDestination();
    localSourceNode.connect(dest);
    localSourceNode.connect(localAudioContext.destination);

    const combinedStream = new MediaStream([
      ...recStream.getVideoTracks(),
      ...dest.stream.getAudioTracks()
    ]);

    const preview = document.getElementById('thumb' + idx);

    // Webcam preview while recording
    preview.srcObject = recStream;
    preview.muted = true;
    preview.autoplay = true;
    preview.play().catch(()=>{});

    audio.pause();
    audio.currentTime = 0;
    await new Promise(res => setTimeout(res, 30));

    try {
      await audio.play();
      if (audio.paused) throw new Error("Audio still paused after play()");
    } catch (err) {
      alert("Browser blocked audio autoplay. Please click play on the audio player to unlock, then pause and Record.");
      if (recStream) recStream.getTracks().forEach(t => t.stop());
      return;
    }

    const recorder = new MediaRecorder(combinedStream, {
      mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm'
    });

    recorder.ondataavailable = function(e) {
      if (e.data.size > 0) recChunks.push(e.data);
    };

    recorder.onstop = function() {
      const blob = new Blob(recChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      videoTracks[idx] = { file: null, url, name: `Camera${idx+1}-take.webm`, recordedBlob: blob };
      prepareTempVideo(idx, url, `Camera${idx+1}-take.webm`);
      preview.pause();
      preview.srcObject = null;
      preview.removeAttribute('src');
      preview.load();
      setTimeout(() => {
        preview.src = url;
        preview.currentTime = 0;
        preview.autoplay = false;
        preview.muted = true;
        preview.load();
        preview.onloadeddata = () => {
          preview.currentTime = 0;
          preview.pause();
        };
      }, 20);
      document.querySelector(`.download-btn[data-idx="${idx}"]`).disabled = false;
      if (recStream) recStream.getTracks().forEach(track => track.stop());
      if (localAudioContext) localAudioContext.close();
      audio.pause();
      updateSwitcherBtns();
    };

    // Change btn state
    e.target.disabled = true;
    e.target.textContent = 'Recording...';

    audio.onended = function() {
      if (recorder.state === 'recording') recorder.stop();
      audio.onended = null;
    };
    preview.onclick = () => {
      if (recorder.state === 'recording') recorder.stop();
    };
    recorder.onstop = () => {
      e.target.disabled = false;
      e.target.textContent = 'Record';
      preview.onclick = null;
    };

    recorder.start();
  };

  // Upload button
  document.querySelector(`.upload-btn[data-idx="${i}"]`).onchange = (e) => {
    const idx = +e.target.dataset.idx;
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const preview = document.getElementById('thumb' + idx);
    preview.src = url;
    preview.currentTime = 0;
    preview.load();
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
  activeTrackIndex = idx;
  switcherBtnsContainer.querySelectorAll('.switcher-btn').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
  });
  document.querySelectorAll('.thumb').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
  });
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

  for (let i = 0; i < tempVideos.length; i++) {
    if (tempVideos[i]) {
      tempVideos[i].muted = true;
      try {
        await tempVideos[i].play();
      } catch(e) { }
    }
  }
  let currentVideo = getCurrentDrawVideo(activeTrackIndex);
  if (!currentVideo) {
    alert('Please upload or record at least one video take.');
    isRecording = false; isPlaying = false; recIndicator.style.display = 'none';
    return;
  }

  let previousFrame = null;

  function drawFrame() {
    if (!isRecording) return;
    let vid = getCurrentDrawVideo(activeTrackIndex);
    if (vid && !vid.ended && vid.readyState >= 2) {
      try {
        ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
        previousFrame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      } catch(e) {}
    } else if (previousFrame) {
      ctx.putImageData(previousFrame, 0, 0);
    } else {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
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
    });
});
