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

// --- GIG AD SLOTS LOGIC ---
const GIG_AD_SLOTS = 6; // number of ad slots
const GIG_EMPTY_THUMB = `<div class="gig-empty-thumb" title="No ad yet">🎸</div>`;
const GIG_AD_DEFAULT_CLIENT = "Anonymous";
const DEMO_USER = "potential_client"; // Replace with login/account logic if you wish

// Simple browser memory for demo (reset on refresh). For real app, use backend!
let gigAdSlots = Array(GIG_AD_SLOTS).fill(null).map(() => ({
  videoUrl: null,
  client: null,
  locked: false,
  lockOwner: null,
  lockUntil: null,
  timestamp: null,
}));

function renderGigAdSlots() {
  const grid = document.getElementById("gigAdGrid");
  grid.innerHTML = "";
  gigAdSlots.forEach((slot, i) => {
    const slotDiv = document.createElement("div");
    slotDiv.className = "gig-ad-slot";
    // Video or empty thumb
    if (slot.videoUrl) {
      const v = document.createElement("video");
      v.src = slot.videoUrl;
      v.autoplay = true;
      v.loop = true;
      v.muted = true;
      v.playsInline = true;
      v.setAttribute("controls", false);
      v.className = "gig-ad-thumb";
      slotDiv.appendChild(v);
    } else {
      slotDiv.innerHTML += GIG_EMPTY_THUMB;
    }
    // Client info
    if (slot.client) {
      const client = document.createElement("div");
      client.className = "gig-ad-client";
      client.textContent = `Ad by: ${slot.client}`;
      slotDiv.appendChild(client);
    }
    // Timestamp
    if (slot.timestamp) {
      const ts = document.createElement("div");
      ts.className = "gig-ad-timestamp";
      ts.textContent = `Updated: ${slot.timestamp}`;
      slotDiv.appendChild(ts);
    }
    // Locked state
    if (slot.locked) {
      const lockMsg = document.createElement("div");
      lockMsg.className = "gig-ad-locked-msg";
      lockMsg.textContent = "🔒 Slot is locked!";
      slotDiv.appendChild(lockMsg);

      if (slot.lockOwner) {
        const owner = document.createElement("div");
        owner.className = "gig-lock-owner";
        owner.textContent = `Locked by: ${slot.lockOwner}`;
        slotDiv.appendChild(owner);
      }
      // If current user is the lock owner, show upload (replace) button
      if (slot.lockOwner === DEMO_USER) {
        slotDiv.appendChild(createGigAdUploadBtn(i, true));
      } else {
        // Not lock owner, disable upload
        const uploadBtn = createGigAdUploadBtn(i, false);
        uploadBtn.disabled = true;
        slotDiv.appendChild(uploadBtn);
      }
      // If not locked by this user, allow "Lock this slot" is hidden
    } else {
      // Not locked: anyone can upload/replace
      slotDiv.appendChild(createGigAdUploadBtn(i, true));
      // Show "Lock this slot" button
      const lockBtn = document.createElement("button");
      lockBtn.className = "gig-ad-lock-btn";
      lockBtn.textContent = "Lock this slot (Pay)";
      lockBtn.onclick = () => lockGigAdSlot(i);
      slotDiv.appendChild(lockBtn);
    }
    grid.appendChild(slotDiv);
  });
}

function createGigAdUploadBtn(slotIndex, enabled) {
  const label = document.createElement("label");
  label.className = "gig-ad-upload-btn";
  label.style.cursor = enabled ? "pointer" : "not-allowed";
  label.innerHTML = "Upload Ad Video";
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".mp4,.webm,.mov,.ogg,.mkv,video/*";
  input.style.display = "none";
  input.onchange = e => {
    if (!enabled) return;
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    // Update slot
    gigAdSlots[slotIndex].videoUrl = url;
    gigAdSlots[slotIndex].client = DEMO_USER;
    gigAdSlots[slotIndex].timestamp = new Date().toLocaleString();
    renderGigAdSlots();
  };
  label.appendChild(input);
  if (!enabled) label.disabled = true;
  label.onclick = enabled ? () => input.click() : (e) => e.preventDefault();
  return label;
}

function lockGigAdSlot(slotIndex) {
  // DEMO: Simulate payment with a confirm dialog
  if (confirm("To lock this ad slot and prevent others from replacing your ad, you must pay. Simulate payment now?")) {
    gigAdSlots[slotIndex].locked = true;
    gigAdSlots[slotIndex].lockOwner = DEMO_USER;
    gigAdSlots[slotIndex].lockUntil = null; // You can add expiration logic here
    renderGigAdSlots();
    alert("Slot locked! Only you can update this ad until you unlock or your exclusive period ends.");
  }
}

renderGigAdSlots();

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

// --- Main Video Recording Logic ---
const mainRecorderPreview = document.getElementById('mainRecorderPreview');
const mainRecorderRecordBtn = document.getElementById('mainRecorderRecordBtn');
const mainRecorderStopBtn = document.getElementById('mainRecorderStopBtn');
const mainRecorderDownloadBtn = document.getElementById('mainRecorderDownloadBtn');
const mainRecorderStatus = document.getElementById('mainRecorderStatus');

// Update instruction text dynamically in JS in case you want to change via script:
document.querySelector('.main-recorder-section h3').textContent = "after each take is recorded,click 'download' to save it to your computer-and don't forget to name your take";
document.querySelector('.take-instructions span').textContent = "after each take is recorded,click 'download' to save it to your computer—and don't forget to name your take";
document.querySelector('.switcher-upload-section h3').textContent = "easyly upload each take right here";

