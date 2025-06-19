<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Fastcut Music Video Maker</title>
  <style>
    body { font-family: sans-serif; background: #f7f7f7; color: #232323; }
    h1 { margin-bottom: 2px; }
    .track-card { display:inline-block; vertical-align:top; margin:8px; padding:7px; border:1px solid #aaa; border-radius:6px; background:#fafafa; }
    #tracksContainer { margin:16px 0; }
    #switcherBtnsContainer button.active-switcher-btn { background:#ff5555; color:#fff; }
    .track-title { font-weight:bold; margin-bottom:3px; }
    #mainOutput { display:block; width:640px; height:360px; margin:12px auto; background:#000; }
    #switcherBtnsContainer { margin:12px 0; }
    #exportStatus { margin-left:10px; color:#228B22; }
    #warnSong { color:#b00; font-weight:bold; display:none; }
    video[muted]::-webkit-media-controls-volume-slider { display:none; }
    video[muted]::-webkit-media-controls-mute-button { display:none; }
    @media (max-width: 900px) {
      #mainOutput { width:100vw; height:auto; max-width:95vw; }
      .track-card { width:150px; }
    }
  </style>
</head>
<body>
  <h1>Fastcut Music Video Maker</h1>

  <div>
    <label>Song: <input type="file" id="songInput" accept="audio/*"></label>
    <span id="warnSong">Please choose a song first!</span>
  </div>
  <audio id="audio" controls style="width:100%;margin:8px 0;"></audio>

  <!-- Six video thumbnail screens and track controls will be rendered here: -->
  <div id="tracksContainer"></div>

  <!-- Six track switcher buttons will appear here: -->
  <div id="switcherBtnsContainer"></div>

  <!-- Main output video preview: -->
  <video id="mainOutput" controls autoplay muted playsinline></video>

  <div style="margin:10px 0;">
    <button id="recordFullEditBtn">Record Full Edit</button>
    <button id="stopPreviewBtn">Stop</button>
    <button id="exportMusicVideoBtn" disabled>Export</button>
    <span id="exportStatus"></span>
  </div>

  <div style="margin-top:24px;">
    <small>Fastcut Music Video Maker © 2025 Bernardo Garcia<br>
    Contact: bernardogarciaofficial@gmail.com</small>
  </div>

  <script src="script.js"></script>
</body>
</html>
