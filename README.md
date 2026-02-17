# StudyPlan: Spaced Repetition Timetable

StudyPlan is a small web application that generates a weekly study timetable based on when you learned a topic. Instead of planning only “hours,” it schedules short review sessions at fixed intervals so that concepts are revisited before they are forgotten.

The current version is intentionally simple. It focuses on topic level scheduling and a clear preview of the week, without external libraries or frameworks.

## What it does

For each topic you add, you provide the course name, the topic name, and the lecture date and time. The app then schedules five review sessions:

- Right after the lecture
- Within one hour
- Before sleeping
- Two days later
- Six days later

The scheduled times are snapped into an allowed study window and can handle windows that cross midnight.

## Key details

- Topic level scheduling (not just course level)
- Cross midnight time windows supported (example: 7:00 PM to 1:00 AM)
- Bedtime based “before sleeping” session
- Weekly timetable preview
- Plans saved locally in the browser using localStorage
- Responsive layout

## Technology

- HTML
- CSS
- Vanilla JavaScript
- Git and GitHub Pages

## Project layout

- `index.html` page structure
- `styles.css` styling
- `script.js` scheduling logic and UI behavior

## Live site

https://palash-2904.github.io/Personalized-Time-Table-website/

## How to run locally

1. Clone the repository or download the files.
2. Open `index.html` in a browser.

## Notes on scheduling

This project currently uses a fixed set of review intervals. It does not yet implement an adaptive model based on performance, difficulty, or a forgetting curve. The main goal of this version is to get the workflow and time handling correct.

## Planned improvements

- Mark reviews as completed
- Reschedule missed reviews
- Difficulty based or performance based spacing
- A calendar style view with better time placement
- Cleaner saved plan management

