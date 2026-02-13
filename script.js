document.addEventListener('DOMContentLoaded', () => {

  const byId = (id) => document.getElementById(id);

  // ===============================
  // AUDIO SETUP
  // ===============================

  const audio = byId('audio');
  const songInput = byId('songInput');
  const audioStatus = byId('audioStatus');
  let masterAudioFile = null;

  if (songInput && audio) {
    songInput.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;

      masterAudioFile = file;
      audio.src = URL.createObjectURL(file);
      audio.style.display = "block";
      audio.load();
      audioStatus.textContent = "Audio loaded: " + file.name;
    };
  }

  // ===============================
  // TRACKS SETUP
  // ===============================

  const NUM_TRACKS = 6;
  let activeTrack = 0;
  let isSwitching = false;
  let switchingTimeline = [];

  const fastcutSwitcher = byId("fastcutSwitcher");

  if (fastcutSwitcher) {
    fastcutSwitcher.innerHTML = "";
    for (let i = 0; i < NUM_TRACKS; i++) {
      const btn = document.createElement("button");
      btn.className = "fastcut-btn";
      btn.id = "fastcutBtn-" + i;
      btn.textContent = "Video Track " + (i + 1);
      btn.disabled = true;
      btn.onclick = () => {
        if (!isSwitching) return;
        setActiveTrack(i);
        recordSwitch(audio.currentTime, i);
      };
      fastcutSwitcher.appendChild(btn);
    }
  }

  function getVideo(i) {
    return byId("video-" + i);
  }

  function setTrackUI(idx) {
    for (let i = 0; i < NUM_TRACKS; i++) {
      const btn = byId("fastcutBtn-" + i);
      const track = byId("switcher-track-" + i);
      if (!btn || !track) continue;

      btn.classList.toggle("active", i === idx);
      track.classList.toggle("active", i === idx);
    }
  }

  async function setActiveTrack(idx) {
    activeTrack = idx;
    setTrackUI(idx);

    const t = audio.currentTime || 0;

    for (let i = 0; i < NUM_TRACKS; i++) {
      const v = getVideo(i);
      if (!v) continue;

      if (i === idx) {
        try {
          v.currentTime = t;
          await v.play();
        } catch (_) {}
      } else {
        v.pause();
      }
    }
  }

  function recordSwitch(timeSec, trackIdx) {
    const last = switchingTimeline[switchingTimeline.length - 1];
    if (last && last.track === trackIdx) return;
    switchingTimeline.push({ timeSec, track: trackIdx });
  }

  // ===============================
  // UPLOAD HANDLERS
  // ===============================

  const uploaded = Array(NUM_TRACKS).fill(false);

  for (let i = 0; i < NUM_TRACKS; i++) {
    const uploadBtn = byId("uploadVideoBtn-" + i);
    const uploadInput = byId("uploadVideoInput-" + i);
    const video = getVideo(i);

    if (!uploadBtn || !uploadInput || !video) continue;

    uploadBtn.onclick = () => uploadInput.click();

    uploadInput.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;

      video.src = URL.createObjectURL(file);
      video.muted = true;
      video.playsInline = true;
      video.load();

      uploaded[i] = true;
      uploadBtn.textContent = "Uploaded ✓";
    };
  }

  // ===============================
  // SWITCHING
  // ===============================

  const startBtn = byId("startSwitchingBtn");
  const stopBtn = byId("stopSwitchingBtn");
  const mixCanvas = byId("mixCanvas");
  const ctx = mixCanvas.getContext("2d");
  const masterOutputVideo = byId("masterOutputVideo");
  const exportStatus = byId("exportStatus");

  let mediaRecorder = null;
  let chunks = [];
  let drawLoopId = null;

  function getTrackAtTime(timeSec) {
    let track = 0;
    for (let i = 0; i < switchingTimeline.length; i++) {
      if (switchingTimeline[i].timeSec <= timeSec)
        track = switchingTimeline[i].track;
    }
    return track;
  }

  startBtn.onclick = async () => {

    if (!masterAudioFile) {
      alert("Upload audio first");
      return;
    }

    if (!uploaded.every(v => v)) {
      alert("Upload all 6 video tracks first");
      return;
    }

    isSwitching = true;
    switchingTimeline = [];
    recordSwitch(0, activeTrack);

    startBtn.disabled = true;
    stopBtn.disabled = false;

    for (let i = 0; i < NUM_TRACKS; i++) {
      byId("fastcutBtn-" + i).disabled = false;
    }

    audio.currentTime = 0;
    await audio.play();

    await setActiveTrack(activeTrack);

    const stream = mixCanvas.captureStream(30);
    const audioStream = audio.captureStream();
    const combined = new MediaStream([
      ...stream.getVideoTracks(),
      ...audioStream.getAudioTracks()
    ]);

    mediaRecorder = new MediaRecorder(combined);
    chunks = [];

    mediaRecorder.ondataavailable = e => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      masterOutputVideo.src = url;
      masterOutputVideo.load();

      const a = document.createElement("a");
      a.href = url;
      a.download = "fastcut_music_video.webm";
      a.click();

      exportStatus.textContent = "Export complete!";
    };

    mediaRecorder.start(250);

    function draw() {
      if (!isSwitching) return;

      const t = audio.currentTime;
      const track = getTrackAtTime(t);
      const v = getVideo(track);

      if (v && v.readyState >= 2) {
        ctx.drawImage(v, 0, 0, mixCanvas.width, mixCanvas.height);
      }

      drawLoopId = requestAnimationFrame(draw);
    }

    draw();
  };

  stopBtn.onclick = () => {

    isSwitching = false;

    startBtn.disabled = false;
    stopBtn.disabled = true;

    for (let i = 0; i < NUM_TRACKS; i++) {
      byId("fastcutBtn-" + i).disabled = true;
      const v = getVideo(i);
      if (v) v.pause();
    }

    audio.pause();

    if (drawLoopId) cancelAnimationFrame(drawLoopId);
    if (mediaRecorder && mediaRecorder.state !== "inactive")
      mediaRecorder.stop();
  };

});
