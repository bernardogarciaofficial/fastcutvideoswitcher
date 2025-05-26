const video = document.getElementById('video');
const recordBtn = document.getElementById('recordBtn');
const stopBtn = document.getElementById('stopBtn');
const playBtn = document.getElementById('playBtn');
const recIndicator = document.getElementById('recIndicator');
const countdown = document.getElementById('countdown');
const songInput = document.getElementById('songInput');
const waveform = document.getElementById('waveform');

let audio = null;
let audioUrl = null;
let audioBuffer = null;
let audioContext = null;
let isSongLoaded = false;
let isRecording = false;
let isPlaying = false;

let mediaStream = null;
let mediaRecorder = null;
let recordedChunks = [];
let recordedVideoBlob = null;

function enableControls() {
  recordBtn.disabled = !isSongLoaded;
  playBtn.disabled = !recordedVideoBlob;
  stopBtn.disabled = true;
}

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
  enableControls();
});

// Handles play/pause/stop of audio as "slave" to video
function syncAudioToVideo() {
  if (!audio) return;
  // If video is playing, play audio
  if (!video.paused) {
    if (audio.paused) {
      audio.currentTime = video.currentTime;
      audio.play();
    }
  } else {
    if (!audio.paused) audio.pause();
  }
}

// Play video and audio in sync (audio as slave)
playBtn.addEventListener('click', () => {
  if (!recordedVideoBlob || !audio) return;
  video.srcObject = null;
  video.src = URL.createObjectURL(recordedVideoBlob);
  video.muted = false;
  video.currentTime = 0;
  audio.currentTime = 0;
  video.controls = true;
  isPlaying = true;
  video.play();
  audio.play();

  stopBtn.disabled = false;
  playBtn.disabled = true;
  recordBtn.disabled = false;

  // Keep audio synced to video
  const sync = () => {
    if (!isPlaying) return;
    if (Math.abs(video.currentTime - audio.currentTime) > 0.07) {
      audio.currentTime = video.currentTime;
    }
    if (!video.paused && audio.paused) audio.play();
    if (video.paused && !audio.paused) audio.pause();
    if (!video.ended) requestAnimationFrame(sync);
  };
  sync();

  // When either ends, stop both
  video.onended = () => {
    isPlaying = false;
    audio.pause();
    stopBtn.disabled = true;
    playBtn.disabled = false;
  };
  audio.onended = () => {
    isPlaying = false;
    video.pause();
    stopBtn.disabled = true;
    playBtn.disabled = false;
  };
});

// When video is manually paused/stopped, also stop audio
video.addEventListener('pause', () => {
  if (isPlaying && audio && !audio.paused) audio.pause();
});
video.addEventListener('play', () => {
  if (isPlaying && audio && audio.paused) audio.play();
});

// Stop both video and audio
stopBtn.addEventListener('click', () => {
  if (isRecording && mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop(); // onstop will handle UI
    return;
  }
  isPlaying = false;
  if (video && !video.paused) {
    video.pause();
    video.currentTime = 0;
  }
  if (audio && !audio.paused) {
    audio.pause();
    audio.currentTime = 0;
  }
  stopBtn.disabled = true;
  playBtn.disabled = false;
  recordBtn.disabled = false;
});

// Countdown utility
function showCountdown(seconds = 3) {
  return new Promise(resolve => {
    countdown.classList.remove('hidden');
    let current = seconds;
    countdown.textContent = current;
    const tick = () => {
      current--;
      if (current > 0) {
        countdown.textContent = current;
        setTimeout(tick, 1000);
      } else {
        countdown.textContent = "GO!";
        setTimeout(() => {
          countdown.classList.add('hidden');
          resolve();
        }, 700);
      }
    };
    setTimeout(tick, 1000);
  });
}

// Start Recording with countdown and REC indicator
recordBtn.addEventListener('click', async () => {
  if (isRecording || !isSongLoaded) return;

  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("getUserMedia not supported in this browser.");
      return;
    }
    // Start 3-2-1 countdown overlay on video
    await showCountdown(3);

    mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    video.srcObject = mediaStream;
    video.muted = true;
    await video.play();
    recIndicator.classList.remove('hidden');
    isRecording = true;
    recordedChunks = [];
    recordedVideoBlob = null;

    playBtn.disabled = true;
    stopBtn.disabled = false;
    recordBtn.disabled = true;

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
      mediaRecorder = new MediaRecorder(mediaStream, options);
    } catch (err) {
      alert("MediaRecorder API is not supported with the selected codec in this browser.");
      recIndicator.classList.add('hidden');
      playBtn.disabled = false;
      stopBtn.disabled = true;
      recordBtn.disabled = false;
      isRecording = false;
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
      }
      return;
    }

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordedChunks.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      recIndicator.classList.add('hidden');
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
      }
      recordedVideoBlob = new Blob(recordedChunks, { type: 'video/webm' });
      video.srcObject = null;
      video.src = URL.createObjectURL(recordedVideoBlob);
      video.muted = false;
      video.controls = true;
      playBtn.disabled = false;
      stopBtn.disabled = true;
      recordBtn.disabled = false;
      isRecording = false;
      // Stop audio
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    };

    mediaRecorder.start();
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

// When page loads, set up visuals
window.addEventListener('DOMContentLoaded', () => {
  enableControls();
  // Resize waveform on window resize
  window.addEventListener('resize', () => {
    if (audioBuffer) drawWaveform(audioBuffer);
  });
});
