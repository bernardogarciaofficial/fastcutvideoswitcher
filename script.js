// FASTCUT STUDIOS - Minimal Sync Edition

const NUM_TRACKS = 6;
const audio = document.getElementById('audio');
const masterOutputVideo = document.getElementById('masterOutputVideo');
const hiddenVideos = document.getElementById('hiddenVideos');
const switcherTracks = document.getElementById('switcherTracks');

const videoTracks = Array(NUM_TRACKS).fill(null); // {url, name, recordedBlob}
const tempVideos = Array(NUM_TRACKS).fill(null);  // <video>
let activeTrackIndex = 0;
let isRecording = false;
let animationFrameId = null;

// --- Set up UI for 6 plain thumbnail video screens with upload, record, download ---
for (let i = 0; i < NUM_TRACKS; i++) createTrackCard(i);

function createTrackCard(index) {
  const card = document.createElement('div');
  card.style.border = '1px solid #888';
  card.style.margin = '10px';
  card.style.padding = '6px';
  card.style.width = '160px';
  card.style.display = 'inline-block';
  card.style.verticalAlign = 'top';
  card.style.fontSize = '12px';

  // Title
  const title = document.createElement('div');
  title.textContent = `Camera ${index + 1}`;
  card.appendChild(title);

  // Upload
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'video/*';
  input.style.display = 'block';
  input.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    videoTracks[index] = { file, url, name: file.name };
    prepareTempVideo(index, url);
    preview.src = url;
    preview.load();
    dlBtn.style.display = '';
  });
  card.appendChild(input);

  // Record
  const recBtn = document.createElement('button');
  recBtn.textContent = 'Record';
  recBtn.style.display = 'inline-block';
  recBtn.style.marginTop = '4px';
  card.appendChild(recBtn);

  const stopRecBtn = document.createElement('button');
  stopRecBtn.textContent = 'Stop';
  stopRecBtn.style.display = 'none';
  stopRecBtn.style.marginLeft = '4px';
  card.appendChild(stopRecBtn);

  let trackRecorder = null;
  let recStream = null;
  let recChunks = [];

  recBtn.addEventListener('click', async function () {
    if (trackRecorder && trackRecorder.state === 'recording') return;
    recBtn.disabled = true;
    stopRecBtn.style.display = '';
    try {
      recStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch (err) {
      recBtn.disabled = false;
      stopRecBtn.style.display = 'none';
      return;
    }
    preview.srcObject = recStream;
    preview.muted = true;
    preview.autoplay = true;
    preview.play().catch(()=>{});
    trackRecorder = new MediaRecorder(recStream, { mimeType: 'video/webm; codecs=vp9,opus' });
    recChunks = [];
    trackRecorder.ondataavailable = function(e) {
      if (e.data.size > 0) recChunks.push(e.data);
    };
    trackRecorder.onstop = function() {
      const blob = new Blob(recChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      videoTracks[index] = { file: null, url, name: `Camera${index+1}-take.webm`, recordedBlob: blob };
      prepareTempVideo(index, url);
      preview.srcObject = null;
      preview.src = url;
      preview.load();
      dlBtn.style.display = '';
      recBtn.disabled = false;
      stopRecBtn.style.display = 'none';
      if (recStream) recStream.getTracks().forEach(track => track.stop());
    };
    trackRecorder.start();
  });

  stopRecBtn.addEventListener('click', function() {
    if (trackRecorder && trackRecorder.state === 'recording') {
      trackRecorder.stop();
      stopRecBtn.style.display = 'none';
    }
  });

  // Download button
  const dlBtn = document.createElement('button');
  dlBtn.textContent = 'Download';
  dlBtn.style.display = 'none';
  dlBtn.style.marginTop = '4px';
  dlBtn.addEventListener('click', function() {
    if (videoTracks[index] && videoTracks[index].url) {
      const a = document.createElement('a');
      a.href = videoTracks[index].url;
      a.download = videoTracks[index].name || `track${index+1}.webm`;
      a.click();
    }
  });
  card.appendChild(dlBtn);

  // Plain video preview (thumbnail)
  const preview = document.createElement('video');
  preview.controls = true;
  preview.style.width = '100%';
  preview.style.marginTop = '4px';
  preview.style.background = "#000";
  preview.muted = true;
  preview.playsInline = true;
  card.appendChild(preview);

  // Click to select for switching
  card.addEventListener('click', function () {
    setActiveTrack(index);
    Array.from(switcherTracks.children).forEach((c, i) =>
      c.style.background = i === index ? "#eee" : "");
  });

  switcherTracks.appendChild(card);
}

// --- Hidden, preloaded video for sync ---
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

// --- Core sync logic ---
function synchronizeVideosToAudio() {
  const syncTime = audio.currentTime;
  tempVideos.forEach((v, i) => {
    if (v) {
      v.pause();
      v.currentTime = Math.min(syncTime, v.duration ? v.duration - 0.02 : syncTime);
    }
  });
  const vid = tempVideos[activeTrackIndex];
  if (vid) {
    vid.currentTime = syncTime;
    vid.play().catch(()=>{});
  }
}

// --- Switch camera ---
function setActiveTrack(idx) {
  activeTrackIndex = idx;
  masterOutputVideo.srcObject = null;
  masterOutputVideo.src = videoTracks[idx] ? videoTracks[idx].url : "";
  masterOutputVideo.currentTime = 0;
  masterOutputVideo.pause(); // Never auto-play
}

// --- Always re-sync after seeking audio ---
audio.addEventListener('seeked', synchronizeVideosToAudio);

// --- Live recording/preview draw loop, if you want to implement ---
function drawFrame(canvas, ctx) {
  if (!isRecording) return;
  const vid = tempVideos[activeTrackIndex];
  if (!(vid && vid.readyState >= 2 && !vid.ended)) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    if (Math.abs(vid.currentTime - audio.currentTime) > 0.01) {
      vid.currentTime = audio.currentTime;
    }
    ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
  }
  animationFrameId = requestAnimationFrame(() => drawFrame(canvas, ctx));
}
