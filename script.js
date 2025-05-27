let selectedSongFile = null;
const songInput = document.getElementById('songInput');
const uploadSongBtn = document.getElementById('uploadSongBtn');
const uploadStatus = document.getElementById('uploadStatus');
const audio = document.getElementById('audio');

const recordBtn = document.getElementById('recordBtn');
const stopBtn = document.getElementById('stopBtn');
const recIndicator = document.getElementById('recIndicator');
const video = document.getElementById('video');

let mediaRecorder = null;
let recordedChunks = [];

// --- SONG FILE SELECTION & PREVIEW ---
songInput.onchange = function(e) {
  const file = e.target.files[0];
  selectedSongFile = file;
  if (file) {
    audio.src = URL.createObjectURL(file);
    audio.style.display = 'block';
    audio.load();
    uploadSongBtn.disabled = false;
  } else {
    audio.style.display = 'none';
    uploadSongBtn.disabled = true;
  }
};

// --- SONG UPLOAD ---
uploadSongBtn.onclick = async function() {
  if (!selectedSongFile) return;
  const formData = new FormData();
  formData.append('song', selectedSongFile);
  uploadStatus.textContent = "Uploading...";
  try {
    // CHANGE THIS URL to your real backend endpoint if needed!
    const response = await fetch('https://webhook.site/YOUR_UNIQUE_URL', {
      method: 'POST',
      body: formData
    });
    if (response.ok) {
      uploadStatus.textContent = "Song uploaded successfully!";
    } else {
      uploadStatus.textContent = "Song upload failed.";
    }
  } catch (err) {
    uploadStatus.textContent = "Error uploading song: " + err.message;
  }
};

// --- VIDEO RECORDING ---
recordBtn.onclick = async () => {
  recordedChunks = [];
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    video.srcObject = stream;
    video.muted = true;
    video.controls = false;
    video.play();

    mediaRecorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    mediaRecorder.ondataavailable = e => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };
    mediaRecorder.onstop = () => {
      // Stop camera
      if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
        video.srcObject = null;
      }
      // Show recorded video
      const blob = new Blob(recordedChunks, { type: "video/webm" });
      video.src = URL.createObjectURL(blob);
      video.controls = true;
      video.muted = false;
      video.play();
      // UI reset
      recordBtn.disabled = false;
      stopBtn.disabled = true;
      recIndicator.classList.remove('active');
      // Optionally stop song when recording stops
      if (!audio.paused) {
        audio.pause();
        audio.currentTime = 0;
      }
    };

    mediaRecorder.start();
    recIndicator.classList.add('active');
    recordBtn.disabled = true;
    stopBtn.disabled = false;

    // Play song in sync with recording
    if (audio.src) {
      audio.currentTime = 0;
      audio.play();
    }
  } catch (err) {
    alert("Webcam access denied or error: " + err.message);
    recordBtn.disabled = false;
    stopBtn.disabled = true;
    recIndicator.classList.remove('active');
  }
};

stopBtn.onclick = () => {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
  recIndicator.classList.remove('active');
  recordBtn.disabled = false;
  stopBtn.disabled = true;
};