// No script needed for the email, since it's static in the HTML

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

  // Start music in sync
  audio.currentTime = 0;
  audio.play();

  // Record video + audio
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

// --- Rest of your code remains unchanged for switching and export ---

document.addEventListener('DOMContentLoaded', function() {
  // --- FastCut Switcher Logic ---
  const NUM_TRACKS = 6;
  const TRACK_NAMES = [
    "Video Track 1",
    "Video Track 2",
    "Video Track 3",
    "Video Track 4",
    "Video Track 5",
    "Video Track 6"
  ];
  // Render buttons in a single row
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
    btn.disabled = true; // Initially disabled
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

  // --- Upload Section ---
  const VIDEO_ACCEPTED = ".mp4,.webm,.mov,.ogg,.mkv,video/*";
  const switcherTracks = document.getElementById("switcherTracks");
  switcherTracks.innerHTML = Array(NUM_TRACKS).fill(0).map((_, i) => `
    <div class="switcher-track" id="switcher-track-${i}">
      <div class="track-title">${TRACK_NAMES[i]}</div>
      <video id="video-${i}" width="140" height="90" controls muted></video>
      <div>
        <label class="upload-video-label" for="uploadVideoInput-${i}">Upload Take</label>
        <input type="file" id="uploadVideoInput-${i}" class="upload-video-input" accept="${VIDEO_ACCEPTED}" style="display:none;">
        <button class="upload-video-btn" id="uploadVideoBtn-${i}">🎬 Upload Take</button>
      </div>
    </div>
  `).join("");

  // Store video elements and uploaded blob URLs
  const uploadedVideos = Array(NUM_TRACKS).fill(null);

  for (let i = 0; i < NUM_TRACKS; i++) {
    const uploadBtn = document.getElementById(`uploadVideoBtn-${i}`);
    const uploadInput = document.getElementById(`uploadVideoInput-${i}`);
    const video = document.getElementById(`video-${i}`);
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
      setTimeout(() => uploadBtn.textContent = "🎬 Upload Take", 3000);
      checkAllTakesUploaded();
    };
  }

  // --- Switching/Recording Logic ---
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

  // Always allow start button (for testing) but show error if takes missing.
  startSwitchingBtn.disabled = false;
  stopSwitchingBtn.disabled = true;

  function checkAllTakesUploaded() {
    // Optional: Enable startSwitchingBtn only when all uploaded
    // let allUploaded = uploadedVideos.every(v => !!v);
    // startSwitchingBtn.disabled = !allUploaded;
    setupSwitcherTracks();
  }

  function setupSwitcherTracks() {
    for (let i = 0; i < NUM_TRACKS; i++) {
      const v = document.getElementById(`video-${i}`);
      v.pause();
      v.currentTime = 0;
    }
  }

  function recordSwitch(timeMs, trackIdx) {
    if (switchingTimeline.length === 0 && timeMs > 100) return;
    if (switchingTimeline.length > 0 && switchingTimeline[switchingTimeline.length-1].track === trackIdx) return;
    switchingTimeline.push({ time: timeMs, track: trackIdx });
  }

  // --- Key logic update: combine audio and video stream for recording! ---
  startSwitchingBtn.onclick = () => {
    switchingError.textContent = '';
    // Check if all takes are uploaded
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
    // Play main audio in sync (NEW: play when switching starts)
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

    // --- NEW: Get both video and audio streams and combine ---
    const videoStream = mixCanvas.captureStream(30);

    // Try to get an audio stream from the <audio> element (music track)
    let audioStream = null;
    if (audio.captureStream) {
      audioStream = audio.captureStream();
    } else if (audio.mozCaptureStream) {
      audioStream = audio.mozCaptureStream();
    }

    // Combine video and audio tracks into a single MediaStream
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
      // Set volume after new src loaded
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

    // Use srcObject for live preview, but don't accidentally play audio twice
    masterOutputVideo.srcObject = combinedStream;
    masterOutputVideo.muted = true; // Prevent echo/feedback during live recording
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
      if (v && !v.paused && !v.ended) {
        const ctx = mixCanvas.getContext('2d');
        ctx.fillStyle = "#111";
        ctx.fillRect(0, 0, mixCanvas.width, mixCanvas.height);
        ctx.drawImage(v, 0, 0, mixCanvas.width, mixCanvas.height);
      } else {
        const ctx = mixCanvas.getContext('2d');
        ctx.fillStyle = "#111";
        ctx.fillRect(0, 0, mixCanvas.width, mixCanvas.height);
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
    fastcutBtns.forEach(btn => btn.disabled = true);
    audio.pause();
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    if (drawRequestId !== null) cancelAnimationFrame(drawRequestId);
    drawRequestId = null;
    exportStatus.textContent = "Rendering and export complete! Download below.";
  };

  // On load, disable all switching controls until videos are uploaded
  // Buttons are enabled/disabled in logic above.

  // Ensure main output video is unmuted for built-in speaker icon on page load
  masterOutputVideo.muted = false;

  // --- Export Music Video Button Logic ---
  const exportMusicVideoBtn = document.getElementById('exportMusicVideoBtn');
  exportMusicVideoBtn.onclick = function() {
    // Try to get the current src of the master output video
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
    // Download the video as "fastcut_music_video.webm"
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
