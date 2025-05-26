// FinalCut-inspired editing platform - core logic

const NUM_TRACKS = 3; // Example: 2 video, 1 audio
const TRACK_HEIGHT = 54;
const PIXELS_PER_SEC = 80;

const songInput = document.getElementById('songInput');
const videoInput = document.getElementById('videoInput');
const mediaBinList = document.getElementById('mediaBinList');
const previewVideo = document.getElementById('previewVideo');
const waveform = document.getElementById('waveform');
const timeline = document.getElementById('timeline');
const inspectorContent = document.getElementById('inspectorContent');
const timelineRuler = document.getElementById('timelineRuler');
const playTimelineBtn = document.getElementById('playTimelineBtn');
const stopTimelineBtn = document.getElementById('stopTimelineBtn');
const splitBtn = document.getElementById('splitBtn');
const cutBtn = document.getElementById('cutBtn');
const fadeBtn = document.getElementById('fadeBtn');
const exportBtn = document.getElementById('exportBtn');
const masterOutputVideo = document.getElementById('masterOutputVideo');

// App state
let audio = null;
let audioUrl = null;
let audioBuffer = null;
let audioContext = null;
let songDuration = 0;
let timelineClips = []; // {id, type, src, start, end, track, trimStart, trimEnd}
let mediaBin = []; // {id, name, type, file, url, duration}
let selectedClipId = null;
let timelinePlaying = false;
let timelinePlayHead = 0;

// --- Media Bin Logic ---

function addToMediaBin(file, type) {
  const id = 'media_' + Math.random().toString(36).substr(2,9);
  const url = URL.createObjectURL(file);
  let name = file.name;
  let duration = 0;
  const mediaObj = { id, name, type, file, url, duration };
  mediaBin.push(mediaObj);
  if (type === 'video') {
    const tempVid = document.createElement('video');
    tempVid.src = url;
    tempVid.onloadedmetadata = () => {
      mediaObj.duration = tempVid.duration;
      renderMediaBin();
    };
  } else if (type === 'audio') {
    const tempAud = document.createElement('audio');
    tempAud.src = url;
    tempAud.onloadedmetadata = () => {
      mediaObj.duration = tempAud.duration;
      renderMediaBin();
    };
  }
  renderMediaBin();
}

function renderMediaBin() {
  mediaBinList.innerHTML = '';
  mediaBin.forEach(item => {
    const li = document.createElement('li');
    li.textContent = `${item.type === 'video' ? '🎬' : '🎵'} ${item.name}`;
    li.addEventListener('click', () => {
      previewMedia(item);
    });
    li.draggable = true;
    li.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('mediaId', item.id);
    });
    mediaBinList.appendChild(li);
  });
}

function previewMedia(item) {
  previewVideo.src = item.url;
  previewVideo.currentTime = 0;
  previewVideo.play();
}

// --- Song Upload/Waveform ---
songInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  audioUrl = URL.createObjectURL(file);
  audio = new Audio(audioUrl);
  audio.preload = "auto";
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const arrayBuffer = await file.arrayBuffer();
  audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  songDuration = audioBuffer.duration;
  addToMediaBin(file, 'audio');
  drawWaveform(audioBuffer);
  renderTimelineRuler(songDuration);
});

