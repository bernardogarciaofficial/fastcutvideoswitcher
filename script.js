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

songInput.addEventListener('change', function (e) {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  audio.src = url;
  audio.load();
  status.textContent = "Song loaded!";
  // Make sure audio is not muted
  audio.muted = false;
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

  // Prepare preview for live webcam
  preview.srcObject = recStream;
  preview.muted = true;
  preview.autoplay = true;
  preview.play().catch(()=>{});

  // Wait for audio to start playing before starting recording
  audio.currentTime = 0;
  try {
    await audio.play();
  } catch (err) {
    status.textContent = "Browser blocked audio autoplay. Please click the play button on the audio player, then hit Record again.";
    recordBtn.disabled = false;
    if (recStream) recStream.getTracks().forEach(t => t.stop());
    return;
  }

  // Start recording AFTER audio starts
  mediaRecorder = new MediaRecorder(recStream, { mimeType: 'video/webm; codecs=vp9,opus' });
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
  };

  // Start recording
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
