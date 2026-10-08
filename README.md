# Cognifyx

Enter your weekly class timetable and Cognifyx schedules every revision for you, spaced along the forgetting curve, with a specific study technique for each one.

## The revision ladder

For every class session:

| When | Technique |
| --- | --- |
| Right after class | Brain dump (active recall) |
| Evening (default 18:00) | Teach a 6-year-old |
| Before sleep (bedtime minus 20 min) | Write your own questions |
| After 2 days | Answer your questions from memory |
| After 4 days | Blank page + teach |
| After 7 days | Practice test |
| After 2 weeks | Teach + test |
| After 1 month | Full recall test |

Evening and bedtime are configurable on the Method page. Reviews are computed from your classes, so editing a class reschedules everything automatically.

## Run it

Requires Node.js 22.13+ (uses the built-in `node:sqlite`; no npm install needed).

```
npm start          # http://localhost:3000
npm test
```

Environment variables: `PORT` (default 3000), `DB_PATH` (default `data/cognifyx.db`).

## Storage

- **With the server** (`npm start`): data lives in SQLite (`data/cognifyx.db`). The header badge shows **Synced**.
- **Static hosting only** (e.g. GitHub Pages serving `public/`): the app detects no API and stores data in the browser's localStorage. The badge shows **Local only**.

There is no login yet: anyone who can reach the server can read and edit its data. Run it locally or behind your own access control until accounts are added.

## Deploy to GitHub Pages

`.github/workflows/pages.yml` runs the tests and publishes `public/` whenever `main` is updated. One-time setup: repo **Settings → Pages → Build and deployment → Source: GitHub Actions**. The site is then at https://palash-2904.github.io/Personalized-Time-Table-website/ and runs in "Local only" mode (data stays in each browser, not shared across devices). For synced data, host the Node server (`npm start`) somewhere that runs Node and use that URL instead.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/state` | classes, settings, review completions, notes |
| POST | `/api/classes` | create class |
| PUT / DELETE | `/api/classes/:id` | update / delete class (and its history) |
| PUT | `/api/settings` | `{eveningTime, bedtime}` |
| PUT | `/api/reviews` | `{classId, date, step, status: "done"\|"skipped"\|null}` |
| PUT | `/api/notes` | `{classId, date, topic}` |

## Layout

- `public/` frontend (`scheduler.js` is the pure scheduling logic, shared with the tests)
- `server/` HTTP server, SQLite layer, validation
- `tests/` `node --test` suites for the scheduler and API
- `timetable-logic_v1.py` early prototype, no longer used
