// FASTCUT STUDIOS - Minimal, Reliable Version with Smooth Switching

const NUM_TRACKS = 6;
const audio = document.getElementById('audio');
const songInput = document.getElementById('songInput');
const masterOutputVideo = document.getElementById('masterOutputVideo');
const hiddenVideos = document.getElementById('hiddenVideos');
const switcherTracks = document.getElementById('switcherTracks');
const recordFullEditBtn = document.getElementById('recordFullEditBtn');
const recIndicator = document.getElementById('recIndicator');
const stopPreviewBtn = document.getElementById('stopPreviewBtn');
const exportBtn = document.getElementById('exportMusicVideoBtn');
const exportStatus = document.getElementById('exportStatus');
const switcherBtnsContainer = document.getElementById('switcherBtnsContainer');
const stopSwitchingBtn = document.getElementById('stopSwitchingBtn');

const videoTracks = Array(NUM_TRACKS).fill(null);
const tempVideos = Array(NUM_TRACKS).fill(null);
let activeTrackIndex = 0;
let isRecording = false;
let isSwitching = false;
let animationFrameId = null;
let mediaRecorder = null;
let recordedChunks = [];
let audioContext = null;

// Keep track of last camera for smooth switching
let lastActiveTrackIndex = -1;

// SONG UPLOAD
songInput.addEventListener('change', function (e) {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  audio.src = url;
  audio.load();
});

// CAMERA SLOT UI
for (let i = 0; i < NUM_TRACKS; i++) createTrackCard(i);

// CREATE SIX SIMPLE SWITCHER BUTTONS
createSwitcherBtns();

function createSwitcherBtns() {
  if (!switcherBtnsContainer) return;
  switcherBtnsContainer.innerHTML = '';
  for (let i = 0; i < NUM_TRACKS; i++) {
    const btn = document.createElement('button');
    btn.textContent = `Camera ${i + 1}`;
    btn.style.margin = '4px';
    btn.onclick = function () {
      if (!isSwitching) return;
      setActiveTrack(i);
      Array.from(switcherBtnsContainer.children).forEach((b, idx) =>
        b.style.background = idx === i ? "#ddd" : ""
      );
    };
    switcherBtnsContainer.appendChild(btn);
  }
}

// STOP BUTTON FOR SWITCHING
if (stopSwitchingBtn) {
  stopSwitchingBtn.onclick = function () {
    isSwitching = false;
    Array.from(switcherBtnsContainer.children).forEach((b) => b.style.background = "");
  };
}

// Function to start switching process (call this when you want to enable switching)
function startSwitching() {
  isSwitching = true;
}

function createTrackCard(index) {
  const card = document.createElement('div');
  card.style.border = '1px solid #888';
  card.style.margin = '10px';
  card.style.padding = '6px';
  card.style.width = '160px';
  card.style.display = 'inline-block';
  card.style.verticalAlign = 'top';

  // Title
  const title = document.createElement('div');
  title.textContent = `Camera ${index + 1}`;
  card.appendChild(title);

  // Upload
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

  // Record
  const recBtn = document.createElement('button');
  recBtn.textContent = 'Record';
  recBtn.style.marginTop = '4px';
  card.appendChild(recBtn);

  const stopRecBtn = document.createElement('button');
  stopRecBtn.textContent = 'Stop';
  stopRecBtn.style.display = 'none';
  stopRecBtn.style.marginLeft = '4px';
  card.appendChild(stopRecBtn);

  let trackRecorder = null;
  let recStream = null;
  let recChunks = [];

  recBtn.addEventListener('click', async function () {
    if (trackRecorder && trackRecorder.state === 'recording') return;
    recBtn.disabled = true;
    stopRecBtn.style.display = '';
    try {
      recStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch (err) {
      recBtn.disabled = false;
      stopRecBtn.style.display = 'none';
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
      videoTracks[index] = { file: null, url, name: `Camera${index+1}-take.webm`, recordedBlob: blob };
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
    }
  });

  // Download button
  const dlBtn = document.createElement('button');
  dlBtn.textContent = 'Download';
  dlBtn.style.display = 'none';
  dlBtn.style.marginTop = '4px';
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
  preview.controls = true;
  preview.style.width = '100%';
  preview.style.marginTop = '4px';
  preview.style.background = "#000";
  preview.muted = true;
  preview.playsInline = true;
  card.appendChild(preview);

  switcherTracks.appendChild(card);
}

// Remove "Add Video" button from your HTML!

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
  hiddenVideos.appendChild(v);
  tempVideos[idx] = v;
}

