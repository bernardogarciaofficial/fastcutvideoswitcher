// --- FASTCUT LIVE 8-BAR SEGMENT SWITCHING ---

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

  // 8-Bar Live Segment Edit Logic
  const bpmInput = document.getElementById('bpmInput');
  const timeSigInput = document.getElementById('timeSigInput');
  const segmentTimeline = document.getElementById('segmentTimeline');
  const prevSegmentBtn = document.getElementById('prevSegmentBtn');
  const nextSegmentBtn = document.getElementById('nextSegmentBtn');
  const startSegmentRecordingBtn = document.getElementById('startSegmentRecordingBtn');
  const lockSegmentBtn = document.getElementById('lockSegmentBtn');
  const unlockSegmentBtn = document.getElementById('unlockSegmentBtn');
  const previewSegmentBtn = document.getElementById('previewSegmentBtn');
  const segmentInfo = document.getElementById('segmentInfo');
  const segmentLockStatus = document.getElementById('segmentLockStatus');
  const segmentSwitcherBtns = document.getElementById('segmentSwitcherBtns');
  const segmentMixCanvas = document.getElementById('segmentMixCanvas');
  const segmentPreviewVideo = document.getElementById('segmentPreviewVideo');
  const overlay = document.getElementById('segmentRecordingOverlay');
  const countdownDiv = document.getElementById('countdown');
  const recIndicator = document.getElementById('recIndicator');

  let segmentData = [];
  let currentSegment = 0;
  let segmentCount = 0;
  let segmentRecordings = [];
  let isSegmentLocked = [];
  let segmentSwitchTimeline = [];
  let segmentActiveTrack = 0;
  let isSegmentRecording = false;
  let segmentDrawRequestId = null;
  let segmentMediaRecorder = null;
  let segmentChunks = [];
  let segmentRecordingStart = 0;
  let segmentRecordingBlobUrl = null;

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
    segmentRecordings = [];
    isSegmentLocked = [];
    const totalDuration = getAudioDuration();
    const segLen = getSegmentLengthSec();
    segmentCount = Math.ceil(totalDuration / segLen);
    for (let i = 0; i < segmentCount; i++) {
      segmentData.push({
        start: i * segLen,
        end: Math.min((i + 1) * segLen, totalDuration)
      });
      segmentRecordings.push(null);
      isSegmentLocked.push(false);
    }
    currentSegment = 0;
  }

  function renderSegmentTimeline() {
    segmentTimeline.innerHTML = '';
    segmentData.forEach((seg, idx) => {
      const block = document.createElement('div');
      block.className = 'segment-block' +
        (idx === currentSegment ? ' active' : '') +
        (isSegmentLocked[idx] ? ' locked' : '');
      block.textContent = `Bars ${1 + idx * 8}–${Math.min((idx + 1) * 8, Math.ceil(getAudioDuration() / getBarLengthSec()))}`;
      if (isSegmentLocked[idx]) {
        const lockIcon = document.createElement('span');
        lockIcon.className = 'lock-icon';
        lockIcon.textContent = '🔒';
        block.appendChild(lockIcon);
      }
      if (idx <= currentSegment) {
        block.onclick = () => {
          if (idx === currentSegment || isSegmentLocked[idx]) {
            currentSegment = idx;
            renderSegmentTimeline();
            updateSegmentUI();
          }
        };
      } else {
        block.style.opacity = 0.5;
        block.style.cursor = "not-allowed";
      }
      segmentTimeline.appendChild(block);
    });
  }

  function updateSegmentUI() {
    segmentInfo.textContent = `Segment ${currentSegment + 1} of ${segmentCount} (Bars ${1 + currentSegment * 8}–${Math.min((currentSegment + 1) * 8, Math.ceil(getAudioDuration() / getBarLengthSec()))})`;
    segmentLockStatus.textContent = isSegmentLocked[currentSegment] ? 'Locked – cannot edit unless unlocked.' : '';
    prevSegmentBtn.disabled = currentSegment === 0;
    nextSegmentBtn.disabled = currentSegment === segmentCount - 1 || !isSegmentLocked[currentSegment];
    startSegmentRecordingBtn.style.display = isSegmentLocked[currentSegment] ? 'none' : '';
    lockSegmentBtn.style.display = (!isSegmentLocked[currentSegment] && !!segmentRecordings[currentSegment]) ? '' : 'none';
    unlockSegmentBtn.style.display = isSegmentLocked[currentSegment] ? '' : 'none';
    previewSegmentBtn.style.display = !!segmentRecordings[currentSegment] ? '' : 'none';
    segmentPreviewVideo.style.display = 'none';
    segmentMixCanvas.style.display = 'none';
    overlay.style.display = 'none';
    renderSegmentSwitcherBtns();
  }

  prevSegmentBtn.onclick = () => {
    if (currentSegment > 0) {
      currentSegment--;
      renderSegmentTimeline();
      updateSegmentUI();
    }
  };
  nextSegmentBtn.onclick = () => {
    if (currentSegment < segmentCount - 1 && isSegmentLocked[currentSegment]) {
      currentSegment++;
      renderSegmentTimeline();
      updateSegmentUI();
    }
  };
  bpmInput.onchange = timeSigInput.onchange = () => {
    recalcSegments();
    renderSegmentTimeline();
    updateSegmentUI();
  };
  audio.onloadedmetadata = () => {
    recalcSegments();
    renderSegmentTimeline();
    updateSegmentUI();
  };

  function renderSegmentSwitcherBtns() {
    segmentSwitcherBtns.innerHTML = '';
    for (let i = 0; i < NUM_TRACKS; i++) {
      const btn = document.createElement('button');
      btn.className = 'segment-switch-btn' + (i === segmentActiveTrack ? ' active' : '');
      btn.textContent = `Cam ${i+1}`;
      btn.disabled = isSegmentLocked[currentSegment] || !isSegmentRecording;
      btn.onclick = () => {
        if (!isSegmentRecording) return;
        setSegmentActiveTrack(i);
        recordSegmentSwitch(Date.now() - segmentRecordingStart, i);
      };
      segmentSwitcherBtns.appendChild(btn);
    }
  }
  function setSegmentActiveTrack(idx) {
    segmentActiveTrack = idx;
    renderSegmentSwitcherBtns();
  }
  function recordSegmentSwitch(timeMs, trackIdx) {
    if (segmentSwitchTimeline.length === 0 && timeMs > 100) return;
    if (segmentSwitchTimeline.length > 0 && segmentSwitchTimeline[segmentSwitchTimeline.length-1].track === trackIdx) return;
    segmentSwitchTimeline.push({ time: timeMs, track: trackIdx });
  }

  function showCountdownAndRec(cb) {
    overlay.style.display = '';
    countdownDiv.style.display = '';
    recIndicator.classList.remove('blinking');
    countdownDiv.textContent = '3';
    let t = 3;
    let interval = setInterval(() => {
      t--;
      if (t > 0) {
        countdownDiv.textContent = t;
      } else {
        countdownDiv.textContent = '';
        countdownDiv.style.display = 'none';
        recIndicator.classList.add('blinking');
        cb();
        clearInterval(interval);
      }
    }, 1000);
  }
  function hideOverlay() {
    overlay.style.display = 'none';
    countdownDiv.textContent = '';
    countdownDiv.style.display = '';
    recIndicator.classList.remove('blinking');
  }

  startSegmentRecordingBtn.onclick = async () => {
    if (uploadedVideos.some(v => !v)) {
      segmentLockStatus.textContent = "Please upload all 6 takes before recording!";
      return;
    }
    for (let i = 0; i < NUM_TRACKS; i++) {
      const v = document.getElementById(`video-${i}`);
      v.currentTime = segmentData[currentSegment].start;
      v.pause();
    }
    isSegmentRecording = false;
    renderSegmentSwitcherBtns();
    showCountdownAndRec(() => {
      isSegmentRecording = true;
      segmentSwitchTimeline = [{ time: 0, track: segmentActiveTrack }];
      segmentRecordingStart = Date.now();
      for (let i = 0; i < NUM_TRACKS; i++) {
        const v = document.getElementById(`video-${i}`);
        v.currentTime = segmentData[currentSegment].start;
        v.muted = true;
        v.play();
      }
      audio.currentTime = segmentData[currentSegment].start;
      audio.play();

      segmentMixCanvas.style.display = '';
      const ctx = segmentMixCanvas.getContext('2d');
      ctx.fillStyle = "#111";
      ctx.fillRect(0,0,segmentMixCanvas.width,segmentMixCanvas.height);

      const videoStream = segmentMixCanvas.captureStream(30);
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
      segmentChunks = [];
      segmentMediaRecorder = new MediaRecorder(combinedStream, { mimeType: "video/webm" });
      segmentMediaRecorder.ondataavailable = e => { if (e.data.size > 0) segmentChunks.push(e.data); };
      segmentMediaRecorder.onstop = () => {
        if (segmentRecordingBlobUrl) URL.revokeObjectURL(segmentRecordingBlobUrl);
        const blob = new Blob(segmentChunks, { type: "video/webm" });
        segmentRecordingBlobUrl = URL.createObjectURL(blob);
        segmentPreviewVideo.src = segmentRecordingBlobUrl;
        segmentPreviewVideo.load();
        segmentRecordings[currentSegment] = {
          videoBlob: blob,
          timeline: [...segmentSwitchTimeline]
        };
        segmentPreviewVideo.style.display = '';
        segmentMixCanvas.style.display = 'none';
        isSegmentRecording = false;
        hideOverlay();
        renderSegmentSwitcherBtns();
        updateSegmentUI();
      };
      segmentMediaRecorder.start();
      function draw() {
        if (!isSegmentRecording) return;
        let elapsed = (audio.currentTime - segmentData[currentSegment].start) * 1000;
        let track = segmentSwitchTimeline[0].track;
        for (let i = 0; i < segmentSwitchTimeline.length; i++) {
          if (segmentSwitchTimeline[i].time <= elapsed) {
            track = segmentSwitchTimeline[i].track;
          } else {
            break;
          }
        }
        const v = document.getElementById(`video-${track}`);
        ctx.fillStyle = "#111";
        ctx.fillRect(0, 0, segmentMixCanvas.width, segmentMixCanvas.height);
        if (v && !v.paused && !v.ended) {
          ctx.drawImage(v, 0, 0, segmentMixCanvas.width, segmentMixCanvas.height);
        }
        if ((audio.currentTime >= segmentData[currentSegment].end) || !isSegmentRecording) {
          stopSegmentRecording();
          return;
        }
        segmentDrawRequestId = requestAnimationFrame(draw);
      }
      draw();
    });
  };

  function stopSegmentRecording() {
    if (!isSegmentRecording) return;
    isSegmentRecording = false;
    audio.pause();
    for (let i = 0; i < NUM_TRACKS; i++) {
      const v = document.getElementById(`video-${i}`);
      v.pause();
    }
    if (segmentMediaRecorder && segmentMediaRecorder.state !== "inactive") {
      segmentMediaRecorder.stop();
    }
    if (segmentDrawRequestId !== null) cancelAnimationFrame(segmentDrawRequestId);
    segmentDrawRequestId = null;
  }

  lockSegmentBtn.onclick = () => {
    if (!segmentRecordings[currentSegment]) return;
    isSegmentLocked[currentSegment] = true;
    updateSegmentUI();
    renderSegmentTimeline();
  };
  unlockSegmentBtn.onclick = () => {
    isSegmentLocked[currentSegment] = false;
    updateSegmentUI();
    renderSegmentTimeline();
  };
  previewSegmentBtn.onclick = () => {
    if (segmentRecordings[currentSegment]) {
      segmentPreviewVideo.src = URL.createObjectURL(segmentRecordings[currentSegment].videoBlob);
      segmentPreviewVideo.style.display = '';
      segmentMixCanvas.style.display = 'none';
      segmentPreviewVideo.play();
    }
  };

  recalcSegments();
  renderSegmentTimeline();
  updateSegmentUI();

  // Export Logic: Concatenate all segment videos
  const masterOutputVideo = document.getElementById('masterOutputVideo');
  const exportMusicVideoBtn = document.getElementById('exportMusicVideoBtn');
  const exportStatus = document.getElementById('exportStatus');

  exportMusicVideoBtn.onclick = async function() {
    if (isSegmentLocked.some(l => !l) || segmentRecordings.some(r => !r)) {
      exportStatus.textContent = "Please record and lock all segments first!";
      return;
    }
    exportStatus.textContent = "Exporting (concatenating segments)...";
    const blobs = segmentRecordings.map(r => r.videoBlob);
    const superBlob = new Blob(blobs, { type: "video/webm" });
    const url = URL.createObjectURL(superBlob);
    masterOutputVideo.src = url;
    masterOutputVideo.load();
    masterOutputVideo.muted = false;
    exportStatus.textContent = "Export complete! Download your final video.";
    const a = document.createElement('a');
    a.href = url;
    a.download = `fastcut_music_video.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
});
