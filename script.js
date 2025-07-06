const NUM_TRACKS = 6;
const songInput = document.getElementById('songInput');
const audio = document.getElementById('audio');
const thumbRow = document.getElementById('thumbRow');
const status = document.getElementById('status');

let audioUnlocked = false;
let audioContext = null;
let sourceNode = null;
let dest = null;

// Array to store each track's video url/blob
const videoTracks = Array(NUM_TRACKS).fill(null);

// Song loading/reset
songInput.addEventListener('change', function (e) {
  cleanupAudio();
  audioUnlocked = false;
  audio.pause();
  audio.currentTime = 0;
  audio.controls = true;
  videoTracks.fill(null);
  createThumbRow();
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  audio.src = url;
  audio.load();
  status.textContent = "Song loaded! Click play below to unlock audio, then pause. You can't play the song outside of recording.";
});

// User unlocks audio
audio.addEventListener('play', () => {
  if (!audioUnlocked) {
    audioUnlocked = true;
    status.textContent = "Audio unlocked! Pause, then click Record on any track.";
    document.querySelectorAll('.record-btn').forEach(btn => btn.disabled = false);
  }
});

// Create 6 thumbnail slots
function createThumbRow() {
  thumbRow.innerHTML = '';
  for(let i=0; i<NUM_TRACKS; i++) {
    const col = document.createElement('div');
    col.className = 'thumb-col';

    const video = document.createElement('video');
    video.className = 'thumb';
    video.id = 'thumb' + i;
    video.muted = true;
    video.playsInline = true;
    video.controls = true;

    const controls = document.createElement('div');
    controls.className = 'thumb-controls';

    const recordBtn = document.createElement('button');
    recordBtn.className = 'record-btn';
    recordBtn.textContent = 'Record';
    recordBtn.disabled = true;

    const downloadBtn = document.createElement('button');
    downloadBtn.textContent = 'Download';
    downloadBtn.disabled = true;

    controls.appendChild(recordBtn);
    controls.appendChild(downloadBtn);

    col.appendChild(video);
    col.appendChild(controls);
    thumbRow.appendChild(col);

    recordBtn.onclick = () => startRecording(i, video, recordBtn, downloadBtn);
    downloadBtn.onclick = () => handleDownload(i);
  }
}

createThumbRow();

async function startRecording(idx, video, recordBtn, downloadBtn) {
  if (!audio.src) {
    status.textContent = "Please select an audio file first.";
    return;
  }
  if (!audioUnlocked) {
    status.textContent = "Please click play on the audio player below, then pause, before recording.";
    return;
  }
  audio.controls = false;
  recordBtn.disabled = true;
  status.textContent = `Recording track ${idx+1}...`;

  let recChunks = [];
  let recStream = null;

  try {
    recStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  } catch (err) {
    status.textContent = "Could not access camera!";
    recordBtn.disabled = false;
    return;
  }

  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    sourceNode = audioContext.createMediaElementSource(audio);
    dest = audioContext.createMediaStreamDestination();
    sourceNode.connect(dest);
    sourceNode.connect(audioContext.destination);
  }

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
  await audio.play();

  const mediaRecorder = new MediaRecorder(combinedStream, {
    mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : 'video/webm'
  });

  mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recChunks.push(e.data); };

  mediaRecorder.onstop = () => {
    const recordedBlob = new Blob(recChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(recordedBlob);
    videoTracks[idx] = { url, recordedBlob };

    // --- The key: force refresh video element
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
    status.textContent = `Track ${idx+1} recorded!`;
    if (recStream) recStream.getTracks().forEach(t => t.stop());
    recordBtn.disabled = false;
    audio.controls = false;
  };

  audio.onended = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
    audio.onended = null;
  };
  video.onclick = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
  };

  mediaRecorder.start();
}

function handleDownload(idx) {
  const track = videoTracks[idx];
  if (!track) return;
  const a = document.createElement('a');
  a.href = track.url;
  a.download = `take${idx+1}.webm`;
  a.click();
}

function cleanupAudio() {
  if (audioContext) try { audioContext.close(); } catch {}
  audioContext = null;
  sourceNode = null;
  dest = null;
}
