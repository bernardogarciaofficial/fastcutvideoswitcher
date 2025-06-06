// --- FASTCUT MUSIC VIDEO PLATFORM (with 8-bar Step-by-Step Segmented Editing) ---

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

  audio.currentTime = 0;
  audio.play();

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

// --- FastCut 6-Track Upload/Preview Section & Main Switcher Logic ---
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
  // Render 6-track upload grid
  const switcherTracks = document.getElementById("switcherTracks");
  switcherTracks.innerHTML = Array(NUM_TRACKS).fill(0).map((_, i) => `
    <div class="switcher-track" id="switcher-track-${i}">
      <div class="track-title">${TRACK_NAMES[i]}</div>
      <video id="video-${i}" width="140" height="90" controls muted></video>
      <div>
        <label class="upload-video-label" for="uploadVideoInput-${i}">Upload Take</label>
        <input type="file" id="uploadVideoInput-${i}" class="upload-video-input" accept=".mp4,.webm,.mov,.ogg,.mkv,video/*" style="display:none;">
        <button class="upload-video-btn" id="uploadVideoBtn-${i}">🎬 Upload Take</button>
      </div>
    </div>
  `).join("");

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
    };
  }

  // --- Live Switcher Buttons ---
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
      if (isSwitching) {
        recordSwitch(Date.now() - switchingStartTime, i);
      }
    };
    btn.disabled = true;
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

  // --- 8-Bars-At-A-Time Segmented Editing Logic (Strict Step-by-Step) ---
  const bpmInput = document.getElementById('bpmInput');
  const timeSigInput = document.getElementById('timeSigInput');
  const segmentTimeline = document.getElementById('segmentTimeline');
  const prevSegmentBtn = document.getElementById('prevSegmentBtn');
  const nextSegmentBtn = document.getElementById('nextSegmentBtn');
  const segmentTakeSelect = document.getElementById('segmentTakeSelect');
  const lockSegmentBtn = document.getElementById('lockSegmentBtn');
  const unlockSegmentBtn = document.getElementById('unlockSegmentBtn');
  const segmentInfo = document.getElementById('segmentInfo');
  const segmentLockStatus = document.getElementById('segmentLockStatus');

  let segmentData = [];
  let currentSegment = 0;
  let segmentCount = 0;

  function getBarLengthSec() {
    const bpm = parseFloat(bpmInput.value) || 120;
    return 60 / bpm * parseInt(timeSigInput.value || 4, 10);
  }
  function getSegmentLengthSec() {
    return getBarLengthSec() * 8;
  }
  function getAudioDuration() {
    return isFinite(audio.duration) && audio.duration > 0
      ? audio.duration
      : 180;
  }
  function recalcSegments() {
    segmentData = [];
    const totalDuration = getAudioDuration();
    const segLen = getSegmentLengthSec();
    segmentCount = Math.ceil(totalDuration / segLen);
    for (let i = 0; i < segmentCount; i++) {
      segmentData.push({
        start: i * segLen,
        end: Math.min((i + 1) * segLen, totalDuration),
        take: 0,
        locked: false
      });
    }
    currentSegment = 0;
  }
  function firstUnlockedSegment() {
    return segmentData.findIndex(s => !s.locked);
  }
  function renderSegmentTimeline() {
    segmentTimeline.innerHTML = '';
    segmentData.forEach((seg, idx) => {
      const block = document.createElement('div');
      block.className = 'segment-block' +
        (idx === currentSegment ? ' active' : '') +
        (seg.locked ? ' locked' : '');
      block.textContent = `Bars ${1 + idx * 8}–${Math.min((idx + 1) * 8, Math.ceil(getAudioDuration() / getBarLengthSec()))}`;
      if (seg.locked) {
        const lockIcon = document.createElement('span');
        lockIcon.className = 'lock-icon';
        lockIcon.textContent = '🔒';
        block.appendChild(lockIcon);
      }
      // Only allow click for current or previous segments
      if (idx <= firstUnlockedSegment() || seg.locked) {
        block.onclick = () => {
          currentSegment = idx;
          renderSegmentTimeline();
          updateSegmentAssignmentUI();
        };
      } else {
        block.style.opacity = 0.5;
        block.style.cursor = "not-allowed";
      }
      segmentTimeline.appendChild(block);
    });
  }
  function updateSegmentAssignmentUI() {
    if (!segmentData.length) return;
    segmentInfo.textContent = `Segment ${currentSegment + 1} of ${segmentCount} (Bars ${1 + currentSegment * 8}–${Math.min((currentSegment + 1) * 8, Math.ceil(getAudioDuration() / getBarLengthSec()))})`;
    segmentTakeSelect.innerHTML = '';
    for (let i = 0; i < NUM_TRACKS; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = `Take ${i + 1}`;
      segmentTakeSelect.appendChild(opt);
    }
    segmentTakeSelect.value = segmentData[currentSegment].take;
    // Only allow editing the first unlocked segment (or locked segments, but not others)
    const unlockedIdx = firstUnlockedSegment();
    const canEdit = (currentSegment === unlockedIdx && unlockedIdx !== -1) || segmentData[currentSegment].locked;
    segmentTakeSelect.disabled = !canEdit || segmentData[currentSegment].locked;
    lockSegmentBtn.style.display = canEdit && !segmentData[currentSegment].locked ? '' : 'none';
    unlockSegmentBtn.style.display = segmentData[currentSegment].locked ? '' : 'none';
    prevSegmentBtn.disabled = currentSegment <= 0;
    nextSegmentBtn.disabled = currentSegment >= unlockedIdx && unlockedIdx !== -1;
    segmentLockStatus.textContent = segmentData[currentSegment].locked ? 'Locked – cannot edit unless unlocked.' : '';
  }
  segmentTakeSelect.onchange = () => {
    segmentData[currentSegment].take = parseInt(segmentTakeSelect.value, 10);
  };
  lockSegmentBtn.onclick = () => {
    segmentData[currentSegment].locked = true;
    // Advance to next segment unless it's the last one
    const nextIdx = currentSegment + 1;
    renderSegmentTimeline();
    if (nextIdx < segmentCount && firstUnlockedSegment() === nextIdx) {
      currentSegment = nextIdx;
    }
    renderSegmentTimeline();
    updateSegmentAssignmentUI();
  };
  unlockSegmentBtn.onclick = () => {
    segmentData[currentSegment].locked = false;
    renderSegmentTimeline();
    updateSegmentAssignmentUI();
  };
  prevSegmentBtn.onclick = () => {
    if (currentSegment > 0) {
      currentSegment--;
      renderSegmentTimeline();
      updateSegmentAssignmentUI();
    }
  };
  nextSegmentBtn.onclick = () => {
    const unlockedIdx = firstUnlockedSegment();
    if (currentSegment < unlockedIdx) {
      currentSegment++;
      renderSegmentTimeline();
      updateSegmentAssignmentUI();
    }
  };
  bpmInput.onchange = timeSigInput.onchange = () => {
    recalcSegments();
    renderSegmentTimeline();
    updateSegmentAssignmentUI();
  };
  audio.onloadedmetadata = () => {
    recalcSegments();
    renderSegmentTimeline();
    updateSegmentAssignmentUI();
  };
  // On initial load
  recalcSegments();
  renderSegmentTimeline();
  updateSegmentAssignmentUI();

  // --- Play Segment button logic ---
  const segmentControlsDiv = document.querySelector('.segment-controls');
  let playSegmentBtn = document.createElement('button');
  playSegmentBtn.textContent = 'Play Segment';
  segmentControlsDiv.appendChild(playSegmentBtn);

  let segmentAudioTimeout = null;
  playSegmentBtn.onclick = () => {
    const seg = segmentData[currentSegment];
    if (!seg) return;
    audio.currentTime = seg.start;
    audio.play();
    if (segmentAudioTimeout) clearTimeout(segmentAudioTimeout);
    segmentAudioTimeout = setTimeout(() => {
      audio.pause();
    }, (seg.end - seg.start) * 1000);
  };
  // Pause audio if user navigates away
  segmentTakeSelect.onfocus = prevSegmentBtn.onfocus = nextSegmentBtn.onfocus = () => {
    if (segmentAudioTimeout) clearTimeout(segmentAudioTimeout);
    audio.pause();
  };

  // --- Live Switcher/Export Logic (respects locked segments if any locked) ---
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

  startSwitchingBtn.disabled = false;
  stopSwitchingBtn.disabled = true;

  function recordSwitch(timeMs, trackIdx) {
    if (switchingTimeline.length === 0 && timeMs > 100) return;
    if (switchingTimeline.length > 0 && switchingTimeline[switchingTimeline.length-1].track === trackIdx) return;
    switchingTimeline.push({ time: timeMs, track: trackIdx });
  }

  // Helper: Use segmented timeline if any segments are locked, else use live switching
  function getExportTimeline() {
    if (segmentData.some(seg => seg.locked)) {
      let t = [];
      segmentData.forEach((seg, idx) => {
        t.push({ time: Math.round(seg.start * 1000), track: seg.take });
      });
      return t;
    } else {
      return switchingTimeline.length ? switchingTimeline : [{ time: 0, track: activeTrack }];
    }
  }

  startSwitchingBtn.onclick = () => {
    switchingError.textContent = '';
    const allUploaded = uploadedVideos.every(v => !!v);
    if (!allUploaded) {
      switchingError.textContent = "Please upload all 6 video takes before starting switching!";
      return;
    }
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
      exportStatus.textContent = "Warning: Audio captureStream not supported in your browser. Output will be silent.";
    }

    masterChunks = [];
    mediaRecorder = new MediaRecorder(combinedStream, { mimeType: "video/webm" });
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
    let duration = getAudioDuration();
    masterOutputVideo.srcObject = combinedStream;
    masterOutputVideo.muted = true;
    masterOutputVideo.play();
    audio.currentTime = 0;
    audio.play();
    mediaRecorder.start();

    // Timeline for draw(): either from segmentData (if any locked) or live
    const useTimeline = getExportTimeline();

    function draw() {
      if (!mixing) return;
      let elapsed = (audio.currentTime || 0) * 1000;
      let track = useTimeline[0].track;
      for (let i = 0; i < useTimeline.length; i++) {
        if (useTimeline[i].time <= elapsed) {
          track = useTimeline[i].track;
        } else {
          break;
        }
      }
      const v = document.getElementById(`video-${track}`);
      const ctx = mixCanvas.getContext('2d');
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, mixCanvas.width, mixCanvas.height);
      if (v && !v.paused && !v.ended) {
        ctx.drawImage(v, 0, 0, mixCanvas.width, mixCanvas.height);
      }
      if ((audio.currentTime < duration) && mixing && isSwitching) {
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
    audio.pause();
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    if (drawRequestId !== null) cancelAnimationFrame(drawRequestId);
    drawRequestId = null;
    exportStatus.textContent = "Rendering and export complete! Download below.";
  };

  masterOutputVideo.muted = false;

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
