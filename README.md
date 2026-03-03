# Solar Layout Generator

A web-based SaaS tool for Malaysian homeowners to assess rooftop solar potential using Google Solar API data. Users search for their property, view an auto-generated solar panel layout on a satellite map, interactively adjust it, and receive NEM Rakyat 3.0 financial projections.

---

## Architecture

```
Frontend (React + Vite)  ↔  REST API  ↔  Backend (Express.js + Prisma)  ↔  Supabase (PostgreSQL + Auth + Storage)  ↔  Google Solar API
```

Monorepo with npm workspaces: `/shared` (types), `/backend` (Express API), `/frontend` (React app).

---

## Prerequisites

- Node.js 20+
- A `.env` file at the root (copy from `.env.example` and fill in values)
- A Supabase project with PostgreSQL, Auth, and a Storage bucket named `geotiffs`
- Google Cloud API keys with Solar API, Maps JavaScript API, and Geocoding API enabled

---

## Commands

| Command | Description |
|---|---|
| `npm install` | Install all workspace dependencies |
| `npm run dev:backend` | Start backend only (port 3001) |
| `npm run dev:frontend` | Start frontend only (port 5173) |
| `npm run format` | Run Prettier across the repo |
| `npm run db:migrate` | Run Prisma migrations against Supabase (uses `DIRECT_URL`) |
| `npm run db:seed` | Seed tariff config data into the database |
| `npx vitest` | Run unit tests |

---
