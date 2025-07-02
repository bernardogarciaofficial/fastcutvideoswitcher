const songInput = document.getElementById('songInput');
const audio = document.getElementById('audio');
const preview = document.getElementById('preview');
const recordBtn = document.getElementById('recordBtn');
const downloadBtn = document.getElementById('downloadBtn');
const resetBtn = document.getElementById('resetBtn');
const status = document.getElementById('status');

let recStream = null;
let recChunks = [];
let mediaRecorder = null;
let recordedBlob = null;
let audioContext = null;
let combinedStream = null;
let isRecording = false;

// Song loading
songInput.addEventListener('change', function (e) {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  audio.src = url;
  audio.load();
  audio.muted = false;
  status.textContent = "Song loaded!";
});

// Record logic
recordBtn.onclick = async () => {
  if (!audio.src) {
    status.textContent = "Please select an audio file first.";
    return;
  }
  recordBtn.disabled = true;
  resetBtn.disabled = false;
  status.textContent = "Recording...";
  isRecording = true;

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

  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const sourceNode = audioContext.createMediaElementSource(audio);
  const dest = audioContext.createMediaStreamDestination();
  sourceNode.connect(dest);
  sourceNode.connect(audioContext.destination);

  combinedStream = new MediaStream([
    ...recStream.getVideoTracks(),
    ...dest.stream.getAudioTracks()
  ]);

  preview.srcObject = recStream;
  preview.muted = true;
  preview.autoplay = true;
  preview.play().catch(()=>{});

  audio.currentTime = 0;
  try {
    await audio.play();
  } catch (err) {
    status.textContent = "Browser blocked audio autoplay. Please click the play button on the audio player, then hit Record again.";
    recordBtn.disabled = false;
    resetBtn.disabled = true;
    if (recStream) recStream.getTracks().forEach(t => t.stop());
    if (audioContext) audioContext.close();
    isRecording = false;
    return;
  }

  mediaRecorder = new MediaRecorder(combinedStream, {
    mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : 'video/webm'
  });

  mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recChunks.push(e.data); };

  mediaRecorder.onstop = () => {
    if (!isRecording) return; // Prevent double calls
    isRecording = false;
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
    if (audioContext) { audioContext.close(); audioContext = null; }
    recordBtn.disabled = false;
    resetBtn.disabled = true;
  };

  // Stop on audio end or video click
  audio.onended = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
    audio.onended = null;
  };
  preview.onclick = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
  };

  mediaRecorder.start();
};

// Download logic
downloadBtn.onclick = () => {
  if (!recordedBlob) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(recordedBlob);
  a.download = 'take.webm';
  a.click();
};

// Reset logic
resetBtn.onclick = () => {
  // Stop recording if in progress
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    isRecording = false;
    mediaRecorder.stop();
  }
  if (recStream) recStream.getTracks().forEach(t => t.stop());
  if (audioContext) { audioContext.close(); audioContext = null; }
  audio.pause();
  audio.currentTime = 0;
  preview.pause();
  preview.removeAttribute('src');
  preview.srcObject = null;
  recordedBlob = null;
  recChunks = [];
  status.textContent = "Reset. Ready for new take.";
  recordBtn.disabled = false;
  downloadBtn.disabled = true;
  resetBtn.disabled = true;
};
