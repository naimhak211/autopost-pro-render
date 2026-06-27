# AutoPost Pro

## Backend Deploy (Render.com)
1. GitHub-এ push করুন
2. render.com → New Web Service → GitHub repo select
3. Root Directory: `backend`
4. Build Command: `pip install -r requirements.txt`
5. Start Command: `gunicorn app:app --bind 0.0.0.0:$PORT`
6. Environment Variables যোগ করুন

## Frontend Deploy (Netlify)
1. `cd frontend && npm install && npm run build`
2. `netlify deploy --prod --dir dist`

## Required Environment Variables
- SECRET_KEY
- ADMIN_USERNAME
- ADMIN_PASSWORD
- GOOGLE_CLIENT_ID
- ANTHROPIC_API_KEY (optional)
- TELEGRAM_BOT_TOKEN (optional)
- TELEGRAM_CHAT_ID (optional)
- BACKEND_PUBLIC_URL
- FRONTEND_URL
