// FASTCUT by Bernardo Garcia - BEAUTIFUL UI, RECORD & DOWNLOAD TRACKS, STOP PREVIEW BUTTON

const AUDIO_ACCEPTED = ".mp3,.wav,.ogg,.m4a,.aac,.flac,.aiff,audio/*";
const songInput = document.getElementById('songInput');
if (songInput) songInput.setAttribute('accept', AUDIO_ACCEPTED);

const audio = document.getElementById('audio');
const audioStatus = document.getElementById('audioStatus');
let masterAudioFile = null;

if (songInput) {
  songInput.onchange = e => {
    const file = e.target.files[0];
    masterAudioFile = file;
    if (file) {
      audio.src = URL.createObjectURL(file);
      audio.style.display = 'block';
      audio.load();
      audioStatus.textContent = `Audio loaded: ${file.name}`;
    } else {
      audio.style.display = 'none';
      audioStatus.textContent = "";
    }
  };
}

document.addEventListener('DOMContentLoaded', function() {
  const NUM_TRACKS = 6;
  const TRACK_NAMES = [
    "Video Track 1",
    "Video Track 2",
    "Video Track 3",
    "Video Track 4",
    "Video Track 5",
    "Video Track 6"
  ];
  const switcherTracks = document.getElementById("switcherTracks");
  const uploadedVideos = Array(NUM_TRACKS).fill(null);
  const recordedBlobs = Array(NUM_TRACKS).fill(null);
  const recordingStates = Array(NUM_TRACKS).fill(false);
  const recorders = Array(NUM_TRACKS).fill(null);
  const tempStreams = Array(NUM_TRACKS).fill(null);
  const tempVideoURLs = Array(NUM_TRACKS).fill(null);

  // Build the UI for each track
  if (switcherTracks) {
    switcherTracks.innerHTML = Array(NUM_TRACKS).fill(0).map((_, i) => `
      <div class="switcher-track" id="switcher-track-${i}">
        <div class="track-title">${TRACK_NAMES[i]}</div>
        <video id="video-${i}" width="220" height="140" controls preload="auto" muted></video>
        <div class="track-btns">
          <button class="upload-video-btn" id="uploadVideoBtn-${i}">Upload</button>
          <input type="file" id="uploadVideoInput-${i}" class="upload-video-input" accept=".mp4,.webm,.mov,.ogg,.mkv,video/*" style="display:none;">
          <button class="record-take-btn" id="recordTakeBtn-${i}">Record Take</button>
          <button class="download-take-btn" id="downloadTakeBtn-${i}">Download Take</button>
        </div>
      </div>
    `).join("");
  }

  for (let i = 0; i < NUM_TRACKS; i++) {
    // Upload button logic
    const uploadBtn = document.getElementById(`uploadVideoBtn-${i}`);
    const uploadInput = document.getElementById(`uploadVideoInput-${i}`);
    const video = document.getElementById(`video-${i}`);
    if (uploadBtn && uploadInput && video) {
      uploadBtn.onclick = () => uploadInput.click();
      uploadInput.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        video.src = url;
        video.controls = true;
        video.muted = false;
        video.load();
        uploadedVideos[i] = url;
        tempVideoURLs[i] = url;
        uploadBtn.textContent = "Uploaded!";
        setTimeout(() => uploadBtn.textContent = "Upload", 2000);
      };
    }

    // RECORD TAKE
    const recordBtn = document.getElementById(`recordTakeBtn-${i}`);
    if (recordBtn && video) {
      recordBtn.onclick = async () => {
        if (!recordingStates[i]) {
          // Start recording
          recordBtn.textContent = "Stop";
          recordingStates[i] = true;
          if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
              const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
              tempStreams[i] = stream;
              video.srcObject = stream;
              video.muted = true;
              video.play();
              recordedBlobs[i] = [];
              const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
              recorders[i] = recorder;
              recorder.ondataavailable = e => { if (e.data.size > 0) recordedBlobs[i].push(e.data); };
              recorder.onstop = () => {
                // Stop webcam
                video.srcObject = null;
                stream.getTracks().forEach(track => track.stop());
                const blob = new Blob(recordedBlobs[i], { type: "video/webm" });
                const url = URL.createObjectURL(blob);
                video.src = url;
                video.controls = true;
                video.muted = false;
                video.load();
                uploadedVideos[i] = url;
                tempVideoURLs[i] = url;
                recordBtn.textContent = "Record Take";
              };
              recorder.start();
            } catch (err) {
              alert("Camera/mic access denied or unavailable.");
              recordBtn.textContent = "Record Take";
              recordingStates[i] = false;
            }
          }
        } else {
          // Stop recording
          if (recorders[i]) {
            recorders[i].stop();
            recorders[i] = null;
            recordingStates[i] = false;
          }
        }
      };
    }

    // DOWNLOAD TAKE
    const downloadBtn = document.getElementById(`downloadTakeBtn-${i}`);
    if (downloadBtn && video) {
      downloadBtn.onclick = () => {
        let blob = null;
        // Prefer download of recorded take if available, else uploaded video blob
        if (recordedBlobs[i] && recordedBlobs[i].length > 0) {
          blob = new Blob(recordedBlobs[i], { type: "video/webm" });
        } else if (video.src && !video.src.startsWith("blob:")) {
          // For uploaded file, fetch and re-blob it
          fetch(video.src)
            .then(resp => resp.blob())
            .then(_blob => {
              saveBlob(_blob, `FastCut_Take${i+1}.webm`);
            });
          return;
        } else if (video.src && video.src.startsWith("blob:")) {
          // For blob url, just download
          fetch(video.src)
            .then(resp => resp.blob())
            .then(_blob => {
              saveBlob(_blob, `FastCut_Take${i+1}.webm`);
            });
          return;
        }
        if (blob) {
          saveBlob(blob, `FastCut_Take${i+1}.webm`);
        } else {
          alert("No take available to download.");
        }
      };
    }
  }

  function saveBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = "none";
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);
  }

  // === MASTER EDITOR ===

  const recordBtn = document.getElementById('recordFullEditBtn');
  const previewBtn = document.getElementById('previewFullEditBtn');
  const stopPreviewBtn = document.getElementById('stopPreviewBtn');
  const exportStatus = document.getElementById('exportStatus');
  const exportMusicVideoBtn = document.getElementById('exportMusicVideoBtn');
  const masterOutputVideo = document.getElementById('masterOutputVideo');
  const switcherBtnsContainer = document.getElementById('switcherBtnsContainer');
  const mixCanvas = document.getElementById('mixCanvas');
  const previewVideo = document.getElementById('previewVideo');

  let isRecording = false;
  let switchTimeline = [];
  let currentTrack = 0;
  let recordedBlob = null;
  let recordedUrl = null;
  let mediaRecorder = null;
  let chunks = [];
  let drawRequestId = null;
  let fullPreviewCleanup = null;
  let lastSync = Array(NUM_TRACKS).fill(0); // for anti-strobe

  function renderSwitcherBtns() {
    if (!switcherBtnsContainer) return;
    switcherBtnsContainer.innerHTML = '';
    for (let i = 0; i < NUM_TRACKS; i++) {
      const btn = document.createElement('button');
      btn.className = 'switch-btn' + (i === currentTrack ? ' active' : '');
      btn.textContent = `Cam ${i+1}`;
      btn.disabled = isRecording ? false : !uploadedVideos[i];
      btn.onclick = () => {
        setActiveTrack(i);
        if (isRecording) {
          recordSwitch(audio.currentTime * 1000, i);
        } else {
          previewTrackInCanvas(i);
        }
      };
      switcherBtnsContainer.appendChild(btn);
    }
  }
  function setActiveTrack(idx) {
    currentTrack = idx;
    renderSwitcherBtns();
  }
  function recordSwitch(timeMs, trackIdx) {
    if (switchTimeline.length > 0 && switchTimeline[switchTimeline.length-1].track === trackIdx) return;
    switchTimeline.push({ time: timeMs, track: trackIdx });
  }

  if (recordBtn) recordBtn.onclick = function() {
    if (uploadedVideos.some(v => !v)) {
      if (exportStatus) exportStatus.textContent = "Please upload or record all 6 takes before recording!";
      return;
    }
    if (!audio.src || audio.src === "") {
      if (exportStatus) exportStatus.textContent = "Please upload your song file before recording!";
      return;
    }
    switchTimeline = [{ time: 0, track: currentTrack }];
    isRecording = true;
    renderSwitcherBtns();

    for (let i = 0; i < NUM_TRACKS; i++) {
      let v = document.getElementById(`video-${i}`);
      if (v) {
        v.currentTime = 0;
        v.muted = true;
        v.play();
      }
    }
    audio.currentTime = 0;
    audio.play();

    if (mixCanvas) mixCanvas.style.display = '';
    if (previewVideo) previewVideo.style.display = 'none';
    if (typeof fullPreviewCleanup === "function") fullPreviewCleanup();

    const ctx = mixCanvas.getContext('2d');
    ctx.fillStyle = "#111";
    ctx.fillRect(0,0,mixCanvas.width,mixCanvas.height);

    const videoStream = mixCanvas.captureStream(30);
    let audioStream = null;
    if (audio.captureStream) {
      audioStream = audio.captureStream();
    } else if (audio.mozCaptureStream) {
      audioStream = audio.mozCaptureStream();
    }
    let combinedStream;
    if (audioStream) {
      combinedStream = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...audioStream.getAudioTracks()
      ]);
    } else {
      combinedStream = videoStream;
    }

    chunks = [];
    mediaRecorder = new MediaRecorder(combinedStream, { mimeType: "video/webm" });
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    mediaRecorder.onstop = () => {
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      recordedBlob = new Blob(chunks, { type: "video/webm" });
      recordedUrl = URL.createObjectURL(recordedBlob);
      if (previewVideo) {
        previewVideo.src = recordedUrl;
        previewVideo.load();
        previewVideo.style.display = '';
      }
      if (mixCanvas) mixCanvas.style.display = 'none';
      isRecording = false;
      renderSwitcherBtns();
      if (exportStatus) exportStatus.textContent = "Recording complete! Preview or export your music video.";
    };
    mediaRecorder.start();

    function draw() {
      if (!isRecording) return;
      let elapsed = audio.currentTime * 1000;
      let track = switchTimeline[0].track;
      for (let i = 0; i < switchTimeline.length; i++) {
        if (switchTimeline[i].time <= elapsed) {
          track = switchTimeline[i].track;
        } else {
          break;
        }
      }
      const v = document.getElementById(`video-${track}`);
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, mixCanvas.width, mixCanvas.height);

      if (v && v.readyState >= 2 && !v.paused && !v.ended) {
        let drift = v.currentTime - audio.currentTime;
        let now = performance.now();
        if (Math.abs(drift) > 0.25 && now - lastSync[track] > 1000) {
          v.currentTime = audio.currentTime;
          v.play();
          lastSync[track] = now;
        }
        ctx.drawImage(v, 0, 0, mixCanvas.width, mixCanvas.height);
      } else {
        ctx.fillStyle = "#222";
        ctx.fillRect(0, 0, mixCanvas.width, mixCanvas.height);
      }
      if (audio.currentTime >= audio.duration || !isRecording) {
        stopFullRecording();
        return;
      }
      drawRequestId = requestAnimationFrame(draw);
    }
    draw();
    if (exportStatus) exportStatus.textContent = "Recording full edit. Use the switcher to change cameras in real time.";
  };

  function stopFullRecording() {
    if (!isRecording) return;
    isRecording = false;
    audio.pause();
    for (let i = 0; i < NUM_TRACKS; i++) {
      let v = document.getElementById(`video-${i}`);
      if (v) v.pause();
    }
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    if (drawRequestId !== null) cancelAnimationFrame(drawRequestId);
    drawRequestId = null;
  }

  if (previewBtn) previewBtn.onclick = function() {
    if (!previewVideo) return;
    previewVideo.style.display = '';
    if (mixCanvas) mixCanvas.style.display = 'none';
    if (!recordedUrl) {
      if (exportStatus) exportStatus.textContent = "Nothing to preview yet. Please record first.";
      return;
    }
    if (typeof fullPreviewCleanup === "function") fullPreviewCleanup();

    let v = previewVideo;
    let pa = audio.cloneNode(true);
    pa.currentTime = 0;
    pa.volume = 1;
    pa.style.display = "none";
    pa.muted = false;
    document.body.appendChild(pa);

    let stopped = false;
    v.src = recordedUrl;
    v.currentTime = 0;
    v.muted = true;
    v.load();

    let syncRAF;
    function sync() {
      if (stopped) return;
      if (Math.abs(pa.currentTime - v.currentTime) > 0.04) {
        pa.currentTime = v.currentTime;
      }
      if (v.ended || pa.ended) {
        stopped = true;
        pa.pause();
        return;
      }
      syncRAF = requestAnimationFrame(sync);
    }

    v.oncanplay = function() {
      v.play();
      pa.currentTime = 0;
      pa.play();
      syncRAF = requestAnimationFrame(sync);
    };

    function cleanupPreview() {
      stopped = true;
      pa.pause();
      if (pa && pa.parentNode) pa.parentNode.removeChild(pa);
      if (syncRAF) cancelAnimationFrame(syncRAF);
      v.oncanplay = null;
    }
    fullPreviewCleanup = cleanupPreview;
    if (exportStatus) exportStatus.textContent = "Previewing your full music video edit.";
  };

  // STOP PREVIEW BUTTON LOGIC
  if (stopPreviewBtn) stopPreviewBtn.onclick = function() {
    if (typeof fullPreviewCleanup === "function") {
      fullPreviewCleanup();
    }
    if (previewVideo) {
      previewVideo.pause();
      previewVideo.currentTime = 0;
      previewVideo.style.display = 'none';
    }
    if (exportStatus) exportStatus.textContent = "Preview stopped.";
  };

  if (exportMusicVideoBtn) exportMusicVideoBtn.onclick = async function() {
    if (!recordedBlob) {
      if (exportStatus) exportStatus.textContent = "Please record your edit first!";
      return;
    }
    if (exportStatus) exportStatus.textContent = "Exporting video file...";
    if (masterOutputVideo) {
      masterOutputVideo.src = recordedUrl;
      masterOutputVideo.load();
      masterOutputVideo.muted = false;
      masterOutputVideo.style.display = '';
    }
    if (exportStatus) exportStatus.textContent = "Export complete! Download your final video.";
    const a = document.createElement('a');
    a.href = recordedUrl;
    a.download = `fastcut_music_video.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  function previewTrackInCanvas(trackIdx) {
    if (!mixCanvas) return;
    mixCanvas.style.display = '';
    if (previewVideo) previewVideo.style.display = 'none';
    if (typeof fullPreviewCleanup === "function") fullPreviewCleanup();
    const ctx = mixCanvas.getContext('2d');
    const v = document.getElementById(`video-${trackIdx}`);
    if (v && v.readyState >= 2) {
      v.currentTime = 0;
      v.pause();
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, mixCanvas.width, mixCanvas.height);
      ctx.drawImage(v, 0, 0, mixCanvas.width, mixCanvas.height);
    } else {
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, mixCanvas.width, mixCanvas.height);
      ctx.fillStyle = "#ffe87d";
      ctx.font = "24px sans-serif";
      ctx.fillText("Load & play a video", 40, 140);
    }
  }

  renderSwitcherBtns();
});
