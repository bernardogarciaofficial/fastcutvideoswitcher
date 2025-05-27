const NUM_TRACKS = 10;
const TRACK_WIDTH = 600, TRACK_HEIGHT = 340;

// Song/audio logic
const songInput = document.getElementById('songInput');
const audio = document.getElementById('audio');
const audioStatus = document.getElementById('audioStatus');
let masterAudioFile = null;
songInput.onchange = e => {
  const file = e.target.files[0];
  masterAudioFile = file;
  if (file) {
    audio.src = URL.createObjectURL(file);
    audio.style.display = 'block';
    audio.load();
    audioStatus.textContent = "Audio loaded!";
  } else {
    audio.style.display = 'none';
    audioStatus.textContent = "";
  }
};

// Video tracks
function createTrackHTML(trackNum) {
  return `
    <div class="track-block" id="track-block-${trackNum}">
      <div class="track-title">Video Track ${trackNum + 1}</div>
      <input type="file" id="fileInput-${trackNum}" accept="video/*">
      <video id="video-${trackNum}" width="${TRACK_WIDTH}" height="${TRACK_HEIGHT}" controls style="margin-top:12px;"></video>
    </div>
  `;
}
const tracksContainer = document.getElementById("tracksContainer");
tracksContainer.innerHTML = Array(NUM_TRACKS).fill(0).map((_, i) => createTrackHTML(i)).join("");

for (let i = 0; i < NUM_TRACKS; i++) {
  const fileInput = document.getElementById(`fileInput-${i}`);
  const video = document.getElementById(`video-${i}`);
  fileInput.onchange = e => {
    const file = e.target.files[0];
    if (file) {
      video.src = URL.createObjectURL(file);
      video.load();
    }
  };
}

// Switcher
const switcherDiv = document.getElementById('trackSwitcher');
switcherDiv.innerHTML = Array(NUM_TRACKS).fill(0).map((_, i) =>
  `<button id="switchBtn-${i}" onclick="scrollToTrack(${i})">Track ${i+1}</button>`
).join('');
window.scrollToTrack = function(trackNum) {
  document.querySelectorAll('.track-block').forEach(el => el.classList.remove('switcher-active'));
  document.querySelectorAll('.track-switcher button').forEach(el => el.classList.remove('active'));
  const block = document.getElementById('track-block-' + trackNum);
  const btn = document.getElementById('switchBtn-' + trackNum);
  if (block) {
    block.classList.add('switcher-active');
    block.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  if (btn) btn.classList.add('active');
};
window.addEventListener('DOMContentLoaded', () => scrollToTrack(0));

// Dice edit: Browser-based fast-cut mixing!
const diceEditBtn = document.getElementById('diceEditBtn');
const diceEditStatus = document.getElementById('diceEditStatus');
const masterOutputVideo = document.getElementById('masterOutputVideo');
const exportBtn = document.getElementById('exportBtn');
const exportStatus = document.getElementById('exportStatus');
const mixCanvas = document.getElementById('mixCanvas');

diceEditBtn.onclick = async function() {
  diceEditStatus.textContent = "";
  exportStatus.textContent = "";
  // Gather all loaded video tracks
  const videos = [];
  for (let i = 0; i < NUM_TRACKS; i++) {
    const v = document.getElementById(`video-${i}`);
    if (v && v.src && v.readyState >= 2) videos.push(v);
  }
  if (!masterAudioFile) {
    diceEditStatus.textContent = "Load your audio track first!";
    return;
  }
  if (videos.length < 2) {
    diceEditStatus.textContent = "Upload at least 2 videos for mixing!";
    return;
  }
  diceEditStatus.textContent = "Mixing... this will take a few seconds.";

  // Get master audio duration
  const audioBlobURL = URL.createObjectURL(masterAudioFile);
  const tempAudio = new Audio(audioBlobURL);
  await new Promise(r => { tempAudio.onloadedmetadata = r; });
  const duration = tempAudio.duration;
  URL.revokeObjectURL(audioBlobURL);

  // Prepare for mixing
  const ctx = mixCanvas.getContext('2d');
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, mixCanvas.width, mixCanvas.height);

  // Prepare MediaRecorder to record from the canvas
  const stream = mixCanvas.captureStream(30);
  let recordedChunks = [];
  const mediaRecorder = new MediaRecorder(stream, { mimeType: "video/webm" });
  mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };

  // Load audio into an <audio> element (for MediaRecorder)
  let audioTrack;
  try {
    const audioCtx = new AudioContext();
    const source = audioCtx.createBufferSource();
    const audioFileBuffer = await masterAudioFile.arrayBuffer();
    const decoded = await audioCtx.decodeAudioData(audioFileBuffer);
    source.buffer = decoded;
    const dest = audioCtx.createMediaStreamDestination();
    source.connect(dest);
    audioTrack = dest.stream.getAudioTracks()[0];
    stream.addTrack(audioTrack);
    source.start();
  } catch (e) {
    diceEditStatus.textContent = "Cannot mix audio - browser does not support advanced audio mixing.";
    return;
  }

  // Mixing: for every 0.5 second, randomly pick a video, draw its current frame to canvas
  const cutLen = 0.5; // seconds per cut
  let t = 0;
  mediaRecorder.start();
  function drawFrame() {
    if (t >= duration) {
      mediaRecorder.stop();
      return;
    }
    const vid = videos[Math.floor(Math.random() * videos.length)];
    // Seek video to the right time
    vid.currentTime = Math.min(t, vid.duration - 0.05);
    vid.onseeked = () => {
      ctx.drawImage(vid, 0, 0, TRACK_WIDTH, TRACK_HEIGHT);
      t += cutLen;
      setTimeout(drawFrame, cutLen * 1000);
    };
  }
  drawFrame();

  // When finished, show video
  mediaRecorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: "video/webm" });
    masterOutputVideo.src = URL.createObjectURL(blob);
    masterOutputVideo.load();
    diceEditStatus.textContent = "DiceCut magic done! Preview below.";
    exportBtn.disabled = false;
  };
  exportBtn.disabled = true;
};

exportBtn.onclick = () => {
  if (!masterOutputVideo.src) {
    exportStatus.textContent = "No master video to export!";
    return;
  }
  const a = document.createElement('a');
  a.href = masterOutputVideo.src;
  a.download = 'dicecut_music_video.webm';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  exportStatus.textContent = "Download started!";
};
