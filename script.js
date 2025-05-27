// --- GLOBAL STATE VARIABLES ---
let audio;
let audioUrl;
let audioContext;
let audioBuffer;
let isSongLoaded = false;

const songInput = document.getElementById('songInput');
const waveform = document.getElementById('waveform');

// --- Song Upload and Waveform Visualization ---
songInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) {
    alert("No file selected.");
    return;
  }
  if (!file.type.startsWith("audio/")) {
    alert("Unsupported file type. Please upload an audio file.");
    return;
  }
  try {
    if (audio) {
      audio.pause();
      URL.revokeObjectURL(audio.src);
    }
    audioUrl = URL.createObjectURL(file);
    audio = new Audio(audioUrl);
    audio.preload = "auto";

    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }
    const arrayBuffer = await file.arrayBuffer();

    try {
      audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    } catch (decodeErr) {
      alert("Could not decode audio file. Please try another audio file.");
      console.error("decodeAudioData error:", decodeErr);
      isSongLoaded = false;
      return;
    }

    drawWaveform(audioBuffer);
    isSongLoaded = true;
    enableRecordButtons();
    alert("Song uploaded successfully!");
  } catch (err) {
    isSongLoaded = false;
    alert("Error loading audio file: " + (err.message || err));
    console.error(err);
  }
});

// --- Draw waveform for uploaded audio ---
function drawWaveform(buffer) {
  const canvas = waveform;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const width = canvas.width = canvas.parentElement.offsetWidth || 800;
  const height = canvas.height = 80;
  ctx.clearRect(0, 0, width, height);

  if (!buffer || !buffer.getChannelData) {
    ctx.fillStyle = "#f33";
    ctx.font = "24px sans-serif";
    ctx.fillText("No waveform data.", 30, 50);
    return;
  }

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

// --- Responsive redraw of waveform when resizing window ---
window.addEventListener('resize', () => {
  if (audioBuffer) drawWaveform(audioBuffer);
});

// --- VIDEO STATE SETUP FOR 10 TRACKS ---
const videoStates = [];
for (let i = 0; i < 10; i++) {
  const recordBtn = document.getElementById('recordBtn' + i);
  const stopBtn = document.getElementById('stopBtn' + i);
  const playBtn = document.getElementById('playBtn' + i);
  const recIndicator = document.getElementById('recIndicator' + i);
  const video = document.getElementById('video' + i);

  videoStates[i] = {
    recordBtn,
    stopBtn,
    playBtn,
    recIndicator,
    video,
    mediaRecorder: null,
    recordedChunks: [],
    isRecording: false
  };

  recordBtn.disabled = true;
  stopBtn.disabled = true;
  playBtn.disabled = true;

  // Event listeners for each button
  recordBtn.addEventListener('click', () => onRecordButtonClicked(i));
  stopBtn.addEventListener('click', () => onStopButtonClicked(i));
  playBtn.addEventListener('click', () => onPlayButtonClicked(i));
}

// --- Enable record buttons after song upload ---
function enableRecordButtons() {
  videoStates.forEach((vs, idx) => {
    if (vs && vs.recordBtn) {
      vs.recordBtn.disabled = false;
      console.log(`Enabled Record button ${idx}`);
    }
  });
}

// --- Record button logic ---
async function onRecordButtonClicked(trackNumber) {
  const vs = videoStates[trackNumber];
  if (!vs) return;
  // Request webcam
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
      // Stop webcam preview
      vs.video.srcObject.getTracks().forEach(track => track.stop());
      // Create video blob and show it
      const blob = new Blob(vs.recordedChunks, { type: "video/webm" });
      vs.video.src = URL.createObjectURL(blob);
      vs.video.controls = true;
      vs.video.muted = false;
      vs.recordBtn.disabled = false;
      vs.stopBtn.disabled = true;
      vs.playBtn.disabled = false;
      vs.recIndicator.classList.add('hidden');
    };

    vs.mediaRecorder.start();
    vs.isRecording = true;
    vs.recordBtn.disabled = true;
    vs.stopBtn.disabled = false;
    vs.playBtn.disabled = true;
    vs.recIndicator.classList.remove('hidden');
    vs.video.controls = false;
    vs.video.muted = true;
    console.log(`Recording started on track ${trackNumber}`);
  } catch (err) {
    alert("Webcam access denied or error: " + err.message);
    console.error(err);
  }
}

// --- Stop button logic ---
function onStopButtonClicked(trackNumber) {
  const vs = videoStates[trackNumber];
  if (vs && vs.isRecording && vs.mediaRecorder) {
    vs.mediaRecorder.stop();
    vs.isRecording = false;
    vs.recIndicator.classList.add('hidden');
    vs.recordBtn.disabled = false;
    vs.stopBtn.disabled = true;
    vs.playBtn.disabled = false;
    console.log(`Recording stopped on track ${trackNumber}`);
  }
}

// --- Play button logic ---
function onPlayButtonClicked(trackNumber) {
  const vs = videoStates[trackNumber];
  if (vs && vs.video.src) {
    vs.video.play();
  }
}
