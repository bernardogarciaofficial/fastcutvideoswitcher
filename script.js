const NUM_TRACKS = 10;
const TRACK_WIDTH = 600, TRACK_HEIGHT = 340;
const PREVIEW_WIDTH = 160, PREVIEW_HEIGHT = 100;

const AUDIO_ACCEPTED = ".mp3,.wav,.ogg,.m4a,.aac,.flac,.aiff,audio/*";
const VIDEO_ACCEPTED = ".mp4,.webm,.mov,.ogg,.mkv,video/*";

function animateMembersCounter() {
  const el = document.getElementById('membersCountNumber');
  let n = 15347, up = true;
  setInterval(() => {
    if (Math.random() > 0.5) n += up ? 1 : -1;
    if (n < 15320) up = true;
    if (n > 15360) up = false;
    el.textContent = n.toLocaleString();
  }, 1200);
}
animateMembersCounter();

const songInput = document.getElementById('songInput');
songInput.setAttribute('accept', AUDIO_ACCEPTED);
const audio = document.getElementById('audio');
const audioStatus = document.getElementById('audioStatus');
let masterAudioFile = null;
songInput.onchange = e => {
  const file = e.target.files[0];
  masterAudioFile = file;
  if (file) {
    audio.src = URL.createObjectURL(file);
    audio.style.display = 'block';
    audio.load();
    audioStatus.textContent = `Audio loaded: ${file.name}`;
  } else {
    audio.style.display = 'none';
    audioStatus.textContent = "";
  }
};

const switcherTracks = document.getElementById("switcherTracks");
const TRACKS_WITH_UPLOAD = [1, 3, 6, 8];
switcherTracks.innerHTML = Array(NUM_TRACKS).fill(0).map((_, i) => {
  let uploadBtn = "";
  if (TRACKS_WITH_UPLOAD.includes(i)) {
    uploadBtn = `
      <label class="upload-video-label" for="uploadVideoInput-${i}">Upload Video File</label>
      <input type="file" id="uploadVideoInput-${i}" class="upload-video-input" accept="${VIDEO_ACCEPTED}" style="display:none;">
      <button class="upload-video-btn" id="uploadVideoBtn-${i}">🎬 Upload Video</button>
    `;
  }
  return `
    <div class="switcher-track" id="switcher-track-${i}">
      <div class="track-title">Track ${i + 1}</div>
      <video id="video-${i}" width="${PREVIEW_WIDTH}" height="${PREVIEW_HEIGHT}" controls muted></video>
      <div>
        <button id="recordBtn-${i}" class="select-btn">Record</button>
        <button id="stopBtn-${i}" class="select-btn" disabled>Stop</button>
        <span id="recIndicator-${i}" class="rec-indicator" style="display:none;">● REC</span>
      </div>
      ${uploadBtn}
    </div>
  `;
}).join("");

// --- Ensure all video elements loop, preventing early end/black frame ---
for (let i = 0; i < NUM_TRACKS; i++) {
  const video = document.getElementById(`video-${i}`);
  if (video) video.loop = true;
}

const videoTracks = [];
for (let i = 0; i < NUM_TRACKS; i++) {
  let mediaRecorder = null;
  let recordedChunks = [];
  let stream = null;

  const recordBtn = document.getElementById(`recordBtn-${i}`);
  const stopBtn = document.getElementById(`stopBtn-${i}`);
  const video = document.getElementById(`video-${i}`);
  const recIndicator = document.getElementById(`recIndicator-${i}`);

  videoTracks.push({ video, recordedChunks });

  recordBtn.onclick = async () => {
    recordBtn.disabled = true;
    stopBtn.disabled = false;
    recIndicator.style.display = "inline";
    recordedChunks = [];
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 360, frameRate: 24 }, audio: true });
      video.srcObject = stream;
      video.muted = true;
      video.controls = false;
      video.play();

      if (audio.src) {
        audio.currentTime = 0;
        audio.play().catch(() => {
          audioStatus.textContent = "Click the audio controls once to enable music sync.";
        });
      }

      mediaRecorder = new MediaRecorder(stream, { mimeType: "video/webm" });
      mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };
      mediaRecorder.onstop = () => {
        if (video.srcObject) {
          video.srcObject.getTracks().forEach(track => track.stop());
          video.srcObject = null;
        }
        const blob = new Blob(recordedChunks, { type: "video/webm" });
        video.src = URL.createObjectURL(blob);
        video.controls = true;
        video.muted = false;
        video.load();
        recIndicator.style.display = "none";
      };
      mediaRecorder.start();
    } catch (err) {
      alert("Webcam access denied or error: " + err.message);
      recordBtn.disabled = false;
      stopBtn.disabled = true;
      recIndicator.style.display = "none";
    }
  };

  stopBtn.onclick = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    recordBtn.disabled = false;
    stopBtn.disabled = true;
    recIndicator.style.display = "none";
    if (!audio.paused) {
      audio.pause();
      audio.currentTime = 0;
    }
  };

  if (TRACKS_WITH_UPLOAD.includes(i)) {
    const uploadBtn = document.getElementById(`uploadVideoBtn-${i}`);
    const uploadInput = document.getElementById(`uploadVideoInput-${i}`);
    uploadBtn.onclick = () => uploadInput.click();
    uploadInput.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      video.src = url;
      video.controls = true;
      video.muted = false;
      video.load();
      uploadBtn.textContent = "🎬 Uploaded!";
      setTimeout(() => uploadBtn.textContent = "🎬 Upload Video", 3000);
    };
  }
}

