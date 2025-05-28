// Example video sources for each track
const videoSources = [
  "track1.mp4",
  "track2.mp4",
  "track3.mp4",
  "track4.mp4",
  "track5.mp4"
];

// Timeline state (array of cuts)
let timeline = [];
let isRecording = false;
let currentTrack = 0;

const previewRef = document.getElementById("mainPreview");
const timelineDiv = document.getElementById("timeline");

// Initialize with first track and dummy timeline
window.onload = function() {
  switchTrack(1);
  renderTimeline();
};

// Perform a "rough cut" between tracks
function performRoughCut(currentVideo, nextTrackIndex) {
  if (!currentVideo) return;
  const currentTime = currentVideo.currentTime;
  currentVideo.pause();

  // Swap source and sync time
  currentVideo.src = videoSources[nextTrackIndex];
  currentVideo.currentTime = currentTime;
  currentVideo.load();
  currentVideo.play();

  // Add cut to timeline
  timeline.push({
    track: nextTrackIndex + 1,
    time: currentTime.toFixed(2)
  });
  renderTimeline();
}

// Called when a track button is pressed
function switchTrack(trackNumber) {
  if (trackNumber < 1 || trackNumber > videoSources.length) return;
  const nextTrackIndex = trackNumber - 1;
  if (currentTrack !== nextTrackIndex) {
    performRoughCut(previewRef, nextTrackIndex);
    currentTrack = nextTrackIndex;
  }
}

// Simulate recording state (toggle with R key)
document.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "r") {
    isRecording = !isRecording;
    renderTimeline();
  }
});

// Render timeline segments
function renderTimeline() {
  timelineDiv.innerHTML = '';
  if (!isRecording) return;

  for (let i = 0; i < timeline.length; i++) {
    const segment = timeline[i];
    const segDiv = document.createElement("div");
    segDiv.className = "timeline-segment";
    segDiv.textContent = `Track ${segment.track} @${segment.time}s`;
    timelineDiv.appendChild(segDiv);
  }
}
