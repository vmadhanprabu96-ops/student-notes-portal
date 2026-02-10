# Notes Drive Backend (Node + Express)

## What it does
- Reads your Google Drive root folder
- Lists **subject folders**
- Lists files inside each subject
- Provides **download streaming** endpoint
- Allows **admin upload** (protected by ADMIN_KEY)

## Local run
```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

## Required env
- `GOOGLE_SERVICE_ACCOUNT_JSON` (service account JSON)
- `DRIVE_ROOT_FOLDER_ID` (your Drive folder id)
- `ADMIN_KEY` (simple admin secret)

### Service account setup
1) Google Cloud Console → Create Project → Enable **Google Drive API**
2) Create **Service Account**
3) Create Key → JSON
4) Copy JSON into `GOOGLE_SERVICE_ACCOUNT_JSON`
5) In your Google Drive folder settings, **Share your notes folder** with:
   `client_email` from the service account JSON (Viewer is enough for read, Editor for upload).

✅ Now this backend can read/upload even when your PC is OFF (after deployment).
