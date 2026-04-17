# PDF Service

Vercel serverless function that renders a given frontend URL to a PDF binary using headless Chromium. Deployed independently of the Heroku-hosted frontend and backend; see `docs/TRD.md` §14 for the full architecture rationale.

## Endpoints

- `POST /api/pdf-export` — accepts `{ previewUrl: string, filename?: string }`, drives Puppeteer against the URL, returns `application/pdf` binary.

## Environment Variables

| Name                      | Purpose                                                               | Example                                |
| ------------------------- | --------------------------------------------------------------------- | -------------------------------------- |
| `ALLOWED_FRONTEND_ORIGIN` | SSRF guard — only URLs whose origin matches this value can be rendered | `https://solar-layout-generator.herokuapp.com` |

Set via:

```bash
vercel env add ALLOWED_FRONTEND_ORIGIN production
```

## Deploy

First-time setup (interactive prompts for scope / project name):

```bash
cd services/pdf-service
vercel                # links this directory to a new Vercel project
vercel env add ALLOWED_FRONTEND_ORIGIN production
vercel --prod         # production deploy, prints the function URL
```

Subsequent deploys:

```bash
vercel --prod         # redeploys to production
vercel                # deploys a preview URL (useful for testing branches)
```

## Local Development

```bash
npm install
vercel dev            # starts Vercel dev server with local function emulation
```

The `vercel dev` command tunnels requests to the function at `http://localhost:3000/api/pdf-export`. Set `ALLOWED_FRONTEND_ORIGIN` in `.env.local` for local testing.

## Runtime

- **Node version:** 20+ (Vercel Hobby default)
- **Memory:** 1024 MB per invocation (see `vercel.json`)
- **Max duration:** 60 s per invocation
- **Cold start:** 2–5 s (Chromium boot)
- **Warm invocation:** 3–8 s end-to-end
