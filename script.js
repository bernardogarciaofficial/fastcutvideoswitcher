const video = document.getElementById('video');
const recordBtn = document.getElementById('recordBtn');
const stopBtn = document.getElementById('stopBtn');
const playBtn = document.getElementById('playBtn');
const recIndicator = document.getElementById('recIndicator');

let mediaStream = null;
let mediaRecorder = null;
let recordedChunks = [];
let recordedVideoBlob = null;
let isRecording = false;

// Start Recording
recordBtn.addEventListener('click', async () => {
  if (isRecording) return;

  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("getUserMedia not supported in this browser.");
      return;
    }
    // Request both video and audio!
    mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    video.srcObject = mediaStream;
    video.muted = true;
    await video.play();

    recordedChunks = [];
    recordedVideoBlob = null;
    recIndicator.classList.remove('hidden');
    playBtn.disabled = true;
    stopBtn.disabled = false;
    recordBtn.disabled = true;
    isRecording = true;

    mediaRecorder = new MediaRecorder(mediaStream, { mimeType: 'video/webm; codecs=vp9,opus' });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordedChunks.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      recIndicator.classList.add('hidden');
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
      }
      recordedVideoBlob = new Blob(recordedChunks, { type: 'video/webm' });
      video.srcObject = null;
      video.src = URL.createObjectURL(recordedVideoBlob);
      video.muted = false;
      video.controls = true;
      playBtn.disabled = false;
      stopBtn.disabled = true;
      recordBtn.disabled = false;
      isRecording = false;
    };

    mediaRecorder.start();
  } catch (err) {
    if (window.isSecureContext === false) {
      alert("Camera/mic access requires HTTPS or localhost. Please serve your site securely.");
    } else if (err && err.name === "NotAllowedError") {
      alert("Camera/mic permission denied. Please allow camera and mic access in your browser settings.");
    } else if (err && err.name === "NotFoundError") {
      alert("No camera or microphone found on this device.");
    } else {
      alert("Could not access camera or microphone. Error: " + err.message);
    }
  }
});

// Stop Recording
stopBtn.addEventListener('click', () => {
  if (isRecording && mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
  }
});

// Play Recorded Video
playBtn.addEventListener('click', () => {
  if (recordedVideoBlob) {
    video.srcObject = null;
    video.src = URL.createObjectURL(recordedVideoBlob);
    video.muted = false;
    video.controls = true;
    video.play();
  }
});
