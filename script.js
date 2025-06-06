// --- FASTCUT MUSIC VIDEO PLATFORM (NO AD SYSTEM) ---
// --- Animate Members Counter ---
function animateMembersCounter() {
  const el = document.getElementById('membersCountNumber');
  let n = 15347, up = true;
  setInterval(() => {
    if (Math.random() > 0.5) n += up ? 1 : -1;
    if (n < 15320) up = true;
    if (n > 15360) up = false;
    el.textContent = n.toLocaleString();
  }, 1200);
}
animateMembersCounter();

// --- Audio Track Input (accepts most popular formats) ---
const AUDIO_ACCEPTED = ".mp3,.wav,.ogg,.m4a,.aac,.flac,.aiff,audio/*";
document.getElementById('songInput').setAttribute('accept', AUDIO_ACCEPTED);

const audio = document.getElementById('audio');
const audioStatus = document.getElementById('audioStatus');
let masterAudioFile = null;

document.getElementById('songInput').onchange = e => {
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

// --- Main Webcam Video Recording Logic (master take) ---
const mainRecorderPreview = document.getElementById('mainRecorderPreview');
const mainRecorderRecordBtn = document.getElementById('mainRecorderRecordBtn');
const mainRecorderStopBtn = document.getElementById('mainRecorderStopBtn');
const mainRecorderDownloadBtn = document.getElementById('mainRecorderDownloadBtn');
const mainRecorderStatus = document.getElementById('mainRecorderStatus');

let mainRecorderStream = null;
let mainRecorderMediaRecorder = null;
let mainRecorderChunks = [];
let mainRecorderBlobURL = null;

mainRecorderRecordBtn.onclick = async () => {
  if (!masterAudioFile) {
    mainRecorderStatus.textContent = "Please upload an audio track first!";
    return;
  }
  mainRecorderRecordBtn.disabled = true;
  mainRecorderStopBtn.disabled = false;
  mainRecorderDownloadBtn.disabled = true;
  mainRecorderStatus.textContent = "Recording...";

  mainRecorderChunks = [];
  try {
    mainRecorderStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  } catch (err) {
    mainRecorderStatus.textContent = "Camera or microphone access denied.";
    mainRecorderRecordBtn.disabled = false;
    mainRecorderStopBtn.disabled = true;
    return;
  }
  mainRecorderPreview.srcObject = mainRecorderStream;
  mainRecorderPreview.muted = true;
  mainRecorderPreview.controls = false;

  audio.currentTime = 0;
  audio.play();

  mainRecorderMediaRecorder = new MediaRecorder(mainRecorderStream, { mimeType: "video/webm" });
  mainRecorderMediaRecorder.ondataavailable = e => { if (e.data.size > 0) mainRecorderChunks.push(e.data); };
  mainRecorderMediaRecorder.onstop = () => {
    if (mainRecorderPreview.srcObject) {
      mainRecorderPreview.srcObject.getTracks().forEach(track => track.stop());
      mainRecorderPreview.srcObject = null;
    }
    const blob = new Blob(mainRecorderChunks, { type: "video/webm" });
    if (mainRecorderBlobURL) URL.revokeObjectURL(mainRecorderBlobURL);
    mainRecorderBlobURL = URL.createObjectURL(blob);
    mainRecorderPreview.src = mainRecorderBlobURL;
    mainRecorderPreview.controls = true;
    mainRecorderPreview.muted = false;
    mainRecorderPreview.load();
    mainRecorderDownloadBtn.disabled = false;
    mainRecorderStatus.textContent = "Recording complete! Download your take.";
  };
  mainRecorderMediaRecorder.start();
};

mainRecorderStopBtn.onclick = () => {
  if (mainRecorderMediaRecorder && mainRecorderMediaRecorder.state !== "inactive") {
    mainRecorderMediaRecorder.stop();
  }
  mainRecorderRecordBtn.disabled = false;
  mainRecorderStopBtn.disabled = true;
  audio.pause();
  audio.currentTime = 0;
};

mainRecorderDownloadBtn.onclick = () => {
  if (!mainRecorderBlobURL) return;
  const a = document.createElement('a');
  a.href = mainRecorderBlobURL;
  a.download = `fastcut_take_${Date.now()}.webm`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  mainRecorderStatus.textContent = "Take downloaded. Repeat or upload it as a take below!";
};

// --- FastCut 6-Track Upload/Preview Section & Main Switcher Logic ---
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

  // --- 6-track Upload/Preview Grid ---
  const switcherTracks = document.getElementById("switcherTracks");
  switcherTracks.innerHTML = Array(NUM_TRACKS).fill(0).map((_, i) => `
    <div class="switcher-track" id="switcher-track-${i}">
      <div class="track-title">${TRACK_NAMES[i]}</div>
      <video id="video-${i}" width="140" height="90" controls muted></video>
      <div>
        <label class="upload-video-label" for="uploadVideoInput-${i}">Upload Take</label>
        <input type="file" id="uploadVideoInput-${i}" class="upload-video-input" accept=".mp4,.webm,.mov,.ogg,.mkv,video/*" style="display:none;">
        <button class="upload-video-btn" id="uploadVideoBtn-${i}">🎬 Upload Take</button>
      </div>
      <button class="download-track-btn" id="downloadTrackBtn-${i}" style="display:none;margin-top:6px;">⬇️ Download Take</button>
    </div>
  `).join("");

  const uploadedVideos = Array(NUM_TRACKS).fill(null);
  const uploadedVideoFiles = Array(NUM_TRACKS).fill(null);

  for (let i = 0; i < NUM_TRACKS; i++) {
    const uploadBtn = document.getElementById(`uploadVideoBtn-${i}`);
    const uploadInput = document.getElementById(`uploadVideoInput-${i}`);
    const video = document.getElementById(`video-${i}`);
    const downloadBtn = document.getElementById(`downloadTrackBtn-${i}`);
    uploadBtn.onclick = () => uploadInput.click();
    uploadInput.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      video.src = url;
      video.controls = true;
      video.muted = false;
      video.load();
      uploadBtn.textContent = "🎬 Uploaded!";
      uploadedVideos[i] = url;
      uploadedVideoFiles[i] = file;
      downloadBtn.style.display = "inline-block";
      setTimeout(() => uploadBtn.textContent = "🎬 Upload Take", 3000);
    };
    downloadBtn.onclick = () => {
      if (!uploadedVideoFiles[i]) return;
      const a = document.createElement('a');
      a.href = uploadedVideos[i];
      a.download = `fastcut_take${i+1}_${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };
  }

  // --- Switcher Buttons ---
  const fastcutSwitcher = document.getElementById('fastcutSwitcher');
  fastcutSwitcher.innerHTML = Array(NUM_TRACKS).fill(0).map((_, i) =>
    `<button class="fastcut-btn" id="fastcutBtn-${i}">${TRACK_NAMES[i]}</button>`
  ).join('');

  let activeTrack = 0;
  const fastcutBtns = [];
  for (let i = 0; i < NUM_TRACKS; i++) {
    const btn = document.getElementById(`fastcutBtn-${i}`);
    fastcutBtns.push(btn);
    btn.onclick = () => {
      if (!isSwitching) return;
      setActiveTrack(i);
      if (isSwitching) {
        recordSwitch(Date.now() - switchingStartTime, i);
      }
    };
    btn.disabled = true;
  }
  function setActiveTrack(idx) {
    activeTrack = idx;
    const tracks = document.querySelectorAll('.switcher-track');
    if (tracks.length === NUM_TRACKS) {
      tracks.forEach((el, j) =>
        el.classList.toggle('active', j === idx)
      );
    }
    fastcutBtns.forEach((btn, j) =>
      btn.classList.toggle('active', j === idx)
    );
  }
  setActiveTrack(0);

  // --- Switcher/Export Logic ---
  const startSwitchingBtn = document.getElementById('startSwitchingBtn');
  const stopSwitchingBtn = document.getElementById('stopSwitchingBtn');
  const masterOutputVideo = document.getElementById('masterOutputVideo');
  const exportStatus = document.getElementById('exportStatus');
  const mixCanvas = document.getElementById('mixCanvas');
  const switchingError = document.getElementById('switchingError');
  let isSwitching = false;
  let mixing = false, mediaRecorder = null, masterChunks = [];
  let drawRequestId = null;
  let livePlaybackUrl = null;
  let switchingStartTime = 0;
  let switchingTimeline = [];

  startSwitchingBtn.disabled = false;
  stopSwitchingBtn.disabled = true;

  function recordSwitch(timeMs, trackIdx) {
    if (switchingTimeline.length === 0 && timeMs > 100) return;
    if (switchingTimeline.length > 0 && switchingTimeline[switchingTimeline.length-1].track === trackIdx) return;
    switchingTimeline.push({ time: timeMs, track: trackIdx });
  }

  startSwitchingBtn.onclick = () => {
    switchingError.textContent = '';
    const allUploaded = uploadedVideos.every(v => !!v);
    if (!allUploaded) {
      switchingError.textContent = "Please upload all 6 video takes before starting switching!";
      return;
    }
    exportStatus.textContent = "";
    for (let i = 0; i < NUM_TRACKS; i++) {
      const v = document.getElementById(`video-${i}`);
      v.currentTime = 0;
      v.pause();
    }
    for (let i = 0; i < NUM_TRACKS; i++) {
      const v = document.getElementById(`video-${i}`);
      v.currentTime = 0;
      v.muted = true;
      v.play();
    }
    audio.currentTime = 0;
    audio.play();

    switchingTimeline = [{ time: 0, track: activeTrack }];
    switchingStartTime = Date.now();
    isSwitching = true;
    startSwitchingBtn.disabled = true;
    stopSwitchingBtn.disabled = false;
    fastcutBtns.forEach(btn => btn.disabled = false);

    const ctx = mixCanvas.getContext('2d');
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, mixCanvas.width, mixCanvas.height);

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
      exportStatus.textContent = "Warning: Audio captureStream not supported in your browser. Output will be silent.";
    }

    masterChunks = [];
    mediaRecorder = new MediaRecorder(combinedStream, { mimeType: "video/webm" });
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) masterChunks.push(e.data); };
    mediaRecorder.onstop = () => {
      masterOutputVideo.srcObject = null;
      if(livePlaybackUrl) {
        URL.revokeObjectURL(livePlaybackUrl);
        livePlaybackUrl = null;
      }
      const blob = new Blob(masterChunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      masterOutputVideo.src = url;
      masterOutputVideo.load();
      masterOutputVideo.muted = false;
      livePlaybackUrl = url;
      exportStatus.textContent = "Export complete! Download your final video.";
      const a = document.createElement('a');
      a.href = url;
      a.download = `fastcut_music_video.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };

    mixing = true;
    let duration = 0;
    const refVideo = document.getElementById('video-0');
    if (refVideo && !isNaN(refVideo.duration)) duration = refVideo.duration;
    else duration = 180;

    masterOutputVideo.srcObject = combinedStream;
    masterOutputVideo.muted = true;
    masterOutputVideo.play();
    audio.currentTime = 0;
    audio.play();
    mediaRecorder.start();

    function draw() {
      if (!mixing) return;
      let elapsed = Date.now() - switchingStartTime;
      let track = switchingTimeline[0].track;
      for (let i = 0; i < switchingTimeline.length; i++) {
        if (switchingTimeline[i].time <= elapsed) {
          track = switchingTimeline[i].track;
        } else {
          break;
        }
      }
      const v = document.getElementById(`video-${track}`);
      const ctx = mixCanvas.getContext('2d');
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, mixCanvas.width, mixCanvas.height);
      if (v && !v.paused && !v.ended) {
        ctx.drawImage(v, 0, 0, mixCanvas.width, mixCanvas.height);
      }
      if ((Date.now() - switchingStartTime)/1000 < duration && mixing && isSwitching) {
        drawRequestId = requestAnimationFrame(draw);
      }
    }
    draw();
  };

  stopSwitchingBtn.onclick = () => {
    if (!isSwitching) return;
    mixing = false;
    isSwitching = false;
    startSwitchingBtn.disabled = false;
    stopSwitchingBtn.disabled = true;
    audio.pause();
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    if (drawRequestId !== null) cancelAnimationFrame(drawRequestId);
    drawRequestId = null;
    exportStatus.textContent = "Rendering and export complete! Download below.";
  };

  masterOutputVideo.muted = false;

  const exportMusicVideoBtn = document.getElementById('exportMusicVideoBtn');
  exportMusicVideoBtn.onclick = function() {
    let videoUrl = masterOutputVideo.src;
    if (!videoUrl || videoUrl === window.location.href) {
      exportStatus.textContent = "No exported video available to download yet!";
      exportMusicVideoBtn.disabled = true;
      setTimeout(() => {
        exportMusicVideoBtn.disabled = false;
        exportStatus.textContent = "";
      }, 1600);
      return;
    }
    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = "fastcut_music_video.webm";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    exportStatus.textContent = "Music video exported and downloaded!";
    exportMusicVideoBtn.disabled = true;
    setTimeout(() => {
      exportMusicVideoBtn.disabled = false;
      exportStatus.textContent = "";
    }, 1800);
  };
});
