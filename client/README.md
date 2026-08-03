# CDMP Frontend

The React frontend provides the donation map, research dashboard, and Ask CDMP
interface. AI requests are sent to the backend; no provider key belongs in the
client environment or browser bundle.

The research dashboard loads its paginated records immediately. Analytics
charts load only after a year is selected and the filters are applied.

## Docker Setup

Run the complete application from the repository root:

```bash
cp server/.env.example server/.env
docker compose up --build -d
```

Configure the AI provider in `server/.env`, not `client/.env`. The Docker client
is available at `http://localhost:8080` and calls the backend at
`http://localhost:5001/api`.

See [../DOCKER.md](../DOCKER.md) for the MongoDB restore steps and
[../server/README.md](../server/README.md) for OpenAI, Claude, and Gemini setup.

## Local Development

```bash
cp .env.example .env
npm install
npm run dev
```

The default `VITE_API_BASE_URL` is `http://localhost:5001/api`, so the backend
must also be running. Vite environment variables are included in the browser
bundle; never place `AI_API_KEY`, `JWT_SECRET`, or another secret in
`client/.env` or any `VITE_` variable.

## Tests

```bash
npm test
npm run lint
npm run build
```

For end-to-end tests against Docker:

```bash
npm run cypress:run
```
