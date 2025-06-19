// FASTCUT MUSIC VIDEO MAKER - WITH Record Full Edit, Stop, Export

const NUM_TRACKS = 6;
const songInput = document.getElementById('songInput');
const audio = document.getElementById('audio');
const mainOutput = document.getElementById('mainOutput');
const tracksContainer = document.getElementById('tracksContainer');
const switcherBtnsContainer = document.getElementById('switcherBtnsContainer');
const recordFullEditBtn = document.getElementById('recordFullEditBtn');
const stopPreviewBtn = document.getElementById('stopPreviewBtn');
const exportBtn = document.getElementById('exportMusicVideoBtn');
const exportStatus = document.getElementById('exportStatus');
const warnSong = document.getElementById('warnSong');

const videoTracks = Array(NUM_TRACKS).fill(null);
const tempVideos = Array(NUM_TRACKS).fill(null);
let activeTrackIndex = 0;
let requestedTrackIndex = 0;
let isRecording = false;
let animationFrameId = null;
let mediaRecorder = null;
let recordedChunks = [];
let audioContext = null;
const FADE_DURATION = 0.7; // seconds
const SYNC_THRESHOLD = 0.04; // 40ms

let fadeState = null;

// Persistent canvas for compositing
const outputCanvas = document.createElement('canvas');
outputCanvas.width = 640;
outputCanvas.height = 360;
const outputCtx = outputCanvas.getContext('2d');

// Helper: Stop draw loop
function stopDrawLoop() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

