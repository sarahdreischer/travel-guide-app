# Travel Guide

AI-powered travel advice app. Create trips, get structured advice across categories like transportation, food, safety, and more.

Built with Next.js 15 (App Router), TypeScript, Drizzle ORM, PostgreSQL, Tailwind CSS, and Vercel AI SDK.

## Prerequisites

- Node.js 18+
- Docker (for local PostgreSQL)
- An OpenAI API key

## Local Development Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Start PostgreSQL via Docker

```bash
docker compose up -d
```

This starts a PostgreSQL 16 container on port 5432 with:
- User: `travel_user`
- Password: `travel_pass`
- Database: `travel_guide`
- The `citext` extension is auto-enabled via `docker/init.sql`

### 3. Create your `.env.local`

Copy the example and fill in your OpenAI key:

```bash
cp .env.example .env.local
```

Then edit `.env.local` and set your `OPENAI_API_KEY`.

Key environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | — | PostgreSQL connection string |
| `OPENAI_API_KEY` | — | Required for AI advice generation |
| `AI_MODEL` | `gpt-4o-mini` | Which OpenAI model to use |
| `AI_MAX_CALLS_PER_MINUTE` | `20` | Burst rate limit |
| `AI_MAX_CALLS_PER_DAY` | `100` | Daily rate limit |
| `AI_FAILURE_COOLDOWN_MINUTES` | `2` | Pause after AI failure |
| `AI_BATCH_TIMEOUT_MS` | `90000` | Timeout per batch AI call |
| `GENERATING_TRIP_ADVICE_TIMEOUT_SECONDS` | `15` | Loading page redirect timeout |
| `RECONCILIATION_INTERVAL_MINUTES` | `10` | Background reconciliation frequency |

### 4. Run database migrations

```bash
DATABASE_URL=postgresql://travel_user:travel_pass@localhost:5432/travel_guide npx drizzle-kit migrate
```

This creates all tables (`users`, `sessions`, `trips`, `advice_cache`, `votes`, `login_attempts`).

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:file -- <pattern>` | Run specific test file (e.g. `npm run test:file -- sub-questions`) |
| `npm run type-check` | TypeScript check without emitting |
| `npm run lint` | ESLint |
| `npm run reconcile` | Force-reconcile missing AI advice for all trips |
| `npm run reconcile -- <tripId>` | Reconcile a specific trip |
| `npm run clear-cache -- <tripId>` | Delete all cached AI advice for a trip (regenerates on next load) |

## Database Management

```bash
# Start database
docker compose up -d

# Stop database (data persists)
docker compose down

# Stop and wipe all data
docker compose down -v

# Connect to database directly
docker compose exec postgres psql -U travel_user -d travel_guide

# Generate a new migration after schema changes
DATABASE_URL=postgresql://travel_user:travel_pass@localhost:5432/travel_guide npx drizzle-kit generate

# Apply migrations
DATABASE_URL=postgresql://travel_user:travel_pass@localhost:5432/travel_guide npx drizzle-kit migrate
```

## Production Deployment (DigitalOcean + Neon + Resend)

### Prerequisites

- [DigitalOcean](https://www.digitalocean.com/) account
- [Neon](https://neon.tech/) account (free tier — PostgreSQL database)
- [Resend](https://resend.com/) account (free tier — transactional email)
- GitHub repo connected to DO App Platform

### 1. Set up Neon database

1. Create a new Neon project → database named `travel_guide`
2. Enable the `citext` extension: `CREATE EXTENSION IF NOT EXISTS citext;`
3. Copy the connection string (starts with `postgresql://...?sslmode=require`)
4. Run migrations against it:
   ```bash
   DATABASE_URL=<your-neon-url> npx drizzle-kit push
   ```

### 2. Set up Resend

1. Sign up at resend.com, verify a domain (or use their test domain)
2. Get your API key — this becomes `SMTP_PASS`
3. SMTP settings: host=`smtp.resend.com`, port=`587`, user=`resend`

### 3. Deploy to DigitalOcean App Platform

1. Push code to GitHub
2. In DO dashboard: Create App → select your repo
3. It auto-detects the `.do/app.yaml` spec and `Dockerfile`
4. Set environment variables (secrets) in the dashboard:
   - `DATABASE_URL` — Neon connection string
   - `OPENAI_API_KEY` — your OpenAI key
   - `RESEND_API_KEY` — Resend API key (used as SMTP_PASS)
   - `APP_URL` — your production URL (e.g. `https://travel-guide-xxx.ondigitalocean.app`)
5. Deploy — takes ~2 minutes

### 4. Verify

- Visit your app URL → should show the login page
- Create an account, create a trip, confirm AI advice generates

### Notes

- No function timeout limits — AI calls can run as long as needed
- The `scheduled-reconciliation` module runs natively as a persistent process
- App Platform auto-deploys on push to `main`
- Instance: `basic-xxs` ($5/mo) is sufficient for personal use
- Scale up instance size if you need more concurrent users

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/login/       # Login page
│   ├── (setup)/setup/      # Registration/setup page
│   ├── (app)/              # Authenticated pages (home, destinations, profile, trip)
│   └── api/                # API routes
├── actions/                # Server Actions (auth, trip, advice, vote, profile)
├── components/             # React components (forms, cards, UI primitives)
├── lib/
│   ├── travel-config.ts    # Central config: destinations, categories, questions, topic mappings
│   ├── llm-adapter.ts      # AI provider integration (OpenAI via Vercel AI SDK)
│   ├── advice-store.ts     # Advice cache DB operations
│   ├── ai-rate-limiter.ts  # Rate limiting for AI calls
│   ├── auth.ts             # Authentication service
│   ├── profile.ts          # Profile service
│   └── validators.ts       # Pure validation functions
└── db/
    ├── schema.ts           # Drizzle table definitions
    └── migrations/         # SQL migrations
```

## Adding New Travel Categories/Questions

Edit `src/lib/travel-config.ts` — this is the single source of truth for:
- Supported destinations
- Categories and their sub-questions
- Concise topic mappings (home page cards)

After adding new questions, existing cached advice will be detected as stale and regenerated on the next page load.
