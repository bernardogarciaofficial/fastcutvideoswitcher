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

// Update instruction text dynamically in JS in case you want to change via script:
document.querySelector('.main-recorder-section h3').textContent =
  "after each take is recorded,click 'download' to save it to your computer-and don't forget to name your take";
document.querySelector('.take-instructions span').textContent =
  "after each take is recorded,click 'download' to save it to your computer—and don't forget to name your take";
document.querySelector('.switcher-upload-section h3').textContent =
  "easyly upload each take right here";

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
  try { await audio.play(); } catch (_) {}

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
  mainRecorderStatus.textContent = "Take downloaded. Repeat or upload it as a take below!";
};

// --- Rest of your code remains unchanged for switching and export ---
document.addEventListener('DOMContentLoaded', function() {

  // --- FastCut Switcher Logic ---
  const NUM_TRACKS = 6;
  const TRACK_NAMES = [
    "Video Track 1",
    "Video Track 2",
    "Video Track 3",
    "Video Track 4",
    "Video Track 5",
    "Video Track 6"
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
      if (!isSwitching) return;
      setActiveTrack(i);
      recordSwitch(Date.now() - switchingStartTime, i);
    };
    btn.disabled = true; // Initially disabled
  }

  function setActiveTrack(idx) {
    activeTrack = idx;
    const tracks = document.querySelectorAll('.switcher-track');
    if (tracks.length === NUM_TRACKS) {
      tracks.forEach((el, j) => el.classList.toggle('active', j === idx));
    }
    fastcutBtns.forEach((btn, j) => btn.classList.toggle('active', j === idx));
  }
  setActiveTrack(0);

  // --- Upload Section ---
  const VIDEO_ACCEPTED = ".mp4,.webm,.mov,.ogg,.mkv,video/*";
  const switcherTracks = document.getElementById("switcherTracks");
  switcherTracks.innerHTML = Array(NUM_TRACKS).fill(0).map((_, i) => `
    <div class="switcher-track" id="switcher-track-${i}">
      <div class="track-title">${TRACK_NAMES[i]}</div>
      <video id="video-${i}" width="140" height="90" controls muted playsinline></video>
      <div>
        <label class="upload-video-label" for="uploadVideoInput-${i}">Upload Take</label>
        <input type="file" id="uploadVideoInput-${i}" class="upload-video-input" accept="${VIDEO_ACCEPTED}" style="display:none;">
        <button class="upload-video-btn" id="uploadVideoBtn-${i}">🎬 Upload Take</button>
      </div>
    </div>
  `).join("");

  // Store video elements and uploaded blob URLs
  const uploadedVideos = Array(NUM_TRACKS).fill(null);

  function getAllVideoEls() {
    const arr = [];
    for (let i = 0; i < NUM_TRACKS; i++) arr.push(document.getElementById(`video-${i}`));
    return arr;
  }

  function waitForMetadata(v) {
    return new Promise(resolve => {
      if (!v) return resolve();
      if (v.readyState >= 1) return resolve(); // HAVE_METADATA
      v.addEventListener('loadedmetadata', () => resolve(), { once: true });
    });
  }

  async function seekVideoSafe(v, t) {
    if (!v) return;
    await waitForMetadata(v);
    const dur = isFinite(v.duration) ? v.duration : null;
    const clamped = dur ? Math.min(Math.max(t, 0), Math.max(dur - 0.05, 0)) : Math.max(t, 0);
    try { v.currentTime = clamped; } catch (_) {}
  }

  function setVideosMuted(muted) {
    for (const v of getAllVideoEls()) {
      if (!v) continue;
      v.muted = muted;
      // Keep user from hearing 6 tracks at once
      v.volume = 0;
    }
  }

  // ---------- VIDEO SYNC DEPARTMENT (UPGRADED) ----------
  // Audio is MASTER CLOCK. Videos follow.
  let syncLoopId = null;
  let lastHardSyncAt = 0;

  const SOFT_DRIFT_SEC = 0.08;  // small correction threshold (~80ms)
  const HARD_DRIFT_SEC = 0.25;  // big correction threshold (~250ms)
  const HARD_SYNC_COOLDOWN_MS = 300; // avoid spamming seeks

  async function hardSyncAllVideosToAudio() {
    const t = audio.currentTime || 0;
    const now = Date.now();
    if (now - lastHardSyncAt < HARD_SYNC_COOLDOWN_MS) return;
    lastHardSyncAt = now;

    const vids = getAllVideoEls();
    await Promise.all(vids.map(v => seekVideoSafe(v, t)));
  }

  function startSyncLoop() {
    stopSyncLoop();
    const tick = async () => {
      // only sync while switching/playing
      if (!isSwitching || audio.paused || audio.seeking) {
        syncLoopId = requestAnimationFrame(tick);
        return;
      }

      const t = audio.currentTime || 0;
      const vids = getAllVideoEls();

      // Measure drift on the ACTIVE track (most important)
      const activeV = document.getElementById(`video-${activeTrack}`);
      if (activeV && activeV.readyState >= 2) { // HAVE_CURRENT_DATA
        const drift = (activeV.currentTime || 0) - t;

        // Hard correct if large drift
        if (Math.abs(drift) >= HARD_DRIFT_SEC) {
          await hardSyncAllVideosToAudio();
        } else if (Math.abs(drift) >= SOFT_DRIFT_SEC) {
          // Soft correction: nudge active track only (tiny jump)
          try { activeV.currentTime = t; } catch (_) {}
        }
      }

      syncLoopId = requestAnimationFrame(tick);
    };
    syncLoopId = requestAnimationFrame(tick);
  }

  function stopSyncLoop() {
    if (syncLoopId != null) cancelAnimationFrame(syncLoopId);
    syncLoopId = null;
  }

  // Hook audio events to keep everything glued
  audio.addEventListener('play', () => {
    if (!isSwitching) return;
    // Ensure all videos are playing when audio plays
    for (const v of getAllVideoEls()) {
      if (!v) continue;
      v.play().catch(() => {});
    }
    startSyncLoop();
  });

  audio.addEventListener('pause', () => {
    if (!isSwitching) return;
    for (const v of getAllVideoEls()) {
      if (!v) continue;
      v.pause();
    }
    stopSyncLoop();
  });

  audio.addEventListener('seeking', () => {
    if (!isSwitching) return;
    // pause videos during seek to reduce stutter
    for (const v of getAllVideoEls()) {
      if (!v) continue;
      v.pause();
    }
  });

  audio.addEventListener('seeked', async () => {
    if (!isSwitching) return;
    await hardSyncAllVideosToAudio();
    // resume if audio is playing
    if (!audio.paused) {
      for (const v of getAllVideoEls()) {
        if (!v) continue;
        v.play().catch(() => {});
      }
    }
  });

  audio.addEventListener('ratechange', () => {
    if (!isSwitching) return;
    // Keep video playbackRate matching audio playbackRate
    const r = audio.playbackRate || 1;
    for (const v of getAllVideoEls()) {
      if (!v) continue;
      v.playbackRate = r;
    }
  });
  // ---------- END SYNC DEPARTMENT ----------

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
      video.muted = true; // keep takes silent during switching
      video.playsInline = true;
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
  const exportStatus = document.getElementById('exportStatus');
  const mixCanvas = document.getElementById('mixCanvas');
  const switchingError = document.getElementById('switchingError');

  let isSwitching = false;
  let mixing = false, mediaRecorder = null, masterChunks = [];
  let drawRequestId = null;
  let livePlaybackUrl = null;
  let switchingStartTime = 0;
  let switchingTimeline = [];

  // Always allow start button (for testing) but show error if takes missing.
  startSwitchingBtn.disabled = false;
  stopSwitchingBtn.disabled = true;

  function checkAllTakesUploaded() {
    setupSwitcherTracks();
  }

  function setupSwitcherTracks() {
    for (let i = 0; i < NUM_TRACKS; i++) {
      const v = document.getElementById(`video-${i}`);
      if (!v) continue;
      v.pause();
      try { v.currentTime = 0; } catch (_) {}
    }
  }

  function recordSwitch(timeMs, trackIdx) {
    if (switchingTimeline.length === 0 && timeMs > 100) return;
    if (switchingTimeline.length > 0 && switchingTimeline[switchingTimeline.length - 1].track === trackIdx) return;
    switchingTimeline.push({ time: timeMs, track: trackIdx });
  }

  // --- Start Switching (UPGRADED SYNC) ---
  startSwitchingBtn.onclick = async () => {
    switchingError.textContent = '';
    const allUploaded = uploadedVideos.every(v => !!v);
    if (!allUploaded) {
      switchingError.textContent = "Please upload all 6 video takes before starting switching!";
      return;
    }
    if (!masterAudioFile) {
      switchingError.textContent = "Please upload an audio track first!";
      return;
    }

    exportStatus.textContent = "";

    // reset timeline
    switchingTimeline = [{ time: 0, track: activeTrack }];
    switchingStartTime = Date.now();
    isSwitching = true;

    startSwitchingBtn.disabled = true;
    stopSwitchingBtn.disabled = false;
    fastcutBtns.forEach(btn => btn.disabled = false);

    // Prepare videos
    setVideosMuted(true);
    const vids = getAllVideoEls();
    await Promise.all(vids.map(v => waitForMetadata(v)));
    await Promise.all(vids.map(v => seekVideoSafe(v, 0)));

    // Start all videos (muted) + start audio once
    for (const v of vids) {
      if (!v) continue;
      v.play().catch(() => {});
    }

    audio.currentTime = 0;
    try { await audio.play(); } catch (_) {
      // If browser blocks autoplay, user must tap play on audio
      exportStatus.textContent = "Tap Play on the audio player once (browser policy), then press Start Switching again.";
      // rollback state
      isSwitching = false;
      startSwitchingBtn.disabled = false;
      stopSwitchingBtn.disabled = true;
      fastcutBtns.forEach(btn => btn.disabled = true);
      return;
    }

    // HARD sync at start (tight lock)
    await hardSyncAllVideosToAudio();
    startSyncLoop();

    // Canvas prep
    const ctx = mixCanvas.getContext('2d');
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, mixCanvas.width, mixCanvas.height);

    // --- Recording stream combine ---
    const videoStream = mixCanvas.captureStream(30);

    let audioStream = null;
    if (audio.captureStream) audioStream = audio.captureStream();
    else if (audio.mozCaptureStream) audioStream = audio.mozCaptureStream();

    let combinedStream;
    if (audioStream) {
      combinedStream = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...audioStream.getAudioTracks()
      ]);
    } else {
      combinedStream = videoStream;
      exportStatus.textContent = "Warning: Audio captureStream not supported in your browser. Output may be silent.";
    }

    masterChunks = [];
    mediaRecorder = new MediaRecorder(combinedStream, { mimeType: "video/webm" });
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) masterChunks.push(e.data); };
    mediaRecorder.onstop = () => {
      masterOutputVideo.srcObject = null;
      if (livePlaybackUrl) {
        URL.revokeObjectURL(livePlaybackUrl);
        livePlaybackUrl = null;
      }
      const blob = new Blob(masterChunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      masterOutputVideo.src = url;
      masterOutputVideo.load();
      masterOutputVideo.muted = false;
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

    // Prefer audio duration, fallback to track 0, fallback 180s
    let duration = 180;
    if (isFinite(audio.duration) && audio.duration > 0) duration = audio.duration;
    else {
      const refVideo = document.getElementById('video-0');
      if (refVideo && isFinite(refVideo.duration) && refVideo.duration > 0) duration = refVideo.duration;
    }

    // Live preview (muted to avoid echo)
    masterOutputVideo.srcObject = combinedStream;
    masterOutputVideo.muted = true;
    masterOutputVideo.play().catch(() => {});

    mediaRecorder.start();

    function draw() {
      if (!mixing) return;

      const elapsed = Date.now() - switchingStartTime;

      // Find track to display based on timeline
      let track = switchingTimeline[0].track;
      for (let i = 0; i < switchingTimeline.length; i++) {
        if (switchingTimeline[i].time <= elapsed) track = switchingTimeline[i].track;
        else break;
      }

      const v = document.getElementById(`video-${track}`);
      const ctx = mixCanvas.getContext('2d');

      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, mixCanvas.width, mixCanvas.height);

      if (v && v.readyState >= 2 && !v.ended) {
        try { ctx.drawImage(v, 0, 0, mixCanvas.width, mixCanvas.height); } catch (_) {}
      }

      if ((Date.now() - switchingStartTime) / 1000 < duration && mixing && isSwitching) {
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

    stopSyncLoop();

    // stop audio + videos
    audio.pause();
    for (const v of getAllVideoEls()) {
      if (!v) continue;
      v.pause();
    }

    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    if (drawRequestId !== null) cancelAnimationFrame(drawRequestId);
    drawRequestId = null;

    exportStatus.textContent = "Rendering and export complete! Download below.";
  };

  // Ensure main output video is unmuted for built-in speaker icon on page load
  masterOutputVideo.muted = false;

  // --- Export Music Video Button Logic ---
  const exportMusicVideoBtn = document.getElementById('exportMusicVideoBtn');
  exportMusicVideoBtn.onclick = function() {
    let videoUrl = masterOutputVideo.src;
    if (!videoUrl || videoUrl === window.location.href) {
      exportStatus.textContent = "No exported video available to download yet!";
      exportMusicVideoBtn.disabled = true;
      setTimeout(() => {
        exportMusicVideoBtn.disabled = false;
        exportStatus.textContent = "";
      }, 1600);
      return;
    }
    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = "fastcut_music_video.webm";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    exportStatus.textContent = "Music video exported and downloaded!";
    exportMusicVideoBtn.disabled = true;
    setTimeout(() => {
      exportMusicVideoBtn.disabled = false;
      exportStatus.textContent = "";
    }, 1800);
  };
});
