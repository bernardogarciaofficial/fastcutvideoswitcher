// FASTCUT MUSIC VIDEO MAKER – fade in at switch start, fade out at switch end

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
const thumbVideos = Array.from({ length: NUM_TRACKS }, (_, i) => document.getElementById(`thumb${i}`));

const videoTracks = Array(NUM_TRACKS).fill(null); // {file, url, name, recordedBlob}
const tempVideos = Array(NUM_TRACKS).fill(null); // DOM video elements for compositing
let activeTrackIndex = 0;
let requestedTrackIndex = 0;
let isRecording = false;
let animationFrameId = null;
let mediaRecorder = null;
let recordedChunks = [];
let audioContext = null;

let transitionState = null;
const TRANSITION_DURATION = 0.6; // seconds (0.3 fade in, 0.3 fade out)


// Persistent canvas for compositing
const outputCanvas = document.createElement('canvas');
outputCanvas.width = 640;
outputCanvas.height = 360;
const outputCtx = outputCanvas.getContext('2d');

// ---- Track Cards with Upload/Rec Controls ----
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
    thumbVideos[index].src = url;
    thumbVideos[index].style.display = 'block';
    thumbVideos[index].load();
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
    // For recording preview, use the thumbnail video element
    const preview = thumbVideos[index];
    preview.srcObject = recStream;
    preview.muted = true;
    preview.autoplay = true;
    preview.style.display = 'block';
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
      if (i === activeTrackIndex) return;
      transitionState = {
        from: activeTrackIndex,
        to: i,
        startTime: performance.now()
      };
      requestedTrackIndex = i;
      updateSwitcherBtns();
      ensureAudioPlays();
    };
    switcherBtnsContainer.appendChild(btn);
  }
  updateSwitcherBtns();
}

function updateThumbnails() {
  for (let i = 0; i < NUM_TRACKS; i++) {
    thumbVideos[i].classList.toggle('active', i === activeTrackIndex);
    thumbVideos[i].style.opacity = (i === activeTrackIndex) ? "1" : "0.65";
    thumbVideos[i].style.boxShadow = (i === activeTrackIndex) ? "0 0 10px #ff3333" : "";
  }
}

function updateSwitcherBtns() {
  for (let j = 0; j < NUM_TRACKS; j++) {
    switcherBtnsContainer.children[j].className = (j === requestedTrackIndex) ? "active-switcher-btn" : "";
  }
  updateThumbnails();
}

// --- Helpers for black frame prevention and syncing ---
function isVidReady(v) {
  // Video is ready only if it has enough data and isn't at end
  return v && v.readyState >= 2 && v.currentTime < (v.duration || Infinity);
}

function seekAndWait(v, t) {
  return new Promise(resolve => {
    if (!v) return resolve();
    // Only seek if not already almost at correct time
    if (Math.abs(v.currentTime - t) > 0.033) {
      v.currentTime = Math.min(t, v.duration ? v.duration - 0.033 : t);
      v.addEventListener('seeked', resolve, { once: true });
    } else {
      resolve();
    }
  });
}

async function ensureAllVideosReadyAt(t) {
  const waitPromises = tempVideos
    .filter(v => v)
    .map(v => seekAndWait(v, t));
  await Promise.all(waitPromises);
}

