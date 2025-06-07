// FastCut 24-bar segment editor with working "Film Each Take", fade, and REC indicator in corner, with webcam record per take

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

// --- FILM EACH TAKE LOGIC (with webcam record)

const NUM_TAKES = 6;
const TAKE_NAMES = [
  "Video Track 1",
  "Video Track 2",
  "Video Track 3",
  "Video Track 4",
  "Video Track 5",
  "Video Track 6"
];
const filmEachTakeSection = document.getElementById('filmEachTakeSection');
const filmTakes = document.getElementById('filmTakes');
const proceedBtn = document.getElementById('proceedToSegmentEditingBtn');
let filmBlobs = Array(NUM_TAKES).fill(null); // URL of uploaded/recorded blobs
let takeVideos = Array(NUM_TAKES).fill(null);

let mediaRecorders = Array(NUM_TAKES).fill(null);
let recordedBlobs = Array(NUM_TAKES).fill(null);
let takeStreams = Array(NUM_TAKES).fill(null);
let isRecordingArr = Array(NUM_TAKES).fill(false);

function renderFilmTakes() {
  filmTakes.innerHTML = "";
  for (let i = 0; i < NUM_TAKES; i++) {
    const block = document.createElement('div');
    block.className = 'film-take-block';
    block.innerHTML = `
      <div class="track-title">${TAKE_NAMES[i]}</div>
      <video id="film-video-${i}" width="140" height="90" controls style="background:#222; display:${filmBlobs[i] ? '' : 'none'}"></video>
      <div>
        <label class="upload-video-label" for="filmUploadInput-${i}">Upload Take</label>
        <input type="file" id="filmUploadInput-${i}" accept=".mp4,.webm,.mov,.ogg,.mkv,video/*" style="display:none;">
        <button class="upload-video-btn" id="filmUploadBtn-${i}">🎬 Upload</button>
      </div>
      <button class="record-take-btn" id="filmRecordBtn-${i}">Record Take</button>
    `;
    filmTakes.appendChild(block);
    // Wire up upload
    const uploadBtn = document.getElementById(`filmUploadBtn-${i}`);
    const uploadInput = document.getElementById(`filmUploadInput-${i}`);
    const recordBtn = document.getElementById(`filmRecordBtn-${i}`);
    const videoEl = document.getElementById(`film-video-${i}`);
    uploadBtn.onclick = () => uploadInput.click();
    uploadInput.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      filmBlobs[i] = url;
      videoEl.srcObject = null;
      videoEl.src = url;
      videoEl.style.display = '';
      videoEl.load();
      uploadBtn.textContent = "🎬 Uploaded!";
      setTimeout(() => uploadBtn.textContent = "🎬 Upload", 2500);
    };
    // Webcam record logic
    recordBtn.onclick = async () => {
      if (!isRecordingArr[i]) {
        // Start webcam
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          takeStreams[i] = stream;
          videoEl.srcObject = stream;
          videoEl.muted = true;
          videoEl.style.display = '';
          videoEl.play();
          mediaRecorders[i] = new MediaRecorder(stream, { mimeType: "video/webm" });
          recordedBlobs[i] = [];
          mediaRecorders[i].ondataavailable = e => {
            if (e.data.size > 0) recordedBlobs[i].push(e.data);
          };
          mediaRecorders[i].onstop = () => {
            const blob = new Blob(recordedBlobs[i], { type: "video/webm" });
            const url = URL.createObjectURL(blob);
            filmBlobs[i] = url;
            videoEl.srcObject = null;
            videoEl.src = url;
            videoEl.muted = false;
            videoEl.load();
            if (takeStreams[i]) takeStreams[i].getTracks().forEach(track => track.stop());
            recordBtn.textContent = "Record Take";
            isRecordingArr[i] = false;
          };
          mediaRecorders[i].start();
          isRecordingArr[i] = true;
          recordBtn.textContent = "Stop Recording";
        } catch (err) {
          alert("Could not access webcam.");
        }
      } else {
        // Stop recording
        mediaRecorders[i].stop();
        isRecordingArr[i] = false;
        recordBtn.textContent = "Saving...";
      }
    };
    // Show video if available
    if (filmBlobs[i]) {
      videoEl.srcObject = null;
      videoEl.src = filmBlobs[i];
      videoEl.style.display = '';
      videoEl.load();
      takeVideos[i] = videoEl;
    }
  }
}
renderFilmTakes();

proceedBtn.onclick = () => {
  if (filmBlobs.some(v => !v)) {
    proceedBtn.textContent = "Upload or film all takes first!";
    setTimeout(() => proceedBtn.textContent = "Proceed to Segment Editing", 2000);
    return;
  }
  filmEachTakeSection.style.display = 'none';
  document.getElementById('segmentEditingSection').style.display = '';
  // Now load the segment editing with the takes
  for (let i = 0; i < NUM_TAKES; i++) {
    takeVideos[i] = document.createElement('video');
    takeVideos[i].src = filmBlobs[i];
    takeVideos[i].muted = true;
    takeVideos[i].load();
  }
  setupSegmentEditing();
};

// --- SEGMENTED EDITING LOGIC

