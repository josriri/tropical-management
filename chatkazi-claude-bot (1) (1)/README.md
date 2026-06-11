# Claude × ChatKazi WhatsApp Bot

An AI-powered WhatsApp bot that uses Claude to automatically reply to messages via the ChatKazi API.

---

## How it works

1. Someone sends a WhatsApp message to your number
2. ChatKazi receives it and POSTs it to your `/webhook` endpoint
3. The server passes it to Claude (with conversation history)
4. Claude's reply is sent back via ChatKazi
5. The person receives Claude's response on WhatsApp

You can also trigger conversations manually via the `/send` endpoint.

---

## Local setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment variables
```bash
cp .env.example .env
```
Edit `.env` and fill in your keys:
```
CHATKAZI_API_KEY=ck_live_...
ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Run locally
```bash
npm run dev
```
Server starts on `http://localhost:3000`

### 4. Test it locally (optional)
Send a message manually:
```bash
curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -d '{"to": "254712345678", "text": "Hello!"}'
```

---

## Deploy to Render

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
# Create a new repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/chatkazi-claude-bot.git
git push -u origin main
```

### 2. Create a Web Service on Render
1. Go to [render.com](https://render.com) and sign in
2. Click **New → Web Service**
3. Connect your GitHub repo
4. Render auto-detects `render.yaml` — click **Create Web Service**
5. Go to **Environment** tab and add:
   - `CHATKAZI_API_KEY` → your ChatKazi key
   - `ANTHROPIC_API_KEY` → your Anthropic key
6. Click **Deploy**

Your live URL will be something like:
```
https://chatkazi-claude-bot.onrender.com
```

### 3. Set the webhook in ChatKazi
In your ChatKazi dashboard, set the webhook URL to:
```
https://chatkazi-claude-bot.onrender.com/webhook
```

That's it — incoming WhatsApp messages will now trigger Claude responses automatically.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/send` | Send a message + get Claude reply |
| `POST` | `/webhook` | ChatKazi calls this on incoming messages |
| `GET` | `/health` | Health check (used by Render) |
| `GET` | `/history/:phone` | View conversation history |
| `DELETE` | `/history/:phone` | Clear a conversation |

### POST /send — body
```json
{
  "to": "254712345678",
  "text": "Your message here",
  "sessionId": "default"
}
```

---

## Customising Claude's personality

Edit `SYSTEM_PROMPT` in your `.env` or in the Render environment variables. For example:
```
SYSTEM_PROMPT=You are Kazi, a friendly customer support agent for Acme Store. Always greet customers by name if known. Keep replies under 3 sentences.
```

---

## Notes

- Conversation history is stored in memory — it resets if the server restarts. For persistence, replace the `conversations` object with a database (Redis or SQLite).
- Render's free tier spins down after 15 minutes of inactivity. Upgrade to a paid plan for always-on availability.
