# Notes Drive Frontend (React + Vite + Tailwind)

## Local run
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

## Env
- `VITE_API_BASE` = backend URL (local or Render URL)

## Deploy
- Netlify: build command `npm run build`, publish directory `dist`
- Set environment variable `VITE_API_BASE` to your backend URL
