# Paige's Content Studio

A personal content studio that runs in Safari on iPhone & iPad. Free, private, no server.
Open it at **https://paigesuter.github.io/content-studio/** and add it to your Home Screen.

## Sections
| Section | Status |
|---|---|
| Home: upload, recent footage, brand at a glance | ✅ Phase 1 |
| My Footage: library, folders, favourites, previews | ✅ Phase 1 |
| Brand Brain: identity, audience, pillars, voice, feedback, history/undo, Ask Claude | ✅ Phase 1 |
| Brand Kit & Settings: palettes, font pairings, your own fonts, approval, backup | ✅ Phase 1 |
| Create / Edit: quick reel editor (one talking clip) with "My brand" look | ✅ (multi-clip timeline in Phase 3) |
| Hook Bank, captions, content ideas, transcription intelligence | Phase 2 |
| Timeline editor, presets, transitions, music, formats | Phase 3 |
| Inspiration library, "Recreate this style" | Phase 4 |
| Content calendar & drafts | Phase 5 |

## How it works
- Everything (footage copies, brand brain, kit, projects) is stored **on your device** (IndexedDB). Originals in Photos are never touched.
- Speech-to-text runs on the device (Whisper). Video export runs on the device (canvas + MediaRecorder, 1080×1920).
- AI writing uses the free **Ask Claude** bridge: copy a prompt → paste into your Claude chat → paste the reply back.
- This repo is public (free hosting), so it only contains public-facing brand info. Private notes live on your device.

## Files
`index.html` + `studio.js` + `studio.css`: the studio · `edit.html` + `app.js` + `style.css`: quick reel editor ·
`brand-seed.js`: starting Brand Brain · `kit.js`: palettes & fonts · `brand.js`: brand storage & history ·
`library.js`: footage library · `db.js`: on-device storage · `engine.js`/`render.js`/`looks.js`/`listen-worker.js`: editing engine.
