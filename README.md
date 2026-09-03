# Wordoku

Wordoku is a static daily browser puzzle. Its date-based puzzle seed uses UTC; add `?seed=anything` to the URL for a repeatable test puzzle.

Each day has Easy, Medium, Hard, and Multi puzzles. The difficulty tuning values are grouped at the top of `app.js`; Easy keeps the original region behavior, Medium has no one-cell regions, and Hard has no one- or two-cell regions. Multi is a 6x6 word hunt with six large regions and 8-12 familiar six-letter words; it shows found words but keeps the total hidden.

## Prepare and run

1. From this folder, run `powershell -ExecutionPolicy Bypass -File .\tools\build-dictionary.ps1` to create `assets/dictionary.json` from the supplied lexicon and frequency candidate data.
2. Serve the folder over HTTP, for example: `python -m http.server 8000`.
3. Open `http://localhost:8000` in a browser.

The generated asset retains every alphabetic 5-, 6-, and 7-letter dictionary entry for guess validation. Puzzle answers are drawn only from the adjacent curated candidate file with Zipf frequency at least 4.0, giving a pool of familiar words while still accepting valid alternate solutions.
