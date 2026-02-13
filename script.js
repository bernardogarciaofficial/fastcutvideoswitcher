document.addEventListener('DOMContentLoaded', () => {

  // -------------------------
  // Small helpers (safety)
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

  // -------------------------
  // Animate Members Counter
  // -------------------------
  function animateMembersCounter() {
    const el = byId('membersCountNumber');
    if (!el) return; // safety
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
        audio.load();
        if (audioStatus) audioStatus.textContent = `Audio loaded: ${file.name}`;
      } else {
        audio.style.display = 'none';
        if (audioStatus) audioStatus.textContent = "";
      }
    };
  }

  // -------------------------
  // Main Video Recording Logic
  // -------------------------
  const mainRecorderPreview = byId('mainRecorderPreview');
  const mainRecorderRecordBtn = byId('mainRecorderRecordBtn');
  const mainRecorderStopBtn = byId('mainRecorderStopBtn');
  const mainRecorderDownloadBtn = byId('mainRecorderDownloadBtn');
  const mainRecorderStatus = byId('mainRecorderStatus');

  // SAFELY update text (won’t crash if selectors don’t exist)
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

      // Start music in sync
      if (audio) {
        audio.currentTime = 0;
        try { await audio.play(); } catch (_) {}
      }

      mainRecorderMediaRecorder = new MediaRecorder(mainRecorderStream, { mimeType: "video/webm" });

      mainRecorderMediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) mainRecorderChunks.push(e.data);
      };

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
        if (mainRecorderStatus) mainRecorderStatus.textContent = "Recording complete! Download your take.";
      };

      mainRecorderMediaRecorder.start();
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
  // FastCut Switcher Logic
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
  let switchingStartTime = 0;
  let switchingTimeline = [];

  const fastcutBtns = [];
  for (let i = 0; i < NUM_TRACKS; i++) {
    const btn = byId(`fastcutBtn-${i}`);
    if (!btn) continue;
    fastcutBtns.push(btn);
    btn.disabled = true;
    btn.onclick = () => {
      if (!isSwitching) return;
      setActiveTrack(i);
      recordSwitch(Date.now() - switchingStartTime, i);
    };
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

  // Upload section
  const VIDEO_ACCEPTED = ".mp4,.webm,.mov,.ogg,.mkv,video/*";
  const switcherTracks = byId("switcherTracks");
  if (switcherTracks) {
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
  }

  const uploadedVideos = Array(NUM_TRACKS).fill(null);

  function getAllVideoEls() {
    const arr = [];
    for (let i = 0; i < NUM_TRACKS; i++) arr.push(byId(`video-${i}`));
    return arr;
  }

  function waitForMetadata(v) {
    return new Promise(resolve => {
      if (!v) return resolve();
      if (v.readyState >= 1) return resolve();
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
      v.volume = 0;
    }
  }

  // Sync loop
  let syncLoopId = null;
  let lastHardSyncAt = 0;

  const SOFT_DRIFT_SEC = 0.08;
  const HARD_DRIFT_SEC = 0.25;
  const HARD_SYNC_COOLDOWN_MS = 300;

  async function hardSyncAllVideosToAudio() {
    if (!audio) return;
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
      if (!audio) {
        syncLoopId = requestAnimationFrame(tick);
        return;
      }

      if (!isSwitching || audio.paused || audio.seeking) {
        syncLoopId = requestAnimationFrame(tick);
        return;
      }

      const t = audio.currentTime || 0;
      const activeV = byId(`video-${activeTrack}`);

      if (activeV && activeV.readyState >= 2) {
        const drift = (activeV.currentTime || 0) - t;

        if (Math.abs(drift) >= HARD_DRIFT_SEC) {
          await hardSyncAllVideosToAudio();
        } else if (Math.abs(drift) >= SOFT_DRIFT_SEC) {
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

  if (audio) {
    audio.addEventListener('play', () => {
      if (!isSwitching) return;
      for (const v of getAllVideoEls()) v && v.play().catch(() => {});
      startSyncLoop();
    });

    audio.addEventListener('pause', () => {
      if (!isSwitching) return;
      for (const v of getAllVideoEls()) v && v.pause();
      stopSyncLoop();
    });

    audio.addEventListener('seeking', () => {
      if (!isSwitching) return;
      for (const v of getAllVideoEls()) v && v.pause();
    });

    audio.addEventListener('seeked', async () => {
      if (!isSwitching) return;
      await hardSyncAllVideosToAudio();
      if (!audio.paused) {
        for (const v of getAllVideoEls()) v && v.play().catch(() => {});
      }
    });

    audio.addEventListener('ratechange', () => {
      if (!isSwitching) return;
      const r = audio.playbackRate || 1;
      for (const v of getAllVideoEls()) if (v) v.playbackRate = r;
    });
  }

  // Upload handlers
  for (let i = 0; i < NUM_TRACKS; i++) {
    const uploadBtn = byId(`uploadVideoBtn-${i}`);
    const uploadInput = byId(`uploadVideoInput-${i}`);
    const video = byId(`video-${i}`);

    if (!uploadBtn || !uploadInput || !video) continue;

    uploadBtn.onclick = () => uploadInput.click();

    uploadInput.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);

      video.src = url;
      video.controls = true;
      video.muted = true;
      video.playsInline = true;
      video.load();

      uploadBtn.textContent = "🎬 Uploaded!";
      uploadedVideos[i] = url;
      setTimeout(() => uploadBtn.textContent = "🎬 Upload Take", 3000);
    };
  }

  // -------------------------
  // Switching / Export Logic
  // -------------------------
  const startSwitchingBtn = byId('startSwitchingBtn');
  const stopSwitchingBtn = byId('stopSwitchingBtn');
  const masterOutputVideo = byId('masterOutputVideo');
  const exportStatus = byId('exportStatus');
  const mixCanvas = byId('mixCanvas');
  const switchingError = byId('switchingError');

  let mixing = false, mediaRecorder = null, masterChunks = [];
  let drawRequestId = null;
  let livePlaybackUrl = null;

  if (startSwitchingBtn) startSwitchingBtn.disabled = false;
  if (stopSwitchingBtn) stopSwitchingBtn.disabled = true;

  function recordSwitch(timeMs, trackIdx) {
    if (switchingTimeline.length === 0 && timeMs > 100) return;
    if (switchingTimeline.length > 0 && switchingTimeline[switchingTimeline.length - 1].track === trackIdx) return;
    switchingTimeline.push({ time: timeMs, track: trackIdx });
  }

  if (startSwitchingBtn) {
    startSwitchingBtn.onclick = async () => {
      if (switchingError) switchingError.textContent = '';

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

      if (exportStatus) exportStatus.textContent = "";

      switchingTimeline = [{ time: 0, track: activeTrack }];
      switchingStartTime = Date.now();
      isSwitching = true;

      startSwitchingBtn.disabled = true;
      if (stopSwitchingBtn) stopSwitchingBtn.disabled = false;
      fastcutBtns.forEach(btn => btn.disabled = false);

      setVideosMuted(true);
      const vids = getAllVideoEls();
      await Promise.all(vids.map(v => waitForMetadata(v)));
      await Promise.all(vids.map(v => seekVideoSafe(v, 0)));

      for (const v of vids) v && v.play().catch(() => {});

      audio.currentTime = 0;
      try {
        await audio.play();
      } catch (_) {
        if (exportStatus) exportStatus.textContent =
          "Tap Play on the audio player once (browser policy), then press Start Switching again.";

        isSwitching = false;
        startSwitchingBtn.disabled = false;
        if (stopSwitchingBtn) stopSwitchingBtn.disabled = true;
        fastcutBtns.forEach(btn => btn.disabled = true);
        return;
      }

      await hardSyncAllVideosToAudio();
      startSyncLoop();

      const ctx = mixCanvas.getContext('2d');
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, mixCanvas.width, mixCanvas.height);

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
        if (exportStatus) exportStatus.textContent =
          "Warning: Audio captureStream not supported in your browser. Output may be silent.";
      }

      masterChunks = [];
      mediaRecorder = new MediaRecorder(combinedStream, { mimeType: "video/webm" });

      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) masterChunks.push(e.data);
      };

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

        if (exportStatus) exportStatus.textContent = "Export complete! Downloading your final video...";

        const a = document.createElement('a');
        a.href = url;
        a.download = `fastcut_music_video.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      };

      mixing = true;

      let duration = 180;
      if (isFinite(audio.duration) && audio.duration > 0) duration = audio.duration;
      else {
        const refVideo = byId('video-0');
        if (refVideo && isFinite(refVideo.duration) && refVideo.duration > 0) duration = refVideo.duration;
      }

      masterOutputVideo.srcObject = combinedStream;
      masterOutputVideo.muted = true;
      masterOutputVideo.play().catch(() => {});

      mediaRecorder.start();

      function draw() {
        if (!mixing) return;

        const elapsed = Date.now() - switchingStartTime;

        let track = switchingTimeline[0].track;
        for (let i = 0; i < switchingTimeline.length; i++) {
          if (switchingTimeline[i].time <= elapsed) track = switchingTimeline[i].track;
          else break;
        }

        const v = byId(`video-${track}`);
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
  }

  if (stopSwitchingBtn) {
    stopSwitchingBtn.onclick = () => {
      if (!isSwitching) return;

      mixing = false;
      isSwitching = false;

      if (startSwitchingBtn) startSwitchingBtn.disabled = false;
      stopSwitchingBtn.disabled = true;
      fastcutBtns.forEach(btn => btn.disabled = true);

      stopSyncLoop();

      if (audio) audio.pause();
      for (const v of getAllVideoEls()) v && v.pause();

      if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
      if (drawRequestId !== null) cancelAnimationFrame(drawRequestId);
      drawRequestId = null;

      if (exportStatus) exportStatus.textContent = "Rendering and export complete! Download below.";
    };
  }

  if (masterOutputVideo) masterOutputVideo.muted = false;

  // Export button
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
