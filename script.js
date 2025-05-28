// FastCut Music Video Switcher - main logic with multi-format export

const NUM_TRACKS = 10;
const TRACK_WIDTH = 600, TRACK_HEIGHT = 340;
const PREVIEW_WIDTH = 160, PREVIEW_HEIGHT = 100;

// Accept all major audio formats
const AUDIO_ACCEPTED = ".mp3,.wav,.ogg,.m4a,.aac,.flac,.aiff,audio/*";
const VIDEO_ACCEPTED = ".mp4,.webm,.mov,.ogg,.mkv,video/*";

// --- Dummy members counter, could be replaced with live value from backend
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

// Switcher track UI setup
const switcherTracks = document.getElementById("switcherTracks");
const TRACKS_WITH_UPLOAD = [1, 3, 6, 8]; // 0-indexed: 2,4,7,9
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

// Track recording/playback logic
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
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
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

  // --- Video File Upload for theme tracks
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

// FastCut Switcher Row (10 buttons for live switching)
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

// Main record/stop/export logic
const mainRecordBtn = document.getElementById('mainRecordBtn');
const mainStopBtn = document.getElementById('mainStopBtn');
const recordStatus = document.getElementById('recordStatus');
const masterOutputVideo = document.getElementById('masterOutputVideo');
const exportBtn = document.getElementById('exportBtn');
const exportStatus = document.getElementById('exportStatus');
const mixCanvas = document.getElementById('mixCanvas');
const exportFormat = document.getElementById('exportFormat');

let mixing = false, mediaRecorder = null, masterChunks = [];
let drawRequestId = null;
let livePlaybackUrl = null;

// ffmpeg.wasm integration
let ffmpegReady = false;
let ffmpeg; // Will hold ffmpeg.wasm instance

async function loadFFmpeg() {
  if (ffmpegReady) return ffmpeg;
  const { createFFmpeg, fetchFile } = FFmpeg;
  ffmpeg = createFFmpeg({ log: true });
  exportStatus.textContent = "Loading video converter...";
  await ffmpeg.load();
  ffmpegReady = true;
  exportStatus.textContent = "";
  return ffmpeg;
}

