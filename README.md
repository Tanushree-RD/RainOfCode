# Exoplanet Detector

## Team
- Tanushree RD (@Tanushree-RD)
- <Teammate Name> (@github-username)

---

## What it does

Exoplanet Detector is an AI-assisted pipeline for detecting exoplanets from astronomical light curve data. Users can load transit light curves, generate or upload transmission spectra, train a browser-based convolutional neural network, obtain explainable AI predictions, and export a complete scientific PDF report.

### Features

- Upload or use preset exoplanet light curves
- Perform transit detection using a BLS-style period search
- Generate or upload transmission spectra
- Detect atmospheric gases such as:
  - H₂O
  - CO₂
  - CH₄
  - O₃
  - O₂
  - N₂O
  - DMS
  - SO₂
- Train a real TensorFlow.js CNN directly in the browser
- Optional LLM reasoning using Groq
- Explainable AI predictions
- Physics consistency checks
- Candidate ranking
- Export detailed PDF reports

---

## Tech Stack

### Frontend
- HTML5
- CSS3
- Vanilla JavaScript

### Machine Learning
- TensorFlow.js

### AI
- Groq API (Llama 3.1)

### Visualization
- HTML5 Canvas (custom chart renderer)

### PDF
- jsPDF
- jspdf-autotable

### Desktop
- Electron
- electron-builder

---

## Project Structure

```
exoplanet-app/
│
├── index.html
├── styles.css
├── js/
│   ├── app.js
│   ├── chart.js
│   ├── data.js
│   ├── lightcurve.js
│   ├── model.js
│   ├── pdf.js
│   ├── spectrum.js
│   └── state.js
├── main.js
├── package.json
└── README.md
```

---

## How to Run

### Option 1 (Browser)

Simply open:

```
index.html
```

No installation required.

### Option 2 (Electron)

Install dependencies:

```bash
npm install
```

Run:

```bash
npm start
```

Build desktop application:

```bash
npm run dist
```

or

```bash
npm run dist:win
npm run dist:mac
npm run dist:linux
```

---

## Requirements

- Node.js 18+
- Internet connection (for Groq API and CDN libraries)

---

## Screenshots / Demo

Add screenshots or demo video here.

---

## Notes

- Entire application runs client-side.
- No backend server or database.
- CNN is trained inside the browser using TensorFlow.js.
- Charts are rendered using a custom Canvas implementation.
- PDF reports are generated locally.
