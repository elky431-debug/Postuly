# Postuly — Automatisation de candidatures

SaaS français pour automatiser l'envoi de candidatures spontanées depuis Gmail.

## Stack

| Couche | Techno |
|--------|--------|
| Backend | FastAPI (Python) |
| Frontend | Next.js 15 + Tailwind CSS |
| Base de données | Supabase (PostgreSQL) |
| Scraping | Playwright (Python) |
| Files d'attente | Celery + Redis |
| Automatisation | n8n (Docker) |
| Auth | Supabase Auth (Google OAuth) |
| IA | Claude API / GPT-4o-mini |

## Lancer le projet

### Prérequis

- Python 3.12+
- Node.js 20+
- Docker & Docker Compose
- Compte Supabase

### 1. Configuration

```bash
cp .env.example .env
# Remplir les variables dans .env

cd frontend
cp .env.local.example .env.local
# Remplir les variables Supabase
```

### 2. Base de données

Copier le contenu de `backend/app/db/schema.sql` dans le SQL Editor de Supabase et l'exécuter.

### 3. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
playwright install chromium
uvicorn app.main:app --reload
```

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

### 5. Services (Redis + Celery + n8n)

```bash
docker compose up -d
```

Le backend tourne sur `http://localhost:8000`, le frontend sur `http://localhost:3000`.

## Architecture

```
/
├── backend/              # API FastAPI
│   ├── app/
│   │   ├── api/          # Routes (auth, profiles, campaigns, applications, cv, companies)
│   │   ├── services/     # Logique métier (SIRENE, scraping, IA, Gmail)
│   │   ├── models/       # Schémas Pydantic
│   │   ├── db/           # Client Supabase + schéma SQL
│   │   └── tasks/        # Tâches Celery (pipeline, envoi email)
│   └── Dockerfile
├── frontend/             # Next.js App Router
│   ├── src/
│   │   ├── app/          # Pages (dashboard, campaigns, kanban, auth, onboarding)
│   │   ├── components/   # Composants (ui, layout, kanban)
│   │   └── lib/          # Utils, API client, types, Supabase client
├── docker-compose.yml    # Redis + Celery + n8n
└── .env.example
```
