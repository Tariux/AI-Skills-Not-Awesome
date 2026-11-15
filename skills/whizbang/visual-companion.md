# Visual Companion for Whizbang

## When to Offer

Offer the visual companion **just-in-time** — the first time one of these moments comes up, never upfront:

- Something they'll look at: a screen, page, printout, sign
- A layout or arrangement: of a screen, room, schedule
- A flow or sequence of steps
- Options that would look different from each other
- A structure easier to see than read: diagram, timeline, map

**Offer message (exactly):**

> "This might be easier if I show you. Want me to open a browser tab with some mockups?"

If they decline, stay in text and don't offer again unless they raise it.

## Per Question Check

Before each question, ask: *Would they understand this better by seeing it?*

- **Goes in browser:** Mockups, layouts, diagrams, side-by-side designs
- **Stays in text:** Requirements, scope, tradeoffs, conceptual choices
- A question about UI isn't automatically visual

## Implementation

If accepted, serve a simple HTTP server with:
- `index.html` — current mockup
- `/api/update` — POST endpoint to update mockup from agent
- WebSocket or polling for live updates

Keep it minimal. The visual companion is a tool, not a mode — accepting it doesn't send every question to the browser.