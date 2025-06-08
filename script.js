// FASTCUT FULL SONG LIVE SWITCHER - COMPLETE, ROBUST VERSION

// Animate a fake member counter (optional UI bling)
function animateMembersCounter() {
  const el = document.getElementById('membersCountNumber');
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

const AUDIO_ACCEPTED = ".mp3,.wav,.ogg,.m4a,.aac,.flac,.aiff,audio/*";
const songInput = document.getElementById('songInput');
if (songInput) songInput.setAttribute('accept', AUDIO_ACCEPTED);

const audio = document.getElementById('audio');
const audioStatus = document.getElementById('audioStatus');
let masterAudioFile = null;

if (songInput) {
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
}

document.addEventListener('DOMContentLoaded', function() {
  const NUM_TRACKS = 6;
  const TRACK_NAMES = [
    "Video Track 1",
    "Video Track 2",
    "Video Track 3",
    "Video Track 4",
    "Video Track 5",
    "Video Track 6"
  ];
  const switcherTracks = document.getElementById("switcherTracks");
  if (switcherTracks) {
    switcherTracks.innerHTML = Array(NUM_TRACKS).fill(0).map((_, i) => `
      <div class="switcher-track" id="switcher-track-${i}">
        <div class="track-title">${TRACK_NAMES[i]}</div>
        <video id="video-${i}" width="140" height="90" controls preload="auto" muted></video>
        <div>
          <label class="upload-video-label" for="uploadVideoInput-${i}">Upload Take</label>
          <input type="file" id="uploadVideoInput-${i}" class="upload-video-input" accept=".mp4,.webm,.mov,.ogg,.mkv,video/*" style="display:none;">
          <button class="upload-video-btn" id="uploadVideoBtn-${i}">🎬 Upload Take</button>
        </div>
      </div>
    `).join("");
  }

  const uploadedVideos = Array(NUM_TRACKS).fill(null);

  for (let i = 0; i < NUM_TRACKS; i++) {
    const uploadBtn = document.getElementById(`uploadVideoBtn-${i}`);
    const uploadInput = document.getElementById(`uploadVideoInput-${i}`);
    const video = document.getElementById(`video-${i}`);
    if (uploadBtn && uploadInput && video) {
      video.preload = "auto";
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
      };
    }
  }

  // CONTINUOUS FULL-SONG LIVE EDITING

  const recordBtn = document.getElementById('recordFullEditBtn');
  const previewBtn = document.getElementById('previewFullEditBtn');
  const exportStatus = document.getElementById('exportStatus');
  const exportMusicVideoBtn = document.getElementById('exportMusicVideoBtn');
  const masterOutputVideo = document.getElementById('masterOutputVideo');
  const switcherBtnsContainer = document.getElementById('switcherBtnsContainer');
  const mixCanvas = document.getElementById('mixCanvas');
  const previewVideo = document.getElementById('previewVideo');

  let isRecording = false;
  let switchTimeline = [];
  let currentTrack = 0;
  let recordedBlob = null;
  let recordedUrl = null;
  let mediaRecorder = null;
  let chunks = [];
  let drawRequestId = null;
  let fullPreviewCleanup = null;

  // LIVE CAMERA SWITCHER BUTTONS
  function renderSwitcherBtns() {
    if (!switcherBtnsContainer) return;
    switcherBtnsContainer.innerHTML = '';
    for (let i = 0; i < NUM_TRACKS; i++) {
      const btn = document.createElement('button');
      btn.className = 'switch-btn' + (i === currentTrack ? ' active' : '');
      btn.textContent = `Cam ${i+1}`;
      btn.disabled = isRecording ? false : uploadedVideos[i] === null;
      btn.onclick = () => {
        setActiveTrack(i);
        if (isRecording) {
          // Use audio.currentTime for ultra-tight sync
          recordSwitch(audio.currentTime * 1000, i);
        } else {
          previewTrackInCanvas(i);
        }
      };
      switcherBtnsContainer.appendChild(btn);
    }
  }
  function setActiveTrack(idx) {
    currentTrack = idx;
    renderSwitcherBtns();
  }
  function recordSwitch(timeMs, trackIdx) {
    if (switchTimeline.length > 0 && switchTimeline[switchTimeline.length-1].track === trackIdx) return;
    switchTimeline.push({ time: timeMs, track: trackIdx });
  }

  // RECORD THE ENTIRE SONG AS ONE VIDEO
  if (recordBtn) recordBtn.onclick = function() {
    if (uploadedVideos.some(v => !v)) {
      if (exportStatus) exportStatus.textContent = "Please upload all 6 takes before recording!";
      return;
    }
    if (!audio.src || audio.src === "") {
      if (exportStatus) exportStatus.textContent = "Please upload your song file before recording!";
      return;
    }
    switchTimeline = [{ time: 0, track: currentTrack }];
    isRecording = true;
    renderSwitcherBtns();

    // Sync all takes to start, mute, and play
    for (let i = 0; i < NUM_TRACKS; i++) {
      let v = document.getElementById(`video-${i}`);
      if (v) {
        v.currentTime = 0;
        v.muted = true;
        v.play();
      }
    }
    audio.currentTime = 0;
    audio.play();

    if (mixCanvas) mixCanvas.style.display = '';
    if (previewVideo) previewVideo.style.display = 'none';
    if (typeof fullPreviewCleanup === "function") fullPreviewCleanup();

    const ctx = mixCanvas.getContext('2d');
    ctx.fillStyle = "#111";
    ctx.fillRect(0,0,mixCanvas.width,mixCanvas.height);

    const videoStream = mixCanvas.captureStream(30);
    let audioStream = null;
    if (audio.captureStream) {
      audioStream = audio.captureStream();
    } else if (audio.mozCaptureStream) {
      audioStream = audio.mozCaptureStream();
    }
    let combinedStream;
    if (audioStream) {
      combinedStream = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...audioStream.getAudioTracks()
      ]);
    } else {
      combinedStream = videoStream;
    }

    chunks = [];
    mediaRecorder = new MediaRecorder(combinedStream, { mimeType: "video/webm" });
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    mediaRecorder.onstop = () => {
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      recordedBlob = new Blob(chunks, { type: "video/webm" });
      recordedUrl = URL.createObjectURL(recordedBlob);
      if (previewVideo) {
        previewVideo.src = recordedUrl;
        previewVideo.load();
        previewVideo.style.display = '';
      }
      if (mixCanvas) mixCanvas.style.display = 'none';
      isRecording = false;
      renderSwitcherBtns();
      if (exportStatus) exportStatus.textContent = "Recording complete! Preview or export your music video.";
    };
    mediaRecorder.start();

    function draw() {
      if (!isRecording) return;
      // Ultra-tight sync: always use audio.currentTime as master clock
      let elapsed = audio.currentTime * 1000;
      let track = switchTimeline[0].track;
      for (let i = 0; i < switchTimeline.length; i++) {
        if (switchTimeline[i].time <= elapsed) {
          track = switchTimeline[i].track;
        } else {
          break;
        }
      }
      const v = document.getElementById(`video-${track}`);
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, mixCanvas.width, mixCanvas.height);
      if (v && !v.paused && !v.ended && v.readyState >= 2) {
        // Try to keep video in sync with audio
        if (Math.abs(v.currentTime - audio.currentTime) > 0.03) {
          v.currentTime = audio.currentTime;
        }
        ctx.drawImage(v, 0, 0, mixCanvas.width, mixCanvas.height);
      } else {
        // fallback: blank canvas
        ctx.fillStyle = "#222";
        ctx.fillRect(0, 0, mixCanvas.width, mixCanvas.height);
      }
      if (audio.currentTime >= audio.duration || !isRecording) {
        stopFullRecording();
        return;
      }
      drawRequestId = requestAnimationFrame(draw);
    }
    draw();
    if (exportStatus) exportStatus.textContent = "Recording full edit. Use the switcher to change cameras in real time.";
  };

  function stopFullRecording() {
    if (!isRecording) return;
    isRecording = false;
    audio.pause();
    for (let i = 0; i < NUM_TRACKS; i++) {
      let v = document.getElementById(`video-${i}`);
      if (v) v.pause();
    }
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    if (drawRequestId !== null) cancelAnimationFrame(drawRequestId);
    drawRequestId = null;
  }

  // PREVIEW FULL SONG EDIT
  if (previewBtn) previewBtn.onclick = function() {
    if (!previewVideo) return;
    previewVideo.style.display = '';
    if (mixCanvas) mixCanvas.style.display = 'none';
    if (!recordedUrl) {
      if (exportStatus) exportStatus.textContent = "Nothing to preview yet. Please record first.";
      return;
    }
    if (typeof fullPreviewCleanup === "function") fullPreviewCleanup();

    let v = previewVideo;
    let pa = audio.cloneNode(true);
    pa.currentTime = 0;
    pa.volume = 1;
    pa.style.display = "none";
    pa.muted = false;
    document.body.appendChild(pa);

    let stopped = false;
    v.src = recordedUrl;
    v.currentTime = 0;
    v.muted = true;
    v.load();

    let syncRAF;
    function sync() {
      if (stopped) return;
      if (Math.abs(pa.currentTime - v.currentTime) > 0.04) {
        pa.currentTime = v.currentTime;
      }
      if (v.ended || pa.ended) {
        stopped = true;
        pa.pause();
        return;
      }
      syncRAF = requestAnimationFrame(sync);
    }

    v.oncanplay = function() {
      v.play();
      pa.currentTime = 0;
      pa.play();
      syncRAF = requestAnimationFrame(sync);
    };

    function cleanupPreview() {
      stopped = true;
      pa.pause();
      if (pa && pa.parentNode) pa.parentNode.removeChild(pa);
      if (syncRAF) cancelAnimationFrame(syncRAF);
      v.oncanplay = null;
    }
    fullPreviewCleanup = cleanupPreview;
    if (exportStatus) exportStatus.textContent = "Previewing your full music video edit.";
  };

  // EXPORT FINAL VIDEO
  if (exportMusicVideoBtn) exportMusicVideoBtn.onclick = async function() {
    if (!recordedBlob) {
      if (exportStatus) exportStatus.textContent = "Please record your edit first!";
      return;
    }
    if (exportStatus) exportStatus.textContent = "Exporting video file...";
    if (masterOutputVideo) {
      masterOutputVideo.src = recordedUrl;
      masterOutputVideo.load();
      masterOutputVideo.muted = false;
      masterOutputVideo.style.display = '';
    }
    if (exportStatus) exportStatus.textContent = "Export complete! Download your final video.";
    const a = document.createElement('a');
    a.href = recordedUrl;
    a.download = `fastcut_music_video.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // PREVIEW SINGLE TAKE WITHOUT RECORDING
  function previewTrackInCanvas(trackIdx) {
    if (!mixCanvas) return;
    mixCanvas.style.display = '';
    if (previewVideo) previewVideo.style.display = 'none';
    if (typeof fullPreviewCleanup === "function") fullPreviewCleanup();
    const ctx = mixCanvas.getContext('2d');
    const v = document.getElementById(`video-${trackIdx}`);
    if (v && v.readyState >= 2) {
      v.currentTime = 0;
      v.pause();
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, mixCanvas.width, mixCanvas.height);
      ctx.drawImage(v, 0, 0, mixCanvas.width, mixCanvas.height);
    } else {
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, mixCanvas.width, mixCanvas.height);
      ctx.fillStyle = "#ffe87d";
      ctx.font = "24px sans-serif";
      ctx.fillText("Load & play a video", 40, 140);
    }
  }

  renderSwitcherBtns();
});
