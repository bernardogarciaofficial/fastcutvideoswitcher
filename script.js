// FASTCUT MUSIC VIDEO SWITCHER - MODERN SCRIPT (with Firebase)

// --- FIREBASE CONFIG ---
const firebaseConfig = {
  apiKey: "AIzaSyBUqDO2yJdpXkZjbt3dWjTcjT2ZojpXOYo",
  authDomain: "fastcut-music-video-switcher.firebaseapp.com",
  projectId: "fastcut-music-video-switcher",
  storageBucket: "fastcut-music-video-switcher.appspot.com",
  messagingSenderId: "965905432625",
  appId: "1:965905432625:web:ae8d92cf20d36118471510",
  measurementId: "G-3DKDEMQCBR"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();

// --- MEMBERS COUNTER ANIMATION ---
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

// --- GIG AD LOGIC ---
const MAIN_AD_SLOTS = 6, SIDEBAR_AD_SLOTS = 2, SPREAD_AD_BELOW_MASTER = 2, FOOTER_AD_SLOTS = 2, DEMO_USER = "potential_client";
let gigAdSlots = Array(MAIN_AD_SLOTS).fill(null).map(() => ({ videoUrl: null, client: null, locked: false, lockOwner: null, lockUntil: null, timestamp: null, spread: false, promotedAdIndex: null }));
let sidebarAdSlots = Array(SIDEBAR_AD_SLOTS).fill(null).map(() => ({ spread: false, promotedAdIndex: null }));
let spreadAdSlotsBelow = Array(SPREAD_AD_BELOW_MASTER).fill(null).map(() => ({ spread: false, promotedAdIndex: null }));
let footerAdSlots = Array(FOOTER_AD_SLOTS).fill(null).map(() => ({ spread: false, promotedAdIndex: null }));

function getAllSpreadSlots() {
  return [
    { arr: sidebarAdSlots, render: renderSidebarAdSlots, key: "sidebar" },
    { arr: spreadAdSlotsBelow, render: renderSpreadAdSlotsBelow, key: "below" },
    { arr: footerAdSlots, render: renderFooterAdSlots, key: "footer" }
  ];
}
async function saveAllAdSlotsToFirebase() {
  await db.collection("ads").doc("main").set({ slots: gigAdSlots });
  await db.collection("ads").doc("sidebar").set({ slots: sidebarAdSlots });
  await db.collection("ads").doc("below").set({ slots: spreadAdSlotsBelow });
  await db.collection("ads").doc("footer").set({ slots: footerAdSlots });
}
async function loadAllAdSlotsFromFirebase() {
  const mainDoc = await db.collection("ads").doc("main").get();
  if (mainDoc.exists && mainDoc.data().slots) gigAdSlots = mainDoc.data().slots;
  const sidebarDoc = await db.collection("ads").doc("sidebar").get();
  if (sidebarDoc.exists && sidebarDoc.data().slots) sidebarAdSlots = sidebarDoc.data().slots;
  const belowDoc = await db.collection("ads").doc("below").get();
  if (belowDoc.exists && belowDoc.data().slots) spreadAdSlotsBelow = belowDoc.data().slots;
  const footerDoc = await db.collection("ads").doc("footer").get();
  if (footerDoc.exists && footerDoc.data().slots) footerAdSlots = footerDoc.data().slots;
  renderAllAdSlots();
}
function subscribeToAdSlots() {
  db.collection("ads").doc("main").onSnapshot(doc => {
    if (doc.exists && doc.data().slots) { gigAdSlots = doc.data().slots; renderGigAdSlots(); }
  });
  db.collection("ads").doc("sidebar").onSnapshot(doc => {
    if (doc.exists && doc.data().slots) { sidebarAdSlots = doc.data().slots; renderSidebarAdSlots(); }
  });
  db.collection("ads").doc("below").onSnapshot(doc => {
    if (doc.exists && doc.data().slots) { spreadAdSlotsBelow = doc.data().slots; renderSpreadAdSlotsBelow(); }
  });
  db.collection("ads").doc("footer").onSnapshot(doc => {
    if (doc.exists && doc.data().slots) { footerAdSlots = doc.data().slots; renderFooterAdSlots(); }
  });
}
function renderGigAdSlots() {
  const grid = document.getElementById("gigAdGrid");
  grid.innerHTML = "";
  let anyAd = false;
  gigAdSlots.forEach((slot, i) => {
    if (slot.videoUrl && /^https?:\/\//.test(slot.videoUrl)) anyAd = true;
    grid.appendChild(renderSingleAdSlot(slot, i, "main"));
  });
  // Show demo note if NO ads exist
  const demoNote = document.getElementById("gigAdDemoNote");
  if (demoNote) demoNote.style.display = anyAd ? "none" : "block";
}
function renderSidebarAdSlots() {
  const sidebar = document.getElementById("sidebarAdSlots");
  sidebar.innerHTML = "";
  sidebarAdSlots.forEach((slot, i) => sidebar.appendChild(renderSingleAdSlot(getPromotedSlotData(slot), i, "sidebar", slot.spread)));
}
function renderSpreadAdSlotsBelow() {
  const below = document.getElementById("spreadAdSlotsBelow");
  below.innerHTML = "";
  spreadAdSlotsBelow.forEach((slot, i) => below.appendChild(renderSingleAdSlot(getPromotedSlotData(slot), i, "spread", slot.spread)));
}
function renderFooterAdSlots() {
  const footer = document.getElementById("footerAdSlots");
  footer.innerHTML = "";
  footerAdSlots.forEach((slot, i) => footer.appendChild(renderSingleAdSlot(getPromotedSlotData(slot), i, "footer", slot.spread)));
}
function getPromotedSlotData(slot) {
  if (!slot.spread || slot.promotedAdIndex == null || !gigAdSlots[slot.promotedAdIndex]) return { videoUrl: null, client: null, promoted: false, locked: false };
  return { ...gigAdSlots[slot.promotedAdIndex], spread: true, promoted: true };
}
function renderSingleAdSlot(slot, index, location, isSpread = false) {
  const slotDiv = document.createElement("div");
  slotDiv.className = "gig-ad-slot" + (slot.spread || slot.promoted ? " promoted" : "");
  // Video or empty thumb
  if (slot.videoUrl && typeof slot.videoUrl === "string" && /^https?:\/\//.test(slot.videoUrl)) {
    const v = document.createElement("video");
    v.src = slot.videoUrl;
    v.autoplay = true; v.loop = true; v.muted = true; v.playsInline = true;
    v.setAttribute("controls", false);
    v.className = "gig-ad-thumb";
    v.onerror = () => {
      v.style.display = "none";
      const fb = document.createElement("div");
      fb.className = "gig-empty-thumb";
      fb.innerText = "🎸";
      slotDiv.prepend(fb);
    };
    slotDiv.appendChild(v);
  } else {
    slotDiv.innerHTML += `<div class="gig-empty-thumb" title="No ad yet">🎸</div>`;
  }
  if (slot.client) {
    const client = document.createElement("div");
    client.className = "gig-ad-client";
    client.textContent = `Ad by: ${slot.client}`;
    slotDiv.appendChild(client);
  }
  if (slot.timestamp) {
    const ts = document.createElement("div");
    ts.className = "gig-ad-timestamp";
    ts.textContent = `Updated: ${slot.timestamp}`;
    slotDiv.appendChild(ts);
  }
  if (slot.spread || slot.promoted) {
    slotDiv.title = "This ad is promoted by a client and shown here for extra exposure!";
    return slotDiv;
  }
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
    if (slot.lockOwner === DEMO_USER) {
      slotDiv.appendChild(createGigAdUploadBtn(index, true));
    } else {
      const uploadBtn = createGigAdUploadBtn(index, false);
      uploadBtn.disabled = true;
      slotDiv.appendChild(uploadBtn);
    }
  } else {
    slotDiv.appendChild(createGigAdUploadBtn(index, true));
    const lockBtn = document.createElement("button");
    lockBtn.className = "gig-ad-lock-btn";
    lockBtn.textContent = "Lock this slot (Pay)";
    lockBtn.onclick = () => lockGigAdSlot(index);
    slotDiv.appendChild(lockBtn);
  }
  return slotDiv;
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
  input.onchange = async e => {
    if (!enabled) return;
    const file = e.target.files[0];
    if (!file) return;
    label.innerHTML = "Uploading...";
    label.style.opacity = 0.7;
    try {
      const storageRef = storage.ref(`ad_videos/slot${slotIndex}_${Date.now()}_${file.name}`);
      const snapshot = await storageRef.put(file);
      const url = await snapshot.ref.getDownloadURL();
      gigAdSlots[slotIndex].videoUrl = url;
      gigAdSlots[slotIndex].client = DEMO_USER;
      gigAdSlots[slotIndex].timestamp = new Date().toLocaleString();
      await saveAllAdSlotsToFirebase();
      renderAllAdSlots();
    } catch (err) {
      alert("Upload failed: " + err.message);
    }
    label.innerHTML = "Upload Ad Video";
    label.style.opacity = 1;
  };
  label.appendChild(input);
  if (!enabled) label.disabled = true;
  label.onclick = enabled ? () => input.click() : (e) => e.preventDefault();
  return label;
}
async function lockGigAdSlot(index) {
  if (confirm("To lock this ad slot and promote it across the platform, you must pay. Simulate payment now?")) {
    gigAdSlots[index].locked = true;
    gigAdSlots[index].lockOwner = DEMO_USER;
    gigAdSlots[index].lockUntil = null;
    spreadLockedAd(index);
    await saveAllAdSlotsToFirebase();
    renderAllAdSlots();
    alert("Slot locked and promoted! Your ad will be shown in multiple locations for extra exposure.");
  }
}
function spreadLockedAd(adIndex) {
  getAllSpreadSlots().forEach(slotGroup => {
    slotGroup.arr.forEach(slot => {
      slot.spread = true;
      slot.promotedAdIndex = adIndex;
    });
    slotGroup.render();
  });
}
function renderAllAdSlots() {
  renderGigAdSlots();
  renderSidebarAdSlots();
  renderSpreadAdSlotsBelow();
  renderFooterAdSlots();
}
window.addEventListener('DOMContentLoaded', async function() {
  await loadAllAdSlotsFromFirebase();
  subscribeToAdSlots();
  fastCutInit();
});

// --- AUDIO TRACK INPUT ---
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

// --- MAIN VIDEO RECORDER ---
const mainRecorderPreview = document.getElementById('mainRecorderPreview');
const mainRecorderRecordBtn = document.getElementById('mainRecorderRecordBtn');
const mainRecorderStopBtn = document.getElementById('mainRecorderStopBtn');
const mainRecorderDownloadBtn = document.getElementById('mainRecorderDownloadBtn');
const mainRecorderStatus = document.getElementById('mainRecorderStatus');
let mainRecorderStream = null, mainRecorderMediaRecorder = null, mainRecorderChunks = [], mainRecorderBlobURL = null;

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
  if (mainRecorderMediaRecorder && mainRecorderMediaRecorder.state !== "inactive") mainRecorderMediaRecorder.stop();
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

// --- FASTCUT SWITCHER / EXPORT LOGIC ---
function fastCutInit() {
  const NUM_TRACKS = 6;
  const TRACK_NAMES = ["Video Track 1","Video Track 2","Video Track 3","Video Track 4","Video Track 5","Video Track 6"];
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
      if (isSwitching) recordSwitch(Date.now() - switchingStartTime, i);
    };
    btn.disabled = true;
  }
  function setActiveTrack(idx) {
    activeTrack = idx;
    const tracks = document.querySelectorAll('.switcher-track');
    if (tracks.length === NUM_TRACKS) tracks.forEach((el, j) => el.classList.toggle('active', j === idx));
    fastcutBtns.forEach((btn, j) => btn.classList.toggle('active', j === idx));
  }
  setActiveTrack(0);

  // --- UPLOAD SECTION ---
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
      setTimeout(() => uploadBtn.textContent = "🎬 Upload Take", 2200);
      checkAllTakesUploaded();
    };
  }
  const startSwitchingBtn = document.getElementById('startSwitchingBtn');
  const stopSwitchingBtn = document.getElementById('stopSwitchingBtn');
  const masterOutputVideo = document.getElementById('masterOutputVideo');
  const exportStatus = document.getElementById('exportStatus');
  const mixCanvas = document.getElementById('mixCanvas');
  const switchingError = document.getElementById('switchingError');
  let isSwitching = false, mixing = false, mediaRecorder = null, masterChunks = [];
  let drawRequestId = null, livePlaybackUrl = null, switchingStartTime = 0, switchingTimeline = [];
  startSwitchingBtn.disabled = false;
  stopSwitchingBtn.disabled = true;

  function checkAllTakesUploaded() {
    setupSwitcherTracks();
    const allUploaded = uploadedVideos.every(v => !!v);
    fastcutBtns.forEach(btn => btn.disabled = !allUploaded);
    startSwitchingBtn.disabled = !allUploaded;
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
    if (audio.captureStream) audioStream = audio.captureStream();
    else if (audio.mozCaptureStream) audioStream = audio.mozCaptureStream();
    let combinedStream;
    if (audioStream) {
      combinedStream = new MediaStream([...videoStream.getVideoTracks(), ...audioStream.getAudioTracks()]);
    } else {
      combinedStream = videoStream;
      exportStatus.textContent = "Warning: Audio captureStream not supported in your browser. Output will be silent.";
    }
    masterChunks = [];
    mediaRecorder = new MediaRecorder(combinedStream, { mimeType: "video/webm" });
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) masterChunks.push(e.data); };
    mediaRecorder.onstop = () => {
      masterOutputVideo.srcObject = null;
      if(livePlaybackUrl) { URL.revokeObjectURL(livePlaybackUrl); livePlaybackUrl = null; }
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
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
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
        if (switchingTimeline[i].time <= elapsed) track = switchingTimeline[i].track;
        else break;
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
      if ((Date.now() - switchingStartTime)/1000 < duration && mixing && isSwitching) drawRequestId = requestAnimationFrame(draw);
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
    if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
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
        exportMusicVideoBtn.disabled = false; exportStatus.textContent = "";
      }, 1400);
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
    setTimeout(() => { exportMusicVideoBtn.disabled = false; exportStatus.textContent = ""; }, 1500);
  };
}