function drawWaveform(buffer) {
  const canvas = waveform;
  const ctx = canvas.getContext('2d');
  const width = canvas.width = 440;
  const height = canvas.height = 50;
  ctx.clearRect(0, 0, width, height);
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
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

function renderTimelineRuler(duration) {
  timelineRuler.innerHTML = '';
  const seconds = Math.ceil(duration);
  for (let i = 0; i <= seconds; i += 1) {
    const mark = document.createElement('span');
    mark.textContent = i % 5 === 0 ? `${i}s` : '|';
    mark.style.marginRight = '12px';
    timelineRuler.appendChild(mark);
  }
}

// --- Video Upload ---
videoInput.addEventListener('change', (e) => {
  const files = Array.from(e.target.files);
  files.forEach(file => addToMediaBin(file, 'video'));
});

// --- Timeline (drag/drop) ---
timeline.addEventListener('dragover', (e) => {
  e.preventDefault();
});

timeline.addEventListener('drop', (e) => {
  e.preventDefault();
  const mediaId = e.dataTransfer.getData('mediaId');
  const item = mediaBin.find(m => m.id === mediaId);
  if (!item) return;
  // Add to timeline at position of drop (for now, append at end)
  const start = timelineClips.length === 0 ? 0 : Math.max(...timelineClips.map(c => c.end || 0));
  const end = start + (item.duration || 5);
  const track = item.type === 'audio' ? 2 : 0; // Video on track 0, audio on 2
  const clip = {
    id: 'clip_' + Math.random().toString(36).substr(2,9),
    type: item.type,
    src: item.url,
    mediaId: item.id,
    start,
    end,
    track,
    trimStart: 0,
    trimEnd: item.duration || 5
  };
  timelineClips.push(clip);
  renderTimeline();
});

// --- Timeline Rendering ---
function renderTimeline() {
  // Clear
  timeline.innerHTML = '';
  // Height per track
  timeline.style.height = (TRACK_HEIGHT * NUM_TRACKS) + "px";
  // Draw tracks background
  for (let i = 0; i < NUM_TRACKS; i++) {
    const trackLabel = document.createElement('span');
    trackLabel.className = 'fc-timeline-track-label';
    trackLabel.textContent = i === 2 ? 'Audio' : `Video ${i+1}`;
    trackLabel.style.top = (i*TRACK_HEIGHT + 8) + "px";
    timeline.appendChild(trackLabel);
  }
  // Draw clips
  timelineClips.forEach(clip => {
    const pxStart = clip.start * PIXELS_PER_SEC;
    const pxWidth = (clip.end - clip.start) * PIXELS_PER_SEC;
    const trackY = clip.track * TRACK_HEIGHT + 4;
    const div = document.createElement('div');
    div.className = 'fc-timeline-clip' + (clip.id === selectedClipId ? ' selected' : '');
    div.style.left = pxStart + "px";
    div.style.top = trackY + "px";
    div.style.width = pxWidth + "px";
    div.style.height = (TRACK_HEIGHT-8) + "px";
    div.textContent = clip.type === 'video' ? '🎬 Video' : '🎵 Audio';
    div.draggable = true;
    div.addEventListener('click', (e) => {
      selectedClipId = clip.id;
      renderTimeline();
      renderInspector();
    });
    // Drag to move
    div.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('clipId', clip.id);
    });
    timeline.appendChild(div);

    // Trimming handles
    const leftTrim = document.createElement('div');
    leftTrim.className = 'fc-clip-trim left';
    leftTrim.addEventListener('mousedown', (e) => startTrimClip(clip, 'left', e));
    div.appendChild(leftTrim);

    const rightTrim = document.createElement('div');
    rightTrim.className = 'fc-clip-trim right';
    rightTrim.addEventListener('mousedown', (e) => startTrimClip(clip, 'right', e));
    div.appendChild(rightTrim);
  });
}

// --- Timeline Clip Trimming ---
let trimState = null;
function startTrimClip(clip, side, e) {
  e.stopPropagation();
  trimState = { clip, side, startX: e.pageX, origStart: clip.start, origEnd: clip.end };
  document.body.style.cursor = 'ew-resize';
  document.addEventListener('mousemove', onTrimMove);
  document.addEventListener('mouseup', onTrimEnd);
}
function onTrimMove(e) {
  if (!trimState) return;
  const dx = (e.pageX - trimState.startX) / PIXELS_PER_SEC;
  let clip = trimState.clip;
  if (trimState.side === 'left') {
    clip.start = Math.max(0, Math.min(clip.end-0.2, trimState.origStart + dx));
  } else {
    clip.end = Math.max(clip.start+0.2, trimState.origEnd + dx);
  }
  renderTimeline();
  renderInspector();
}
function onTrimEnd() {
  trimState = null;
  document.body.style.cursor = '';
  document.removeEventListener('mousemove', onTrimMove);
  document.removeEventListener('mouseup', onTrimEnd);
}

