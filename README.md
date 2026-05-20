# Dream Life

Personal app for focus, home, money, and weekly reflections. Repo folder is still named `Life OS`.

**Demo:** [dream-life-demo.mp4](docs/dream-life-demo.mp4) (~6 min)  
Full-quality copy on your machine: `docs/Dream_life_demo.mp4` (not in git, too large).

## Screenshots

**Suggestions** — nudges, today’s note, quick actions

![Suggestions](docs/images/suggestions.png)

**Tasks**

![Tasks](docs/images/tasks.png)

**Focus**

![Focus](docs/images/focus.png)

**Cleaning**

![Cleaning](docs/images/cleaning.png)

**Patterns**

![Patterns](docs/images/patterns.png)

**Weekly review**

![Weekly review](docs/images/weekly-review.png)

## Run locally

```bash
docker compose up -d
```

Backend (`backend/`):

```bash
python -m venv .venv
# activate venv
pip install -r requirements.txt
copy .env.example .env
python -m alembic upgrade head
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8765
```

Frontend (`frontend/`):

```bash
npm install
npm run dev
```

Open http://localhost:3001

## Stack

Next.js · FastAPI · PostgreSQL

## Clear test data

Settings → Developer tools → **Reset all data** (or **Clear app history** if you want to keep goals/tasks/zones).
