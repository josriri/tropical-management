import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const CHATKAZI_BASE = "https://api.chatkazi.app/api/v1";
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// In-memory conversation history per phone number
const conversations = {};

// ─── Helper: send a WhatsApp message via ChatKazi ────────────────────────────
async function sendWhatsApp(to, text, sessionId = "default") {
  const res = await fetch(`${CHATKAZI_BASE}/messages/text`, {
    method: "POST",
    headers: {
      "x-api-key": process.env.CHATKAZI_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sessionId, to, text }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "ChatKazi send failed");
  return data;
}

// ─── Helper: get Claude's reply ──────────────────────────────────────────────
async function getClaudeReply(phone, userText) {
  if (!conversations[phone]) conversations[phone] = [];

  conversations[phone].push({ role: "user", content: userText });

  // Keep last 20 messages to avoid token overuse
  const history = conversations[phone].slice(-20);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    system:
      process.env.SYSTEM_PROMPT ||
      "You are a helpful WhatsApp assistant. Keep replies concise and friendly, as if texting. Use plain text only — no markdown.",
    messages: history,
  });

  const reply = response.content.find((b) => b.type === "text")?.text || "";
  conversations[phone].push({ role: "assistant", content: reply });
  return reply;
}

// ─── POST /send — send a message and get Claude's reply ─────────────────────
// Used by your own frontend or scripts to initiate a conversation
app.post("/send", async (req, res) => {
  const { to, text, sessionId } = req.body;
  if (!to || !text) {
    return res.status(400).json({ error: "Missing 'to' or 'text'" });
  }

  try {
    // Send the outgoing message
    await sendWhatsApp(to, text, sessionId);

    // Get Claude's reply
    const reply = await getClaudeReply(to, text);

    // Send Claude's reply back to the user
    await sendWhatsApp(to, reply, sessionId);

    res.json({ success: true, reply });
  } catch (err) {
    console.error("Error in /send:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /webhook — receives incoming WhatsApp messages from ChatKazi ───────
// Configure this URL in your ChatKazi dashboard as the webhook endpoint
app.post("/webhook", async (req, res) => {
  // Acknowledge immediately so ChatKazi doesn't retry
  res.sendStatus(200);

  try {
    const body = req.body;
    console.log("Incoming webhook payload:", JSON.stringify(body, null, 2));

    // ChatKazi webhook payload structure — adjust field names if needed
    // Common patterns: body.from / body.sender / body.message / body.text
    const from =
      body.from ||
      body.sender ||
      body.data?.from ||
      body.message?.from;

    const text =
      body.text ||
      body.body ||
      body.message?.text?.body ||
      body.data?.message?.text;

    if (!from || !text) {
      console.log("Webhook: skipping — no sender or text found");
      return;
    }

    console.log(`Incoming from ${from}: ${text}`);

    const sessionId = body.sessionId || body.session || "default";

    // Get Claude's reply and send it
    const reply = await getClaudeReply(from, text);
    await sendWhatsApp(from, reply, sessionId);

    console.log(`Replied to ${from}: ${reply}`);
  } catch (err) {
    console.error("Error in /webhook:", err.message);
  }
});

// ─── GET /health — Render uses this to confirm the service is up ─────────────
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// ─── GET /history/:phone — inspect conversation history ─────────────────────
app.get("/history/:phone", (req, res) => {
  const history = conversations[req.params.phone] || [];
  res.json({ phone: req.params.phone, messages: history });
});

// ─── DELETE /history/:phone — reset a conversation ──────────────────────────
app.delete("/history/:phone", (req, res) => {
  delete conversations[req.params.phone];
  res.json({ cleared: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
