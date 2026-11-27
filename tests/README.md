# Smoke test

`smoke.js` opens the site in a headless Chromium browser, at desktop size and as an iPhone 13, and checks that the main features still work:

- the device list loads, and the two default screens are shown
- adding and removing a device from search
- every content mode (pages, video, e-book, website, nothing) and layout (overlay, side by side, free arrange)
- a share link opens the same screens for a new visitor
- a PDF opens and its page size is read
- "Crop white margins" finds the content on an off-white scan (ignoring dust), crops facing book pages separately, keeps 100% at printed size, and the card statistics and preview match the cropped page
- on the phone: no sideways scrolling, and the quick controls bar shows
- no accessibility problems found by axe-core
- the site opens offline after the first visit
- no JavaScript errors

It starts its own local web server and blocks the analytics script, so test runs don't count as visits.

## Running it

You need [Node.js](https://nodejs.org) installed. The first time, from the repo folder:

```
cd tests
npm install
npx playwright install chromium
cd ..
```

Then, after any change:

```
node tests/smoke.js
```

Each check prints ✓ or ✗, and the last line says how many passed. It takes about 10 seconds.