// ---- Track Cards ----
function createTrackCard(index) {
  const card = document.createElement('div');
  card.className = 'track-card';

  const title = document.createElement('div');
  title.className = "track-title";
  title.textContent = `Camera ${index + 1}`;
  card.appendChild(title);

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'video/*';
  input.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    videoTracks[index] = { file, url, name: file.name };
    prepareTempVideo(index, url);
    preview.src = url;
    preview.load();
    dlBtn.style.display = '';
  });
  card.appendChild(input);

  const recBtn = document.createElement('button');
  recBtn.textContent = 'Rec';
  card.appendChild(recBtn);

  const stopRecBtn = document.createElement('button');
  stopRecBtn.textContent = 'Stop';
  stopRecBtn.style.display = 'none';
  card.appendChild(stopRecBtn);

  let trackRecorder = null;
  let recStream = null;
  let recChunks = [];

  recBtn.addEventListener('click', async function () {
    recBtn.disabled = true;
    stopRecBtn.style.display = '';
    try {
      recStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch (err) {
      recBtn.disabled = false;
      stopRecBtn.style.display = 'none';
      alert("Camera/mic permission denied.");
      return;
    }
    preview.srcObject = recStream;
    preview.muted = true;
    preview.autoplay = true;
    preview.play().catch(()=>{});
    trackRecorder = new MediaRecorder(recStream, { mimeType: 'video/webm; codecs=vp9,opus' });
    recChunks = [];
    trackRecorder.ondataavailable = function(e) {
      if (e.data.size > 0) recChunks.push(e.data);
    };
    trackRecorder.onstop = function() {
      const blob = new Blob(recChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      videoTracks[index] = { file: null, url, name: `Cam${index+1}-take.webm`, recordedBlob: blob };
      prepareTempVideo(index, url);
      preview.srcObject = null;
      preview.src = url;
      preview.load();
      dlBtn.style.display = '';
      recBtn.disabled = false;
      stopRecBtn.style.display = 'none';
      if (recStream) recStream.getTracks().forEach(track => track.stop());
    };
    trackRecorder.start();
  });

  stopRecBtn.addEventListener('click', function() {
    if (trackRecorder && trackRecorder.state === 'recording') {
      trackRecorder.stop();
      stopRecBtn.style.display = 'none';
      recBtn.disabled = false;
    }
  });

  const dlBtn = document.createElement('button');
  dlBtn.textContent = 'DL';
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

  const preview = document.createElement('video');
  preview.controls = true;
  preview.style.background = "#000";
  preview.muted = true;
  preview.playsInline = true;
  card.appendChild(preview);

  tracksContainer.appendChild(card);
}

function prepareTempVideo(idx, url) {
  if (tempVideos[idx]) {
    tempVideos[idx].pause();
    tempVideos[idx].remove();
  }
  const v = document.createElement('video');
  v.src = url;
  v.crossOrigin = "anonymous";
  v.muted = true;
  v.preload = "auto";
  v.playsInline = true;
  v.style.display = "none";
  v.load();
  document.body.appendChild(v);
  tempVideos[idx] = v;
}

// ---- Switcher ----
function createSwitcherBtns() {
  switcherBtnsContainer.innerHTML = '';
  for (let i = 0; i < NUM_TRACKS; i++) {
    const btn = document.createElement('button');
    btn.textContent = String(i + 1);
    btn.onclick = function () {
      if (i === requestedTrackIndex) return;
      startFade(activeTrackIndex, i);
      requestedTrackIndex = i;
      updateSwitcherBtns();
      ensureAudioPlays();
    };
    switcherBtnsContainer.appendChild(btn);
  }
  updateSwitcherBtns();
}

function updateSwitcherBtns() {
  for (let j = 0; j < NUM_TRACKS; j++) {
    switcherBtnsContainer.children[j].className = (j === requestedTrackIndex) ? "active-switcher-btn" : "";
  }
}

// ---- Fade Logic ----
function startFade(fromIdx, toIdx) {
  if (!tempVideos[toIdx]) {
    activeTrackIndex = toIdx;
    requestedTrackIndex = toIdx;
    return;
  }
  fadeState = {
    from: fromIdx,
    to: toIdx,
    startTime: performance.now(),
    duration: FADE_DURATION * 1000
  };
}

function getFadeAlpha(time, duration) {
  if (time < FADE_DURATION) return time / FADE_DURATION;
  if (duration && time > duration - FADE_DURATION) return (duration - time) / FADE_DURATION;
  return 1;
}

// ---- Drawing Loop ----
function drawLoop() {
  let t = audio.currentTime || 0;
  let mainVid = tempVideos[activeTrackIndex];
  let showFade = fadeState !== null;

  if (showFade && fadeState) {
    let elapsed = (performance.now() - fadeState.startTime) / 1000;
    let alpha = Math.min(elapsed / FADE_DURATION, 1);
    let fromVid = tempVideos[fadeState.from];
    let toVid = tempVideos[fadeState.to];

    if (fromVid) fromVid.currentTime = Math.min(t, fromVid.duration || t);
    if (toVid) toVid.currentTime = Math.min(t, toVid.duration || t);

    outputCtx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
    if (fromVid && fromVid.readyState >= 2) {
      outputCtx.globalAlpha = 1 - alpha;
      outputCtx.drawImage(fromVid, 0, 0, outputCanvas.width, outputCanvas.height);
    }
    if (toVid && toVid.readyState >= 2) {
      outputCtx.globalAlpha = alpha;
      outputCtx.drawImage(toVid, 0, 0, outputCanvas.width, outputCanvas.height);
    }
    outputCtx.globalAlpha = 1;

    if (alpha >= 1) {
      activeTrackIndex = fadeState.to;
      fadeState = null;
      updateSwitcherBtns();
    }
  } else if (mainVid && mainVid.readyState >= 2 && t < (mainVid.duration || Infinity)) {
    if (Math.abs(mainVid.currentTime - t) > SYNC_THRESHOLD) {
      try {
        mainVid.currentTime = Math.min(t, mainVid.duration ? mainVid.duration - 0.033 : t);
      } catch (err) {}
    }
    outputCtx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
    outputCtx.globalAlpha = getFadeAlpha(t, audio.duration || 0);
    outputCtx.drawImage(mainVid, 0, 0, outputCanvas.width, outputCanvas.height);
    outputCtx.globalAlpha = 1;
  } else {
    outputCtx.globalAlpha = 1;
    outputCtx.fillStyle = "#000";
    outputCtx.fillRect(0, 0, outputCanvas.width, outputCanvas.height);
  }

  animationFrameId = requestAnimationFrame(drawLoop);
}

// ---- AUDIO ----
songInput.addEventListener('change', function() {
  warnSong.style.display = 'none';
  if (songInput.files.length > 0) {
    const file = songInput.files[0];
    audio.src = URL.createObjectURL(file);
    audio.load();
    audio.currentTime = 0;
    audio.volume = 1;
  }
});

// ---- Record Full Edit ----
recordFullEditBtn.addEventListener('click', async function () {
  if (!audio.src) {
    warnSong.style.display = '';
    setTimeout(() => { warnSong.style.display = 'none'; }, 2500);
    alert('Please upload a song first.');
    return;
  }
  if (!videoTracks.some(Boolean)) {
    alert('Please upload or record at least one video.');
    return;
  }

  // Auto-select first loaded video if needed
  let firstLoaded = tempVideos.findIndex(v => v);
  if (firstLoaded === -1) {
    alert('No video loaded in any camera.');
    return;
  }
  if (!tempVideos[activeTrackIndex]) {
    activeTrackIndex = firstLoaded;
    requestedTrackIndex = firstLoaded;
    updateSwitcherBtns();
  }
  if (!tempVideos[activeTrackIndex]) {
    alert('Selected camera has no video.');
    return;
  }

  isRecording = true;
  recordedChunks = [];
  if (exportStatus) exportStatus.textContent = '';
  if (exportBtn) exportBtn.disabled = true;

  stopDrawLoop();

  for (let i = 0; i < tempVideos.length; i++) {
    if (tempVideos[i]) {
      tempVideos[i].pause();
      tempVideos[i].currentTime = 0;
      await new Promise(resolve => tempVideos[i].addEventListener('seeked', resolve, { once: true }));
      await tempVideos[i].play();
    }
  }
  fadeState = null;
  updateSwitcherBtns();

  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaElementSource(audio);
    const dest = audioContext.createMediaStreamDestination();
    source.connect(dest);
    source.connect(audioContext.destination);

    const canvasStream = outputCanvas.captureStream(30);
    const combinedStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...dest.stream.getAudioTracks()
    ]);

    mediaRecorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm; codecs=vp9,opus' });
    mediaRecorder.ondataavailable = function(e) {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };
    mediaRecorder.onstop = function() {
      stopDrawLoop();
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      mainOutput.src = URL.createObjectURL(blob);
      mainOutput.srcObject = null;
      mainOutput.controls = true;
      mainOutput.style.display = 'block';
      if (exportBtn) exportBtn.disabled = false;
      isRecording = false;
      if (exportStatus) exportStatus.textContent = 'Recording finished! Preview your cut below.';
      if (audioContext) {
        audioContext.close();
        audioContext = null;
      }
      // Restore preview loop after recording
      mainOutput.srcObject = outputCanvas.captureStream(30);
      animationFrameId = requestAnimationFrame(drawLoop);
      createSwitcherBtns();
    };

    audio.currentTime = 0;
    await audio.play().catch((err)=>{
      alert('Audio playback failed. Please click the play button on the audio player to enable audio.');
      if (exportStatus) exportStatus.textContent = 'Audio playback blocked. Click play on the audio bar.';
    });
    mediaRecorder.start();

    // Re-enable switcher during recording
    switcherBtnsContainer.innerHTML = "";
    for (let i = 0; i < NUM_TRACKS; i++) {
      const btn = document.createElement('button');
      btn.textContent = String(i + 1);
      btn.onclick = function () {
        if (i === requestedTrackIndex) return;
        startFade(activeTrackIndex, i);
        requestedTrackIndex = i;
        updateSwitcherBtns();
      };
      switcherBtnsContainer.appendChild(btn);
    }
    updateSwitcherBtns();

    animationFrameId = requestAnimationFrame(drawLoop);

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
        if (exportStatus) exportStatus.textContent = 'Recording stopped.';
      }
    };
  } catch (err) {
    alert("Browser audio/video recording error: " + err.message);
    if (exportStatus) exportStatus.textContent = 'Recording error. Try a different browser or audio file format.';
    isRecording = false;
    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }
    createSwitcherBtns();
    mainOutput.srcObject = outputCanvas.captureStream(30);
    animationFrameId = requestAnimationFrame(drawLoop);
    return;
  }
});

// ---- EXPORT ----
exportBtn.addEventListener('click', function () {
  if (!mainOutput.src) {
    if (exportStatus) exportStatus.textContent = 'Nothing to export yet!';
    return;
  }
  fetch(mainOutput.src)
    .then(res => res.blob())
    .then(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'fastcut-edit.webm';
      a.click();
      if (exportStatus) exportStatus.textContent = 'Video exported – check your downloads!';
    });
});

// ---- Always Keep Audio Playing on Switch or Play ----
function ensureAudioPlays() {
  if (audio.src && audio.paused) {
    audio.play().catch(()=>{});
  }
}
mainOutput.addEventListener('play', ensureAudioPlays);
mainOutput.addEventListener('seeking', ensureAudioPlays);
mainOutput.addEventListener('click', ensureAudioPlays);
switcherBtnsContainer.addEventListener('click', ensureAudioPlays);

// ---- Init ----
for (let i = 0; i < NUM_TRACKS; i++) createTrackCard(i);
createSwitcherBtns();
warnSong.style.display = 'none';

// Start preview loop
mainOutput.srcObject = outputCanvas.captureStream(30);
animationFrameId = requestAnimationFrame(drawLoop);
