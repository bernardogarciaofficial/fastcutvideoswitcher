// ... (other code above)

songInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) {
    alert("No file selected.");
    return;
  }
  const validTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3'];
  if (!validTypes.includes(file.type)) {
    alert("Unsupported file type. Please upload an MP3, WAV, or OGG audio file.");
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
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const arrayBuffer = await file.arrayBuffer();
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
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

// ... (rest of your script.js code continues below)
