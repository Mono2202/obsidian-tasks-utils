---
name: project-inbox-feature
description: Inbox GTD clarification tab — new feature added in feature/inbox-managment branch
metadata:
  type: project
---

New Inbox tab added to MonoVault for GTD inbox clarification workflow.

**Files added:**
- `obsidian/inbox.py` — Inbox class (parse, update, delete, move, complete items)
- `backend/routes/inbox.py` — Blueprint: /inbox-items, /inbox/add, /inbox/update, /inbox/delete, /inbox/move, /inbox/complete, /vault-files
- `frontend/assets/inbox.svg` — tab icon
- `frontend/templates/tabs/inbox.html` — panel + fixed-position modal
- `frontend/static/tabs/inbox.js` — all JS
- `frontend/static/tabs/inbox.css` — modal, tag chips, autocomplete dropdown

**Key behaviors:**
- Items identified by raw_line (same as tasks pattern)
- Default sort: newest first (reversed file order, bottom = newest)
- Quick-complete (✅) → marks done + moves to IMPLODING_TASKS file
- Popup: rename, dates (due/sched/start), time, recurrence, tag chips, move-to-page autocomplete
- Move with empty target → goes to IMPLODING_TASKS
- Save = update in-place in inbox; Move = remove from inbox + append to target
- Vault files autocomplete loaded once on first tab open

**How to apply:** If modifying inbox, the modal is a sibling of the tab panel in the DOM (both inside `.main` via Jinja include). The modal uses `position:fixed` so it overlays everything.
