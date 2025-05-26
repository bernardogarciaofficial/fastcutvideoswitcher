const NUM_VIDEOS = 10;

const songInput = document.getElementById('songInput');
const waveform = document.getElementById('waveform');
const randomDiceEditBtn = document.getElementById('randomDiceEditBtn');
const masterOutputVideo = document.getElementById('masterOutputVideo');

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
        vs.video.controls = true;
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
    vs.video.currentTime = 0;
    audio.currentTime = 0;
    vs.video.controls = true;
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

// ----------- RANDOM DICE EDIT FUNCTIONALITY (PROTOTYPE) -----------

// Helper: Shuffle array (Fisher-Yates)
function shuffleArray(array) {
  let arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Helper: Get all available (recorded) videos
function getAvailableVideos() {
  return videoStates
    .map((vs, idx) => ({ idx, blob: vs.recordedVideoBlob }))
    .filter(v => !!v.blob);
}

// Helper: Generate random edit points (simulate on-the-beat cuts)
function getRandomEditPoints(audioDuration, minCut = 1.5, maxCut = 4.5) {
  let points = [0];
  let t = 0;
  while (t < audioDuration - minCut) {
    let cut = minCut + Math.random() * (maxCut - minCut);
    t += cut;
    if (t < audioDuration) points.push(t);
  }
  if (points[points.length - 1] < audioDuration) points.push(audioDuration);
  return points;
}

// Simulate a random dice edit
randomDiceEditBtn.addEventListener('click', async () => {
  // 1. Gather all available video blobs
  const videoClips = getAvailableVideos();
  if (!audioBuffer || !audio || videoClips.length === 0) {
    alert('Please upload a song and record at least one video to use the Random Dice Edit.');
    return;
  }

  // 2. Get random order of video indices
  const shuffledIndices = shuffleArray(videoClips.map(v => v.idx));

  // 3. Generate random edit points (simulate beat cuts)
  const audioDuration = audioBuffer.duration;
  const editPoints = getRandomEditPoints(audioDuration);

  // 4. Assign video segments to each cut (cycle through shuffled indices)
  let segments = [];
  let currentIdxInShuffle = 0;
  for (let i = 0; i < editPoints.length - 1; i++) {
    const start = editPoints[i];
    const end = editPoints[i + 1];
    const clipIdx = shuffledIndices[currentIdxInShuffle];
    segments.push({
      videoIdx: clipIdx,
      startTime: start,
      endTime: end
    });
    currentIdxInShuffle = (currentIdxInShuffle + 1) % shuffledIndices.length;
  }

  // 5. "Render" (simulate) the master output edit
  simulateMasterEdit(segments, videoClips, audioUrl, audioDuration);

  // 6. UI feedback
  randomDiceEditBtn.disabled = true;
  randomDiceEditBtn.innerText = 'Rendering... 🎬';
  setTimeout(() => {
    randomDiceEditBtn.disabled = false;
    randomDiceEditBtn.innerHTML = '<span class="dice-icon">🎲</span> Random Dice Edit the Entire Song';
  }, 2500);
});

// Simulate the master output edit by playing segments in sequence using MediaSource or fallback UI
function simulateMasterEdit(segments, videoClips, audioUrl, audioDuration) {
  // This is a UI simulation: for each segment, seek the video to the right time and play it, switching on the fly.
  // Real professional rendering would require ffmpeg/Canvas/MediaRecorder or server-side processing.

  // Set up the master output video
  const videoElements = {};
  for (const { idx, blob } of videoClips) {
    const el = document.createElement('video');
    el.src = URL.createObjectURL(blob);
    el.preload = 'auto';
    el.muted = true;
    el.playsInline = true;
    videoElements[idx] = el;
  }

  // Load audio for sync
  const outputAudio = new Audio(audioUrl);
  outputAudio.preload = 'auto';
  outputAudio.currentTime = 0;
  outputAudio.volume = 1;

  // Master output video element
  masterOutputVideo.srcObject = null;
  masterOutputVideo.src = '';
  masterOutputVideo.controls = true;
  masterOutputVideo.muted = false;

  // For UI: We use one video element, swap sources, and seek as needed
  let segIdx = 0;
  let isPlaying = false;

  async function playSegment(segmentIdx) {
    if (segmentIdx >= segments.length) {
      isPlaying = false;
      outputAudio.pause();
      return;
    }
    const seg = segments[segmentIdx];
    const videoEl = videoElements[seg.videoIdx];
    if (!videoEl) return;

    // Prepare video and audio
    videoEl.currentTime = seg.startTime;
    masterOutputVideo.src = videoEl.src;
    masterOutputVideo.currentTime = seg.startTime;
    masterOutputVideo.muted = true; // Only the audio track will play
    masterOutputVideo.play();

    // When segment starts, play audio from correct time
    outputAudio.currentTime = seg.startTime;
    if (outputAudio.paused) outputAudio.play();

    isPlaying = true;

    // Wait for segment duration or video end
    const segDuration = seg.endTime - seg.startTime;
    const playPromise = new Promise(resolve => {
      const onTimeUpdate = () => {
        if (masterOutputVideo.currentTime >= seg.endTime - 0.03 || masterOutputVideo.ended) {
          masterOutputVideo.removeEventListener('timeupdate', onTimeUpdate);
          resolve();
        }
      };
      masterOutputVideo.addEventListener('timeupdate', onTimeUpdate);
    });

    await playPromise;
    // Move to next segment
    playSegment(segmentIdx + 1);
  }

  // Start playback
  outputAudio.onended = () => {
    isPlaying = false;
  };
  playSegment(0);

  // For a more "pro" look, simulate effects: quick fade-in/out between segments (UI only)
  masterOutputVideo.style.transition = 'filter 0.3s';
  masterOutputVideo.style.filter = 'brightness(1)';

  masterOutputVideo.onplay = () => {
    masterOutputVideo.style.filter = 'brightness(1)';
  };
  masterOutputVideo.onpause = () => {
    masterOutputVideo.style.filter = 'brightness(0.7)';
  };

  // For more visual feedback, add a "fake" effect indication (UI only)
  masterOutputVideo.classList.add('master-fx');
}

// (Optional) Add CSS for master-fx class for simulated effects
const fxStyle = document.createElement('style');
fxStyle.innerHTML = `
.master-fx {
  box-shadow: 0 0 30px #1de9b6, 0 0 0 5px #3949ab55;
  transition: box-shadow 0.17s;
}
`;
document.head.appendChild(fxStyle);
