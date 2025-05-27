async function startRecording(trackNumber) {
  const vs = videoStates[trackNumber];
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    vs.video.srcObject = stream;
    vs.mediaRecorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    vs.recordedChunks = [];

    vs.mediaRecorder.ondataavailable = e => {
      if (e.data.size > 0) {
        vs.recordedChunks.push(e.data);
      }
    };

    vs.mediaRecorder.onstop = () => {
      // Stop and clear webcam preview
      if (vs.video.srcObject) {
        vs.video.srcObject.getTracks().forEach(track => track.stop());
        vs.video.srcObject = null;
      }
      // Create video blob and show it
      const blob = new Blob(vs.recordedChunks, { type: "video/webm" });
      vs.video.src = URL.createObjectURL(blob);
      vs.video.controls = true;
      vs.video.muted = false;
      vs.recordBtn.disabled = false;
      vs.stopBtn.disabled = true;
      vs.playBtn.disabled = false;
      stopRecFlash(vs);
      vs.recIndicator.classList.add('hidden');
      if (audio && !audio.paused) {
        audio.pause();
        audio.currentTime = 0;
      }
    };

    vs.mediaRecorder.start();
    vs.isRecording = true;
    vs.recordBtn.disabled = true;
    vs.stopBtn.disabled = false;
    vs.playBtn.disabled = true;
    vs.recIndicator.classList.remove('hidden');
    vs.video.controls = false;
    vs.video.muted = true;
    startRecFlash(vs);

    // SYNC: Play music at the same time as video recording
    if (audio) {
      audio.currentTime = 0;
      audio.play();
    }
  } catch (err) {
    alert("Webcam access denied or error: " + err.message);
    vs.recordBtn.disabled = false;
    vs.stopBtn.disabled = true;
    vs.playBtn.disabled = true;
    stopRecFlash(vs);
    vs.recIndicator.classList.add('hidden');
  }
}
