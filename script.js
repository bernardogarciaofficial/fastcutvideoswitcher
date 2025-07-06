const NUM_TRACKS = 6;
const songInput = document.getElementById('songInput');
const audioStatus = document.getElementById('audioStatus');
const audio = document.getElementById('audio');
const thumbRow = document.getElementById('thumbRow');
const switcherBtnsContainer = document.getElementById('switcherBtnsContainer');
const audioUnlockBtn = document.getElementById('audioUnlockBtn');
const audioUnlockMsg = document.getElementById('audioUnlockMsg');
const audioUnlockContainer = document.getElementById('audioUnlockContainer');

const videoTracks = Array(NUM_TRACKS).fill(null);
let activeTrackIndex = 0;
let audioUnlocked = false;

// ===== SONG UPLOAD =====
songInput.addEventListener('change', function (e) {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  audio.src = url;
  audio.style.display = 'block';
  audioStatus.textContent = `Loaded: ${file.name}`;
  audio.load();
  resetAudioUnlock();
});

function resetAudioUnlock() {
  audioUnlocked = false;
  audioUnlockMsg.textContent = '';
  audioUnlockBtn.disabled = false;
  audioUnlockContainer.style.display = '';
  document.querySelectorAll('.record-btn').forEach(btn => btn.disabled = true);
}

// ===== AUDIO UNLOCK =====
audioUnlockBtn.onclick = async () => {
  try {
    audio.currentTime = 0;
    await audio.play();
    audio.pause();
    audioUnlocked = true;
    audioUnlockMsg.textContent = "Audio unlocked! You can now record.";
    audioUnlockBtn.disabled = true;
    document.querySelectorAll('.record-btn').forEach(btn => btn.disabled = false);
    setTimeout(()=>{ audioUnlockContainer.style.display = 'none'; }, 1000);
  } catch (e) {
    audioUnlockMsg.textContent = "Please allow audio playback in your browser.";
  }
};

// ===== THUMBNAIL ROW WITH BUTTONS =====
function createThumbRow() {
  thumbRow.innerHTML = '';
  for(let i=0; i<NUM_TRACKS; i++) {
    const col = document.createElement('div');
    col.className = 'thumb-col';
    col.dataset.idx = i;

    // Thumbnail video
    const video = document.createElement('video');
    video.className = 'thumb';
    video.id = 'thumb' + i;
    video.muted = true;
    video.playsInline = true;
    video.width = 160;
    video.height = 90;

    // Controls
    const controls = document.createElement('div');
    controls.className = 'thumb-controls';

    const recordBtn = document.createElement('button');
    recordBtn.className = 'record-btn';
    recordBtn.textContent = 'Record';
    recordBtn.dataset.idx = i;
    recordBtn.disabled = true;

    const uploadInput = document.createElement('input');
    uploadInput.type = 'file';
    uploadInput.accept = 'video/*';
    uploadInput.className = 'upload-btn';
    uploadInput.dataset.idx = i;

    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'download-btn';
    downloadBtn.textContent = 'Download';
    downloadBtn.dataset.idx = i;
    downloadBtn.disabled = true;

    controls.appendChild(recordBtn);
    controls.appendChild(uploadInput);
    controls.appendChild(downloadBtn);

    col.appendChild(video);
    col.appendChild(controls);
    thumbRow.appendChild(col);

    // Event listeners
    recordBtn.onclick = (e) => startRecording(i, video, recordBtn, downloadBtn);
    uploadInput.onchange = (e) => handleUpload(i, video, downloadBtn, uploadInput);
    downloadBtn.onclick = () => handleDownload(i);
    video.onclick = () => setActiveTrack(i);
  }
}
createThumbRow();

