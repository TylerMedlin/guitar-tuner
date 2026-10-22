# Guitar Tuner

A mobile-friendly guitar tuner that runs in the browser. No install or build step.

## Features
- **Tappable headstock** – tap any tuning knob to pick the note for that string (− / + half step, note grid, octave buttons, and a "Play note" reference tone).
- **Preset tunings** – Standard, Drop D, Eb, D standard, Drop C, DADGAD, Open G/D/E/C.
- **Custom tunings** – change any string, then "Save as custom tuning". Saved in your browser.
- **Microphone tuner** – listens to your guitar, shows a needle and how many cents sharp/flat you are, tells you to tune up or down, and shows "✓ In tune!" (with a vibration on phones) once you're within ±5 cents.
- **Auto detect** picks the closest string automatically; tapping a knob locks the tuner to that string. Tap the chip to switch back to auto.

## Run it
The microphone only works over `https://` or `localhost`.

- **GitHub Pages:** repo Settings → Pages → deploy from this branch, then open the URL on your phone.
- **Locally:** `python3 -m http.server` in this folder, then open http://localhost:8000.

## Files
- `index.html` – page layout
- `css/style.css` – styles
- `js/notes.js` – note math and preset tunings
- `js/pitch.js` – pitch detection (YIN algorithm)
- `js/app.js` – headstock drawing, note picker, mic + tuner logic