mainRecordBtn.onclick = async function() {
  recordStatus.textContent = "";
  exportStatus.textContent = "";
  exportBtn.disabled = true;

  // Prepare all video tracks: must be loaded and ready
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

  // Get audio duration
  const audioBlobURL = URL.createObjectURL(masterAudioFile);
  const tempAudio = new Audio(audioBlobURL);
  await new Promise(r => { tempAudio.onloadedmetadata = r; });
  const duration = tempAudio.duration;
  URL.revokeObjectURL(audioBlobURL);

  // Sync all videos and audio to 0 and pause
  for (let i = 0; i < NUM_TRACKS; i++) {
    const v = document.getElementById(`video-${i}`);
    if (v && v.src) {
      v.currentTime = 0; v.pause();
    }
  }
  audio.currentTime = 0; audio.pause();

  // Wait for all videos to seek to 0 and be ready to play
  await Promise.all(
    Array.from({length: NUM_TRACKS}, (_, i) => {
      const v = document.getElementById(`video-${i}`);
      if (v && v.src) {
        return new Promise(resolve => {
          const seekHandler = () => {
            v.removeEventListener('seeked', seekHandler);
            resolve();
          };
          v.addEventListener('seeked', seekHandler);
          v.currentTime = 0;
        });
      } else {
        return Promise.resolve();
      }
    })
  );

  // Prepare canvas and MediaRecorder
  const ctx = mixCanvas.getContext('2d');
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, mixCanvas.width, mixCanvas.height);

  const stream = mixCanvas.captureStream(30);
  masterChunks = [];
  mediaRecorder = new MediaRecorder(stream, { mimeType: "video/webm" });
  mediaRecorder.ondataavailable = e => { if (e.data.size > 0) masterChunks.push(e.data); };

  // Audio for recording (mixAudioTrack)
  let audioTrack;
  try {
    const audioCtx = new AudioContext();
    const source = audioCtx.createBufferSource();
    const audioFileBuffer = await masterAudioFile.arrayBuffer();
    const decoded = await audioCtx.decodeAudioData(audioFileBuffer);
    source.buffer = decoded;
    const dest = audioCtx.createMediaStreamDestination();
    source.connect(dest);
    audioTrack = dest.stream.getAudioTracks()[0];
    stream.addTrack(audioTrack);
    source.start();
  } catch (e) {
    recordStatus.textContent = "Cannot mix audio - browser does not support advanced audio mixing.";
    return;
  }

  // Show live canvas in main output video
  if(livePlaybackUrl) {
    URL.revokeObjectURL(livePlaybackUrl);
    livePlaybackUrl = null;
  }
  masterOutputVideo.srcObject = stream;
  masterOutputVideo.play();

  // Start everything in sync
  mixing = true;
  mainRecordBtn.disabled = true;
  mainStopBtn.disabled = false;
  recordStatus.textContent = "Recording... Use the FastCut buttons to live-switch!";
  exportBtn.disabled = true;

  // Play all videos, but only display the active one on canvas
  for (let i = 0; i < NUM_TRACKS; i++) {
    const v = document.getElementById(`video-${i}`);
    if (v && v.src) {
      v.currentTime = 0;
      v.muted = true;
      v.play();
    }
  }
  audio.currentTime = 0;
  audio.play();

  mediaRecorder.start();

  let t0 = performance.now();
  function draw() {
    if (!mixing) return;
    // Draw active track frame to canvas
    const v = document.getElementById(`video-${activeTrack}`);
    if (v && !v.paused && !v.ended) {
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, TRACK_WIDTH, TRACK_HEIGHT);
      ctx.drawImage(v, 0, 0, TRACK_WIDTH, TRACK_HEIGHT);
    } else {
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, TRACK_WIDTH, TRACK_HEIGHT);
    }
    if ((performance.now() - t0)/1000 < duration && mixing) {
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
  audio.pause();
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
}

// Export logic (with format selection and ffmpeg.wasm conversion)
exportBtn.onclick = async () => {
  if (!masterOutputVideo.src && !livePlaybackUrl) {
    exportStatus.textContent = "No master video to export!";
    return;
  }
  const format = exportFormat.value;
  const webmUrl = masterOutputVideo.src || livePlaybackUrl;

  if (format === "webm") {
    // Native export, no conversion needed
    const a = document.createElement('a');
    a.href = webmUrl;
    a.download = 'fastcut_music_video.webm';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    exportStatus.textContent = "Download started!";
    return;
  }

  // Convert using ffmpeg.wasm
  exportStatus.textContent = "Converting video, please wait...";
  exportBtn.disabled = true;
  try {
    await loadFFmpeg();
    const response = await fetch(webmUrl);
    const buffer = await response.arrayBuffer();
    ffmpeg.FS('writeFile', 'input.webm', new Uint8Array(buffer));
    let outName = 'output.mp4';
    if (format === "mov") outName = 'output.mov';

    // Set args for ffmpeg conversion
    let args = ['-i', 'input.webm', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac', '-b:a', '192k', outName];
    if (format === "mov") args = ['-i', 'input.webm', '-c:v', 'mpeg4', '-qscale:v', '3', '-c:a', 'aac', outName];

    await ffmpeg.run(...args);

    const data = ffmpeg.FS('readFile', outName);
    const blob = new Blob([data.buffer], { type: format === "mp4" ? "video/mp4" : "video/quicktime" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fastcut_music_video.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    exportStatus.textContent = `Download started as .${format}!`;
    URL.revokeObjectURL(url);
    ffmpeg.FS('unlink', 'input.webm');
    ffmpeg.FS('unlink', outName);
  } catch (err) {
    exportStatus.textContent = "Export/conversion failed: " + err.message;
  } finally {
    exportBtn.disabled = false;
  }
};
