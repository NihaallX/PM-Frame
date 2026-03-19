# PMFrame

PMFrame is a frontend-only PM toolkit that turns a raw product problem statement into three practical product strategy artifacts in one pass:

- Jobs-to-be-Done
- User Journey Map
- PRD Skeleton

It uses the Groq API with streaming enabled so the UI starts filling in progressively instead of waiting for one large response.

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Create a local env file from the example and add your Groq key:

```bash
cp .env.example .env
```

3. Start the Vite dev server:

```bash
npm run dev
```

4. Open the local URL shown in the terminal.

## Environment variable

The app reads your Groq API key from:

```bash
VITE_GROQ_API_KEY=your_key_here
```

## Build for production

```bash
npm run build
```

The production bundle is generated in `dist/`.

## Deploy to Vercel

1. Push the project to a Git provider connected to Vercel.
2. Create a new Vercel project and point it at this repo.
3. Add `VITE_GROQ_API_KEY` in the Vercel project environment variables.
4. Keep the default Vite build settings or set:
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. Deploy.

`vercel.json` includes a rewrite so refreshes continue to work on any route.

## What the app sends to Groq

PMFrame makes a streamed request to Groq using:

- Model: `llama-3.3-70b-versatile`
- Endpoint: `https://api.groq.com/openai/v1/chat/completions`
- Output shape: `{ jtbd, journeyMap, prd }`

No backend is required.
