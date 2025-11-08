# CampusBlackMarket — Full‑Stack Prototype

Campus-exclusive marketplace for Thapar University students. Prototype stacks included in this repository are Node/Express for the API and a Vite + React + TypeScript frontend (see the `Thapar` folder). The `Thapar` app is a Vite React TypeScript starter extended with Supabase client integration, Tailwind CSS and several React components for products, chat and transactions.

## Contents added in this repo
- `Thapar/` — Vite + React + TypeScript frontend (new)
  - Uses Supabase (`@supabase/supabase-js`) for auth and DB interaction
  - Tailwind CSS for styling
  - Includes components: Auth (Login/Signup), Chat, Product list/card/modal, Transactions UI

## Prerequisites
- Node 18+
- A Supabase project (if you want to run the frontend against a live DB)

## Environment variables
Create the following files manually (do NOT commit real secrets):

- `Thapar/` (frontend) — a `.env` or `.env.local` with Supabase keys:
  - `VITE_SUPABASE_URL=https://<your-supabase-project>.supabase.co`
  - `VITE_SUPABASE_ANON_KEY=<anon-or-service-key>`
  - Any other `VITE_` variables you need for local development

## Install & Run

### API (backend)
From project root or the `api` folder:
```powershell
Set-Location 'C:\Users\DELL\Desktop\campus BlackMarket\api'
npm install
npm run dev   # if a dev script exists (or `npm start`)
```

### Thapar (frontend)
From project root or the `Thapar` folder:
```powershell
Set-Location 'C:\Users\DELL\Desktop\campus BlackMarket\Thapar'
npm install
npm run dev
```
Open http://localhost:5173 (Vite default) to see the frontend.

## Where the Supabase migration is
- `Thapar/supabase/migrations/marketplace_schema.sql` contains the SQL migration used by the frontend DB schema (if you use Supabase locally or via their dashboard, apply this migration there).

## Project notes (summary)
- The `Thapar` app contains React components for product listings, a chat UI, product modals and transactions. It uses `@supabase/supabase-js` to talk to a Supabase backend and Tailwind CSS for styling.
- The frontend uses TypeScript; run `npm run typecheck` in the `Thapar` folder to run the type checker.

## requirements.txt
- A human-readable Node dependency manifest was added as `requirements.txt` at the repo root listing the main runtime and build dependencies for `Thapar`. This is for documentation; use `npm install` in each package folder to install actual packages.

## Next steps
- Add README docs inside `Thapar/` that describe component architecture and any Supabase table mappings.
- If you want, I can add a `dev` script to the `api/package.json` for `nodemon` and install it, or add more details to `Thapar/README.md`.

# First version Campus blackmarket