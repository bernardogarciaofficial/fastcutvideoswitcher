const NUM_TRACKS = 6;
const songInput = document.getElementById('songInput');
const audioStatus = document.getElementById('audioStatus');
const audio = document.getElementById('audio');
const masterOutputVideo = document.getElementById('masterOutputVideo');
const recIndicator = document.getElementById('recIndicator');
const recordFullEditBtn = document.getElementById('recordFullEditBtn');
const stopPreviewBtn = document.getElementById('stopPreviewBtn');
const exportBtn = document.getElementById('exportMusicVideoBtn');
const exportStatus = document.getElementById('exportStatus');
const hiddenVideos = document.getElementById('hiddenVideos');
const thumbRow = document.getElementById('thumbRow');
const switcherBtnsContainer = document.getElementById('switcherBtnsContainer');
const audioUnlockBtn = document.getElementById('audioUnlockBtn');
const audioUnlockMsg = document.getElementById('audioUnlockMsg');
const audioUnlockContainer = document.getElementById('audioUnlockContainer');

const videoTracks = Array(NUM_TRACKS).fill(null);
let activeTrackIndex = 0;
let isRecording = false;
let isPlaying = false;
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
    const video = document.createElement('video');
    video.className = 'thumb';
    video.id = 'thumb' + i;
    video.muted = true;
    video.playsInline = true;
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
  }
}
createThumbRow();

for(let i=0; i<NUM_TRACKS; i++) {
  document.querySelector(`.record-btn[data-idx="${i}"]`).onclick = async (e) => {
    const idx = +e.target.dataset.idx;
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

    const preview = document.getElementById('thumb' + idx);

    preview.srcObject = recStream;
    preview.muted = true;
    preview.autoplay = true;
    preview.play().catch(()=>{});

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
      videoTracks[idx] = { file: null, url, name: `Camera${idx+1}-take.webm`, recordedBlob: blob };
      // DEMO-MATCHING thumbnail refresh logic:
      preview.pause();
      preview.srcObject = null;
      preview.removeAttribute('src');
      preview.load();
      setTimeout(() => {
        preview.src = url;
        preview.currentTime = 0;
        preview.load();
        preview.onloadeddata = () => {
          preview.currentTime = 0;
          preview.pause();
        };
      }, 20);
      document.querySelector(`.download-btn[data-idx="${idx}"]`).disabled = false;
      if (recStream) recStream.getTracks().forEach(track => track.stop());
      if (localAudioContext) localAudioContext.close();
      audio.pause();
      updateSwitcherBtns();
    };

    e.target.disabled = true;
    e.target.textContent = 'Recording...';

    audio.onended = function() {
      if (recorder.state === 'recording') recorder.stop();
      audio.onended = null;
    };
    preview.onclick = () => {
      if (recorder.state === 'recording') recorder.stop();
    };
    recorder.onstop = () => {
      e.target.disabled = false;
      e.target.textContent = 'Record';
      preview.onclick = null;
    };

    recorder.start();
  };

  document.querySelector(`.upload-btn[data-idx="${i}"]`).onchange = (e) => {
    const idx = +e.target.dataset.idx;
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const preview = document.getElementById('thumb' + idx);
    preview.src = url;
    preview.currentTime = 0;
    preview.load();
    videoTracks[idx] = { file, url, name: file.name };
    document.querySelector(`.download-btn[data-idx="${idx}"]`).disabled = false;
    updateSwitcherBtns();
  };

  document.querySelector(`.download-btn[data-idx="${i}"]`).onclick = (e) => {
    const idx = +e.target.dataset.idx;
    const track = videoTracks[idx];
    if (!track) return;
    const a = document.createElement('a');
    a.href = track.url;
    a.download = track.name || `track${idx+1}.webm`;
    a.click();
  };

  document.getElementById('thumb' + i).onclick = () => {
    setActiveTrack(i);
  };
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

function setActiveTrack(idx) {
  activeTrackIndex = idx;
  switcherBtnsContainer.querySelectorAll('.switcher-btn').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
  });
  document.querySelectorAll('.thumb').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
  });
}
setActiveTrack(0);
