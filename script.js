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

// Audio load logic
songInput.addEventListener('change', function (e) {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  audio.src = url;
  audio.load();
  status.textContent = "Song loaded!";
});

recordBtn.onclick = async () => {
  if (!audio.src) {
    status.textContent = "Please select an audio file first.";
    return;
  }
  recordBtn.disabled = true;
  status.textContent = "Recording...";
  recChunks = [];
  recordedBlob = null;
  downloadBtn.disabled = true;

  try {
    recStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  } catch (err) {
    status.textContent = "Could not access camera/mic!";
    recordBtn.disabled = false;
    return;
  }

  mediaRecorder = new MediaRecorder(recStream, { mimeType: 'video/webm; codecs=vp9,opus' });
  mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recChunks.push(e.data); };
  mediaRecorder.onstop = () => {
    // Save the recorded take
    recordedBlob = new Blob(recChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(recordedBlob);

    // --- CRITICAL PART: Update the preview video element robustly ---
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
        preview.pause(); // or preview.play() for autoplay
      };
    }, 20);

    // Enable download
    downloadBtn.disabled = false;
    status.textContent = "Recording complete! Preview and download your take.";
    if (recStream) recStream.getTracks().forEach(t => t.stop());
  };

  // Show webcam preview while recording
  preview.srcObject = recStream;
  preview.muted = true;
  preview.autoplay = true;
  preview.play().catch(()=>{});

  // Start both audio and video recording in sync
  audio.currentTime = 0;
  audio.play();
  mediaRecorder.start();

  // Stop when audio ends or click preview to stop
  audio.onended = () => {
    if (mediaRecorder.state === 'recording') mediaRecorder.stop();
    audio.onended = null;
  };
  preview.onclick = () => {
    if (mediaRecorder.state === 'recording') mediaRecorder.stop();
  };
  mediaRecorder.onstop = () => {
    recordBtn.disabled = false;
    preview.onclick = null;
  };
};

downloadBtn.onclick = () => {
  if (!recordedBlob) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(recordedBlob);
  a.download = 'take.webm';
  a.click();
};
