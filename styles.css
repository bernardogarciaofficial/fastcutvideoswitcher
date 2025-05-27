const previewTracks = document.getElementById('previewTracks');
const videoInput = document.getElementById('videoInput');
const programVideo = document.getElementById('programVideo');
const sourceSelect = document.getElementById('sourceSelect');
const cutBtn = document.getElementById('cutBtn');
const fadeBtn = document.getElementById('fadeBtn');

let videos = [];
let currentSource = null;

// Load videos
videoInput.onchange = () => {
  previewTracks.innerHTML = '';
  sourceSelect.innerHTML = '';
  videos = [];
  Array.from(videoInput.files).forEach((file, idx) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.src = url;
    video.width = 180;
    video.height = 100;
    video.controls = true;
    video.className = 'track-preview';
    previewTracks.appendChild(video);

    videos.push({ url, video });
    const option = document.createElement('option');
    option.value = idx;
    option.text = `Track ${idx + 1}`;
    sourceSelect.appendChild(option);
  });
};

// Cut transition
cutBtn.onclick = () => {
  const idx = parseInt(sourceSelect.value);
  if (videos[idx]) {
    programVideo.src = videos[idx].url;
    programVideo.currentTime = videos[idx].video.currentTime;
    programVideo.play();
    currentSource = idx;
  }
};

// Fade transition (simple crossfade)
fadeBtn.onclick = () => {
  const idx = parseInt(sourceSelect.value);
  if (videos[idx]) {
    let fadeOut = programVideo;
    let fadeIn = document.createElement('video');
    fadeIn.src = videos[idx].url;
    fadeIn.currentTime = videos[idx].video.currentTime;
    fadeIn.muted = true;
    fadeIn.width = fadeOut.width;
    fadeIn.height = fadeOut.height;
    fadeIn.style.position = 'absolute';
    fadeIn.style.top = '0';
    fadeIn.style.left = '0';
    fadeIn.style.opacity = '0';
    fadeOut.parentNode.appendChild(fadeIn);
    fadeIn.play();

    let op = 0;
    let fadeInterval = setInterval(() => {
      op += 0.05;
      fadeIn.style.opacity = '' + op;
      if (op >= 1) {
        clearInterval(fadeInterval);
        programVideo.src = fadeIn.src;
        programVideo.currentTime = fadeIn.currentTime;
        programVideo.play();
        fadeIn.remove();
        currentSource = idx;
      }
    }, 40);
  }
};