// --- Improved Core sync logic (no black frames during switching) ---
function synchronizeVideosToAudio() {
  const syncTime = audio.currentTime;
  tempVideos.forEach((v) => {
    if (v) {
      v.pause();
      v.currentTime = Math.min(syncTime, v.duration ? v.duration - 0.04 : syncTime);
    }
  });
  const vid = tempVideos[activeTrackIndex];
  if (vid) {
    // Wait for seeked before playing to avoid black/blank frames
    if (Math.abs(vid.currentTime - syncTime) > 0.02) {
      vid.currentTime = syncTime;
      vid.addEventListener('seeked', playAndDraw, { once: true });
    } else {
      playAndDraw();
    }
    function playAndDraw() {
      vid.play().catch(()=>{});
    }
  }
}
audio.addEventListener('seeked', synchronizeVideosToAudio);

function setActiveTrack(idx) {
  activeTrackIndex = idx;
  // On next drawFrame, the video will be synced and played if recording
  if (!isRecording) {
    // For previewing, update masterOutputVideo
    masterOutputVideo.srcObject = null;
    masterOutputVideo.src = videoTracks[idx] ? videoTracks[idx].url : "";
    masterOutputVideo.currentTime = 0;
    masterOutputVideo.pause();
  }
}

// --- RECORD FULL EDIT ---
recordFullEditBtn.addEventListener('click', async function () {
  // Check requirements
  if (!audio.src) {
    alert('Please upload a song first.');
    return;
  }
  if (!videoTracks.some(Boolean)) {
    alert('Please upload or record at least one video.');
    return;
  }
  if (!tempVideos[activeTrackIndex]) {
    alert('Selected camera has no video.');
    return;
  }
  isRecording = true;
  recordedChunks = [];
  exportStatus.textContent = '';
  if (recIndicator) recIndicator.style.display = 'block';
  if (exportBtn) exportBtn.disabled = true;

  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 360;
  const ctx = canvas.getContext('2d');

  // Ensure all temp videos are loaded & sync
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
  for (let i = 0; i < tempVideos.length; i++) {
    if (tempVideos[i]) {
      if (tempVideos[i].readyState < 2) {
        await new Promise(resolve => {
          tempVideos[i].addEventListener('loadeddata', resolve, { once: true });
        });
      }
    }
  }

  synchronizeVideosToAudio();

  // --- This is the improved drawFrame logic (your snippet) ---
  lastActiveTrackIndex = -1; // reset on recording start
  function drawFrame() {
    if (!isRecording) return;

    // If camera changed, sync new video to audio and play
    if (activeTrackIndex !== lastActiveTrackIndex) {
      const vid = tempVideos[activeTrackIndex];
      if (vid) {
        vid.currentTime = audio.currentTime;
        vid.play().catch(()=>{});
      }
      lastActiveTrackIndex = activeTrackIndex;
    }

    const vid = tempVideos[activeTrackIndex];
    if (vid && vid.readyState >= 2 && !vid.ended) {
      // Only sync currentTime if a large difference is detected (e.g. user seeks)
      if (Math.abs(vid.currentTime - audio.currentTime) > 0.2) {
        vid.currentTime = audio.currentTime;
      }
      ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
    }
    animationFrameId = requestAnimationFrame(drawFrame);
  }
  drawFrame();

  // Live preview
  try {
    masterOutputVideo.srcObject = canvas.captureStream(30);
    masterOutputVideo.src = "";
    masterOutputVideo.play();
  } catch (e) {}

  // Audio context for audio recording
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
    if (recIndicator) recIndicator.style.display = 'none';
    if (exportBtn) exportBtn.disabled = false;
    isRecording = false;
    exportStatus.textContent = 'Recording finished! Preview your cut below.';
    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }
  };

  audio.currentTime = 0;
  audio.play();
  synchronizeVideosToAudio();
  mediaRecorder.start();

  audio.onended = function () {
    if (isRecording && mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      audio.onended = null;
    }
  };

  if (stopPreviewBtn) {
    stopPreviewBtn.onclick = function () {
      if (isRecording && mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        audio.pause();
        if (recIndicator) recIndicator.style.display = 'none';
        exportStatus.textContent = 'Recording stopped.';
      }
    };
  }
});
