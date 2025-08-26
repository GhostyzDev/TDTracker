
Point Tracker (Bootstrap)

How to run:
1) Download and unzip the package.
2) Open index.html in your browser.
3) Click a challenge to open its page. Each challenge saves its own data locally in your browser (localStorage).

Features:
- Name each team.
- Add players with an "Officer's Name" field and assign to Team A/B.
- Easy +1/+5 and -1/-5 buttons per team.
- Point history log.
- Export JSON snapshot of current page state.
- Reset button clears ONLY the current page's data (scores, players, history).

Add more challenges:
- Duplicate challenge-1.html and rename (e.g., challenge-3.html).
- Inside the file, change: <body data-page="challenge-1"> => <body data-page="challenge-3">
- Update the navbar links if you want it listed globally (in all pages).

Notes:
- Data is stored in localStorage keyed to the page id, so each challenge is isolated.
- This is a static site; no server required.
- Uses Bootstrap 5.3.3 via CDN.
