const NUM_TAKES = 6;

const songInput = document.getElementById('songInput');
const audio = document.getElementById('audio');
const status = document.getElementById('status');
const takesContainer = document.getElementById('takes');

let recStream = null;
let audioContext = null;
let sourceNode = null;
let dest = null;
let audioUnlocked = false;
let audioLoaded = false;

// State for all takes
const takes = Array.from({length: NUM_TAKES}).map(() => ({
  preview: null,
  recordBtn: null,
  downloadBtn: null,
  recChunks: [],
  mediaRecorder: null,
  recordedBlob: null,
  combinedStream: null,
  isRecording: false,
}));

// --- Populate take slots ---
takesContainer.innerHTML = takes.map((_, i) => `
  <div class="take" data-idx="${i}">
    <div class="take-title">Take #${i+1}</div>
    <video class="preview" controls playsinline muted></video>
    <br>
    <button class="recordBtn">Record</button>
    <button class="downloadBtn" disabled>Download</button>
  </div>
`).join("");

// Bind DOM elements for each take
takes.forEach((take, i) => {
  const takeDiv = takesContainer.querySelector(`.take[data-idx="${i}"]`);
  take.preview = takeDiv.querySelector('.preview');
  take.recordBtn = takeDiv.querySelector('.recordBtn');
  take.downloadBtn = takeDiv.querySelector('.downloadBtn');
});

// --- Song loading ---
songInput.addEventListener('change', function (e) {
  cleanupAudio();
  audioUnlocked = false;
  audioLoaded = false;
  audio.pause();
  audio.currentTime = 0;
  audio.controls = true;
  status.textContent = "Song loaded! Click play below to unlock audio, then pause. You can't play the song outside of recording.";
  takes.forEach(take => {
    take.recordBtn.disabled = false;
    take.downloadBtn.disabled = true;
    take.recordedBlob = null;
    take.recChunks = [];
    take.preview.src = "";
    take.preview.srcObject = null;
    take.preview.load();
  });
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  audio.src = url;
  audio.load();
  audioLoaded = true;
});

// --- User unlocks audio ---
audio.addEventListener('play', () => {
  if (!audioUnlocked) {
    audioUnlocked = true;
    status.textContent = "Audio unlocked! Pause, then pick a Take to Record.";
  }
});

// --- Per-take record logic ---
takes.forEach((take, idx) => {
  take.recordBtn.onclick = async () => {
    if (!audio.src) {
      status.textContent = "Please select an audio file first.";
      return;
    }
    if (!audioUnlocked) {
      status.textContent = "Please click play on the audio player below, then pause, before recording.";
      return;
    }
    // Only allow one recording at a time
    if (takes.some(t => t.isRecording)) {
      status.textContent = "Can only record one take at a time.";
      return;
    }
    // Disable all other record buttons
    takes.forEach((t, i) => { if (i !== idx) t.recordBtn.disabled = true; });
    take.recordBtn.disabled = true;
    status.textContent = `Recording Take #${idx+1}...`;

    take.recChunks = [];
    take.recordedBlob = null;
    take.downloadBtn.disabled = true;
    take.isRecording = true;

    try {
      recStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    } catch (err) {
      status.textContent = "Could not access camera!";
      take.recordBtn.disabled = false;
      takes.forEach((t, i) => { if (i !== idx) t.recordBtn.disabled = false; });
      take.isRecording = false;
      return;
    }

    // --- Create context+source+dest if missing (once per song load) ---
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      sourceNode = audioContext.createMediaElementSource(audio);
      dest = audioContext.createMediaStreamDestination();
      sourceNode.connect(dest);
      sourceNode.connect(audioContext.destination);
    }

    // --- Combine webcam video + audio ---
    take.combinedStream = new MediaStream([
      ...recStream.getVideoTracks(),
      ...dest.stream.getAudioTracks()
    ]);

    // --- Webcam preview ---
    take.preview.srcObject = recStream;
    take.preview.muted = true;
    take.preview.autoplay = true;
    take.preview.play().catch(()=>{});

    // --- Ensure song starts at 0 and plays in sync with recording ---
    audio.pause();
    audio.currentTime = 0;
    audio.controls = false;
    await new Promise(res => setTimeout(res, 30));

    try {
      await audio.play();
      if (audio.paused) throw new Error("Audio still paused after play()");
    } catch (err) {
      status.textContent = "Browser blocked audio autoplay. Please click play on the audio player to unlock, then pause and Record.";
      audio.controls = true;
      take.recordBtn.disabled = false;
      takes.forEach((t, i) => { if (i !== idx) t.recordBtn.disabled = false; });
      take.isRecording = false;
      if (recStream) recStream.getTracks().forEach(t => t.stop());
      return;
    }

    take.mediaRecorder = new MediaRecorder(take.combinedStream, {
      mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm'
    });

    take.mediaRecorder.ondataavailable = e => { if (e.data.size > 0) take.recChunks.push(e.data); };

    take.mediaRecorder.onstop = () => {
      take.recordedBlob = new Blob(take.recChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(take.recordedBlob);
      take.preview.pause();
      take.preview.srcObject = null;
      take.preview.removeAttribute('src');
      take.preview.load();
      setTimeout(() => {
        take.preview.src = url;
        take.preview.currentTime = 0;
        take.preview.load();
        take.preview.onloadeddata = () => {
          take.preview.currentTime = 0;
          take.preview.pause();
        };
      }, 20);
      take.downloadBtn.disabled = false;
      status.textContent = `Take #${idx+1} recorded! Play or download, or pick another slot.`;
      if (recStream) recStream.getTracks().forEach(t => t.stop());
      audio.controls = false; // keep song locked
      take.isRecording = false;
      // Enable all record buttons
      takes.forEach((t) => t.recordBtn.disabled = false);
    };

    // --- Stop on audio end or video click
    audio.onended = () => {
      if (take.mediaRecorder && take.mediaRecorder.state === 'recording') take.mediaRecorder.stop();
      audio.onended = null;
    };
    take.preview.onclick = () => {
      if (take.mediaRecorder && take.mediaRecorder.state === 'recording') take.mediaRecorder.stop();
    };

    take.mediaRecorder.start();
  };

  // --- Download logic ---
  take.downloadBtn.onclick = () => {
    if (!take.recordedBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(take.recordedBlob);
    a.download = `take${idx+1}.webm`;
    a.click();
  };
});

function cleanupAudio() {
  if (audioContext) try { audioContext.close(); } catch {}
  audioContext = null;
  sourceNode = null;
  dest = null;
}
