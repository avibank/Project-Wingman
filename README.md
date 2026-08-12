# AVBANK — Aviation Study App Prototype

A study app prototype for AU aviation students: video lessons, per-chapter
practice exams, discussion threads, and a PDF library, organized by chapter.

## Run locally (optional — not required to deploy)

```
npm install
npm run dev
```

## Deploy to Vercel

1. Push this folder to a new GitHub repository.
2. Go to vercel.com, sign in with GitHub, click "Add New Project."
3. Select this repository and click **Deploy**. Vercel auto-detects the
   Vite/React setup — no configuration needed.
4. You'll get a live URL like `avbank.vercel.app` within about a minute.

## Where things live

- `src/App.jsx` — the entire app (chapters, exam logic, discussion, PDF library)
- Chapter content (videos, questions, PDFs) is defined near the top of `App.jsx`
  in the `CHAPTERS` and `PDFS` arrays — edit those directly to add real content.
