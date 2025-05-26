const NUM_VIDEOS = 10;

const songInput = document.getElementById('songInput');
const waveform = document.getElementById('waveform');
const randomDiceEditBtn = document.getElementById('randomDiceEditBtn');
const masterOutputVideo = document.getElementById('masterOutputVideo');
const masterOverlay = document.getElementById('masterOverlay');

let audio = null;
let audioUrl = null;
let audioBuffer = null;
let audioContext = null;
let isSongLoaded = false;

// Per-video screen state
const videoStates = Array(NUM_VIDEOS).fill().map(() => ({
  video: null,
  recordBtn: null,
  stopBtn: null,
  playBtn: null,
  recIndicator: null,
  countdown: null,
  mediaStream: null,
  mediaRecorder: null,
  recordedChunks: [],
  recordedVideoBlob: null,
  isRecording: false,
  isPlaying: false
}));

// Draw waveform for uploaded audio
function drawWaveform(buffer) {
  const canvas = waveform;
  const ctx = canvas.getContext('2d');
  const width = canvas.width = waveform.parentElement.offsetWidth;
  const height = canvas.height = 80;
  ctx.clearRect(0, 0, width, height);

  const data = buffer.getChannelData(0);
  const step = Math.floor(data.length / width);
  ctx.beginPath();
  ctx.moveTo(0, height / 2);

  for (let i = 0; i < width; i++) {
    let min = 1.0, max = -1.0;
    for (let j = 0; j < step; j++) {
      const datum = data[(i * step) + j];
      if (datum < min) min = datum;
      if (datum > max) max = datum;
    }
    ctx.lineTo(i, (1 + min) * 0.5 * height);
    ctx.lineTo(i, (1 + max) * 0.5 * height);
  }
  ctx.strokeStyle = "#36e";
  ctx.lineWidth = 1;
  ctx.stroke();
}

// Handle song upload and waveform generation
songInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (audio) {
    audio.pause();
    URL.revokeObjectURL(audio.src);
  }
  audioUrl = URL.createObjectURL(file);
  audio = new Audio(audioUrl);
  audio.preload = "auto";
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const arrayBuffer = await file.arrayBuffer();
  audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  drawWaveform(audioBuffer);
  isSongLoaded = true;
  // Enable record buttons on all videos
  videoStates.forEach((vs) => {
    vs.recordBtn.disabled = false;
  });
});

// Countdown utility
function showCountdown(countdownElem, seconds = 3) {
  return new Promise(resolve => {
    countdownElem.classList.remove('hidden');
    let current = seconds;
    countdownElem.textContent = current;
    const tick = () => {
      current--;
      if (current > 0) {
        countdownElem.textContent = current;
        setTimeout(tick, 1000);
      } else {
        countdownElem.textContent = "GO!";
        setTimeout(() => {
          countdownElem.classList.add('hidden');
          resolve();
        }, 700);
      }
    };
    setTimeout(tick, 1000);
  });
}

