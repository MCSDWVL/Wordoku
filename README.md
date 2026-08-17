# Wordoku

Wordoku is a static daily browser puzzle. Its date-based puzzle seed uses UTC; add `?seed=anything` to the URL for a repeatable test puzzle.

## Prepare and run

1. From this folder, run `powershell -ExecutionPolicy Bypass -File .\tools\build-dictionary.ps1` to create `assets/dictionary.json` from the supplied lexicon.
2. Serve the folder over HTTP, for example: `python -m http.server 8000`.
3. Open `http://localhost:8000` in a browser.

The generated dictionary asset intentionally contains every alphabetic 5-, 6-, and 7-letter entry from the source lexicon, which are the only word lengths the game can use.