const fastcutSwitcher = document.getElementById('fastcutSwitcher');
fastcutSwitcher.innerHTML = Array(NUM_TRACKS).fill(0).map((_, i) =>
  `<button class="fastcut-btn" id="fastcutBtn-${i}">T${i+1}</button>`
).join('');

let activeTrack = 0;
const fastcutBtns = [];
for (let i = 0; i < NUM_TRACKS; i++) {
  const btn = document.getElementById(`fastcutBtn-${i}`);
  fastcutBtns.push(btn);
  btn.onclick = () => setActiveTrack(i);
}
function setActiveTrack(idx) {
  activeTrack = idx;
  document.querySelectorAll('.switcher-track').forEach((el,j) =>
    el.classList.toggle('active', j === idx)
  );
  fastcutBtns.forEach((btn,j) =>
    btn.classList.toggle('active', j === idx)
  );
}
setActiveTrack(0);

const mainRecordBtn = document.getElementById('mainRecordBtn');
const mainStopBtn = document.getElementById('mainStopBtn');
const recordStatus = document.getElementById('recordStatus');
const masterOutputVideo = document.getElementById('masterOutputVideo');
const exportBtn = document.getElementById('exportBtn');
const exportStatus = document.getElementById('exportStatus');
const mixCanvas = document.getElementById('mixCanvas');

let mixing = false, mediaRecorder = null, masterChunks = [];
let drawRequestId = null;
let livePlaybackUrl = null;
let audioCtx = null;
let source = null;
let audioSessionStartTime = null;
let decodedAudioBuffer = null;

