const NUM_VIDEOS = 10;

const songInput = document.getElementById('songInput');
const waveform = document.getElementById('waveform');

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
