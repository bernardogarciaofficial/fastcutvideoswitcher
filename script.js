// ... all previous code up to and including videoStates setup ...

// --- AUTO SWITCHER STATE ---
let autoSwitchPlan = null;

// --- AUTO SWITCHER DOM ---
const switcherPreview = document.getElementById('switcherPreview');
const runAutoSwitcherBtn = document.getElementById('runAutoSwitcherBtn');
const rerollSwitcherBtn = document.getElementById('rerollSwitcherBtn');
const switcherPlanInfo = document.getElementById('switcherPlanInfo');

// --- AUTO SWITCHER LOGIC ---
function createAutoSwitchPlan() {
  // Only use tracks with a valid video
  const usedClips = videoStates
    .map((vs, idx) => ({ idx, blob: vs.recordedVideoBlob, duration: vs.video.duration }))
    .filter(v => v.blob && v.duration > 0);

  if (!usedClips.length || !isSongLoaded || !audioBuffer) return null;

  const plan = [];
  const songDuration = audioBuffer.duration;
  const minSegment = 1.3, maxSegment = 4.0;
  let t = 0;
  let prevIdx = -1;
  while (t < songDuration) {
    let segLen = Math.min(maxSegment, Math.max(minSegment, minSegment + Math.random() * (maxSegment-minSegment)));
    if (t + segLen > songDuration) segLen = songDuration - t;

    // Choose a random track, never same as previous
    let candidates = usedClips.filter(c => c.idx !== prevIdx);
    if (!candidates.length) candidates = usedClips;
    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    plan.push({
      videoIdx: chosen.idx,
      segStart: t,
      segEnd: t+segLen,
    });
    prevIdx = chosen.idx;
    t += segLen;
  }
  return plan;
}

// Update switcher preview UI
function updateSwitcherPreview(plan) {
  switcherPreview.innerHTML = '';
  // Make a thumb for each track with a number showing how many times it appears in plan
  let counts = Array(10).fill(0);
  if (plan) plan.forEach(seg => counts[seg.videoIdx]++);

  for (let i = 0; i < 10; i++) {
    const vs = videoStates[i];
    if (!vs.recordedVideoBlob) continue;
    const thumb = document.createElement('div');
    thumb.className = 'switcher-thumb';
    if (plan && counts[i]) thumb.classList.add('active');
    const v = document.createElement('video');
    v.src = URL.createObjectURL(vs.recordedVideoBlob);
    v.muted = true;
    v.playsInline = true;
    v.loop = true;
    v.autoplay = true;
    v.style.pointerEvents = 'none';
    thumb.appendChild(v);
    const label = document.createElement('div');
    label.className = 'switcher-thumb-label';
    label.textContent = `Track ${i+1}${counts[i] ? ` (${counts[i]})` : ''}`;
    thumb.appendChild(label);
    switcherPreview.appendChild(thumb);
  }
}

// On run auto switcher
runAutoSwitcherBtn.addEventListener('click', () => {
  autoSwitchPlan = createAutoSwitchPlan();
  if (!autoSwitchPlan) {
    switcherPlanInfo.textContent = 'Please record at least one video and upload a song.';
    return;
  }
  updateSwitcherPreview(autoSwitchPlan);
  switcherPlanInfo.textContent = `Switch plan ready: ${autoSwitchPlan.length} cuts. (You can reroll for a new sequence.)`;
  rerollSwitcherBtn.style.display = 'inline-block';
});

// On reroll (make a new plan)
rerollSwitcherBtn.addEventListener('click', () => {
  autoSwitchPlan = createAutoSwitchPlan();
  updateSwitcherPreview(autoSwitchPlan);
  switcherPlanInfo.textContent = `Switch plan ready: ${autoSwitchPlan.length} cuts. (You can reroll for a new sequence.)`;
});

// If new video blobs added, update preview
function refreshSwitcherOnRecording() {
  if (autoSwitchPlan) updateSwitcherPreview(autoSwitchPlan);
}
videoStates.forEach((vs, idx) => {
  vs.playBtn.addEventListener("click", refreshSwitcherOnRecording);
  vs.recordBtn.addEventListener("click", refreshSwitcherOnRecording);
});

// --------- MASTER OUTPUT: Random Dice Edit Feature --------
// Update: Use autoSwitchPlan if present, otherwise fallback to old random segments
randomDiceEditBtn.addEventListener('click', () => {
  // Only use tracks with a valid video
  const usedClips = videoStates
    .map((vs, idx) => ({ idx, blob: vs.recordedVideoBlob, duration: vs.video.duration }))
    .filter(v => v.blob && v.duration > 0);

  if (!usedClips.length) {
    alert("Please record at least one clip before using Synchronize Random Dice Edit!");
    return;
  }
  if (!isSongLoaded || !audioBuffer) {
    alert("Please upload a song first!");
    return;
  }

  // --- Use the switch plan if available ---
  if (autoSwitchPlan && autoSwitchPlan.length) {
    masterSegments = autoSwitchPlan.map(seg => {
      const { videoIdx, segStart, segEnd } = seg;
      const vs = videoStates[videoIdx];
      return {
        videoBlob: vs.recordedVideoBlob,
        videoIdx,
        videoSrc: URL.createObjectURL(vs.recordedVideoBlob),
        videoDuration: vs.video.duration,
        segStart, segEnd,
        transition: randomTransitionStyle(),
        filter: (Math.random() < 0.6) ? randomFilterCSS() : null,
        effect: (Math.random() < 0.3) ? randomEffectCSS() : null
      };
    });
  } else {
    // fallback to original random cut logic
    const songDuration = audioBuffer.duration;
    const minSegment = 1.5, maxSegment = 4.0;
    let t = 0, segmentTimes = [];
    while (t < songDuration) {
      let segLen = Math.min(maxSegment, Math.max(minSegment, minSegment + Math.random() * (maxSegment-minSegment)));
      if (t + segLen > songDuration) segLen = songDuration - t;
      segmentTimes.push([t, t+segLen]);
      t += segLen;
    }

    let shuffledClips = shuffleArray(usedClips);
    while (shuffledClips.length < segmentTimes.length) {
      shuffledClips = shuffledClips.concat(shuffleArray(usedClips));
    }

    masterSegments = [];
    for (let i = 0; i < segmentTimes.length; i++) {
      let idx = i % shuffledClips.length;
      const { blob, duration, idx: vIdx } = shuffledClips[idx];
      masterSegments.push({
        videoBlob: blob,
        videoIdx: vIdx,
        videoSrc: URL.createObjectURL(blob),
        videoDuration: duration,
        segStart: segmentTimes[i][0],
        segEnd: segmentTimes[i][1],
        transition: i === 0 ? null : randomTransitionStyle(),
        filter: (Math.random() < 0.6) ? randomFilterCSS() : null,
        effect: (Math.random() < 0.3) ? randomEffectCSS() : null
      });
    }
  }

  randomDiceEditBtn.disabled = true;
  randomDiceEditBtn.innerText = "🎲 Synchronizing & Editing...";
  setTimeout(() => {
    randomDiceEditBtn.innerText = "🎲 Synchronize Random Dice Edit Entire Music Video";
    randomDiceEditBtn.disabled = false;
    playMasterEdit();
  }, 900);
});

// ...rest of script.js remains unchanged (master output playback etc)...