mainRecordBtn.onclick = async function() {
  recordStatus.textContent = "";
  exportStatus.textContent = "";
  exportBtn.disabled = true;

  const readyVideos = [];
  for (let i = 0; i < NUM_TRACKS; i++) {
    const v = document.getElementById(`video-${i}`);
    if (v && v.src && v.readyState >= 2) readyVideos.push(v);
  }
  if (!masterAudioFile) {
    recordStatus.textContent = "Load your audio track first!";
    return;
  }
  if (readyVideos.length < 2) {
    recordStatus.textContent = "Record at least 2 videos!";
    return;
  }

  // Ensure all used videos are loaded and ready
  for (let i = 0; i < NUM_TRACKS; i++) {
    const v = document.getElementById(`video-${i}`);
    if (v && v.src && v.readyState < 2) {
      recordStatus.textContent = `Track ${i+1} video not ready!`;
      return;
    }
  }

  // Decode audio using AudioContext for master clock
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const audioFileBuffer = await masterAudioFile.arrayBuffer();
  decodedAudioBuffer = await audioCtx.decodeAudioData(audioFileBuffer);

  // Get duration from decoded buffer
  const duration = decodedAudioBuffer.duration;

  // Reset all videos and pause
  for (let i = 0; i < NUM_TRACKS; i++) {
    const v = document.getElementById(`video-${i}`);
    if (v && v.src) {
      v.pause();
      v.currentTime = 0;
      v.loop = true; // Ensure looping even if the user uploaded/recorded
    }
  }

  // Prepare canvas and MediaRecorder
  const ctx = mixCanvas.getContext('2d');
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, mixCanvas.width, mixCanvas.height);

  const stream = mixCanvas.captureStream(30);
  masterChunks = [];
  mediaRecorder = new MediaRecorder(stream, { mimeType: "video/webm" });
  mediaRecorder.ondataavailable = e => { if (e.data.size > 0) masterChunks.push(e.data); };

  // Use AudioContext for output audio
  const dest = audioCtx.createMediaStreamDestination();
  source = audioCtx.createBufferSource();
  source.buffer = decodedAudioBuffer;
  source.connect(dest);
  // Add audio track to the video stream
  if (dest.stream.getAudioTracks().length > 0) {
    stream.addTrack(dest.stream.getAudioTracks()[0]);
  }

  if(livePlaybackUrl) {
    URL.revokeObjectURL(livePlaybackUrl);
    livePlaybackUrl = null;
  }
  masterOutputVideo.srcObject = stream;
  masterOutputVideo.play();

  mixing = true;
  mainRecordBtn.disabled = true;
  mainStopBtn.disabled = false;
  recordStatus.textContent = "Recording... Use the FastCut buttons to live-switch!";
  exportBtn.disabled = true;

  // Sync all videos to 0, muted, and play (but we'll resync them constantly in draw())
  for (let i = 0; i < NUM_TRACKS; i++) {
    const v = document.getElementById(`video-${i}`);
    if (v && v.src) {
      v.currentTime = 0;
      v.muted = true;
      v.play();
      v.loop = true;
    }
  }

  // Start audio and frame-perfect sync
  source.start();
  audioSessionStartTime = audioCtx.currentTime;

  mediaRecorder.start();

  function draw() {
    if (!mixing) return;
    // Use audioCtx.currentTime as master
    const elapsed = audioCtx.currentTime - audioSessionStartTime;
    // Sync each video to the master clock if drift > 40ms
    for (let i = 0; i < NUM_TRACKS; i++) {
      const v = document.getElementById(`video-${i}`);
      if (v && v.src && Math.abs(v.currentTime - elapsed) > 0.04 && !v.seeking && !v.ended) {
        try {
          v.currentTime = Math.min(elapsed, v.duration || 9999);
        } catch (e) {}
      }
    }
    // Draw the current active track
    const v = document.getElementById(`video-${activeTrack}`);
    if (v && !v.paused && !v.ended && v.readyState >= 2) {
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, TRACK_WIDTH, TRACK_HEIGHT);
      ctx.drawImage(v, 0, 0, TRACK_WIDTH, TRACK_HEIGHT);
      // No frame caching, just freeze canvas on last good frame if video not ready
    }
    // If video not available, do not redraw the canvas (leaves last frame showing)
    if (elapsed < duration && mixing) {
      drawRequestId = requestAnimationFrame(draw);
    } else {
      stopMasterRecording();
    }
  }
  draw();
};

mainStopBtn.onclick = () => {
  stopMasterRecording();
};

function stopMasterRecording() {
  if (!mixing) return;
  mixing = false;
  mainRecordBtn.disabled = false;
  mainStopBtn.disabled = true;
  recordStatus.textContent = "";

  for (let i = 0; i < NUM_TRACKS; i++) {
    const v = document.getElementById(`video-${i}`);
    if (v && v.src) v.pause();
  }
  // Stop audio
  try {
    if (source) source.stop();
  } catch (e) {}
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
    mediaRecorder.onstop = () => {
      masterOutputVideo.srcObject = null;
      if(livePlaybackUrl) {
        URL.revokeObjectURL(livePlaybackUrl);
        livePlaybackUrl = null;
      }
      const blob = new Blob(masterChunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      masterOutputVideo.src = url;
      masterOutputVideo.load();
      livePlaybackUrl = url;
      recordStatus.textContent = "Done! Preview below.";
      exportBtn.disabled = false;
    };
  }
  if (drawRequestId !== null) {
    cancelAnimationFrame(drawRequestId);
    drawRequestId = null;
  }
  if (audioCtx) {
    audioCtx.close();
    audioCtx = null;
  }
}

// Export logic
exportBtn.onclick = () => {
  if (!masterOutputVideo.src && !livePlaybackUrl) {
    exportStatus.textContent = "No master video to export!";
    return;
  }
  const a = document.createElement('a');
  a.href = masterOutputVideo.src || livePlaybackUrl;
  a.download = 'fastcut_music_video.webm';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  exportStatus.textContent = "Download started!";
};
