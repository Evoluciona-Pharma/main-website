# Evoluciona Pharma — Provider Portal

Licensed-provider portal: catalog, request list, and a 4-step information form. **No prices on screen.** A representative follows up.

The API lives in a separate repo (`custom-hub-api`). This app only consumes it.

## Requirements

- Node 22, or Docker
- API running at `http://localhost:3000` (login, catalog, and orders)

## Local

```bash
cp .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:3000
npm install
npm run dev                  # http://localhost:3001
```

Demo: `provider@evolucionafar.ma` / `Demo123!`

```bash
npm test
npm run build && npm start
```

## Docker

```bash
docker compose up --build
```

Open [http://localhost:3001](http://localhost:3001). The browser calls the API on `:3000`; that URL is baked in at build time (`NEXT_PUBLIC_API_URL`).

To point at another API:

```bash
NEXT_PUBLIC_API_URL=https://api.example.com docker compose up --build
```

```bash
docker compose down
```

## Jenkins (staging / production)

Docker image on the Azure VM, nginx in front. Step-by-step: [docs/jenkins-deploy.md](docs/jenkins-deploy.md).

## GitHub Pages

A push to `main` publishes the static export at https://evoluciona-pharma.github.io/Site/ (`NEXT_PUBLIC_BASE_PATH=/Site`).
