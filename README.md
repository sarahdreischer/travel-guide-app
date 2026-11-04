# Trip Guide

Trip Guide is an AI-powered travel guide app which alleviates micro-decision making (such as finding the best transportation medium, buying public transport tickets, restaurant tipping culture etc.) for travellers. 

Users have the ability to generate trips and provide details such as budget range, preferred acitivites, group size etc. and in turn receive structured advice across categories like transportation, food, safety, activities and more in.

Check out [src/lib/travel-config.ts](travel-config.ts) for a full list of questions that are answered for any created trip.

The app is built with Next.js 15 (App Router), TypeScript, Drizzle ORM, PostgreSQL, Tailwind CSS, and Vercel AI SDK.

Any images provided in this app are provided by [https://unsplash.com](Unsplash). 

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
| `npm run clear-cache -- <tripId>` | Delete a trip's cached structured guide (regenerates on next load) |
| `npm run export-advice -- --weeks 4` | Export structured trip guides (destination facts + topics/items) for recent trips to a printable HTML file, one trip per page |

### Exporting advice for quality review

Dump AI advice for recently-created trips into a print-ready HTML file (one page
per trip) so you can review LLM response quality and print it on paper:

```bash
npm run export-advice -- --weeks 4          # trips created in the last 4 weeks (default)
npm run export-advice -- --days 10          # last 10 days
npm run export-advice -- --months 3         # last 3 months
npm run export-advice -- --by generated     # filter by advice generated date instead of trip created date
npm run export-advice -- --weeks 2 --out review.html   # custom output filename
```

Open the resulting `.html` file in a browser and choose **Print → Save as PDF**
(or print to paper). Each trip is laid out on its own page with its metadata,
category group headline tips, and the full question/answer set per category.
Requires `DATABASE_URL` in `.env.local`.

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
├── actions/                # Server Actions (auth, trip, trip-guide, vote, profile)
├── components/             # React components (forms, cards, UI primitives)
├── lib/
│   ├── travel-config.ts        # Destinations config
│   ├── question-library.ts     # Topics + questions with stable IDs and metadata
│   ├── web-research.ts         # Server-side web retrieval for destination research
│   ├── destination-research.ts # Stage 1: research destination facts from the web
│   ├── destination-facts-store.ts # Cache/persistence for researched destination facts
│   ├── trip-guide-generator.ts # Stage 2: structured TripGuide generation
│   ├── trip-guide-store.ts     # Structured trip guide persistence
│   ├── ai-errors.ts            # Shared AI error types
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