// --- Timeline Transport Controls ---
playTimelineBtn.addEventListener('click', () => {
  if (timelineClips.length === 0) return;
  playTimeline();
});
stopTimelineBtn.addEventListener('click', () => {
  stopTimeline();
});
function playTimeline() {
  // Only preview first video track for demo
  const firstVideo = timelineClips.find(c => c.type === 'video');
  if (firstVideo) {
    previewVideo.src = firstVideo.src;
    previewVideo.currentTime = firstVideo.start;
    previewVideo.play();
    timelinePlaying = true;
  }
  if (audio) {
    audio.currentTime = 0;
    audio.play();
  }
}
function stopTimeline() {
  previewVideo.pause();
  previewVideo.currentTime = 0;
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
  timelinePlaying = false;
}

// --- Clip Split / Cut / Fade ---
splitBtn.addEventListener('click', () => {
  if (!selectedClipId) return;
  const clip = timelineClips.find(c => c.id === selectedClipId);
  if (!clip) return;
  const splitTime = (clip.start + clip.end) / 2;
  if (clip.end - clip.start < 0.4) return;
  // Split clip into two
  const left = { ...clip, end: splitTime, id: 'clip_' + Math.random().toString(36).substr(2,9) };
  const right = { ...clip, start: splitTime, id: 'clip_' + Math.random().toString(36).substr(2,9) };
  timelineClips = timelineClips.filter(c => c.id !== clip.id).concat([left, right]);
  renderTimeline();
});
cutBtn.addEventListener('click', () => {
  if (!selectedClipId) return;
  timelineClips = timelineClips.filter(c => c.id !== selectedClipId);
  selectedClipId = null;
  renderTimeline();
  renderInspector();
});
fadeBtn.addEventListener('click', () => {
  if (!selectedClipId) return;
  // Demo: just add a "fade" property (visual only)
  const clip = timelineClips.find(c => c.id === selectedClipId);
  if (!clip) return;
  clip.fade = true;
  renderTimeline();
  renderInspector();
});

// --- Effects Panel ---
document.querySelectorAll('.effect-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!selectedClipId) return;
    const effect = btn.dataset.effect;
    const clip = timelineClips.find(c => c.id === selectedClipId);
    if (clip) {
      clip.effect = effect;
      renderInspector();
    }
  });
});

// --- Inspector Logic ---
function renderInspector() {
  if (!selectedClipId) {
    inspectorContent.textContent = 'Select a clip to edit properties';
    return;
  }
  const clip = timelineClips.find(c => c.id === selectedClipId);
  if (!clip) {
    inspectorContent.textContent = 'Select a clip to edit properties';
    return;
  }
  inspectorContent.innerHTML = `
    <b>Type:</b> ${clip.type}<br>
    <b>Start:</b> <input type="number" min="0" max="${clip.end-0.1}" step="0.05" value="${clip.start.toFixed(2)}" id="inspectorStart"> <br>
    <b>End:</b> <input type="number" min="${clip.start+0.1}" max="999" step="0.05" value="${clip.end.toFixed(2)}" id="inspectorEnd"> <br>
    <b>Effect:</b> ${clip.effect || 'None'}<br>
    <b>Fade Applied:</b> ${clip.fade ? 'Yes' : 'No'}
  `;
  document.getElementById('inspectorStart').addEventListener('input', (e) => {
    clip.start = Math.max(0, Math.min(clip.end-0.1, parseFloat(e.target.value)));
    renderTimeline();
  });
  document.getElementById('inspectorEnd').addEventListener('input', (e) => {
    clip.end = Math.max(clip.start+0.1, parseFloat(e.target.value));
    renderTimeline();
  });
}

// --- Export Master (Simulate) ---
exportBtn.addEventListener('click', () => {
  alert("Exporting is a simulation. In a real app, export logic (ffmpeg, MediaRecorder, etc) is needed.");
  // For UI, just play the first video + audio in master output
  const firstVideo = timelineClips.find(c => c.type === 'video');
  if (firstVideo) {
    masterOutputVideo.src = firstVideo.src;
    masterOutputVideo.currentTime = firstVideo.start;
    masterOutputVideo.play();
  }
  if (audio) {
    audio.currentTime = 0;
    audio.play();
  }
});

// Initial render
renderMediaBin();
renderTimeline();