function setActiveTrack(idx) {
  activeTrackIndex = idx;
  switcherBtnsContainer.querySelectorAll('.switcher-btn').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
  });
  document.querySelectorAll('.thumb').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
  });
}
function updateSwitcherBtns() {
  switcherBtnsContainer.innerHTML = '';
  for(let i=0; i<NUM_TRACKS; i++) {
    const btn = document.createElement('button');
    btn.className = 'switcher-btn' + (i === activeTrackIndex ? ' active' : '');
    btn.textContent = `Camera ${i+1}`;
    btn.disabled = !videoTracks[i];
    btn.onclick = () => setActiveTrack(i);
    switcherBtnsContainer.appendChild(btn);
  }
}
updateSwitcherBtns();

async function startRecording(idx, video, recordBtn, downloadBtn) {
  if (!audio.src) {
    alert("Please choose a song first.");
    return;
  }
  if (!audioUnlocked) {
    alert("Please unlock audio for recording first.");
    return;
  }

  let recChunks = [];
  let recStream = null;
  let localAudioContext = null;
  let localSourceNode = null;
  let dest = null;

  try {
    recStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  } catch (err) {
    alert('Cannot access camera.');
    return;
  }

  localAudioContext = new (window.AudioContext || window.webkitAudioContext)();
  localSourceNode = localAudioContext.createMediaElementSource(audio);
  dest = localAudioContext.createMediaStreamDestination();
  localSourceNode.connect(dest);
  localSourceNode.connect(localAudioContext.destination);

  const combinedStream = new MediaStream([
    ...recStream.getVideoTracks(),
    ...dest.stream.getAudioTracks()
  ]);

  video.srcObject = recStream;
  video.muted = true;
  video.autoplay = true;
  video.play().catch(()=>{});

  audio.pause();
  audio.currentTime = 0;
  await new Promise(res => setTimeout(res, 30));

  try {
    await audio.play();
    if (audio.paused) throw new Error("Audio still paused after play()");
  } catch (err) {
    alert("Browser blocked audio autoplay. Please allow audio playback and try again.");
    if (recStream) recStream.getTracks().forEach(t => t.stop());
    return;
  }

  const recorder = new MediaRecorder(combinedStream, {
    mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : 'video/webm'
  });

  recorder.ondataavailable = function(e) {
    if (e.data.size > 0) recChunks.push(e.data);
  };

  recorder.onstop = function() {
    const blob = new Blob(recChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    videoTracks[idx] = { url, blob, name: `Camera${idx+1}-take.webm` };

    // DEMO-MATCHING: Force video element to show the new take
    video.pause();
    video.srcObject = null;
    video.removeAttribute('src');
    video.load();
    setTimeout(() => {
      video.src = url;
      video.currentTime = 0;
      video.load();
      video.onloadeddata = () => {
        video.currentTime = 0;
        video.pause();
      };
    }, 20);

    downloadBtn.disabled = false;
    if (recStream) recStream.getTracks().forEach(track => track.stop());
    if (localAudioContext) localAudioContext.close();
    audio.pause();
    updateSwitcherBtns();
  };

  recordBtn.disabled = true;
  recordBtn.textContent = 'Recording...';

  audio.onended = function() {
    if (recorder.state === 'recording') recorder.stop();
    audio.onended = null;
  };
  video.onclick = () => {
    if (recorder.state === 'recording') recorder.stop();
  };
  recorder.onstop = () => {
    recordBtn.disabled = false;
    recordBtn.textContent = 'Record';
    video.onclick = null;
  };

  recorder.start();
}

function handleUpload(idx, video, downloadBtn, uploadInput) {
  const file = uploadInput.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  video.src = url;
  video.currentTime = 0;
  video.load();
  videoTracks[idx] = { url, file, name: file.name };
  downloadBtn.disabled = false;
  updateSwitcherBtns();
}

function handleDownload(idx) {
  const track = videoTracks[idx];
  if (!track) return;
  const a = document.createElement('a');
  a.href = track.url;
  a.download = track.name || `track${idx+1}.webm`;
  a.click();
}