function setupSegmentEditing() {
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

// Fade logic
let fadeDuration = 180; // ms
let fadeStartTime = null;
let isFading = false;
let previousTrack = null;

function getBarLengthSec() {
  const bpm = parseFloat(bpmInput.value) || 120;
  return 60 / bpm * parseInt(timeSigInput.value || 4, 10);
}
function getSegmentLengthSec() {
  return getBarLengthSec() * 24;
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
    block.textContent = `Bars ${1 + idx * 24}–${Math.min((idx + 1) * 24, Math.ceil(getAudioDuration() / getBarLengthSec()))}`;
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
  segmentInfo.textContent = `Segment ${currentSegment + 1} of ${segmentCount} (Bars ${1 + currentSegment * 24}–${Math.min((currentSegment + 1) * 24, Math.ceil(getAudioDuration() / getBarLengthSec()))})`;
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
  for (let i = 0; i < NUM_TAKES; i++) {
    const btn = document.createElement('button');
    btn.className = 'segment-switch-btn' + (i === segmentActiveTrack ? ' active' : '');
    btn.textContent = `Cam ${i+1}`;
    btn.disabled = isSegmentLocked[currentSegment] && !isSegmentRecording;
    btn.onclick = () => {
      if (isSegmentRecording) {
        const now = Date.now();
        recordSegmentSwitch(now - segmentRecordingStart, i);
      } else {
        switchToTrack(i);
        previewTrackInCanvas(i);
      }
    };
    segmentSwitcherBtns.appendChild(btn);
  }
}

function switchToTrack(newTrackIndex) {
  if (segmentActiveTrack !== newTrackIndex) {
    previousTrack = segmentActiveTrack;
    segmentActiveTrack = newTrackIndex;
    isFading = true;
    fadeStartTime = performance.now();
  }
  renderSegmentSwitcherBtns();
}

function recordSegmentSwitch(timeMs, trackIdx) {
  if (segmentSwitchTimeline.length === 0 && timeMs > 100) return;
  if (segmentSwitchTimeline.length > 0 && segmentSwitchTimeline[segmentSwitchTimeline.length-1].track === trackIdx) return;
  segmentSwitchTimeline.push({ time: timeMs, track: trackIdx });
}

function previewTrackInCanvas(trackIdx) {
  segmentMixCanvas.style.display = '';
  const ctx = segmentMixCanvas.getContext('2d');
  const v = takeVideos[trackIdx];
  if (v && v.readyState >= 2) {
    v.currentTime = Math.max(v.currentTime, segmentData[currentSegment].start);
    v.pause();
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, segmentMixCanvas.width, segmentMixCanvas.height);
    ctx.drawImage(v, 0, 0, segmentMixCanvas.width, segmentMixCanvas.height);
  } else {
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, segmentMixCanvas.width, segmentMixCanvas.height);
    ctx.fillStyle = "#ffe87d";
    ctx.font = "24px sans-serif";
    ctx.fillText("Load & play a video", 40, 140);
  }
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
  if (takeVideos.some(v => !v)) {
    segmentLockStatus.textContent = "Please upload or film all 6 takes before recording!";
    return;
  }
  for (let i = 0; i < NUM_TAKES; i++) {
    takeVideos[i].currentTime = segmentData[currentSegment].start;
    takeVideos[i].pause();
  }
  isSegmentRecording = false;
  renderSegmentSwitcherBtns();
  showCountdownAndRec(() => {
    isSegmentRecording = true;
    segmentSwitchTimeline = [{ time: 0, track: segmentActiveTrack }];
    segmentRecordingStart = Date.now();
    for (let i = 0; i < NUM_TAKES; i++) {
      takeVideos[i].currentTime = segmentData[currentSegment].start;
      takeVideos[i].muted = true;
      takeVideos[i].play();
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
      if (segmentActiveTrack !== track) {
        switchToTrack(track);
      }
      // Fade logic
      const ctx = segmentMixCanvas.getContext('2d');
      if (isFading && previousTrack !== null) {
        const now = performance.now();
        const alpha = Math.min((now - fadeStartTime) / fadeDuration, 1);
        ctx.globalAlpha = 1 - alpha;
        drawVideoFrame(previousTrack, ctx);
        ctx.globalAlpha = alpha;
        drawVideoFrame(segmentActiveTrack, ctx);
        ctx.globalAlpha = 1;
        if (alpha < 1) {
          segmentDrawRequestId = requestAnimationFrame(draw);
          return;
        } else {
          isFading = false;
          previousTrack = null;
        }
      }
      ctx.globalAlpha = 1;
      drawVideoFrame(segmentActiveTrack, ctx);

      if ((audio.currentTime >= segmentData[currentSegment].end) || !isSegmentRecording) {
        stopSegmentRecording();
        return;
      }
      segmentDrawRequestId = requestAnimationFrame(draw);
    }
    draw();
  });
};

function drawVideoFrame(trackIdx, ctx) {
  const v = takeVideos[trackIdx];
  if (v && v.readyState >= 2 && !v.paused && !v.ended) {
    ctx.drawImage(v, 0, 0, segmentMixCanvas.width, segmentMixCanvas.height);
  }
}

function stopSegmentRecording() {
  if (!isSegmentRecording) return;
  isSegmentRecording = false;
  audio.pause();
  for (let i = 0; i < NUM_TAKES; i++) {
    takeVideos[i].pause();
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
}
