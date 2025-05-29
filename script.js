// --- Animate Members Counter ---
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

// --- Audio Track Input (accepts most popular formats) ---
const AUDIO_ACCEPTED = ".mp3,.wav,.ogg,.m4a,.aac,.flac,.aiff,audio/*";
document.getElementById('songInput').setAttribute('accept', AUDIO_ACCEPTED);

const audio = document.getElementById('audio');
const audioStatus = document.getElementById('audioStatus');
let masterAudioFile = null;

document.getElementById('songInput').onchange = e => {
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

// --- Main Video Recording Logic ---
const mainRecorderPreview = document.getElementById('mainRecorderPreview');
const mainRecorderRecordBtn = document.getElementById('mainRecorderRecordBtn');
const mainRecorderStopBtn = document.getElementById('mainRecorderStopBtn');
const mainRecorderDownloadBtn = document.getElementById('mainRecorderDownloadBtn');
const mainRecorderStatus = document.getElementById('mainRecorderStatus');

let mainRecorderStream = null;
let mainRecorderMediaRecorder = null;
let mainRecorderChunks = [];
let mainRecorderBlobURL = null;

mainRecorderRecordBtn.onclick = async () => {
  if (!masterAudioFile) {
    mainRecorderStatus.textContent = "Please upload an audio track first!";
    return;
  }
  mainRecorderRecordBtn.disabled = true;
  mainRecorderStopBtn.disabled = false;
  mainRecorderDownloadBtn.disabled = true;
  mainRecorderStatus.textContent = "Recording...";

  mainRecorderChunks = [];
  try {
    mainRecorderStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  } catch (err) {
    mainRecorderStatus.textContent = "Camera or microphone access denied.";
    mainRecorderRecordBtn.disabled = false;
    mainRecorderStopBtn.disabled = true;
    return;
  }
  mainRecorderPreview.srcObject = mainRecorderStream;
  mainRecorderPreview.muted = true;
  mainRecorderPreview.controls = false;

  // Start music in sync
  audio.currentTime = 0;
  audio.play();

  // Record video + audio
  mainRecorderMediaRecorder = new MediaRecorder(mainRecorderStream, { mimeType: "video/webm" });
  mainRecorderMediaRecorder.ondataavailable = e => { if (e.data.size > 0) mainRecorderChunks.push(e.data); };
  mainRecorderMediaRecorder.onstop = () => {
    if (mainRecorderPreview.srcObject) {
      mainRecorderPreview.srcObject.getTracks().forEach(track => track.stop());
      mainRecorderPreview.srcObject = null;
    }
    const blob = new Blob(mainRecorderChunks, { type: "video/webm" });
    if (mainRecorderBlobURL) URL.revokeObjectURL(mainRecorderBlobURL);
    mainRecorderBlobURL = URL.createObjectURL(blob);
    mainRecorderPreview.src = mainRecorderBlobURL;
    mainRecorderPreview.controls = true;
    mainRecorderPreview.muted = false;
    mainRecorderPreview.load();
    mainRecorderDownloadBtn.disabled = false;
    mainRecorderStatus.textContent = "Recording complete! Download your take.";
  };
  mainRecorderMediaRecorder.start();
};

mainRecorderStopBtn.onclick = () => {
  if (mainRecorderMediaRecorder && mainRecorderMediaRecorder.state !== "inactive") {
    mainRecorderMediaRecorder.stop();
  }
  mainRecorderRecordBtn.disabled = false;
  mainRecorderStopBtn.disabled = true;
  audio.pause();
  audio.currentTime = 0;
};

mainRecorderDownloadBtn.onclick = () => {
  if (!mainRecorderBlobURL) return;
  const a = document.createElement('a');
  a.href = mainRecorderBlobURL;
  a.download = `fastcut_take_${Date.now()}.webm`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  mainRecorderStatus.textContent = "Take downloaded. Repeat or upload it as a 'Main Camera' take below!";
};

// --- Rest of your code remains unchanged for switching and export ---

document.addEventListener('DOMContentLoaded', function() {
  // --- FastCut Switcher Logic ---
  const NUM_TRACKS = 4;
  const TRACK_NAMES = [
    "Main Camera",
    "Closeup / Vocals",
    "Instrument / B-Roll",
    "Creative Angle"
  ];
  // Render buttons in a single row
  const fastcutSwitcher = document.getElementById('fastcutSwitcher');
  fastcutSwitcher.innerHTML = Array(NUM_TRACKS).fill(0).map((_, i) =>
    `<button class="fastcut-btn" id="fastcutBtn-${i}">${TRACK_NAMES[i]}</button>`
  ).join('');

  let activeTrack = 0;
  const fastcutBtns = [];
  for (let i = 0; i < NUM_TRACKS; i++) {
    const btn = document.getElementById(`fastcutBtn-${i}`);
    fastcutBtns.push(btn);
    btn.onclick = () => {
      setActiveTrack(i);
      if (isSwitching) {
        recordSwitch(Date.now() - switchingStartTime, i);
      }
    };
  }
  function setActiveTrack(idx) {
    activeTrack = idx;
    const tracks = document.querySelectorAll('.switcher-track');
    if (tracks.length === NUM_TRACKS) {
      tracks.forEach((el, j) =>
        el.classList.toggle('active', j === idx)
      );
    }
    fastcutBtns.forEach((btn, j) =>
      btn.classList.toggle('active', j === idx)
    );
  }
  setActiveTrack(0);

  // --- Upload Section ---
  const VIDEO_ACCEPTED = ".mp4,.webm,.mov,.ogg,.mkv,video/*";
  const switcherTracks = document.getElementById("switcherTracks");
  switcherTracks.innerHTML = Array(NUM_TRACKS).fill(0).map((_, i) => `
    <div class="switcher-track" id="switcher-track-${i}">
      <div class="track-title">${TRACK_NAMES[i]}</div>
      <video id="video-${i}" width="220" height="140" controls muted></video>
      <div>
        <label class="upload-video-label" for="uploadVideoInput-${i}">Upload Take</label>
        <input type="file" id="uploadVideoInput-${i}" class="upload-video-input" accept="${VIDEO_ACCEPTED}" style="display:none;">
        <button class="upload-video-btn" id="uploadVideoBtn-${i}">🎬 Upload Take</button>
      </div>
    </div>
  `).join("");

  // Store video elements and uploaded blob URLs
  const uploadedVideos = Array(NUM_TRACKS).fill(null);

  for (let i = 0; i < NUM_TRACKS; i++) {
    const uploadBtn = document.getElementById(`uploadVideoBtn-${i}`);
    const uploadInput = document.getElementById(`uploadVideoInput-${i}`);
    const video = document.getElementById(`video-${i}`);
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
      uploadedVideos[i] = url;
      setTimeout(() => uploadBtn.textContent = "🎬 Upload Take", 3000);
      checkAllTakesUploaded();
    };
  }

  // --- Switching/Recording Logic ---
  const startSwitchingBtn = document.getElementById('startSwitchingBtn');
  const stopSwitchingBtn = document.getElementById('stopSwitchingBtn');
  const masterOutputVideo = document.getElementById('masterOutputVideo');
  const masterOutputVolume = document.getElementById('masterOutputVolume');
  const exportStatus = document.getElementById('exportStatus');
  const mixCanvas = document.getElementById('mixCanvas');

  let isSwitching = false;
  let mixing = false, mediaRecorder = null, masterChunks = [];
  let drawRequestId = null;
  let livePlaybackUrl = null;
  let switchingStartTime = 0;
  let switchingTimeline = [];

  // Volume control for main video output
  masterOutputVideo.volume = masterOutputVolume.value;
  masterOutputVolume.addEventListener('input', (e) => {
    masterOutputVideo.volume = e.target.value;
  });

  function checkAllTakesUploaded() {
    const allUploaded = uploadedVideos.every(v => !!v);
    startSwitchingBtn.disabled = !allUploaded;
    setupSwitcherTracks();
  }

  function setupSwitcherTracks() {
    for (let i = 0; i < NUM_TRACKS; i++) {
      const v = document.getElementById(`video-${i}`);
      v.pause();
      v.currentTime = 0;
    }
  }

  function recordSwitch(timeMs, trackIdx) {
    if (switchingTimeline.length === 0 && timeMs > 100) return;
    if (switchingTimeline.length > 0 && switchingTimeline[switchingTimeline.length-1].track === trackIdx) return;
    switchingTimeline.push({ time: timeMs, track: trackIdx });
  }

  startSwitchingBtn.onclick = () => {
    exportStatus.textContent = "";
    for (let i = 0; i < NUM_TRACKS; i++) {
      const v = document.getElementById(`video-${i}`);
      v.currentTime = 0;
      v.pause();
    }
    for (let i = 0; i < NUM_TRACKS; i++) {
      const v = document.getElementById(`video-${i}`);
      v.currentTime = 0;
      v.muted = true;
      v.play();
    }
    // Play main audio in sync (NEW: play when switching starts)
    audio.currentTime = 0;
    audio.play();

    switchingTimeline = [{ time: 0, track: activeTrack }];
    switchingStartTime = Date.now();
    isSwitching = true;
    startSwitchingBtn.disabled = true;
    stopSwitchingBtn.disabled = false;
    fastcutBtns.forEach(btn => btn.disabled = false);

    const ctx = mixCanvas.getContext('2d');
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, mixCanvas.width, mixCanvas.height);

    const stream = mixCanvas.captureStream(30);
    masterChunks = [];
    mediaRecorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) masterChunks.push(e.data); };
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
      // Set volume after new src loaded
      masterOutputVideo.volume = masterOutputVolume.value;
      livePlaybackUrl = url;
      exportStatus.textContent = "Export complete! Download your final video.";
      const a = document.createElement('a');
      a.href = url;
      a.download = `fastcut_music_video.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };

    mixing = true;
    let duration = 0;
    const refVideo = document.getElementById('video-0');
    if (refVideo && !isNaN(refVideo.duration)) duration = refVideo.duration;
    else duration = 180;

    masterOutputVideo.srcObject = stream;
    masterOutputVideo.play();
    masterOutputVideo.volume = masterOutputVolume.value;
    mediaRecorder.start();

    function draw() {
      if (!mixing) return;
      let elapsed = Date.now() - switchingStartTime;
      let track = switchingTimeline[0].track;
      for (let i = 0; i < switchingTimeline.length; i++) {
        if (switchingTimeline[i].time <= elapsed) {
          track = switchingTimeline[i].track;
        } else {
          break;
        }
      }
      const v = document.getElementById(`video-${track}`);
      if (v && !v.paused && !v.ended) {
        const ctx = mixCanvas.getContext('2d');
        ctx.fillStyle = "#111";
        ctx.fillRect(0, 0, mixCanvas.width, mixCanvas.height);
        ctx.drawImage(v, 0, 0, 600, 340);
      } else {
        const ctx = mixCanvas.getContext('2d');
        ctx.fillStyle = "#111";
        ctx.fillRect(0, 0, 600, 340);
      }
      if ((Date.now() - switchingStartTime)/1000 < duration && mixing && isSwitching) {
        drawRequestId = requestAnimationFrame(draw);
      }
    }
    draw();
  };

  stopSwitchingBtn.onclick = () => {
    if (!isSwitching) return;
    mixing = false;
    isSwitching = false;
    startSwitchingBtn.disabled = false;
    stopSwitchingBtn.disabled = true;
    fastcutBtns.forEach(btn => btn.disabled = true);
    audio.pause();
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    if (drawRequestId !== null) cancelAnimationFrame(drawRequestId);
    drawRequestId = null;
    exportStatus.textContent = "Rendering and export complete! Download below.";
  };

  // On load, disable all switching controls until videos are uploaded
  startSwitchingBtn.disabled = true;
  stopSwitchingBtn.disabled = true;
  fastcutBtns.forEach(btn => btn.disabled = true);
});
