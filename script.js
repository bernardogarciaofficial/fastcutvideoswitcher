document.addEventListener('DOMContentLoaded', () => {
  // -------------------------
  // Helpers
  // -------------------------
  const $ = (sel) => document.querySelector(sel);
  const byId = (id) => document.getElementById(id);

  function safeText(selector, text) {
    const el = $(selector);
    if (el) el.textContent = text;
  }
  function safeSetAccept(id, accept) {
    const el = byId(id);
    if (el) el.setAttribute('accept', accept);
  }

  // Low power mode: phones/tablets (prevents 6-video decode meltdown)
  const LOW_POWER_MODE =
    matchMedia?.('(pointer:coarse)')?.matches ||
    /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // -------------------------
  // Animate Members Counter
  // -------------------------
  function animateMembersCounter() {
    const el = byId('membersCountNumber');
    if (!el) return;
    let n = 15347, up = true;
    setInterval(() => {
      if (Math.random() > 0.5) n += up ? 1 : -1;
      if (n < 15320) up = true;
      if (n > 15360) up = false;
      el.textContent = n.toLocaleString();
    }, 1200);
  }
  animateMembersCounter();

  // -------------------------
  // Audio Track Input
  // -------------------------
  const AUDIO_ACCEPTED = ".mp3,.wav,.ogg,.m4a,.aac,.flac,.aiff,audio/*";
  safeSetAccept('songInput', AUDIO_ACCEPTED);

  const audio = byId('audio');
  const audioStatus = byId('audioStatus');
  let masterAudioFile = null;

  const songInput = byId('songInput');
  if (songInput && audio) {
    songInput.onchange = e => {
      const file = e.target.files[0];
      masterAudioFile = file;

      if (file) {
        audio.src = URL.createObjectURL(file);
        audio.style.display = 'block';
        audio.preload = 'metadata';
        audio.load();
        if (audioStatus) audioStatus.textContent = `Audio loaded: ${file.name}`;
      } else {
        audio.style.display = 'none';
        if (audioStatus) audioStatus.textContent = "";
      }
    };
  }

  // -------------------------
  // Main Video Recording Logic (your "take recorder")
  // -------------------------
  const mainRecorderPreview = byId('mainRecorderPreview');
  const mainRecorderRecordBtn = byId('mainRecorderRecordBtn');
  const mainRecorderStopBtn = byId('mainRecorderStopBtn');
  const mainRecorderDownloadBtn = byId('mainRecorderDownloadBtn');
  const mainRecorderStatus = byId('mainRecorderStatus');

  safeText('.main-recorder-section h3',
    "after each take is recorded,click 'download' to save it to your computer-and don't forget to name your take"
  );
  safeText('.take-instructions span',
    "after each take is recorded,click 'download' to save it to your computer—and don't forget to name your take"
  );
  safeText('.switcher-upload-section h3', "easyly upload each take right here");

  let mainRecorderStream = null;
  let mainRecorderMediaRecorder = null;
  let mainRecorderChunks = [];
  let mainRecorderBlobURL = null;

  // Choose MediaRecorder mimeType safely
  function pickRecorderMime() {
    const candidates = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp8',
      'video/webm',
    ];
    for (const c of candidates) {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported?.(c)) return c;
    }
    return '';
  }

  if (mainRecorderRecordBtn && mainRecorderStopBtn && mainRecorderDownloadBtn && mainRecorderPreview) {
    mainRecorderRecordBtn.onclick = async () => {
      if (!masterAudioFile) {
        if (mainRecorderStatus) mainRecorderStatus.textContent = "Please upload an audio track first!";
        return;
      }

      mainRecorderRecordBtn.disabled = true;
      mainRecorderStopBtn.disabled = false;
      mainRecorderDownloadBtn.disabled = true;
      if (mainRecorderStatus) mainRecorderStatus.textContent = "Recording...";

      mainRecorderChunks = [];
      try {
        mainRecorderStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch (err) {
        if (mainRecorderStatus) mainRecorderStatus.textContent = "Camera or microphone access denied.";
        mainRecorderRecordBtn.disabled = false;
        mainRecorderStopBtn.disabled = true;
        return;
      }

      mainRecorderPreview.srcObject = mainRecorderStream;
      mainRecorderPreview.muted = true;
      mainRecorderPreview.controls = false;
      mainRecorderPreview.playsInline = true;

      // Start music in sync (audio is master)
      if (audio) {
        audio.currentTime = 0;
        try { await audio.play(); } catch (_) {}
      }

      const mimeType = pickRecorderMime();
      try {
        mainRecorderMediaRecorder = mimeType
          ? new MediaRecorder(mainRecorderStream, { mimeType })
          : new MediaRecorder(mainRecorderStream);
      } catch (e) {
        if (mainRecorderStatus) mainRecorderStatus.textContent = "Recording not supported in this browser.";
        mainRecorderRecordBtn.disabled = false;
        mainRecorderStopBtn.disabled = true;
        return;
      }

      mainRecorderMediaRecorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) mainRecorderChunks.push(e.data);
      };

      mainRecorderMediaRecorder.onstop = () => {
        try {
          if (mainRecorderPreview.srcObject) {
            mainRecorderPreview.srcObject.getTracks().forEach(track => track.stop());
            mainRecorderPreview.srcObject = null;
          }
        } catch (_) {}

        const blob = new Blob(mainRecorderChunks, { type: (mimeType || "video/webm") });

        if (mainRecorderBlobURL) URL.revokeObjectURL(mainRecorderBlobURL);
        mainRecorderBlobURL = URL.createObjectURL(blob);

        mainRecorderPreview.src = mainRecorderBlobURL;
        mainRecorderPreview.controls = true;
        mainRecorderPreview.muted = false;
        mainRecorderPreview.load();

        mainRecorderDownloadBtn.disabled = false;
        if (mainRecorderStatus) mainRecorderStatus.textContent = "Recording complete! Download your take.";
      };

      mainRecorderMediaRecorder.start(250); // timeslice helps reduce memory spikes
    };

    mainRecorderStopBtn.onclick = () => {
      if (mainRecorderMediaRecorder && mainRecorderMediaRecorder.state !== "inactive") {
        mainRecorderMediaRecorder.stop();
      }
      mainRecorderRecordBtn.disabled = false;
      mainRecorderStopBtn.disabled = true;

      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    };

    mainRecorderDownloadBtn.onclick = () => {
      if (!mainRecorderBlobURL) return;
      const a = document.createElement('a');
      a.href = mainRecorderBlobURL;
      a.download = `fastcut_take_${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      if (mainRecorderStatus) mainRecorderStatus.textContent = "Take downloaded. Repeat or upload it as a take below!";
    };
  }

  // -------------------------
  // FastCut Switcher Setup
  // -------------------------
  const NUM_TRACKS = 6;
  const TRACK_NAMES = [
    "Video Track 1",
    "Video Track 2",
    "Video Track 3",
    "Video Track 4",
    "Video Track 5",
    "Video Track 6"
  ];

  const fastcutSwitcher = byId('fastcutSwitcher');
  if (fastcutSwitcher) {
    fastcutSwitcher.innerHTML = Array(NUM_TRACKS).fill(0).map((_, i) =>
      `<button class="fastcut-btn" id="fastcutBtn-${i}">${TRACK_NAMES[i]}</button>`
    ).join('');
  }

  let activeTrack = 0;
  let isSwitching = false;
  let switchingTimeline = []; // { timeSec, track }

  const fastcutBtns = [];
  for (let i = 0; i < NUM_TRACKS; i++) {
    const btn = byId(`fastcutBtn-${i}`);
    if (!btn) continue;
    fastcutBtns.push(btn);
    btn.disabled = true;
    btn.onclick = async () => {
      if (!isSwitching) return;
      await setActiveTrack(i);
      recordSwitch(audio?.currentTime ?? 0, i);
    };
  }

  function setTrackUI(idx) {
    const tracks = document.querySelectorAll('.switcher-track');
    if (tracks.length === NUM_TRACKS) {
      tracks.forEach((el, j) => el.classList.toggle('active', j === idx));
    }
    fastcutBtns.forEach((btn, j) => btn.classList.toggle('active', j === idx));
  }

  async function setActiveTrack(idx) {
    activeTrack = idx;
    setTrackUI(idx);

    // Low power mode: keep ONLY the active track "hot"
    if (LOW_POWER_MODE) {
      const vids = getAllVideoEls();
      const t = audio?.currentTime ?? 0;

      for (let i = 0; i < vids.length; i++) {
        const v = vids[i];
        if (!v) continue;

        if (i === idx) {
          await ensureReady(v);
          await seekIfNeeded(v, t);
          v.muted = true;
          v.volume = 0;
          try { await v.play(); } catch (_) {}
        } else {
          try { v.pause(); } catch (_) {}
          // keep them ready but not decoding constantly
        }
      }
    }
  }

  setTrackUI(0);

  // Upload section UI
  const VIDEO_ACCEPTED = ".mp4,.webm,.mov,.ogg,.mkv,video/*";
  const switcherTracks = byId("switcherTracks");
  if (switcherTracks) {
    switcherTracks.innerHTML = Array(NUM_TRACKS).fill(0).map((_, i) => `
      <div class="switcher-track" id="switcher-track-${i}">
        <div class="track-title">${TRACK_NAMES[i]}</div>
        <video id="video-${i}" width="140" height="90" controls muted playsinline preload="metadata"></video>
        <div>
          <label class="upload-video-label" for="uploadVideoInput-${i}">Upload Take</label>
          <input type="file" id="uploadVideoInput-${i}" class="upload-video-input" accept="${VIDEO_ACCEPTED}" style="display:none;">
          <button class="upload-video-btn" id="uploadVideoBtn-${i}">🎬 Upload Take</button>
        </div>
      </div>
    `).join("");
  }

  const uploadedVideos = Array(NUM_TRACKS).fill(null);

  function getAllVideoEls() {
    const arr = [];
    for (let i = 0; i < NUM_TRACKS; i++) arr.push(byId(`video-${i}`));
    return arr;
  }

  function ensureReady(v) {
    return new Promise(resolve => {
      if (!v) return resolve();
      if (v.readyState >= 1) return resolve(); // HAVE_METADATA
      const done = () => resolve();
      v.addEventListener('loadedmetadata', done, { once: true });
      v.addEventListener('error', done, { once: true });
    });
  }

  async function seekIfNeeded(v, targetSec) {
    if (!v) return;
    await ensureReady(v);

    const dur = (isFinite(v.duration) && v.duration > 0) ? v.duration : null;
    const clamped = dur ? Math.min(Math.max(targetSec, 0), Math.max(dur - 0.05, 0)) : Math.max(targetSec, 0);

    // only seek if drift is noticeable (prevents constant decode thrash)
    const drift = Math.abs((v.currentTime || 0) - clamped);
    if (drift < 0.033) return; // ~1 frame at 30fps

    try { v.currentTime = clamped; } catch (_) {}
  }

  function recordSwitch(timeSec, trackIdx) {
    // prevent duplicates
    const last = switchingTimeline[switchingTimeline.length - 1];
    if (last && last.track === trackIdx) return;
    switchingTimeline.push({ timeSec, track: trackIdx });
  }

  // Upload handlers
  for (let i = 0; i < NUM_TRACKS; i++) {
    const uploadBtn = byId(`uploadVideoBtn-${i}`);
    const uploadInput = byId(`uploadVideoInput-${i}`);
    const video = byId(`video-${i}`);

    if (!uploadBtn || !uploadInput || !video) continue;

    uploadBtn.onclick = () => uploadInput.click();

    uploadInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const url = URL.createObjectURL(file);

      video.src = url;
      video.controls = true;
      video.muted = true;
      video.volume = 0;
      video.playsInline = true;
      video.preload = 'metadata';
      video.load();

      await ensureReady(video);

      uploadBtn.textContent = "🎬 Uploaded!";
      uploadedVideos[i] = url;
      setTimeout(() => uploadBtn.textContent = "🎬 Upload Take", 3000);
    };
  }

  // -------------------------
  // Switching / Export Logic (FIXED)
  // -------------------------
  const startSwitchingBtn = byId('startSwitchingBtn');
  const stopSwitchingBtn = byId('stopSwitchingBtn');
  const masterOutputVideo = byId('masterOutputVideo');
  const exportStatus = byId('exportStatus');
  const mixCanvas = byId('mixCanvas');
  const switchingError = byId('switchingError');

  let mixing = false;
  let mediaRecorder = null;
  let masterChunks = [];
  let drawRequestId = null;
  let livePlaybackUrl = null;

  if (startSwitchingBtn) startSwitchingBtn.disabled = false;
  if (stopSwitchingBtn) stopSwitchingBtn.disabled = true;

  // WebAudio fallback capture (works when audio.captureStream is missing)
  let audioCtx = null;
  let audioDest = null;
  let audioSourceNode = null;
  let gainNode = null;

  async function getAudioCaptureStream() {
    if (!audio) return null;

    // Best case
    if (audio.captureStream) return audio.captureStream();
    if (audio.mozCaptureStream) return audio.mozCaptureStream();

    // Fallback: WebAudio -> MediaStreamDestination
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') {
        // requires user gesture; startSwitching click counts
        await audioCtx.resume().catch(() => {});
      }

      // Important: only create one MediaElementSource per audio element
      if (!audioSourceNode) audioSourceNode = audioCtx.createMediaElementSource(audio);

      if (!gainNode) {
        gainNode = audioCtx.createGain();
        gainNode.gain.value = 1;
      }

      if (!audioDest) audioDest = audioCtx.createMediaStreamDestination();

      // connect graph:
      // audio -> gain -> (1) destination for recording  (2) speakers so user can hear
      // If you don’t want speakers, set gain to 0 OR disconnect audioCtx.destination
      audioSourceNode.connect(gainNode);
      gainNode.connect(audioDest);
      gainNode.connect(audioCtx.destination);

      return audioDest.stream;
    } catch (e) {
      return null;
    }
  }

  function pickExportMime() {
    const candidates = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];
    for (const c of candidates) {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported?.(c)) return c;
    }
    return '';
  }

  function getTrackAtTime(timeSec) {
    // timeline is ordered by timeSec, use last <= timeSec
    let track = switchingTimeline.length ? switchingTimeline[0].track : 0;
    for (let i = 0; i < switchingTimeline.length; i++) {
      if (switchingTimeline[i].timeSec <= timeSec) track = switchingTimeline[i].track;
      else break;
    }
    return track;
  }

  async function prepVideosAtStart() {
    const vids = getAllVideoEls();
    await Promise.all(vids.map(v => ensureReady(v)));
    await Promise.all(vids.map(v => seekIfNeeded(v, 0)));

    // Desktop: can keep all playing muted (smoother switching)
    // Mobile: only active will play
    if (!LOW_POWER_MODE) {
      for (const v of vids) {
        if (!v) continue;
        v.muted = true;
        v.volume = 0;
        try { await v.play(); } catch (_) {}
      }
    } else {
      for (const v of vids) { try { v.pause(); } catch (_) {} }
      await setActiveTrack(activeTrack);
    }
  }

  function stopAllVideoPlayback() {
    for (const v of getAllVideoEls()) {
      if (!v) continue;
      try { v.pause(); } catch (_) {}
    }
  }

  if (startSwitchingBtn) {
    startSwitchingBtn.onclick = async () => {
      if (switchingError) switchingError.textContent = '';
      if (exportStatus) exportStatus.textContent = '';

      const allUploaded = uploadedVideos.every(v => !!v);
      if (!allUploaded) {
        if (switchingError) switchingError.textContent = "Please upload all 6 video takes before starting switching!";
        return;
      }
      if (!masterAudioFile || !audio) {
        if (switchingError) switchingError.textContent = "Please upload an audio track first!";
        return;
      }
      if (!mixCanvas || !masterOutputVideo) {
        if (switchingError) switchingError.textContent = "Canvas/output elements missing in HTML.";
        return;
      }

      // reset timeline and state
      isSwitching = true;
      mixing = true;
      switchingTimeline = [];
      recordSwitch(0, activeTrack);

      startSwitchingBtn.disabled = true;
      if (stopSwitchingBtn) stopSwitchingBtn.disabled = false;
      fastcutBtns.forEach(btn => btn.disabled = false);

      // Prepare videos
      await prepVideosAtStart();

      // Start audio (MASTER CLOCK)
      audio.currentTime = 0;

      try {
        await audio.play();
      } catch (_) {
        // Browser policy
        if (switchingError) switchingError.textContent =
          "Tap the audio play button one time (browser policy), then press Start Switching again.";
        isSwitching = false;
        mixing = false;
        startSwitchingBtn.disabled = false;
        if (stopSwitchingBtn) stopSwitchingBtn.disabled = true;
        fastcutBtns.forEach(btn => btn.disabled = true);
        return;
      }

      // Canvas + capture streams
      const ctx = mixCanvas.getContext('2d', { alpha: false });
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, mixCanvas.width, mixCanvas.height);

      const FPS = 30;
      const videoStream = mixCanvas.captureStream(FPS);

      const audioStream = await getAudioCaptureStream();

      let combinedStream;
      if (audioStream && audioStream.getAudioTracks().length) {
        combinedStream = new MediaStream([
          ...videoStream.getVideoTracks(),
          ...audioStream.getAudioTracks()
        ]);
      } else {
        combinedStream = videoStream;
        if (exportStatus) exportStatus.textContent =
          "Warning: Your browser couldn't capture audio for export. Video may export without sound.";
      }

      // Set live preview (optional)
      masterOutputVideo.srcObject = combinedStream;
      masterOutputVideo.muted = true;
      masterOutputVideo.playsInline = true;
      masterOutputVideo.play().catch(() => {});

      // Start recorder
      masterChunks = [];
      const exportMime = pickExportMime();
      try {
        mediaRecorder = exportMime
          ? new MediaRecorder(combinedStream, { mimeType: exportMime })
          : new MediaRecorder(combinedStream);
      } catch (e) {
        if (switchingError) switchingError.textContent = "Export recording is not supported in this browser.";
        isSwitching = false;
        mixing = false;
        startSwitchingBtn.disabled = false;
        if (stopSwitchingBtn) stopSwitchingBtn.disabled = true;
        fastcutBtns.forEach(btn => btn.disabled = true);
        return;
      }

      mediaRecorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) masterChunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        masterOutputVideo.srcObject = null;

        if (livePlaybackUrl) {
          URL.revokeObjectURL(livePlaybackUrl);
          livePlaybackUrl = null;
        }

        const blob = new Blob(masterChunks, { type: exportMime || "video/webm" });
        const url = URL.createObjectURL(blob);
        livePlaybackUrl = url;

        masterOutputVideo.src = url;
        masterOutputVideo.load();
        masterOutputVideo.muted = false;

        if (exportStatus) exportStatus.textContent = "Export complete! Downloading your final video...";

        const a = document.createElement('a');
        a.href = url;
        a.download = `fastcut_music_video.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      };

      mediaRecorder.start(250);

      // STOP automatically when audio ends
      const onEnded = () => {
        if (stopSwitchingBtn) stopSwitchingBtn.click();
      };
      audio.addEventListener('ended', onEnded, { once: true });

      // DRAW LOOP (audio.currentTime is the ONLY timeline)
      const draw = async () => {
        if (!mixing || !isSwitching) return;

        const t = audio.currentTime || 0;
        const track = getTrackAtTime(t);

        // keep selected track aligned with audio (lightweight)
        const v = byId(`video-${track}`);
        if (v) {
          await seekIfNeeded(v, t);

          // On mobile, keep only active playing for better decode
          if (LOW_POWER_MODE) {
            // if switch happened based on timeline, ensure activeTrack matches
            if (activeTrack !== track) {
              activeTrack = track;
              setTrackUI(track);
              await setActiveTrack(track);
            }
          }
        }

        ctx.fillStyle = "#111";
        ctx.fillRect(0, 0, mixCanvas.width, mixCanvas.height);

        if (v && v.readyState >= 2 && !v.ended) {
          try { ctx.drawImage(v, 0, 0, mixCanvas.width, mixCanvas.height); } catch (_) {}
        }

        drawRequestId = requestAnimationFrame(draw);
      };

      drawRequestId = requestAnimationFrame(draw);

      if (exportStatus) {
        exportStatus.textContent = LOW_POWER_MODE
          ? "Switching started (low-power mode). Audio is locked as master clock."
          : "Switching started. Audio is locked as master clock.";
      }
    };
  }

  if (stopSwitchingBtn) {
    stopSwitchingBtn.onclick = () => {
      if (!isSwitching) return;

      mixing = false;
      isSwitching = false;

      if (startSwitchingBtn) startSwitchingBtn.disabled = false;
      stopSwitchingBtn.disabled = true;
      fastcutBtns.forEach(btn => btn.disabled = true);

      if (drawRequestId !== null) cancelAnimationFrame(drawRequestId);
      drawRequestId = null;

      try { audio.pause(); } catch (_) {}
      stopAllVideoPlayback();

      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        try { mediaRecorder.stop(); } catch (_) {}
      }

      if (exportStatus) exportStatus.textContent = "Rendering/export finished. If it didn’t auto-download, press Export Music Video.";
    };
  }

  if (masterOutputVideo) masterOutputVideo.muted = false;

  // Export button: just downloads the current blob URL
  const exportMusicVideoBtn = byId('exportMusicVideoBtn');
  if (exportMusicVideoBtn && masterOutputVideo) {
    exportMusicVideoBtn.onclick = () => {
      const videoUrl = masterOutputVideo.src;

      if (!videoUrl || videoUrl === window.location.href) {
        if (exportStatus) exportStatus.textContent = "No exported video available to download yet!";
        exportMusicVideoBtn.disabled = true;
        setTimeout(() => {
          exportMusicVideoBtn.disabled = false;
          if (exportStatus) exportStatus.textContent = "";
        }, 1600);
        return;
      }

      const a = document.createElement('a');
      a.href = videoUrl;
      a.download = "fastcut_music_video.webm";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      if (exportStatus) exportStatus.textContent = "Music video exported and downloaded!";
      exportMusicVideoBtn.disabled = true;
      setTimeout(() => {
        exportMusicVideoBtn.disabled = false;
        if (exportStatus) exportStatus.textContent = "";
      }, 1800);
    };
  }
});
