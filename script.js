const video = document.getElementById('video');
const recordBtn = document.getElementById('recordBtn');
const playBtn = document.getElementById('playBtn');
const stopBtn = document.getElementById('stopBtn');
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
    if (!window.MediaRecorder) {
      alert("MediaRecorder API not supported in this browser.");
      return;
    }
    mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    video.srcObject = mediaStream;
    video.muted = true;
    await video.play();
    recIndicator.classList.remove('hidden');
    isRecording = true;
    recordedChunks = [];
    recordedVideoBlob = null;
    playBtn.disabled = true;
    stopBtn.disabled = false;
    recordBtn.disabled = true;

    mediaRecorder = new MediaRecorder(mediaStream, { mimeType: 'video/webm' });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordedChunks.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      recIndicator.classList.add('hidden');
      recordedVideoBlob = new Blob(recordedChunks, { type: 'video/webm' });
      video.srcObject = null;
      video.src = URL.createObjectURL(recordedVideoBlob);
      video.controls = true;
      video.muted = false;
      playBtn.disabled = false;
      stopBtn.disabled = true;
      recordBtn.disabled = false;
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
      }
      isRecording = false;
    };

    mediaRecorder.start();
  } catch (err) {
    if (window.isSecureContext === false) {
      alert("Camera access requires HTTPS or localhost. Please serve your site securely.");
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
    // isRecording will be set to false in onstop
  }
});

// Play Recorded Video
playBtn.addEventListener('click', () => {
  if (recordedVideoBlob) {
    video.srcObject = null;
    video.src = URL.createObjectURL(recordedVideoBlob);
    video.controls = true;
    video.muted = false;
    video.play();
  }
});