// ---- Drawing Loop ----
async function drawLoop() {
  let t = audio.currentTime || 0;

  // Handle transition state: fade in new, then fade out old
  if (transitionState) {
    const elapsed = (performance.now() - transitionState.startTime) / 1000;
    const fromVid = tempVideos[transitionState.from];
    const toVid = tempVideos[transitionState.to];

    // Ensure both videos are at correct time
    await Promise.all([seekAndWait(fromVid, t), seekAndWait(toVid, t)]);

    outputCtx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);

    if (elapsed < TRANSITION_DURATION / 2) {
      // Fade in the new video only
      const alpha = elapsed / (TRANSITION_DURATION / 2);
      if (isVidReady(fromVid)) {
        outputCtx.globalAlpha = 1;
        outputCtx.drawImage(fromVid, 0, 0, outputCanvas.width, outputCanvas.height);
      }
      if (isVidReady(toVid)) {
        outputCtx.globalAlpha = alpha;
        outputCtx.drawImage(toVid, 0, 0, outputCanvas.width, outputCanvas.height);
      }
      outputCtx.globalAlpha = 1;
    } else if (elapsed < TRANSITION_DURATION) {
      // New video at full opacity, old video fades out on top
      const alpha = 1 - (elapsed - TRANSITION_DURATION / 2) / (TRANSITION_DURATION / 2);
      if (isVidReady(toVid)) {
        outputCtx.globalAlpha = 1;
        outputCtx.drawImage(toVid, 0, 0, outputCanvas.width, outputCanvas.height);
      }
      if (isVidReady(fromVid)) {
        outputCtx.globalAlpha = alpha;
        outputCtx.drawImage(fromVid, 0, 0, outputCanvas.width, outputCanvas.height);
      }
      outputCtx.globalAlpha = 1;
    } else {
      // Transition finished
      activeTrackIndex = transitionState.to;
      transitionState = null;
    }
  }

  // Normal drawing when not switching
  if (!transitionState) {
    const mainVid = tempVideos[activeTrackIndex];
    if (mainVid && mainVid.readyState >= 2 && mainVid.currentTime < (mainVid.duration || Infinity)) {
      if (Math.abs(mainVid.currentTime - t) > 0.033) {
        mainVid.currentTime = Math.min(t, mainVid.duration ? mainVid.duration - 0.033 : t);
        await new Promise(resolve => mainVid.addEventListener('seeked', resolve, { once: true }));
      }
      outputCtx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
      outputCtx.globalAlpha = 1;
      outputCtx.drawImage(mainVid, 0, 0, outputCanvas.width, outputCanvas.height);
      outputCtx.globalAlpha = 1;
    } else {
      outputCtx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
      outputCtx.globalAlpha = 1;
      outputCtx.fillStyle = "#000";
      outputCtx.fillRect(0, 0, outputCanvas.width, outputCanvas.height);
    }
  }

  animationFrameId = requestAnimationFrame(drawLoop);
}

// ---- Stop the draw loop (for recording)
function stopDrawLoop() {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
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

  // Seek all loaded videos to 0 and ensure they're ready before starting
  await ensureAllVideosReadyAt(0);
  transitionState = null;
  updateSwitcherBtns();

  // --- TRIGGER MUSIC PLAY AND WAIT FOR IT TO START ---
  audio.currentTime = 0;
  let playResult = audio.play();
  if (playResult && typeof playResult.then === "function") {
    try {
      await playResult;
    } catch (e) {
      alert("Audio playback was blocked by your browser. Please interact with the audio controls and try again.");
      isRecording = false;
      createSwitcherBtns();
      mainOutput.srcObject = outputCanvas.captureStream(30);
      animationFrameId = requestAnimationFrame(drawLoop);
      return;
    }
  }

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
      mainOutput.srcObject = outputCanvas.captureStream(30);
      animationFrameId = requestAnimationFrame(drawLoop);
      createSwitcherBtns();
    };

    mediaRecorder.start();

    // Re-enable switcher during recording
    switcherBtnsContainer.innerHTML = "";
    for (let i = 0; i < NUM_TRACKS; i++) {
      const btn = document.createElement('button');
      btn.textContent = String(i + 1);
      btn.onclick = function () {
        if (i === activeTrackIndex) return;
        transitionState = {
          from: activeTrackIndex,
          to: i,
          startTime: performance.now()
        };
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

mainOutput.srcObject = outputCanvas.captureStream(30);
animationFrameId = requestAnimationFrame(drawLoop);
