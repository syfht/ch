// Itsukime chat server — Express + SQLite (node:sqlite, Node >= 22.5)
// Run with:  cd server && npm install && npm start
import express from "express";
import cors from "cors";
import multer from "multer";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const PORT = process.env.PORT || 3001;
const PFPS_DIR = path.join(ROOT, "pfps");
const USER_PFPS_DIR = path.join(ROOT, "userpfps");
fs.mkdirSync(PFPS_DIR, { recursive: true });
fs.mkdirSync(USER_PFPS_DIR, { recursive: true });

/* ---------------------------------- DBs ---------------------------------- */
const usersDb = new DatabaseSync(path.join(__dirname, "users.db"));
const chatDb = new DatabaseSync(path.join(__dirname, "chat.db"));

usersDb.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    username_lower TEXT NOT NULL UNIQUE,
    avatar TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL
  );
`);

chatDb.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel TEXT NOT NULL DEFAULT 'general',
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    avatar TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel, id);
`);

/* ------------------------------ Default pfps ------------------------------ */
const PALETTE = ["#e02424", "#b91c1c", "#f05252", "#7f1d1d", "#ef4444", "#991b1b"];
if (fs.readdirSync(PFPS_DIR).length === 0) {
  PALETTE.forEach((color, i) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" fill="#141414"/><circle cx="128" cy="128" r="86" fill="${color}"/><circle cx="128" cy="106" r="34" fill="#141414"/><path d="M60 214c10-42 36-62 68-62s58 20 68 62z" fill="#141414"/></svg>`;
    fs.writeFileSync(path.join(PFPS_DIR, `default-${i + 1}.svg`), svg);
  });
}
const defaultAvatars = () =>
  fs
    .readdirSync(PFPS_DIR)
    .filter((f) => /\.(svg|png|jpe?g|webp|gif)$/i.test(f))
    .sort()
    .map((f) => `/pfps/${f}`);

/* --------------------------------- Uploads -------------------------------- */
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, USER_PFPS_DIR),
    filename: (_req, file, cb) =>
      cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase() || ".png"}`),
  }),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    cb(null, /^image\/(png|jpeg|webp|gif)$/.test(file.mimetype)),
});

/* ---------------------------------- App ----------------------------------- */
const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use("/pfps", express.static(PFPS_DIR, { maxAge: "1d" }));
app.use("/userpfps", express.static(USER_PFPS_DIR, { maxAge: "1d" }));

const publicUser = (u) => ({ id: u.id, username: u.username, avatar: u.avatar });
const authed = (req) => {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  return usersDb.prepare("SELECT * FROM users WHERE token = ?").get(token) || null;
};

app.get("/api/health", (_req, res) => res.json({ ok: true, name: "Itsukime" }));

app.get("/api/avatars", (_req, res) => res.json({ avatars: defaultAvatars() }));

app.get("/api/username-available", (req, res) => {
  const name = String(req.query.username || "").trim();
  if (!/^[a-zA-Z0-9_.-]{3,20}$/.test(name)) return res.json({ available: false });
  const row = usersDb
    .prepare("SELECT 1 FROM users WHERE username_lower = ?")
    .get(name.toLowerCase());
  res.json({ available: !row });
});

// Upload a custom profile picture -> /userpfps/<uuid>.png
app.post("/api/upload-avatar", upload.single("avatar"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Please upload a PNG, JPG, WEBP or GIF under 4MB." });
  res.json({ avatar: `/userpfps/${req.file.filename}` });
});

// Register a unique username (saved in users.db)
app.post("/api/register", (req, res) => {
  const username = String(req.body?.username || "").trim();
  const avatar = String(req.body?.avatar || "").trim();

  if (!/^[a-zA-Z0-9_.-]{3,20}$/.test(username))
    return res.status(400).json({ error: "Username must be 3-20 characters (letters, numbers, . _ -)." });
  if (!/^\/(pfps|userpfps)\/[\w.\-]+$/.test(avatar))
    return res.status(400).json({ error: "Please choose a profile picture." });
  if (usersDb.prepare("SELECT 1 FROM users WHERE username_lower = ?").get(username.toLowerCase()))
    return res.status(409).json({ error: "That username is already taken." });

  const user = {
    id: crypto.randomUUID(),
    username,
    username_lower: username.toLowerCase(),
    avatar,
    token: crypto.randomBytes(24).toString("hex"),
    created_at: Date.now(),
  };
  usersDb
    .prepare(
      "INSERT INTO users (id, username, username_lower, avatar, token, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(user.id, user.username, user.username_lower, user.avatar, user.token, user.created_at);

  res.json({ token: user.token, user: publicUser(user) });
});

app.get("/api/me", (req, res) => {
  const user = authed(req);
  if (!user) return res.status(401).json({ error: "Not signed in." });
  res.json({ user: publicUser(user) });
});

app.get("/api/users", (_req, res) => {
  const rows = usersDb.prepare("SELECT id, username, avatar FROM users ORDER BY username").all();
  res.json({ users: rows });
});

// Chat history from chat.db
app.get("/api/messages", (req, res) => {
  const after = Number(req.query.after || 0);
  const rows = chatDb
    .prepare(
      "SELECT * FROM messages WHERE channel = 'general' AND id > ? ORDER BY id ASC LIMIT 500",
    )
    .all(after);
  res.json({ messages: rows });
});

app.post("/api/messages", (req, res) => {
  const user = authed(req);
  if (!user) return res.status(401).json({ error: "Not signed in." });
  const content = String(req.body?.content || "").trim().slice(0, 2000);
  if (!content) return res.status(400).json({ error: "Message is empty." });

  const created_at = Date.now();
  const info = chatDb
    .prepare(
      "INSERT INTO messages (channel, user_id, username, avatar, content, created_at) VALUES ('general', ?, ?, ?, ?, ?)",
    )
    .run(user.id, user.username, user.avatar, content, created_at);

  res.json({
    message: {
      id: Number(info.lastInsertRowid),
      channel: "general",
      user_id: user.id,
      username: user.username,
      avatar: user.avatar,
      content,
      created_at,
    },
  });
});

// Optional: serve the built frontend if you copy it into server/public
const staticDir = path.join(__dirname, "public");
if (fs.existsSync(staticDir)) {
  app.use(express.static(staticDir));
  app.get("*", (_req, res) => res.sendFile(path.join(staticDir, "index.html")));
}

app.listen(PORT, () => console.log(`Itsukime server listening on http://localhost:${PORT}`));
