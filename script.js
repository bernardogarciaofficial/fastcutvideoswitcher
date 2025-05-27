const NUM_TRACKS = 10;

// Main (slave) audio track DOM
const songInput = document.getElementById('songInput');
const uploadSongBtn = document.getElementById('uploadSongBtn');
const uploadStatus = document.getElementById('uploadStatus');
const audio = document.getElementById('audio');

let selectedSongFile = null;

// --- Main audio file selection & preview ---
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
  enableAllTrackPlayButtons();
};

// --- Main audio upload ---
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

// --- Helper: Enable play/stop buttons across all tracks when audio is loaded ---
function enableAllTrackPlayButtons() {
  const enabled = !!audio.src;
  for (let trackNum = 0; trackNum < NUM_TRACKS; trackNum++) {
    const playStopBtn = document.getElementById(`playStopSyncedBtn-${trackNum}`);
    playStopBtn.disabled = !enabled || !document.getElementById(`video-${trackNum}`).src;
  }
}


// --- Video Tracks ---
function createTrackHTML(trackNum) {
  return `
    <div class="track-block" id="track-block-${trackNum}">
      <div class="track-title">Video Track ${trackNum + 1}</div>

      <div class="controls">
        <button id="recordBtn-${trackNum}">Record Video</button>
        <button id="stopBtn-${trackNum}" disabled>Stop Recording</button>
        <span id="recIndicator-${trackNum}" class="rec-indicator">● REC</span>
      </div>

      <div id="countdown-${trackNum}" class="countdown"></div>

      <div class="controls track-controls-bottom">
        <button id="playStopSyncedBtn-${trackNum}" disabled>Play (Sync Audio + Video)</button>
      </div>

      <video id="video-${trackNum}" width="560" height="340" controls></video>
    </div>
  `;
}

const tracksContainer = document.getElementById("tracksContainer");
tracksContainer.innerHTML = Array(NUM_TRACKS).fill(0).map((_, i) => createTrackHTML(i)).join("");

// --- Per-Track Logic ---
for (let trackNum = 0; trackNum < NUM_TRACKS; trackNum++) {
  let mediaRecorder = null;
  let recordedChunks = [];

  // DOM refs
  const recordBtn = document.getElementById(`recordBtn-${trackNum}`);
  const stopBtn = document.getElementById(`stopBtn-${trackNum}`);
  const recIndicator = document.getElementById(`recIndicator-${trackNum}`);
  const countdown = document.getElementById(`countdown-${trackNum}`);
  const video = document.getElementById(`video-${trackNum}`);
  const playStopSyncedBtn = document.getElementById(`playStopSyncedBtn-${trackNum}`);

  // --- Helper ---
  function updatePlayStopButtonState() {
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
        updatePlayStopButtonState();
      };

      mediaRecorder.start();
      startRecFlash();
      recordBtn.disabled = true;
      stopBtn.disabled = false;

      // Play main song in sync with recording
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

  // When video src changes, update play/stop button state
  video.addEventListener('loadeddata', () => {
    updatePlayStopButtonState();
  });
}

// When main audio changes, enable/disable all play/stop buttons
audio.addEventListener('loadeddata', enableAllTrackPlayButtons);

// --- Switcher logic ---
const switcherDiv = document.getElementById('trackSwitcher');
switcherDiv.innerHTML = Array(NUM_TRACKS).fill(0).map((_, i) =>
  `<button id="switchBtn-${i}" onclick="scrollToTrack(${i})">Track ${i+1}</button>`
).join('');

// Add the function to window for inline onclick
window.scrollToTrack = function(trackNum) {
  // Remove previous highlight
  document.querySelectorAll('.track-block').forEach(el => el.classList.remove('switcher-active'));
  document.querySelectorAll('.track-switcher button').forEach(el => el.classList.remove('active'));

  // Highlight selected
  const block = document.getElementById('track-block-' + trackNum);
  const btn = document.getElementById('switchBtn-' + trackNum);
  if (block) {
    block.classList.add('switcher-active');
    block.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  if (btn) btn.classList.add('active');
};

// Optionally, auto-highlight first track at start
window.addEventListener('DOMContentLoaded', () => {
  scrollToTrack(0);
});

// --- Master Output Video & Export Button ---
// This is a placeholder implementation. Mixing/exporting is non-trivial in-browser and may require ffmpeg.wasm or MediaRecorder API with canvas compositing for real mixing.

const masterOutputVideo = document.getElementById('masterOutputVideo');
const exportBtn = document.getElementById('exportBtn');
const exportStatus = document.getElementById('exportStatus');

// DEMO: For now, masterOutputVideo will show the first available video uploaded/recorded.
// For a real mixer, you'd combine videos and audio in a canvas and export.
function updateMasterOutputVideo() {
  for (let trackNum = 0; trackNum < NUM_TRACKS; trackNum++) {
    const video = document.getElementById(`video-${trackNum}`);
    if (video && video.src) {
      masterOutputVideo.src = video.src;
      masterOutputVideo.load();
      break;
    }
  }
}
for (let trackNum = 0; trackNum < NUM_TRACKS; trackNum++) {
  const video = document.getElementById(`video-${trackNum}`);
  video.addEventListener('loadeddata', updateMasterOutputVideo);
}

exportBtn.onclick = async function() {
  exportStatus.textContent = "Exporting... (demo only)";
  // In a real app: Mix selected video & audio into a single file.
  // Here, just download the currently displayed masterOutputVideo as a demo.
  if (!masterOutputVideo.src) {
    exportStatus.textContent = "No master video to export!";
    return;
  }
  try {
    const a = document.createElement('a');
    a.href = masterOutputVideo.src;
    a.download = 'exported_music_video.webm';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    exportStatus.textContent = "Download started (video only, demo).";
  } catch (err) {
    exportStatus.textContent = "Export failed: " + err.message;
  }
};
