# Fastcut Two Channels Music Video Maker

Fastcut is a web-based music video editing platform designed for speed, simplicity, and creativity. With Fastcut, you can record, upload, and live-switch between **two video channels**—all perfectly synchronized to your uploaded song. Instantly export your edited music video with fade in/out effects, all directly in your browser.

---

## Features

- **Upload Your Song:** Use any audio file as the sync track for your music video.
- **2 Video Channels:** Record directly from your webcam/microphone or upload video files for two tracks.
- **Instant 2-Channel Switcher:** Preview and switch between two cameras, highlighting your choice in real time.
- **Live Multicam Editing:** Switch between channels live while your song plays, just like a real multicam director!
- **Export Your Cut:** Download your finished music video as a `.webm` file.
- **No Server Required:** Everything runs locally in your browser for privacy and speed.
- **Flexible Multi-Stage Workflow:** Artists can create more complex edits by exporting two-channel cuts and re-importing them, allowing for up to 4, 6, or more channels with iterative switching.

---

## How to Use

1. **Upload a Song**
   - Click the file input under "Song" and select your music file.

2. **Record or Upload Takes**
   - Click "Record" under either channel to capture a new take using your webcam/audio.
   - Or, upload a pre-recorded video file for either channel.

3. **Preview & Select Channels**
   - Use the channel switcher buttons or click on the video thumbnails to preview each take.
   - Thumbnails and switcher buttons highlight the active channel.

4. **Live 2-Channel Edit**
   - Click "Record Full Edit."
   - As your song plays, use the channel switcher buttons to cut between channels. Your choices are recorded in real time.
   - Hit "Stop" or wait for the song to finish.

5. **Export**
   - After recording, click "Export" to download your music video!

6. **For Multi-Stage (4+ Channel) Edits**
   - Repeat the process with other video takes.
   - Import exported edits back into the switcher as new video tracks and repeat the process.
   - Build up complex edits by layering exported two-channel cuts.

---

## Tech Stack

- **HTML/CSS/JS:** All logic runs client-side.
- **Web APIs:** MediaRecorder, getUserMedia, MediaStream, Canvas API, AudioContext.
- **No backend required.**

---

## File Structure

- `index.html` — Main app UI
- `styles.css` — App styling
- `script.js` — All logic for recording, switching, and exporting

---

## Credits

Created by Bernardo Garcia, © 2025

Contact: bernardogarciagarcia441@gmail.com

[GitHub](https://github.com/bernardogarciaofficial/fastcut)
