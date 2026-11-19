# MySQL 8.0 Command Line Client — DBMS Lab External

A monochrome **MySQL 8.0 Command Line Client** web terminal pre-loaded and pre-executed with all 8 DBMS Lab External Examination sets (`DBMS_Queries.md` & `DBMS_Lab_Solutions.md`).

---

## Features

- **100% Pre-Executed Transcripts**: Opening any set (`1` through `8`) automatically executes `CREATE DATABASE`, `USE`, every `CREATE TABLE` statement in `(a)`, every `INSERT INTO` statement in `(b)`, and all 4 examination queries `(c)`, `(d)`, `(e)`, `(f)` against the database, displaying the complete command-line session and ASCII result tables immediately.
- **Live Interactive `mysql>` Prompt**: The bottom `mysql>` prompt is live and connected to the already-populated database for that set, so any additional SQL query can be executed on the spot.
- **Authentic Monochrome Console**: Pure black (`#000000`) background and `#cccccc` console text in `Consolas` monospace — no top navigation bar, no cards, no badges, no progress percentages, and no colored highlights.
- **Stealth Set Switching**:
  - `Ctrl + 1` .. `Ctrl + 8` (or `Alt + 1` .. `Alt + 8`, or `Ctrl + Shift + 1` .. `Ctrl + Shift + 8`) — Instantly switch between Set 1 and Set 8.
  - Typing `\1` .. `\8` (or `set 1` .. `set 8`) at the `mysql>` prompt and pressing `Enter` — Silently switches to Set 1 .. Set 8.
  - Connection ID in the welcome banner (`Your MySQL connection id is 81` .. `88`) and `USE dbms_set_1;` .. `USE dbms_set_8;` subtly indicate the active set (`81` = Set 1 .. `88` = Set 8).
  - `Ctrl + /` — Toggles a discrete monochrome question reference overlay (`Esc` to close).
  - Typing `\r` at the `mysql>` prompt — Resets and re-executes the current set.
  - `Ctrl + L` — Clears the visible terminal screen without deleting database tables.

---

## Local Development

```bash
npm install
npm run verify
npm run build
npm start
```

---

## Deploying to Vercel

This repository includes [`vercel.json`](./vercel.json) and [`api/index.ts`](./api/index.ts) pre-configured for Vercel:

1. Import `https://github.com/ayushkujha/DBMS-Lab` into **Vercel** and click **Deploy**.
2. **Works out of the box (Zero-Config)** using the built-in serverless MySQL 8.0-compatible engine, or optionally connect an external MySQL 8.0 server via `MYSQL_URL` in Vercel Environment Variables.
