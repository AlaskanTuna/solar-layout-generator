# SolarSim Runbook

> Reproduce the SolarSim stack from `git clone` to a live production deploy.
> Estimated time: 60-90 min on a fresh machine, ~30 min if CLIs are pre-installed.

## How to use this document

Follow this as an ordered checklist, not a reference manual. Each major step ends with a validation checkpoint; do not move on until the checkpoint passes. If a command fails, stop and check the troubleshooting section before continuing. The document is written for a maintainer or agent with shell access, cloud credentials, and no prior SolarSim context.

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Clone and install](#2-clone-and-install)
3. [Provision cloud resources](#3-provision-cloud-resources)
4. [Configure environment variables](#4-configure-environment-variables)
5. [Initialise the database and run locally](#5-initialise-the-database-and-run-locally)
6. [Sync Supabase auth config and templates](#6-sync-supabase-auth-config-and-templates)
7. [Deploy to Heroku](#7-deploy-to-heroku)
8. [Deploy the PDF service to Vercel](#8-deploy-the-pdf-service-to-vercel)
9. [CI/CD (GitHub Actions)](#9-cicd-github-actions)
10. [Post-deploy smoke tests](#10-post-deploy-smoke-tests)
11. [Operational runbook](#11-operational-runbook)
12. [Troubleshooting](#12-troubleshooting)
13. [Tearing down](#13-tearing-down)
14. [Appendix A: env var reference card](#appendix-a-env-var-reference-card)
15. [Appendix B: Glossary of CLIs](#appendix-b-glossary-of-clis)

## 1. Prerequisites

### 1.1 Local toolchain (Node, pnpm, git, openssl, dig)

[!IMPORTANT]
SolarSim expects Node 24.x and pnpm 10.33.0. Use `corepack` for pnpm so the repo version and your local version stay aligned.

```bash
node -v
pnpm -v
git --version
openssl version
dig -v
corepack enable
```

Install the base toolchain if any command is missing. The repo is developed against the current Node LTS line, so do not use an older runtime.

✅ Validation: `node -v` reports `v24.x`, `pnpm -v` reports `10.33.0`, and `corepack enable` finishes without error.

### 1.2 Cloud platform CLIs (supabase, gcloud, gh, heroku, vercel) - install + login

[!NOTE]
Use your platform package manager of choice. The examples below are the quickest path on a fresh Unix-like machine.

```bash
brew install supabase/tap/supabase
brew install --cask google-cloud-sdk
brew install gh
brew install heroku/brew/heroku
npm install -g vercel
```

Authenticate each CLI before touching the project:

```bash
supabase login
gcloud auth login
gcloud auth application-default login
gh auth login
heroku login
vercel login
```

`gcloud auth application-default login` matters if you want the backend to talk to Gemini through Vertex AI locally. If you rely on the API-key fallback only, it is still safe to run.

✅ Validation: `supabase projects list`, `gcloud config list`, `gh auth status`, `heroku auth:whoami`, and `vercel whoami` all return authenticated output.

### 1.3 Cloud accounts to create (with signup URLs)

Create these accounts before provisioning anything:

| Provider | Purpose | Signup URL |
| --- | --- | --- |
| Supabase | Postgres, Auth, Storage | https://supabase.com |
| Google Cloud | Solar API, Maps API, OAuth, optional Vertex AI | https://console.cloud.google.com |
| Resend | Transactional email | https://resend.com |
| Heroku | Backend deploy | https://heroku.com |
| Vercel | PDF render function | https://vercel.com |
| Porkbun | Domain registration / DNS | https://porkbun.com |

## 2. Clone and install

```bash
git clone https://github.com/AlaskanTuna/SolarSim.git
cd SolarSim
corepack enable
pnpm install
cp .env.example .env
```

[!IMPORTANT]
Do not skip `cp .env.example .env`. The backend reads root `.env` at runtime, and `supabase config push` resolves `env(...)` placeholders from the same file.

Immediately run the typecheck before provisioning cloud services:

```bash
pnpm typecheck
```

✅ Validation: `pnpm typecheck` exits cleanly.

## 3. Provision cloud resources

[!NOTE]
SolarSim is CLI-first. Use dashboards for inspection only; anything that creates or changes config should be reproducible from the terminal.

### 3.1 Google Cloud project (gcloud project create, enable APIs, OAuth client, API key)

Create a dedicated GCP project and enable the APIs used by SolarSim:

```bash
gcloud projects create solar-layout-generator --name="SolarSim"
gcloud config set project solar-layout-generator
gcloud services enable solar.googleapis.com maps-backend.googleapis.com geocoding-backend.googleapis.com
gcloud services enable aiplatform.googleapis.com
```

Then create credentials in the Cloud Console:

1. Create an API key for the Solar + Maps + Geocoding calls. Restrict it to the enabled APIs.
2. Create an OAuth client ID for a Web application.
3. Set the Supabase callback URI to `https://<supabase-ref>.supabase.co/auth/v1/callback`.
4. Copy the OAuth client ID and secret for `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_SECRET`.

[!IMPORTANT]
The chat assistant can use either Vertex AI or the Gemini API key fallback. In production, keep `GEMINI_API_KEY` available so Sol never depends on one auth path only.

### 3.2 Supabase project (create via dashboard, supabase link, copy keys, create geotiffs storage bucket via SQL)

Create the Supabase project in the dashboard first, then link the repo:

```bash
supabase projects list
supabase link --project-ref <your-supabase-ref>
```

Copy these values from Supabase Settings:

- Project URL -> `SUPABASE_URL`
- anon public key -> `SUPABASE_ANON_KEY`
- service_role key -> `SUPABASE_SERVICE_ROLE_KEY`
- database connection string -> `SUPABASE_DATABASE_URL`

Create the bucket that stores Solar API GeoTIFFs. The backend expects the bucket name `geotiffs`.

```sql
insert into storage.buckets (id, name, public)
values ('geotiffs', 'geotiffs', false);
```

✅ Validation: the `geotiffs` bucket appears in Supabase Storage and is private.

### 3.3 Resend (signup, API key, verify domain - exact DNS records for SPF/DKIM/MX, Porkbun pitfalls)

Create a Resend API key, then verify your sender domain before testing with real users. For SolarSim, use `solarsim.tech` and send from `noreply@solarsim.tech`.

| Type | Host | Value | TTL |
| --- | --- | --- | --- |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | 600 |
| TXT | `resend._domainkey` | DKIM public key from Resend | 600 |
| MX | `send` | `feedback-smtp.<region>.amazonses.com` (priority 10) | 600 |

[!WARNING]
Porkbun auto-appends the domain suffix. Enter `send`, not `send.solarsim.tech`, or you will create the wrong record. For the apex, use ALIAS/ANAME if the registrar supports it; do not try to force a CNAME at the root.

After adding the DNS records, wait for propagation and verify them in Resend until all records are green.

✅ Validation: `dig TXT resend._domainkey.solarsim.tech`, `dig MX send.solarsim.tech`, and the Resend dashboard all confirm the domain as verified.

### 3.4 Domain registrar (Porkbun example for solarsim.tech - apex ALIAS, www CNAME, Resend's 3 DNS records)

Attach the production domain to Heroku first so you can capture the exact DNS targets:

```bash
heroku domains:add solarsim.tech -a solar-layout-generator
heroku domains:add www.solarsim.tech -a solar-layout-generator
heroku domains -a solar-layout-generator
heroku certs:auto:enable -a solar-layout-generator
```

Porkbun DNS records should end up like this:

| Record | Host | Value |
| --- | --- | --- |
| ALIAS (or ANAME) | apex / blank | `<apex-target>.herokudns.com` |
| CNAME | `www` | `<www-target>.herokudns.com` |
| TXT | `send` | Resend SPF record |
| TXT | `resend._domainkey` | Resend DKIM record |
| MX | `send` | Resend bounce MX record |

[!NOTE]
Keep the Heroku DNS targets separate from the Resend sender records. They live on different subdomains and do not conflict.

✅ Validation: `dig +short solarsim.tech` and `dig +short www.solarsim.tech` resolve to Heroku, and `heroku certs:auto -a solar-layout-generator` shows the certificate as managed automatically.

## 4. Configure environment variables

Set the root `.env` from the table below. `VITE_*` variables are baked into the frontend bundle at build time, so they must be correct before the first Heroku deploy.

| Variable | Where the value comes from | What breaks if missing |
| --- | --- | --- |
| `GOOGLE_API_KEY` | GCP API key restricted to Solar, Maps, and Geocoding APIs | Roof lookup, map tiles, and Solar API calls fail |
| `VITE_GOOGLE_API_KEY` | `GOOGLE_API_KEY` via dotenv-expand | Frontend Google Maps JS loader fails |
| `GOOGLE_CLOUD_PROJECT` | GCP project ID, e.g. `solar-layout-generator` | Vertex AI chat path cannot start |
| `GOOGLE_CLOUD_LOCATION` | Usually `global` | Vertex AI requests target the wrong region |
| `GEMINI_API_KEY` | Google AI Studio API key | Sol has no fallback chat auth |
| `CHAT_MODEL` | Gemini model name | Chat boots with the wrong or default model |
| `GOOGLE_OAUTH_CLIENT_ID` | GCP OAuth client | Google sign-in fails |
| `GOOGLE_OAUTH_SECRET` | Same OAuth client | Google sign-in fails |
| `SUPABASE_URL` | Supabase Settings -> API | Auth, storage, and backend client creation fail |
| `SUPABASE_ANON_KEY` | Supabase Settings -> API | Frontend Supabase client cannot sign in |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Settings -> API | Backend cannot read/write privileged data |
| `SUPABASE_DATABASE_URL` | Supabase Settings -> Database | Prisma migrations and runtime DB access fail |
| `VITE_SUPABASE_URL` | `SUPABASE_URL` via dotenv-expand | Frontend Supabase client cannot boot |
| `VITE_SUPABASE_ANON_KEY` | `SUPABASE_ANON_KEY` via dotenv-expand | Frontend auth fails |
| `SITE_URL` | Final public origin, local or production | Supabase redirect links point to the wrong place |
| `APEX_DOMAIN` | `solarsim.tech` in production, blank elsewhere | Apex redirect middleware does not activate |
| `BACKEND_PORT` | Local dev only, usually `3001` | Local backend starts on the wrong port |
| `FRONTEND_PORT` | Local dev only, usually `5173` | Local frontend starts on the wrong port |
| `FRONTEND_URL` | Local `http://localhost:5173`, prod `https://solarsim.tech` | Backend CORS rejects browser requests |
| `PDF_TOKEN_SECRET` | `openssl rand -hex 32` | PDF token signing and verification fail |
| `PDF_EXPORT_URL` | Vercel PDF function URL | Analysis page export button points nowhere |
| `VITE_PDF_EXPORT_URL` | `PDF_EXPORT_URL` via dotenv-expand | Frontend bundle cannot call the PDF service |
| `RESEND_API_KEY` | Resend API key | Supabase auth email delivery fails |
| `PORT` | Heroku runtime injection | Do not set manually; Heroku supplies it |
| `NODE_ENV` | `production` on Heroku, `development` locally | Redirect middleware and prod behavior diverge |
| `ALLOWED_FRONTEND_ORIGIN` | Vercel env var for the PDF service | PDF function rejects browser requests |

[!NOTE]
The repo also contains commented Supabase config hooks for optional keys such as `OPENAI_API_KEY` and S3-related variables. They are not needed for the SolarSim production path described here.

## 5. Initialise the database and run locally

Run the Prisma and app bootstrap in this order:

```bash
pnpm prisma:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

`pnpm dev` starts the shared types build, the backend on `:3001`, and the frontend on `:5173`. Supabase Auth is still hosted; you are only running the app locally against the remote project.

✅ Validation: `http://localhost:5173` loads, sign-up works with a real email, the confirmation email arrives through Resend, and Sol can stream a reply in the chat panel.

## 6. Sync Supabase auth config and templates

Auth redirects, OAuth settings, SMTP, and the HTML email templates live in `supabase/config.toml` and `supabase/templates/*.html`. They do not deploy automatically.

```bash
set -a && source .env && set +a && yes | supabase config push
```

[!IMPORTANT]
The `set -a && source .env && set +a` part is what makes `env(...)` substitution work. The `yes |` is there so non-interactive runs accept the push prompt.

Verify the hosted project after the push:

```bash
supabase projects list
```

In the dashboard, confirm custom SMTP is enabled with `smtp.resend.com:587` and the sender is `noreply@solarsim.tech`.

✅ Validation: Supabase Auth shows custom SMTP enabled and the pushed config matches your local `supabase/config.toml`.

## 7. Deploy to Heroku

### 7.1 First-time app creation (heroku create, buildpacks:set, certs:auto:enable)

Create the app, pin the Node buildpack, and enable automated TLS:

```bash
heroku create solar-layout-generator
heroku buildpacks:set heroku/nodejs
heroku certs:auto:enable -a solar-layout-generator
```

### 7.2 Set every config var (one big heroku config:set with EVERY required value, with placeholder warnings)

[!WARNING]
Set the `VITE_*` vars before the first deploy. Heroku runs `heroku-postbuild`, which bakes those values into the frontend bundle.

```bash
heroku config:set \
  NODE_ENV="production" \
  GOOGLE_API_KEY="..." \
  VITE_GOOGLE_API_KEY="..." \
  GOOGLE_OAUTH_CLIENT_ID="..." \
  GOOGLE_OAUTH_SECRET="..." \
  GOOGLE_CLOUD_PROJECT="solar-layout-generator" \
  GOOGLE_CLOUD_LOCATION="global" \
  GEMINI_API_KEY="..." \
  CHAT_MODEL="gemini-3.1-flash-lite-preview" \
  SUPABASE_URL="https://<supabase-ref>.supabase.co" \
  SUPABASE_ANON_KEY="..." \
  SUPABASE_SERVICE_ROLE_KEY="..." \
  SUPABASE_DATABASE_URL="postgresql://..." \
  VITE_SUPABASE_URL="https://<supabase-ref>.supabase.co" \
  VITE_SUPABASE_ANON_KEY="..." \
  SITE_URL="https://solarsim.tech" \
  FRONTEND_URL="https://solarsim.tech" \
  APEX_DOMAIN="solarsim.tech" \
  PDF_TOKEN_SECRET="$(openssl rand -hex 32)" \
  PDF_EXPORT_URL="placeholder-update-after-vercel-deploy" \
  VITE_PDF_EXPORT_URL="placeholder-update-after-vercel-deploy" \
  RESEND_API_KEY="..." \
  -a solar-layout-generator
```

### 7.3 Custom domain attachment (heroku domains:add for both apex and www, capture DNS targets, update Porkbun)

After the app exists, attach both hostnames and copy the DNS targets into Porkbun:

```bash
heroku domains:add solarsim.tech -a solar-layout-generator
heroku domains:add www.solarsim.tech -a solar-layout-generator
heroku domains -a solar-layout-generator
```

Update Porkbun with the returned Heroku DNS targets, then wait for propagation. The backend redirects `*.herokuapp.com` and `www.solarsim.tech` to `https://solarsim.tech`, so the apex must be the canonical hostname.

✅ Validation: `curl -I https://<heroku-app>.herokuapp.com` returns a `301` to `https://solarsim.tech`, and `curl -I https://www.solarsim.tech` does the same.

### 7.4 First deploy (git push heroku main, wait, heroku open)

```bash
git push heroku main
heroku open -a solar-layout-generator
```

Heroku runs the `release` phase first (`pnpm db:migrate:deploy`) and then starts the web dyno with `web: pnpm start`. If the release fails, the new revision does not go live.

✅ Validation: the live app opens, redirects to `https://solarsim.tech`, and sign-up works in production.

## 8. Deploy the PDF service to Vercel

The PDF service is a separate Vercel function under `services/pdf-service`. It takes a `previewUrl`, opens it in headless Chromium, waits for `window.__PDF_READY__ === true`, and returns a PDF binary. The function must only accept requests from your frontend origin.

```bash
cd services/pdf-service
vercel
vercel env add ALLOWED_FRONTEND_ORIGIN production
vercel --prod
```

Set the frontend origin exactly, with no trailing slash. For SolarSim production, that is `https://solarsim.tech`.

Then wire the deployed Vercel URL back into Heroku and rebuild the frontend bundle:

```bash
heroku config:set \
  PDF_EXPORT_URL="https://<pdf-service>.vercel.app" \
  VITE_PDF_EXPORT_URL="https://<pdf-service>.vercel.app" \
  -a solar-layout-generator
git commit --allow-empty -m "chore: rebuild for pdf service url"
git push heroku main
```

✅ Validation: the Analysis page download button calls the Vercel function, a PDF downloads, and the browser-origin check in the function logs stays green.

## 9. CI/CD (GitHub Actions)

Set the Heroku deploy secrets in GitHub:

```bash
gh secret set HEROKU_API_KEY --body "$(heroku auth:token)"
gh secret set HEROKU_APP_NAME --body "solar-layout-generator"
```

The workflow does two things:

1. On pull requests and pushes, it installs dependencies, runs `pnpm build`, and runs `pnpm test`.
2. On pushes to `main`, after CI passes, it force-pushes the current commit to the Heroku Git endpoint for the configured app.

[!NOTE]
The workflow is the source of truth for automated deploy behavior. It does not create infrastructure; it only ships the commit that already passed CI.

## 10. Post-deploy smoke tests

Run these against the live production URL:

1. Open `https://solarsim.tech` in a private window and confirm the apex domain loads with a valid TLS certificate.
2. Sign up with a real email address and confirm the verification email arrives from `noreply@solarsim.tech`.
3. Complete sign-in and create a new project from the dashboard.
4. Search for a Malaysian address, wait for the location to resolve, and confirm the workbench loads rooftop panels.
5. Drag or rotate a panel on the workbench and confirm the layout saves without a full page reload.
6. Open the analysis page, enter a bill, and confirm the savings and payback calculations render.
7. Open Sol chat, send a question, and confirm the assistant streams token-by-token.
8. Trigger PDF export and confirm the downloaded file opens as a valid A4 landscape report.

✅ Validation: all eight checks complete without a red console error, auth error, or 5xx response.

## 11. Operational runbook

### 11.1 Email template changes - supabase config push or they don't deploy

Edit the HTML template and, if needed, the subject line in `supabase/config.toml`, then push the config again:

```bash
set -a && source .env && set +a && yes | supabase config push
```

Without that push, the hosted project keeps serving the previous template. Committing the file alone is not enough.

### 11.2 Database migrations - auto-run via Procfile release phase

The `Procfile` release phase runs:

```bash
pnpm db:migrate:deploy
```

That means every Heroku deploy applies migrations before the new web dyno serves traffic. If a migration is needed locally first, use `pnpm db:migrate`; if you need to inspect what Heroku will do, run the deploy command manually against the target database.

### 11.3 Rotating Resend API key

If the Resend key changes:

```bash
heroku config:set RESEND_API_KEY="..." -a solar-layout-generator
set -a && source .env && set +a && yes | supabase config push
```

Then verify a fresh signup. The backend does not hold this key; Supabase Auth uses it through SMTP, so the critical update is the Supabase config push.

### 11.4 Cert renewal verification (heroku certs:auto)

Check certificate health periodically:

```bash
heroku certs:auto -a solar-layout-generator
```

If renewal ever fails, inspect the DNS targets first and make sure the ACME challenge path is not being redirected away from Heroku.

### 11.5 Rebuilding after VITE_* env var changes (empty commit trick)

Any change to `VITE_GOOGLE_API_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, or `VITE_PDF_EXPORT_URL` requires a fresh frontend build. The fastest safe path is an empty commit:

```bash
git commit --allow-empty -m "chore: rebuild for env change"
git push heroku main
```

[!IMPORTANT]
If you skip the rebuild, Heroku will keep serving the old bundle and the browser will still use stale client-side env values.

## 12. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Signup succeeds, but no email arrives | Resend domain unverified or `RESEND_API_KEY` invalid | Check Resend logs, confirm the SPF/DKIM/MX records, then re-run `supabase config push` |
| Resend returns `403 Testing domain restriction` | Still using `onboarding@resend.dev` for arbitrary recipients | Verify `solarsim.tech` in Resend and switch `admin_email` to `noreply@solarsim.tech` |
| `supabase config push` shows an empty SMTP password | `.env` was not sourced before the push | Re-run `set -a && source .env && set +a && yes | supabase config push` |
| Local backend refuses to boot with a chat auth error | Neither `GEMINI_API_KEY` nor `GOOGLE_CLOUD_PROJECT` is set | Add at least one of them to `.env` |
| Heroku app loads at `herokuapp.com` but not the custom domain | DNS targets are wrong or TLS is still provisioning | Re-check `heroku domains -a ...`, then update Porkbun and wait for ACM |
| Requests bounce between `www.solarsim.tech` and the apex forever | `APEX_DOMAIN`, `SITE_URL`, or `FRONTEND_URL` do not match the canonical host | Set all three to `https://solarsim.tech` and redeploy |
| PDF export returns `500 Server misconfigured: ALLOWED_FRONTEND_ORIGIN unset` | Vercel env var missing | Set `ALLOWED_FRONTEND_ORIGIN` with `vercel env add` and redeploy |
| PDF export returns `403 CORS rejected` | Frontend origin in Vercel does not exactly match the browser origin | Re-set `ALLOWED_FRONTEND_ORIGIN` to the exact production origin, no trailing slash |
| PDF export button still points at the placeholder URL | `PDF_EXPORT_URL` changed after the frontend build | Update Heroku config and trigger the empty-commit rebuild |
| Chat returns `409` immediately | The project location is still processing | Wait for the location to finish resolving before opening chat |
| Chat ends with `service_unavailable` | Gemini or Vertex AI stayed on `503` after retries | Retry later; the backend already exhausted its retries |
| Heroku release fails on migration | A Prisma migration is broken or the DB URL is wrong | Inspect `heroku logs --tail`, fix the migration locally, then redeploy |
| OAuth sign-in redirects to localhost in production | `SITE_URL` or Supabase redirect config is stale | Update `.env`, push Supabase config, then redeploy Heroku |
| Sign-in works locally but not on Heroku | `FRONTEND_URL` is not the production origin | Set `FRONTEND_URL=https://solarsim.tech` and redeploy |
| `dig` shows no DNS change after updating Porkbun | DNS propagation lag or record typed incorrectly | Re-check the host fields, then wait and query again |

## 13. Tearing down

Use this only when you want to delete the live environment or start over from scratch.

```bash
heroku apps:destroy solar-layout-generator --confirm solar-layout-generator
gcloud projects delete solar-layout-generator
```

For Vercel, remove the deployment or delete the linked project from the Vercel dashboard if you want the account-side record gone:

```bash
vercel rm <deployment-id>
```

Supabase project deletion is still dashboard-only. After deleting the hosted project, remove the `solarsim.tech` DNS records from Porkbun so the domain no longer points at dead infrastructure.

✅ Validation: the Heroku app no longer serves traffic, the GCP project is gone, the Vercel deployment is removed, and the domain no longer resolves to the old stack.

## Appendix A: env var reference card

| Variable | Source | Notes |
| --- | --- | --- |
| `GOOGLE_API_KEY` | GCP API key | Solar API + Maps + Geocoding |
| `VITE_GOOGLE_API_KEY` | Derived from `GOOGLE_API_KEY` | Frontend map loader |
| `GOOGLE_CLOUD_PROJECT` | GCP project ID | Vertex AI chat path |
| `GOOGLE_CLOUD_LOCATION` | Usually `global` | Vertex AI region |
| `GEMINI_API_KEY` | Google AI Studio | Chat fallback |
| `CHAT_MODEL` | Gemini model name | Chat model selector |
| `GOOGLE_OAUTH_CLIENT_ID` | GCP OAuth client | Google sign-in |
| `GOOGLE_OAUTH_SECRET` | GCP OAuth client | Google sign-in |
| `SUPABASE_URL` | Supabase settings | Backend + auth |
| `SUPABASE_ANON_KEY` | Supabase settings | Frontend auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase settings | Backend privileged access |
| `SUPABASE_DATABASE_URL` | Supabase DB connection string | Prisma |
| `VITE_SUPABASE_URL` | Derived from `SUPABASE_URL` | Frontend auth |
| `VITE_SUPABASE_ANON_KEY` | Derived from `SUPABASE_ANON_KEY` | Frontend auth |
| `SITE_URL` | Final public origin | Supabase auth redirects |
| `APEX_DOMAIN` | `solarsim.tech` | Apex redirect middleware |
| `BACKEND_PORT` | Local only | Backend dev port |
| `FRONTEND_PORT` | Local only | Frontend dev port |
| `FRONTEND_URL` | Local or production origin | Backend CORS |
| `PDF_TOKEN_SECRET` | `openssl rand -hex 32` | PDF token signing |
| `PDF_EXPORT_URL` | Vercel function URL | PDF export endpoint |
| `VITE_PDF_EXPORT_URL` | Derived from `PDF_EXPORT_URL` | Frontend export URL |
| `RESEND_API_KEY` | Resend API key | Supabase SMTP |
| `PORT` | Heroku runtime | Do not set by hand |
| `NODE_ENV` | Runtime / Heroku config | Production mode |
| `ALLOWED_FRONTEND_ORIGIN` | Vercel env | PDF function CORS allowlist |

## Appendix B: Glossary of CLIs

| CLI | Meaning |
| --- | --- |
| `supabase` | Manages hosted Supabase auth, config, and project links |
| `gcloud` | Manages Google Cloud projects, APIs, and credentials |
| `gh` | GitHub CLI for secrets, PRs, and workflow inspection |
| `heroku` | Manages the backend app, config vars, domains, and logs |
| `vercel` | Deploys and configures the PDF function |
| `dig` | Queries DNS records from the terminal |
| `openssl` | Generates secure random secrets and checks TLS |

Last verified: 03/05/26 (against main @ <replace-with-current-sha>)
