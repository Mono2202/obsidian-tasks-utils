---
name: project-overview
description: MonoVault is a Flask + plain-JS SPA for managing an Obsidian vault using GTD. Tabs for Today/Habits/Planning/Inbox/Music/Workout/Food/Finance.
metadata:
  type: project
---

MonoVault is a personal Flask app served on localhost, used as a PWA on iOS and desktop. It reads/writes markdown files in an Obsidian vault.

**Why:** Personal productivity tool for GTD workflow with Obsidian.

**How to apply:** All backend work is Python/Flask with no tests. Frontend is plain JS/CSS with no framework, no build step. Tabs are lazy-loaded. Each tab has its own .html template (Jinja include), .js file, and optional .css file.

Key patterns:
- Tasks identified by raw markdown line (raw_line) used as string key for find/replace in files
- Obsidian emojis for task metadata: 📅 due, ⏳ scheduled, 🛫 start, 🔁 recur, ✅ done
- `obsidian/` package: Vault composes sub-objects (tasks, habits, inbox, etc.)
- `backend/routes/` blueprints each receive only the sub-object they need
- `frontend/static/app.js` handles theme, tab switching, shared helpers
