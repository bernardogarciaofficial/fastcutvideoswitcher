// Minimal, bulletproof sync/switching logic for FastCut Studios

const NUM_TRACKS = 6;
const audio = document.getElementById('audio');
const masterOutputVideo = document.getElementById('masterOutputVideo');
const hiddenVideos = document.getElementById('hiddenVideos');

const videoTracks = Array(NUM_TRACKS).fill(null); // {url: ...}
const tempVideos = Array(NUM_TRACKS).fill(null);  // <video>
let activeTrackIndex = 0; // Which camera is selected
let isRecording = false;
let isPlaying = false;
let animationFrameId = null;

// --- Prepare hidden video for a camera slot ---
function prepareTempVideo(idx, url) {
  if (tempVideos[idx]) {
    tempVideos[idx].pause();
    tempVideos[idx].remove();
  }
  const v = document.createElement('video');
  v.src = url;
  v.crossOrigin = "anonymous";
  v.muted = true;
  v.preload = "auto";
  v.playsInline = true;
  v.style.display = "none";
  v.load();
  hiddenVideos.appendChild(v);
  tempVideos[idx] = v;
}

// --- Core sync logic for all hidden videos ---
function synchronizeVideosToAudio() {
  const syncTime = audio.currentTime;
  tempVideos.forEach((v, i) => {
    if (v) {
      v.pause();
      // Don't seek past the video end
      v.currentTime = Math.min(syncTime, v.duration ? v.duration - 0.02 : syncTime);
    }
  });
  // Play only the active video
  const vid = tempVideos[activeTrackIndex];
  if (vid) {
    vid.currentTime = syncTime;
    vid.play().catch(()=>{});
  }
}

// --- Switch active camera ---
function setActiveTrack(idx) {
  activeTrackIndex = idx;
  if (isRecording || isPlaying) {
    synchronizeVideosToAudio();
  } else {
    // No auto-preview! Only update the main output if user explicitly requests preview.
    masterOutputVideo.srcObject = null;
    masterOutputVideo.src = videoTracks[idx] ? videoTracks[idx].url : "";
    masterOutputVideo.currentTime = 0;
    masterOutputVideo.pause(); // Don't auto-play!
  }
}

// --- Animation loop for live recording/preview ---
function drawFrame(canvas, ctx) {
  if (!isRecording) return;
  const vid = tempVideos[activeTrackIndex];
  if (!(vid && vid.readyState >= 2 && !vid.ended)) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    // Sync every frame for driftless output
    if (Math.abs(vid.currentTime - audio.currentTime) > 0.01) {
      vid.currentTime = audio.currentTime;
    }
    ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
  }
  animationFrameId = requestAnimationFrame(() => drawFrame(canvas, ctx));
}

// --- Always re-sync after seeking audio ---
audio.addEventListener('seeked', synchronizeVideosToAudio);

// --- Usage ---
// When a user uploads/records a video: call prepareTempVideo(idx, url) and store {url} in videoTracks[idx]
// When switching cameras: call setActiveTrack(idx)
// When you start live preview/recording: call synchronizeVideosToAudio(), then start drawFrame(canvas, ctx)
// Don't auto-play videos on upload or switch! Only play on explicit user preview.
