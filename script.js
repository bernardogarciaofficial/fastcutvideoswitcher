// ... (rest of your code above)

songInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) {
    alert("No file selected.");
    return;
  }
  // Accept any audio file type for maximal compatibility
  if (!file.type.startsWith("audio/")) {
    alert("Unsupported file type. Please upload an audio file.");
    return;
  }
  try {
    if (audio) {
      audio.pause();
      URL.revokeObjectURL(audio.src);
    }
    audioUrl = URL.createObjectURL(file);
    audio = new Audio(audioUrl);
    audio.preload = "auto";
    // Resume audio context if needed (for some browsers)
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }
    const arrayBuffer = await file.arrayBuffer();

    // Try/catch decode for better error reporting
    try {
      audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    } catch (decodeErr) {
      alert("Could not decode audio file. Please try another audio file.");
      console.error("decodeAudioData error:", decodeErr);
      isSongLoaded = false;
      return;
    }

    drawWaveform(audioBuffer);
    isSongLoaded = true;
    videoStates.forEach((vs) => {
      vs.recordBtn.disabled = false;
    });
    alert("Song uploaded successfully!");
  } catch (err) {
    isSongLoaded = false;
    alert("Error loading audio file: " + (err.message || err));
    console.error(err);
  }
});

// Draw waveform for uploaded audio
function drawWaveform(buffer) {
  const canvas = waveform;
  const ctx = canvas.getContext('2d');
  const width = canvas.width = waveform.parentElement.offsetWidth || 800;
  const height = canvas.height = 80;
  ctx.clearRect(0, 0, width, height);

  if (!buffer || !buffer.getChannelData) {
    ctx.fillStyle = "#f33";
    ctx.font = "24px sans-serif";
    ctx.fillText("No waveform data.", 30, 50);
    return;
  }

  const data = buffer.getChannelData(0);
  const step = Math.floor(data.length / width);
  ctx.beginPath();
  ctx.moveTo(0, height / 2);

  for (let i = 0; i < width; i++) {
    let min = 1.0, max = -1.0;
    for (let j = 0; j < step; j++) {
      const datum = data[(i * step) + j];
      if (datum < min) min = datum;
      if (datum > max) max = datum;
    }
    ctx.lineTo(i, (1 + min) * 0.5 * height);
    ctx.lineTo(i, (1 + max) * 0.5 * height);
  }
  ctx.strokeStyle = "#36e";
  ctx.lineWidth = 1;
  ctx.stroke();
}

// Responsive redraw of waveform
window.addEventListener('resize', () => {
  if (audioBuffer) drawWaveform(audioBuffer);
});

// ... rest of your script.js code remains unchanged ...
