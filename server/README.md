# CDMP Backend

The Express backend serves map aggregates, authentication, research endpoints,
and Ask CDMP. Ask CDMP translates supported natural-language questions into a
validated aggregate QuerySpec before querying MongoDB.

Research analytics require a selected year. Unfiltered all-years analytics are
rejected so a dashboard visit cannot start a multi-million-record aggregation.

## Environment Setup

From the `server` directory, create the private environment file:

```bash
cp .env.example .env
```

Set `JWT_SECRET` to a long random value. For Docker, the Compose file replaces
`HOST`, `PORT`, `MONGODB_URI`, and `REQUIRE_MONGODB` with container-safe values.
The remaining values, including the AI configuration, come from `server/.env`.

| Variable | Purpose |
| --- | --- |
| `HOST` | Backend bind address |
| `PORT` | Backend port |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret used to sign authentication tokens |
| `REQUIRE_MONGODB` | Exit at startup when MongoDB is unavailable |
| `CLIENT_URL` | Frontend URL used to build local password-reset links |
| `PASSWORD_RESET_PREVIEW` | Return a reset link without email delivery when explicitly set to `true` |
| `AI_PROVIDER` | `openai-compatible`, `anthropic`, or `gemini` |
| `AI_API_KEY` | Private key for the selected provider |
| `AI_MODEL` | Provider model identifier |
| `AI_BASE_URL` | Required for OpenAI-compatible providers; optional otherwise |
| `AI_REQUEST_TIMEOUT_MS` | Provider request timeout in milliseconds |

For a local course demonstration without an email provider, set
`PASSWORD_RESET_PREVIEW=true`. The forgot-password screen will display a
15-minute reset link. Keep this setting `false` outside a controlled demo
because anyone with access to the form and a registered email address could
obtain that account's reset link.

## Ask CDMP Provider Setup

Choose one provider configuration and place it in `server/.env`. The listed
models are tested examples for this project; another model can be used if it
supports the provider's structured JSON output format.

### OpenAI

Create a key from the [OpenAI API key page](https://platform.openai.com/settings/organization/api-keys).

```dotenv
AI_PROVIDER=openai-compatible
AI_API_KEY=replace_with_your_openai_key
AI_MODEL=gpt-4o-mini
AI_BASE_URL=https://api.openai.com/v1
AI_REQUEST_TIMEOUT_MS=30000
```

### Claude

Create a key from the [Claude Console](https://console.anthropic.com/settings/keys).

```dotenv
AI_PROVIDER=anthropic
AI_API_KEY=replace_with_your_anthropic_key
AI_MODEL=claude-sonnet-4-6
AI_BASE_URL=
AI_REQUEST_TIMEOUT_MS=30000
```

### Gemini

Create a key from [Google AI Studio](https://aistudio.google.com/apikey).

```dotenv
AI_PROVIDER=gemini
AI_API_KEY=replace_with_your_gemini_key
AI_MODEL=gemini-3.5-flash-lite
AI_BASE_URL=
AI_REQUEST_TIMEOUT_MS=30000
```

API keys stay on the backend. Do not put them in client files, Dockerfiles,
source code, screenshots, documentation, or Git. `server/.env` is ignored by
Git and excluded from the server image build context; Docker injects it only at
container runtime.

After changing provider settings for a running Docker stack, recreate the
server container from the repository root:

```bash
docker compose up -d --force-recreate server
```

## Run Locally

Start MongoDB separately, then run:

```bash
npm install
npm run dev
```

For the complete application and local MongoDB container, use Docker from the
repository root:

```bash
docker compose up --build -d
```

## Verify Ask CDMP

With the backend running and data restored:

```bash
curl -sS -X POST http://localhost:5001/api/ask \
  -H "Content-Type: application/json" \
  --data '{"question":"Which party received the most donations nationally in 2024?"}'
```

A successful response contains `answer`, `query`, `data`,
`interpretedFilters`, and `coverage`. An AI service error usually means the
provider configuration, key, model, network access, or timeout needs attention.

Ask CDMP supports aggregate questions including:

- summaries by party, province, riding, and year range
- top or bottom rankings of up to ten parties, provinces, ridings, or years
- comparisons across two to six parties, two to ten provinces, or two years
- single-party and multi-party donation trends
- party and province donation changes between two endpoint years
- total amount, donation count, donor count, and average donation metrics

Questions requesting individual donor records, raw database access, multiple
metrics in one answer, or operations that change data are not supported.

Ask CDMP includes coverage notes when a requested period contains known gaps in
the imported data. The current import excludes CPC records in 2020 and LPC
records in 2021, while 2024 currently contains BQ records only. Population
values have not been loaded, so per-capita questions are unsupported. Ask about
donation counts instead.

## Tests

The automated tests mock MongoDB and provider calls, so they do not spend AI
credits and do not require a real API key:

```bash
npm test
```
