const NUM_TRACKS = 10;
const TRACK_WIDTH = 600, TRACK_HEIGHT = 340;
const PREVIEW_WIDTH = 160, PREVIEW_HEIGHT = 100;

const songInput = document.getElementById('songInput');
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
    audioStatus.textContent = "Audio loaded!";
  } else {
    audio.style.display = 'none';
    audioStatus.textContent = "";
  }
};

// Switcher track UI setup
const switcherTracks = document.getElementById("switcherTracks");
switcherTracks.innerHTML = Array(NUM_TRACKS).fill(0).map((_, i) => `
  <div class="switcher-track" id="switcher-track-${i}">
    <div class="track-title">Track ${i + 1}</div>
    <video id="video-${i}" width="${PREVIEW_WIDTH}" height="${PREVIEW_HEIGHT}" controls muted></video>
    <div>
      <button id="recordBtn-${i}" class="select-btn">Record</button>
      <button id="stopBtn-${i}" class="select-btn" disabled>Stop</button>
      <span id="recIndicator-${i}" class="rec-indicator" style="display:none;">● REC</span>
    </div>
    <button id="selectBtn-${i}" class="select-btn" style="width:100%;margin-top:9px;">Select</button>
  </div>
`).join("");

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
}

// Live switcher logic
let activeTrack = 0;
const selectBtns = [];
for (let i = 0; i < NUM_TRACKS; i++) {
  const selectBtn = document.getElementById(`selectBtn-${i}`);
  selectBtns.push(selectBtn);
  selectBtn.onclick = () => setActiveTrack(i);
}
function setActiveTrack(idx) {
  activeTrack = idx;
  document.querySelectorAll('.switcher-track').forEach((el,j) =>
    el.classList.toggle('active', j === idx)
  );
  selectBtns.forEach((btn,j) =>
    btn.classList.toggle('active', j === idx)
  );
}
setActiveTrack(0);

// Master record/stop/export logic
const mainRecordBtn = document.getElementById('mainRecordBtn');
const mainStopBtn = document.getElementById('mainStopBtn');
const recordStatus = document.getElementById('recordStatus');
const masterOutputVideo = document.getElementById('masterOutputVideo');
const exportBtn = document.getElementById('exportBtn');
const exportStatus = document.getElementById('exportStatus');
const mixCanvas = document.getElementById('mixCanvas');

let mixing = false, mediaRecorder = null, masterChunks = [];

mainRecordBtn.onclick = async function() {
  recordStatus.textContent = "";
  exportStatus.textContent = "";
  exportBtn.disabled = true;

  // Prepare all video tracks: must be loaded
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

  // Start everything
  mixing = true;
  mainRecordBtn.disabled = true;
  mainStopBtn.disabled = false;
  recordStatus.textContent = "Recording... Use the Select buttons to live-switch.";
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
      ctx.drawImage(v, 0, 0, TRACK_WIDTH, TRACK_HEIGHT);
    } else {
      ctx.fillRect(0, 0, TRACK_WIDTH, TRACK_HEIGHT);
    }
    if ((performance.now() - t0)/1000 < duration && mixing) {
      requestAnimationFrame(draw);
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
      const blob = new Blob(masterChunks, { type: "video/webm" });
      masterOutputVideo.src = URL.createObjectURL(blob);
      masterOutputVideo.load();
      recordStatus.textContent = "Done! Preview below.";
      exportBtn.disabled = false;
    };
  }
}

// Export logic
exportBtn.onclick = () => {
  if (!masterOutputVideo.src) {
    exportStatus.textContent = "No master video to export!";
    return;
  }
  const a = document.createElement('a');
  a.href = masterOutputVideo.src;
  a.download = 'fastcut_music_video.webm';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  exportStatus.textContent = "Download started!";
};
