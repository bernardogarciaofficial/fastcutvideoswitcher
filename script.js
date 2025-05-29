// ...everything else remains the same...

// --- FastCut Switcher Logic (Upload-Only) ---
// Move this up so it is initialized earlier, as it's now in the main recorder section
const NUM_TRACKS = 4;
const TRACK_NAMES = [
  "Main Camera",
  "Closeup / Vocals",
  "Instrument / B-Roll",
  "Creative Angle"
];
const fastcutSwitcher = document.getElementById('fastcutSwitcher');
fastcutSwitcher.innerHTML = Array(NUM_TRACKS).fill(0).map((_, i) =>
  `<button class="fastcut-btn" id="fastcutBtn-${i}">${TRACK_NAMES[i]}</button>`
).join('');

let activeTrack = 0;
const fastcutBtns = [];
for (let i = 0; i < NUM_TRACKS; i++) {
  const btn = document.getElementById(`fastcutBtn-${i}`);
  fastcutBtns.push(btn);
  btn.onclick = () => setActiveTrack(i);
}
function setActiveTrack(idx) {
  activeTrack = idx;
  document.querySelectorAll('.switcher-track').forEach((el,j) =>
    el.classList.toggle('active', j === idx)
  );
  fastcutBtns.forEach((btn,j) =>
    btn.classList.toggle('active', j === idx)
  );
}
setActiveTrack(0);

// ...main recorder, upload section, export logic, etc. remain unchanged...
