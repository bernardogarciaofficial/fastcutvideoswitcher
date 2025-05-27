let selectedSongFile = null;
const songInput = document.getElementById('songInput');
const uploadSongBtn = document.getElementById('uploadSongBtn');
const uploadStatus = document.getElementById('uploadStatus');
const audio = document.getElementById('audio');

const recordBtn = document.getElementById('recordBtn');
const stopBtn = document.getElementById('stopBtn');
const recIndicator = document.getElementById('recIndicator');
const video = document.getElementById('video');
const playStopSyncedBtn = document.getElementById('playStopSyncedBtn');
const countdown = document.getElementById('countdown');

let mediaRecorder = null;
let recordedChunks = [];
let recFlashInterval = null;

// --- Enable/disable Play/Stop (Sync Audio + Video) button ---
function updatePlayButtonState() {
  playStopSyncedBtn.disabled = !(audio.src && video.src);
  updatePlayStopButtonText();
}

function updatePlayStopButtonText() {
  if (isMediaPlaying()) {
    playStopSyncedBtn.textContent = "Stop";
  } else {
    playStopSyncedBtn.textContent = "Play (Sync Audio + Video)";
  }
}

function isMediaPlaying() {
  return (!audio.paused && !audio.ended) || (!video.paused && !video.ended && !video.seeking);
}

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
  updatePlayButtonState();
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

// --- COUNTDOWN ANIMATION ---
function doCountdown(seconds = 3) {
  return new Promise(resolve => {
    countdown.style.display = "block";
    let current = seconds;
    countdown.textContent = current;
    const tick = () => {
      if (current > 1) {
        current -= 1;
        countdown.textContent = current;
        setTimeout(tick, 1000);
      } else {
        countdown.textContent = "GO!";
        setTimeout(() => {
          countdown.style.display = "none";
          resolve();
        }, 700);
      }
    };
    setTimeout(tick, 1000);
  });
}

// --- REC FLASHING ---
function startRecFlash() {
  recIndicator.classList.add('active');
}

function stopRecFlash() {
  recIndicator.classList.remove('active');
}

// --- VIDEO RECORDING ---
recordBtn.onclick = async () => {
  recordBtn.disabled = true;
  stopBtn.disabled = true;
  await doCountdown(3);

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
      stopRecFlash();
      // Optionally stop song when recording stops
      if (!audio.paused) {
        audio.pause();
        audio.currentTime = 0;
      }
      updatePlayButtonState();
    };

    mediaRecorder.start();
    startRecFlash();
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
    stopRecFlash();
  }
};

stopBtn.onclick = () => {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
  stopRecFlash();
  recordBtn.disabled = false;
  stopBtn.disabled = true;
};

// --- PLAY/STOP AUDIO & VIDEO IN SYNC (TOGGLE BUTTON) ---
playStopSyncedBtn.onclick = () => {
  if (!audio.src || !video.src) return;
  if (isMediaPlaying()) {
    // STOP both
    audio.pause();
    video.pause();
    audio.currentTime = 0;
    video.currentTime = 0;
    updatePlayStopButtonText();
  } else {
    // PLAY both from the beginning
    audio.currentTime = 0;
    video.currentTime = 0;
    audio.play();
    video.play();
    updatePlayStopButtonText();
  }
};

// --- Keep button text updated if user plays/pauses using media controls ---
audio.addEventListener('play', updatePlayStopButtonText);
audio.addEventListener('pause', updatePlayStopButtonText);
audio.addEventListener('ended', updatePlayStopButtonText);

video.addEventListener('play', updatePlayStopButtonText);
video.addEventListener('pause', updatePlayStopButtonText);
video.addEventListener('ended', updatePlayStopButtonText);
video.addEventListener('seeking', updatePlayStopButtonText);
video.addEventListener('seeked', updatePlayStopButtonText);
