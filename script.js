let audio;
let audioUrl;
let audioContext;
let audioBuffer;
let isSongLoaded = false;

const songInput = document.getElementById('songInput');
const waveform = document.getElementById('waveform');

songInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith("audio/")) {
    alert("Please upload an audio file.");
    return;
  }
  if (audio) {
    audio.pause();
    URL.revokeObjectURL(audio.src);
  }
  audioUrl = URL.createObjectURL(file);
  audio = new Audio(audioUrl);
  audio.preload = "auto";
  if (!audioContext)
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === "suspended")
    await audioContext.resume();
  const arrayBuffer = await file.arrayBuffer();
  try {
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  } catch (e) {
    alert("Could not decode audio.");
    isSongLoaded = false;
    return;
  }
  drawWaveform(audioBuffer);
  isSongLoaded = true;
  enableRecordButtons();
});

function drawWaveform(buffer) {
  const canvas = waveform;
  const ctx = canvas.getContext('2d');
  const width = canvas.width = canvas.parentElement.offsetWidth || 800;
  const height = canvas.height = 80;
  ctx.clearRect(0, 0, width, height);
  if (!buffer || !buffer.getChannelData) return;
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

window.addEventListener('resize', () => {
  if (audioBuffer) drawWaveform(audioBuffer);
});

const videoStates = [];
for (let i = 0; i < 10; i++) {
  const recordBtn = document.getElementById('recordBtn' + i);
  const stopBtn = document.getElementById('stopBtn' + i);
  const playBtn = document.getElementById('playBtn' + i);
  const recIndicator = document.getElementById('recIndicator' + i);
  const video = document.getElementById('video' + i);
  const countdown = document.getElementById('countdown' + i);

  videoStates[i] = {
    recordBtn,
    stopBtn,
    playBtn,
    recIndicator,
    video,
    countdown,
    mediaRecorder: null,
    recordedChunks: [],
    isRecording: false,
    recFlashInterval: null
  };

  recordBtn.disabled = true;
  stopBtn.disabled = true;
  playBtn.disabled = true;

  recordBtn.addEventListener('click', () => onRecordButtonClicked(i));
  stopBtn.addEventListener('click', () => onStopButtonClicked(i));
  playBtn.addEventListener('click', () => onPlayButtonClicked(i));
}

function enableRecordButtons() {
  videoStates.forEach((vs) => {
    if (vs && vs.recordBtn) vs.recordBtn.disabled = false;
  });
}

// ---- COUNTDOWN and SYNC LOGIC ----
async function onRecordButtonClicked(trackNumber) {
  const vs = videoStates[trackNumber];
  if (!isSongLoaded) {
    alert("Upload a song before recording.");
    return;
  }
  vs.recordBtn.disabled = true;
  vs.stopBtn.disabled = true;
  vs.playBtn.disabled = true;
  vs.recIndicator.classList.add('hidden');
  vs.countdown.classList.remove('hidden');
  vs.countdown.style.display = "block";
  let count = 3;
  vs.countdown.textContent = count;

  const doCount = () => {
    count--;
    if (count > 0) {
      vs.countdown.textContent = count;
      setTimeout(doCount, 700);
    } else {
      vs.countdown.textContent = "";
      vs.countdown.classList.add('hidden');
      vs.countdown.style.display = "none";
      startRecording(trackNumber);
    }
  };
  setTimeout(doCount, 700);
}

async function startRecording(trackNumber) {
  const vs = videoStates[trackNumber];
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    vs.video.srcObject = stream;
    vs.mediaRecorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    vs.recordedChunks = [];

    vs.mediaRecorder.ondataavailable = e => {
      if (e.data.size > 0) {
        vs.recordedChunks.push(e.data);
      }
    };
    vs.mediaRecorder.onstop = () => {
      vs.video.srcObject.getTracks().forEach(track => track.stop());
      const blob = new Blob(vs.recordedChunks, { type: "video/webm" });
      vs.video.src = URL.createObjectURL(blob);
      vs.video.controls = true;
      vs.video.muted = false;
      vs.recordBtn.disabled = false;
      vs.stopBtn.disabled = true;
      vs.playBtn.disabled = false;
      stopRecFlash(vs);
      vs.recIndicator.classList.add('hidden');
      if (audio && !audio.paused) {
        audio.pause();
        audio.currentTime = 0;
      }
    };

    vs.mediaRecorder.start();
    vs.isRecording = true;
    vs.recordBtn.disabled = true;
    vs.stopBtn.disabled = false;
    vs.playBtn.disabled = true;
    vs.recIndicator.classList.remove('hidden');
    vs.video.controls = false;
    vs.video.muted = true;
    startRecFlash(vs);

    // SYNC: Play music at the same time as video recording
    if (audio) {
      audio.currentTime = 0;
      audio.play();
    }
  } catch (err) {
    alert("Webcam access denied or error: " + err.message);
    vs.recordBtn.disabled = false;
    vs.stopBtn.disabled = true;
    vs.playBtn.disabled = true;
    stopRecFlash(vs);
    vs.recIndicator.classList.add('hidden');
  }
}

function onStopButtonClicked(trackNumber) {
  const vs = videoStates[trackNumber];
  if (vs && vs.isRecording && vs.mediaRecorder) {
    vs.mediaRecorder.stop();
    vs.isRecording = false;
    stopRecFlash(vs);
    vs.recIndicator.classList.add('hidden');
    vs.recordBtn.disabled = false;
    vs.stopBtn.disabled = true;
    vs.playBtn.disabled = false;
    if (audio && !audio.paused) {
      audio.pause();
      audio.currentTime = 0;
    }
  }
}

function onPlayButtonClicked(trackNumber) {
  const vs = videoStates[trackNumber];
  if (vs && vs.video.src) {
    vs.video.play();
    // Optional: play audio with video (not tightly synced)
    // if (audio) { audio.currentTime = 0; audio.play(); }
  }
}

// --- Flashing REC indicator ---
function startRecFlash(vs) {
  if (vs.recFlashInterval) clearInterval(vs.recFlashInterval);
  let visible = true;
  vs.recIndicator.classList.remove('hidden');
  vs.recIndicator.style.opacity = "1";
  vs.recFlashInterval = setInterval(() => {
    visible = !visible;
    vs.recIndicator.style.opacity = visible ? "1" : "0.2";
  }, 400);
}
function stopRecFlash(vs) {
  if (vs.recFlashInterval) clearInterval(vs.recFlashInterval);
  vs.recIndicator.style.opacity = "1";
}
