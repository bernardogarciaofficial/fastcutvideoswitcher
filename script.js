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

// --- FastCut Switcher Logic (Main Recorder Section) ---
document.addEventListener('DOMContentLoaded', function() {
  const NUM_TRACKS = 4;
  const TRACK_NAMES = [
    "Main Camera",
    "Closeup / Vocals",
    "Instrument / B-Roll",
    "Creative Angle"
  ];
  const fastcutSwitcher = document.getElementById('fastcutSwitcher');
  fastcutSwitcher.innerHTML = Array(NUM_TRACKS).fill(0).map((_, i) =>
    `<button class="fastcut-btn" id="fastcutBtn-${i}">${TRACK_NAMES[i]}</button>`
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
    // Only highlight .switcher-track boxes if they exist (upload section)
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

  // --- Main Recording Section Logic ---
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
    // Get camera and mic
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
    mainRecorderStatus.textContent = "Take downloaded. Repeat for each angle!";
  };

  // --- Switcher Upload Section Logic (Upload-Only) ---
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

  function checkAllTakesUploaded() {
    const allUploaded = uploadedVideos.every(v => !!v);
    document.getElementById("exportBtn").disabled = !allUploaded;
    setupSwitcherTracks();
  }

  function setupSwitcherTracks() {
    // Prepare video elements for switching
    for (let i = 0; i < NUM_TRACKS; i++) {
      const v = document.getElementById(`video-${i}`);
      v.pause();
      v.currentTime = 0;
    }
  }

  // --- Master Output/Export Logic ---
  const masterOutputVideo = document.getElementById('masterOutputVideo');
  const exportBtn = document.getElementById('exportBtn');
  const exportStatus = document.getElementById('exportStatus');
  const mixCanvas = document.getElementById('mixCanvas');

  let mixing = false, mediaRecorder = null, masterChunks = [];
  let drawRequestId = null;
  let livePlaybackUrl = null;

  exportBtn.onclick = () => {
    if (!uploadedVideos.every(v => !!v)) {
      exportStatus.textContent = "Upload all 4 takes to enable export.";
      return;
    }
    exportStatus.textContent = "";
    // Sync all videos to 0
    for (let i = 0; i < NUM_TRACKS; i++) {
      const v = document.getElementById(`video-${i}`);
      v.currentTime = 0;
      v.pause();
    }
    // Play all, but draw only active
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
      livePlaybackUrl = url;
      exportStatus.textContent = "Export complete! Download your final video.";
      // Offer download
      const a = document.createElement('a');
      a.href = url;
      a.download = `fastcut_music_video.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };

    // Start all videos in sync
    for (let i = 0; i < NUM_TRACKS; i++) {
      const v = document.getElementById(`video-${i}`);
      v.currentTime = 0;
      v.muted = true;
      v.play();
    }

    // Draw the active video to canvas (switchable)
    mixing = true;
    let duration = 0;
    const refVideo = document.getElementById('video-0');
    if (refVideo && !isNaN(refVideo.duration)) duration = refVideo.duration;
    else duration = 180; // fallback

    masterOutputVideo.srcObject = stream;
    masterOutputVideo.play();
    mediaRecorder.start();

    let t0 = performance.now();
    function draw() {
      if (!mixing) return;
      const v = document.getElementById(`video-${activeTrack}`);
      if (v && !v.paused && !v.ended) {
        ctx.fillStyle = "#111";
        ctx.fillRect(0, 0, mixCanvas.width, mixCanvas.height);
        ctx.drawImage(v, 0, 0, 600, 340);
      } else {
        ctx.fillStyle = "#111";
        ctx.fillRect(0, 0, 600, 340);
      }
      if ((performance.now() - t0)/1000 < duration && mixing) {
        drawRequestId = requestAnimationFrame(draw);
      } else {
        mixing = false;
        mediaRecorder.stop();
        if (drawRequestId !== null) cancelAnimationFrame(drawRequestId);
        drawRequestId = null;
      }
    }
    draw();
  };
});
