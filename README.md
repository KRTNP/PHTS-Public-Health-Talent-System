# PHTS-Public-Health-Talent-System

PHTS (Position Allowance for Special Duties) is a full-stack system for Uttaradit Hospital. It handles eligibility requests for the P.T.S. allowance, their approval, and the monthly payroll calculation.

## What the system does

### Eligibility requests

Users submit a P.T.S. request with attachments. The request goes through six approval steps:

HEAD_WARD → HEAD_DEPT → PTS_OFFICER → HEAD_HR → HEAD_FINANCE → DIRECTOR

Once fully approved, it becomes an official eligibility record.

### Monthly payroll cycle

The PTS_OFFICER opens a payroll period, and the system calculates the results, applying leave rules, license checks, and retroactive adjustments. HR, Finance, and the Director then approve the period. After the final approval the period is locked as a snapshot for reporting.

## Roles

| Role | Can do |
|---|---|
| `USER` | Submit requests and track their status |
| `HEAD_WARD` | Approve requests within their unit |
| `HEAD_DEPT` | Approve requests within their department |
| `PTS_OFFICER` | Verify documents, run calculations, manage payroll periods |
| `HEAD_HR` | Review payroll periods for HR |
| `HEAD_FINANCE` | Review payroll periods against the budget |
| `DIRECTOR` | Give final approval |
| `FINANCE_OFFICER` | Export data and view reports (read-only) |
| `ADMIN` | Administer the system |

## Repository structure

```
phts-project/
├─ backend/                  # Express + TypeScript API
│  ├─ src/
│  │  ├─ modules/            # Domain modules (request, payroll, data-quality, ...)
│  │  ├─ middlewares/        # Auth, validation, error handling
│  │  ├─ shared/             # Utilities, shared helpers
│  │  └─ index.ts            # App entry
│  ├─ scripts/               # Backend scripts and jobs
│  ├─ uploads/               # File uploads (gitkept)
│  ├─ .env.example
│  └─ package.json
│
├─ frontend/                 # Next.js (App Router)
│  ├─ src/
│  │  ├─ app/                # Routes/pages
│  │  ├─ components/         # Shared UI components
│  │  ├─ features/           # API wrappers + hooks per domain
│  │  ├─ theme/              # Theme and styles
│  │  └─ types/              # Global UI types
│  ├─ public/
│  ├─ next.config.ts
│  └─ package.json
│
├─ scripts/                  # Workspace scripts
└─ package.json              # Root scripts
```

## Getting started

Install dependencies for both backend and frontend:

```
cd phts-project
npm run install:all
```

Set up environment files. The backend reads `backend/.env` (copy it from `backend/.env.example`), and the frontend reads `frontend/.env.local`. The main keys are:

- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `JWT_SECRET`
- `REDIS_HOST`, `REDIS_PORT` (only if Redis is enabled)
- `NEXT_PUBLIC_API_URL` (frontend)

Run the backend and frontend together in dev mode:

```
cd phts-project
npm run dev:all
```

Build both:

```
cd phts-project
npm run build:all
```

All three commands are defined in the root `package.json`:

| Script | What it does |
|---|---|
| `npm run install:all` | Installs backend and frontend dependencies |
| `npm run dev:all` | Runs backend and frontend together |
| `npm run build:all` | Builds backend and frontend |

## Team conventions

- Put domain logic in the module it belongs to.
- Use camelCase in the API and services, and PascalCase for React components.
- Never commit secrets or real credentials. `.env` files stay on your machine.

## More documentation

- System design and workflows: `../docs/` (workspace root)
- Backend: `backend/README.md`
- Frontend: `frontend/README.md`
