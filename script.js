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
let combinedStream = null;

songInput.addEventListener('change', function (e) {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  audio.src = url;
  audio.load();
  audio.muted = false;
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

  // 1. Get webcam video (NO audio from mic)
  try {
    recStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  } catch (err) {
    status.textContent = "Could not access camera!";
    recordBtn.disabled = false;
    return;
  }

  // 2. Prepare audio track from the song (not mic)
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const sourceNode = audioContext.createMediaElementSource(audio);
  const dest = audioContext.createMediaStreamDestination();
  sourceNode.connect(dest);
  sourceNode.connect(audioContext.destination); // for monitoring

  // 3. Combine webcam video track + audioContext's audio track
  combinedStream = new MediaStream([
    ...recStream.getVideoTracks(),
    ...dest.stream.getAudioTracks()
  ]);

  // 4. Show webcam preview (live video only)
  preview.srcObject = recStream;
  preview.muted = true;
  preview.autoplay = true;
  preview.play().catch(()=>{});

  // 5. Wait for audio to be able to play
  audio.currentTime = 0;
  try {
    await audio.play();
  } catch (err) {
    status.textContent = "Browser blocked audio autoplay. Please click the play button on the audio player, then hit Record again.";
    recordBtn.disabled = false;
    if (recStream) recStream.getTracks().forEach(t => t.stop());
    if (audioContext) audioContext.close();
    return;
  }

  // 6. Start recording webcam video + song audio
  mediaRecorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm; codecs=vp9,opus' });
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
    if (audioContext) { audioContext.close(); audioContext = null; }
  };

  // Start the recording
  mediaRecorder.start();

  // Stop on audio end or video click
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