// Setup video screens
for (let i = 0; i < NUM_VIDEOS; i++) {
  const vs = videoStates[i];
  vs.video = document.getElementById(`video${i}`);
  vs.recordBtn = document.getElementById(`recordBtn${i}`);
  vs.stopBtn = document.getElementById(`stopBtn${i}`);
  vs.playBtn = document.getElementById(`playBtn${i}`);
  vs.recIndicator = document.getElementById(`recIndicator${i}`);
  vs.countdown = document.getElementById(`countdown${i}`);

  vs.video.controls = true; // Restore browser controls (play/volume)
  vs.video.muted = true;    // Muted by default

  vs.recordBtn.disabled = true;
  vs.playBtn.disabled = true;
  vs.stopBtn.disabled = true;

  // Record
  vs.recordBtn.addEventListener('click', async () => {
    if (vs.isRecording || !isSongLoaded) return;
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("getUserMedia not supported in this browser.");
        return;
      }
      await showCountdown(vs.countdown, 3);

      vs.mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      vs.video.srcObject = vs.mediaStream;
      vs.video.muted = true;
      await vs.video.play();
      vs.recIndicator.classList.remove('hidden');
      vs.isRecording = true;
      vs.recordedChunks = [];
      vs.recordedVideoBlob = null;

      vs.playBtn.disabled = true;
      vs.stopBtn.disabled = false;
      vs.recordBtn.disabled = true;

      // Sync: start song audio in sync with recording
      if (audio) {
        audio.currentTime = 0;
        audio.play();
      }

      // MediaRecorder setup
      let options = {};
      if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
        options.mimeType = 'video/webm;codecs=vp9,opus';
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
        options.mimeType = 'video/webm;codecs=vp8,opus';
      } else if (MediaRecorder.isTypeSupported('video/webm')) {
        options.mimeType = 'video/webm';
      }
      try {
        vs.mediaRecorder = new MediaRecorder(vs.mediaStream, options);
      } catch (err) {
        alert("MediaRecorder API is not supported with the selected codec in this browser.");
        vs.recIndicator.classList.add('hidden');
        vs.playBtn.disabled = false;
        vs.stopBtn.disabled = true;
        vs.recordBtn.disabled = false;
        vs.isRecording = false;
        if (vs.mediaStream) {
          vs.mediaStream.getTracks().forEach(track => track.stop());
          vs.mediaStream = null;
        }
        return;
      }

      vs.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          vs.recordedChunks.push(e.data);
        }
      };

      vs.mediaRecorder.onstop = () => {
        vs.recIndicator.classList.add('hidden');
        if (vs.mediaStream) {
          vs.mediaStream.getTracks().forEach(track => track.stop());
          vs.mediaStream = null;
        }
        vs.recordedVideoBlob = new Blob(vs.recordedChunks, { type: 'video/webm' });
        vs.video.srcObject = null;
        vs.video.src = URL.createObjectURL(vs.recordedVideoBlob);
        vs.video.muted = false;
        vs.video.controls = true; // Keep controls after recording
        vs.playBtn.disabled = false;
        vs.stopBtn.disabled = true;
        vs.recordBtn.disabled = false;
        vs.isRecording = false;
        // Stop audio
        if (audio) {
          audio.pause();
          audio.currentTime = 0;
        }
      };

      vs.mediaRecorder.start();
    } catch (err) {
      if (window.isSecureContext === false) {
        alert("Camera/mic access requires HTTPS or localhost. Please serve your site securely.");
      } else if (err && err.name === "NotAllowedError") {
        alert("Camera/mic permission denied. Please allow camera and mic access in your browser settings.");
      } else if (err && err.name === "NotFoundError") {
        alert("No camera or microphone found on this device.");
      } else {
        alert("Could not access camera or microphone. Error: " + err.message);
      }
    }
  });

  // Play
  vs.playBtn.addEventListener('click', () => {
    if (!vs.recordedVideoBlob || !audio) return;
    vs.video.srcObject = null;
    vs.video.src = URL.createObjectURL(vs.recordedVideoBlob);
    vs.video.muted = false;
    vs.video.controls = true;
    vs.video.currentTime = 0;
    audio.currentTime = 0;
    vs.isPlaying = true;
    vs.video.play();
    audio.play();

    vs.stopBtn.disabled = false;
    vs.playBtn.disabled = true;
    vs.recordBtn.disabled = false;

    // Keep audio synced to video
    const sync = () => {
      if (!vs.isPlaying) return;
      if (Math.abs(vs.video.currentTime - audio.currentTime) > 0.07) {
        audio.currentTime = vs.video.currentTime;
      }
      if (!vs.video.paused && audio.paused) audio.play();
      if (vs.video.paused && !audio.paused) audio.pause();
      if (!vs.video.ended) requestAnimationFrame(sync);
    };
    sync();

    // When either ends, stop both
    vs.video.onended = () => {
      vs.isPlaying = false;
      audio.pause();
      vs.stopBtn.disabled = true;
      vs.playBtn.disabled = false;
    };
    audio.onended = () => {
      vs.isPlaying = false;
      vs.video.pause();
      vs.stopBtn.disabled = true;
      vs.playBtn.disabled = false;
    };
  });

  // When video is manually paused/stopped, also stop audio
  vs.video.addEventListener('pause', () => {
    if (vs.isPlaying && audio && !audio.paused) audio.pause();
  });
  vs.video.addEventListener('play', () => {
    if (vs.isPlaying && audio && audio.paused) audio.play();
  });

  // Stop both video and audio
  vs.stopBtn.addEventListener('click', () => {
    if (vs.isRecording && vs.mediaRecorder && vs.mediaRecorder.state === "recording") {
      vs.mediaRecorder.stop(); // onstop will handle UI
      return;
    }
    vs.isPlaying = false;
    if (vs.video && !vs.video.paused) {
      vs.video.pause();
      vs.video.currentTime = 0;
    }
    if (audio && !audio.paused) {
      audio.pause();
      audio.currentTime = 0;
    }
    vs.stopBtn.disabled = true;
    vs.playBtn.disabled = false;
    vs.recordBtn.disabled = false;
  });
}

