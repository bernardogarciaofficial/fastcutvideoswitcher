const songInput = document.getElementById('songInput');
const audio = document.getElementById('audio');
const preview = document.getElementById('preview');
const recordBtn = document.getElementById('recordBtn');
const downloadBtn = document.getElementById('downloadBtn');
const status = document.getElementById('status');

let recStream = null;
let recChunks = [];
let mediaRecorder = null;
let recordedBlob = null;
let audioContext = null;
let sourceNode = null;
let dest = null;
let combinedStream = null;
let isRecording = false;
let audioUnlocked = false;

// --- Song loading ---
songInput.addEventListener('change', function (e) {
  cleanupAudio();
  audioUnlocked = false;
  audio.pause();
  audio.currentTime = 0;
  audio.controls = true;
  recordBtn.disabled = false;
  downloadBtn.disabled = true;
  recordedBlob = null;
  recChunks = [];
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  audio.src = url;
  audio.load();
  status.textContent = "Song loaded! Click play below to unlock audio, then pause. You can't play the song outside of recording.";
});

// --- User unlocks audio ---
audio.addEventListener('play', () => {
  if (!audioUnlocked) {
    audioUnlocked = true;
    status.textContent = "Audio unlocked! Pause, then click Record.";
  }
});

// --- Record logic ---
recordBtn.onclick = async () => {
  if (!audio.src) {
    status.textContent = "Please select an audio file first.";
    return;
  }
  if (!audioUnlocked) {
    status.textContent = "Please click play on the audio player below, then pause, before recording.";
    return;
  }

  // Disable audio controls so user cannot play outside of recording
  audio.controls = false;

  recordBtn.disabled = true;
  status.textContent = "Recording...";

  recChunks = [];
  recordedBlob = null;
  downloadBtn.disabled = true;

  try {
    recStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  } catch (err) {
    status.textContent = "Could not access camera!";
    recordBtn.disabled = false;
    return;
  }

  // --- Create context+source+dest if missing (once per song load) ---
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    sourceNode = audioContext.createMediaElementSource(audio);
    dest = audioContext.createMediaStreamDestination();
    sourceNode.connect(dest);
    sourceNode.connect(audioContext.destination);
  }

  // --- Combine webcam video + audio ---
  combinedStream = new MediaStream([
    ...recStream.getVideoTracks(),
    ...dest.stream.getAudioTracks()
  ]);

  // --- Webcam preview ---
  preview.srcObject = recStream;
  preview.muted = true;
  preview.autoplay = true;
  preview.play().catch(()=>{});

  // --- Ensure song starts at 0 and plays in sync with recording ---
  audio.pause();
  audio.currentTime = 0;
  await new Promise(res => setTimeout(res, 30));

  try {
    await audio.play();
    if (audio.paused) throw new Error("Audio still paused after play()");
  } catch (err) {
    status.textContent = "Browser blocked audio autoplay. Please click play on the audio player to unlock, then pause and Record.";
    audio.controls = true;
    recordBtn.disabled = false;
    if (recStream) recStream.getTracks().forEach(t => t.stop());
    return;
  }

  mediaRecorder = new MediaRecorder(combinedStream, {
    mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : 'video/webm'
  });

  mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recChunks.push(e.data); };

  mediaRecorder.onstop = () => {
    recordedBlob = new Blob(recChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(recordedBlob);
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
    downloadBtn.disabled = false;
    status.textContent = "Recording complete! Preview and download your take.";
    if (recStream) recStream.getTracks().forEach(t => t.stop());
    recordBtn.disabled = false;
    audio.controls = false; // keep song locked
  };

  // --- Stop on audio end or video click
  audio.onended = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
    audio.onended = null;
  };
  preview.onclick = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
  };

  mediaRecorder.start();
};

// --- Download logic ---
downloadBtn.onclick = () => {
  if (!recordedBlob) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(recordedBlob);
  a.download = 'take.webm';
  a.click();
};

function cleanupAudio() {
  if (audioContext) try { audioContext.close(); } catch {}
  audioContext = null;
  sourceNode = null;
  dest = null;
}
