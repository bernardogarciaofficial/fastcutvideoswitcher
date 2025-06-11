// FASTCUT STUDIOS - Hollywood Music Video Editor
// Author: Bernardo Garcia

// Elements
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

// State
const videoTracks = [];
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
});

// ===== VIDEO TAKES UPLOAD & UI =====
function createTrackCard(index) {
  const card = document.createElement('div');
  card.className = 'switcher-track';
  if (index === 0) card.classList.add('active');

  const title = document.createElement('div');
  title.className = 'track-title';
  title.textContent = `Camera ${index + 1}`;
  card.appendChild(title);

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'video/*';
  input.style.margin = '6px 0';
  input.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    videoTracks[index] = {
      file,
      url: URL.createObjectURL(file),
      name: file.name
    };
    card.update();
    updateSwitcherBtns();
    // If this is the first loaded track, show preview
    if (index === activeTrackIndex) previewInOutput(index);
  });
  card.appendChild(input);

  const label = document.createElement('div');
  label.className = 'upload-video-label';
  label.textContent = 'No video uploaded';
  card.appendChild(label);

  const dlBtn = document.createElement('button');
  dlBtn.className = 'upload-video-btn';
  dlBtn.textContent = 'Download Take';
  dlBtn.style.display = 'none';
  dlBtn.addEventListener('click', function() {
    if (videoTracks[index]) {
      const a = document.createElement('a');
      a.href = videoTracks[index].url;
      a.download = videoTracks[index].name || `track${index+1}.mp4`;
      a.click();
    }
  });
  card.appendChild(dlBtn);

  const preview = document.createElement('video');
  preview.controls = true;
  preview.style.display = 'none';
  preview.style.width = '100%';
  preview.style.borderRadius = '7px';
  preview.style.marginTop = '6px';
  card.appendChild(preview);

  card.update = function () {
    if (videoTracks[index]) {
      label.textContent = videoTracks[index].name;
      dlBtn.style.display = '';
      preview.src = videoTracks[index].url;
      preview.style.display = 'block';
    } else {
      label.textContent = 'No video uploaded';
      dlBtn.style.display = 'none';
      preview.src = '';
      preview.style.display = 'none';
    }
  };

  card.addEventListener('click', function () {
    setActiveTrack(index);
  });

  switcherTracks.appendChild(card);
  card.update();
}

// ===== SWITCHER BUTTONS =====
function updateSwitcherBtns() {
  switcherBtnsContainer.innerHTML = '';
  videoTracks.forEach((track, i) => {
    const btn = document.createElement('button');
    btn.className = 'switcher-btn' + (i === activeTrackIndex ? ' active' : '');
    btn.textContent = `Camera ${i + 1}`;
    btn.disabled = !track;
    btn.addEventListener('click', function () {
      setActiveTrack(i);
    });
    switcherBtnsContainer.appendChild(btn);
  });
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
  // Only preview if not recording or playing
  if (isRecording || isPlaying || !videoTracks[idx]) return;
  masterOutputVideo.src = videoTracks[idx].url;
  masterOutputVideo.style.display = 'block';
  masterOutputVideo.currentTime = 0;
}

// ===== INIT =====
for (let i = 0; i < 4; i++) createTrackCard(i);
updateSwitcherBtns();
masterOutputVideo.style.display = 'none';
exportBtn.disabled = true;

// ===== RECORDING ("Record Full Edit") =====
recordFullEditBtn.addEventListener('click', async function () {
  if (!audio.src) {
    alert('Please upload a song first.');
    return;
  }
  if (!videoTracks.some(Boolean)) {
    alert('Please upload at least one video take.');
    return;
  }
  if (!videoTracks[activeTrackIndex]) {
    alert('Selected camera has no video.');
    return;
  }

  isRecording = true;
  isPlaying = true;
  recordedChunks = [];
  exportStatus.textContent = '';
  recIndicator.style.display = 'block';
  exportBtn.disabled = true;

  // Set up canvas for video output
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 360;
  const ctx = canvas.getContext('2d');
  const currentTrack = videoTracks[activeTrackIndex];

  // Temporary video for drawing frames (DO NOT append to DOM)
  let tempVideo = document.createElement('video');
  tempVideo.src = currentTrack.url;
  tempVideo.crossOrigin = "anonymous";
  tempVideo.muted = true;
  await tempVideo.play();

  // Draw loop
  function drawFrame() {
    if (!isRecording || tempVideo.ended) return;
    ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
    animationFrameId = requestAnimationFrame(drawFrame);
  }
  drawFrame();

  // Prepare audio
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const source = audioContext.createMediaElementSource(audio);
  const dest = audioContext.createMediaStreamDestination();
  source.connect(dest);
  source.connect(audioContext.destination);

  // Combine canvas (video) and audio
  const canvasStream = canvas.captureStream(30);
  const combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...dest.stream.getAudioTracks()
  ]);

  // MediaRecorder
  mediaRecorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm; codecs=vp9,opus' });
  mediaRecorder.ondataavailable = function(e) {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };
  mediaRecorder.onstop = function() {
    cancelAnimationFrame(animationFrameId);
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    // Only update the one output video!
    masterOutputVideo.src = URL.createObjectURL(blob);
    masterOutputVideo.controls = true;
    masterOutputVideo.style.display = 'block';
    recIndicator.style.display = 'none';
    exportBtn.disabled = false;
    isRecording = false;
    isPlaying = false;
    exportStatus.textContent = 'Recording finished! Preview your cut below.';
    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }
  };

  // Start recording
  audio.currentTime = 0;
  tempVideo.currentTime = 0;
  audio.play();
  tempVideo.play();
  mediaRecorder.start();

  // When audio ends, stop everything
  audio.onended = function () {
    if (isRecording && mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      audio.onended = null;
    }
  };

  // Stop button
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