// Responsive redraw of waveform
window.addEventListener('resize', () => {
  if (audioBuffer) drawWaveform(audioBuffer);
});

// --------- MASTER OUTPUT: Random Dice Edit Feature --------
// [No changes from previous - kept as is]
function shuffleArray(array) {
  let arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function randomTransitionStyle() {
  const styles = [
    'fade', 'slide-left', 'slide-right', 'slide-up', 'slide-down', 'circle', 'zoom', 'flip'
  ];
  return styles[Math.floor(Math.random() * styles.length)];
}

function applyTransitionOverlay(type) {
  masterOverlay.style.display = 'block';
  masterOverlay.className = 'master-video-overlay';
  masterOverlay.innerHTML = '';
  switch (type) {
    case 'fade':
      masterOverlay.style.background = 'rgba(0,0,0,0.7)';
      masterOverlay.style.transition = 'background 0.6s';
      setTimeout(() => { masterOverlay.style.background = 'rgba(0,0,0,0)'; }, 80);
      break;
    case 'slide-left':
      masterOverlay.innerHTML = '<div style="width:100%;height:100%;background:#000;position:absolute;left:0;top:0;animation:slideLeft 0.8s;"></div>';
      break;
    case 'slide-right':
      masterOverlay.innerHTML = '<div style="width:100%;height:100%;background:#000;position:absolute;right:0;top:0;animation:slideRight 0.8s;"></div>';
      break;
    case 'zoom':
      masterOverlay.innerHTML = '<div style="width:100%;height:100%;background:#000;position:absolute;left:0;top:0;animation:zoomIn 0.7s;"></div>';
      break;
    case 'flip':
      masterOverlay.innerHTML = '<div style="width:100%;height:100%;background:#000;position:absolute;left:0;top:0;animation:flip 0.6s;"></div>';
      break;
    default:
      masterOverlay.style.background = 'rgba(0,0,0,0.0)';
  }
  setTimeout(() => {
    masterOverlay.style.background = 'rgba(0,0,0,0)';
    masterOverlay.innerHTML = '';
  }, 900);
}

const masterSegments = [];
let masterEditPlaying = false;
let masterEditTimeout = null;

randomDiceEditBtn.addEventListener('click', () => {
  const usedClips = videoStates
    .map((vs, idx) => ({ idx, blob: vs.recordedVideoBlob, duration: vs.video.duration }))
    .filter(v => v.blob && v.duration > 0);

  if (!usedClips.length) {
    alert("Please record at least one clip before using Random Dice Edit!");
    return;
  }
  if (!isSongLoaded || !audioBuffer) {
    alert("Please upload a song first!");
    return;
  }

  const songDuration = audioBuffer.duration;
  const minSegment = 1.5, maxSegment = 4.0;
  let t = 0, segmentTimes = [];
  while (t < songDuration) {
    let segLen = Math.min(maxSegment, Math.max(minSegment, minSegment + Math.random() * (maxSegment-minSegment)));
    if (t + segLen > songDuration) segLen = songDuration - t;
    segmentTimes.push([t, t+segLen]);
    t += segLen;
  }

  let shuffledClips = shuffleArray(usedClips);
  while (shuffledClips.length < segmentTimes.length) {
    shuffledClips = shuffledClips.concat(shuffleArray(usedClips));
  }

  masterSegments.length = 0;
  for (let i = 0; i < segmentTimes.length; i++) {
    let idx = i % shuffledClips.length;
    const { blob, duration, idx: vIdx } = shuffledClips[idx];
    masterSegments.push({
      videoBlob: blob,
      videoIdx: vIdx,
      videoSrc: URL.createObjectURL(blob),
      videoDuration: duration,
      segStart: segmentTimes[i][0],
      segEnd: segmentTimes[i][1],
      transition: i === 0 ? null : randomTransitionStyle(),
      filter: (Math.random() < 0.6) ? randomFilterCSS() : null,
      effect: (Math.random() < 0.3) ? randomEffectCSS() : null
    });
  }

  randomDiceEditBtn.disabled = true;
  randomDiceEditBtn.innerText = "🎲 Shuffling & Editing...";
  setTimeout(() => {
    randomDiceEditBtn.innerText = "🎲 Random Dice Edit the Entire Song";
    randomDiceEditBtn.disabled = false;
    playMasterEdit();
  }, 900);
});

function randomFilterCSS() {
  const filters = [
    "contrast(1.15) brightness(0.98) saturate(1.2)",
    "grayscale(0.15) sepia(0.21)",
    "blur(1px) brightness(1.08)",
    "hue-rotate(15deg)",
    "drop-shadow(0 0 7px #d3e1ff)",
    "none"
  ];
  return filters[Math.floor(Math.random() * filters.length)];
}

function randomEffectCSS() {
  const effects = [
    "pulse",
    "shake",
    "zoom-in",
    "zoom-out",
    null
  ];
  return effects[Math.floor(Math.random() * effects.length)];
}

function playMasterEdit() {
  if (masterEditPlaying) {
    masterOutputVideo.pause();
    masterEditPlaying = false;
    if (masterEditTimeout) clearTimeout(masterEditTimeout);
  }

  if (!masterSegments.length) return;

  masterOutputVideo.src = '';
  masterOutputVideo.currentTime = 0;
  masterOutputVideo.controls = false;

  let audioClone = new Audio(audioUrl);
  audioClone.currentTime = 0;

  let segIdx = 0;
  let segmentStartTime = 0;

  function playSegment(idx) {
    if (idx >= masterSegments.length) {
      audioClone.pause();
      masterOutputVideo.pause();
      masterOutputVideo.controls = true;
      masterEditPlaying = false;
      return;
    }

    const seg = masterSegments[idx];
    masterOutputVideo.src = seg.videoSrc;
    masterOutputVideo.currentTime = 0;
    masterOutputVideo.muted = true;
    masterOutputVideo.style.filter = seg.filter || '';
    masterOutputVideo.className = 'master-effect-' + (seg.effect || '');

    if (seg.transition) applyTransitionOverlay(seg.transition);

    masterOutputVideo.play();
    if (audioClone.paused) audioClone.play();
    audioClone.currentTime = seg.segStart;

    masterEditPlaying = true;
    segmentStartTime = performance.now();

    masterEditTimeout = setTimeout(() => {
      playSegment(idx + 1);
    }, Math.max(0, (seg.segEnd - seg.segStart) * 1000));
  }

  masterOutputVideo.addEventListener('seeked', () => {
    if (masterEditPlaying) {
      audioClone.currentTime = masterSegments[segIdx].segStart + masterOutputVideo.currentTime;
    }
  });

  masterOutputVideo.onended = () => {
    audioClone.pause();
    masterEditPlaying = false;
    masterOutputVideo.controls = true;
  };

  playSegment(0);
}

const style = document.createElement('style');
style.innerHTML = `
@keyframes master-pulse { 0%{transform:scale(1);} 50%{transform:scale(1.045);} 100%{transform:scale(1);} }
@keyframes master-shake { 0%,100%{transform:translateX(0);} 20%{transform:translateX(-6px);} 40%{transform:translateX(6px);} 60%{transform:translateX(-6px);} 80%{transform:translateX(6px);} }
@keyframes master-zoom-in { 0%{transform:scale(1);} 100%{transform:scale(1.07);} }
@keyframes master-zoom-out { 0%{transform:scale(1.07);} 100%{transform:scale(1);} }
.master-effect-pulse { animation: master-pulse 1.2s infinite; }
.master-effect-shake { animation: master-shake 1.1s linear; }
.master-effect-zoom-in { animation: master-zoom-in 0.7s forwards; }
.master-effect-zoom-out { animation: master-zoom-out 0.7s forwards; }
@keyframes slideLeft { from{left:0;} to{left:-100%;} }
@keyframes slideRight { from{right:0;} to{right:-100%;} }
@keyframes zoomIn { from{transform:scale(0.6);} to{transform:scale(1);} }
@keyframes flip { 0%{transform:rotateY(0);} 100%{transform:rotateY(180deg);} }
`;
document.head.appendChild(style);
