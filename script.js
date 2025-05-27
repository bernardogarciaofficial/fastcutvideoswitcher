const NUM_TRACKS = 10;

function createTrackHTML(trackNum) {
  return `
    <div class="track-block" id="track-block-${trackNum}">
      <div class="track-title">Track ${trackNum + 1}</div>

      <div class="controls">
        <input type="file" id="songInput-${trackNum}" accept="audio/*">
        <button id="uploadSongBtn-${trackNum}" disabled>Upload Song</button>
        <span id="uploadStatus-${trackNum}" class="uploadStatus"></span>
      </div>

      <audio id="audio-${trackNum}" controls style="display:none"></audio>

      <div class="controls">
        <button id="recordBtn-${trackNum}">Record Video</button>
        <button id="stopBtn-${trackNum}" disabled>Stop Recording</button>
        <span id="recIndicator-${trackNum}" class="rec-indicator">● REC</span>
      </div>

      <div id="countdown-${trackNum}" class="countdown"></div>

      <div class="controls track-controls-bottom">
        <button id="playStopSyncedBtn-${trackNum}" disabled>Play (Sync Audio + Video)</button>
      </div>

      <video id="video-${trackNum}" width="430" height="270" controls></video>
    </div>
  `;
}

function isMediaPlaying(audio, video) {
  return (!audio.paused && !audio.ended) ||
         (!video.paused && !video.ended && !video.seeking);
}

function updatePlayStopButtonText(audio, video, playStopBtn) {
  if (isMediaPlaying(audio, video)) {
    playStopBtn.textContent = "Stop";
  } else {
    playStopBtn.textContent = "Play (Sync Audio + Video)";
  }
}

function updatePlayButtonState(audio, video, playStopBtn) {
  playStopBtn.disabled = !(audio.src && video.src);
  updatePlayStopButtonText(audio, video, playStopBtn);
}

function doCountdown(countdownDiv, seconds = 3) {
  return new Promise(resolve => {
    countdownDiv.style.display = "block";
    let current = seconds;
    countdownDiv.textContent = current;
    const tick = () => {
      if (current > 1) {
        current -= 1;
        countdownDiv.textContent = current;
        setTimeout(tick, 1000);
      } else {
        countdownDiv.textContent = "GO!";
        setTimeout(() => {
          countdownDiv.style.display = "none";
          resolve();
        }, 700);
      }
    };
    setTimeout(tick, 1000);
  });
}

function startRecFlash(recIndicator) {
  recIndicator.classList.add('active');
}
function stopRecFlash(recIndicator) {
  recIndicator.classList.remove('active');
}

// --- MAIN SETUP ---
const tracksContainer = document.getElementById("tracksContainer");
tracksContainer.innerHTML = Array(NUM_TRACKS).fill(0).map((_, i) => createTrackHTML(i)).join("");

for (let trackNum = 0; trackNum < NUM_TRACKS; trackNum++) {
  let selectedSongFile = null;
  let mediaRecorder = null;
  let recordedChunks = [];

  // DOM refs
  const songInput = document.getElementById(`songInput-${trackNum}`);
  const uploadSongBtn = document.getElementById(`uploadSongBtn-${trackNum}`);
  const uploadStatus = document.getElementById(`uploadStatus-${trackNum}`);
  const audio = document.getElementById(`audio-${trackNum}`);

  const recordBtn = document.getElementById(`recordBtn-${trackNum}`);
  const stopBtn = document.getElementById(`stopBtn-${trackNum}`);
  const recIndicator = document.getElementById(`recIndicator-${trackNum}`);
  const countdown = document.getElementById(`countdown-${trackNum}`);

  const video = document.getElementById(`video-${trackNum}`);
  const playStopSyncedBtn = document.getElementById(`playStopSyncedBtn-${trackNum}`);

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
    updatePlayButtonState(audio, video, playStopSyncedBtn);
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
    recordBtn.disabled = true;
    stopBtn.disabled = true;
    await doCountdown(countdown, 3);

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
        stopRecFlash(recIndicator);
        // Optionally stop song when recording stops
        if (!audio.paused) {
          audio.pause();
          audio.currentTime = 0;
        }
        updatePlayButtonState(audio, video, playStopSyncedBtn);
      };

      mediaRecorder.start();
      startRecFlash(recIndicator);
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
      stopRecFlash(recIndicator);
    }
  };

  stopBtn.onclick = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    stopRecFlash(recIndicator);
    recordBtn.disabled = false;
    stopBtn.disabled = true;
  };

  // --- PLAY/STOP AUDIO & VIDEO IN SYNC (TOGGLE BUTTON) ---
  playStopSyncedBtn.onclick = () => {
    if (!audio.src || !video.src) return;
    if (isMediaPlaying(audio, video)) {
      // STOP both
      audio.pause();
      video.pause();
      audio.currentTime = 0;
      video.currentTime = 0;
      updatePlayStopButtonText(audio, video, playStopSyncedBtn);
    } else {
      // PLAY both from the beginning
      audio.currentTime = 0;
      video.currentTime = 0;
      audio.play();
      video.play();
      updatePlayStopButtonText(audio, video, playStopSyncedBtn);
    }
  };

  // --- Keep button text updated if user plays/pauses using media controls ---
  audio.addEventListener('play', () => updatePlayStopButtonText(audio, video, playStopSyncedBtn));
  audio.addEventListener('pause', () => updatePlayStopButtonText(audio, video, playStopSyncedBtn));
  audio.addEventListener('ended', () => updatePlayStopButtonText(audio, video, playStopSyncedBtn));

  video.addEventListener('play', () => updatePlayStopButtonText(audio, video, playStopSyncedBtn));
  video.addEventListener('pause', () => updatePlayStopButtonText(audio, video, playStopSyncedBtn));
  video.addEventListener('ended', () => updatePlayStopButtonText(audio, video, playStopSyncedBtn));
  video.addEventListener('seeking', () => updatePlayStopButtonText(audio, video, playStopSyncedBtn));
  video.addEventListener('seeked', () => updatePlayStopButtonText(audio, video, playStopSyncedBtn));
}
