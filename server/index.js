import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { Client, Databases, Storage, Users, ID, Query } from 'node-appwrite';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);

// ─── CORS ─────────────────────────────────────────────────────────────────────
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '50mb' }));

// ─── Static uploads folder ────────────────────────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOADS_DIR));

// ─── Appwrite setup ───────────────────────────────────────────────────────────
const appwriteClient = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
  .setProject(process.env.APPWRITE_PROJECT_ID || '')
  .setKey(process.env.APPWRITE_API_KEY || '');

const databases = new Databases(appwriteClient);
const storage = new Storage(appwriteClient);
const usersApi = new Users(appwriteClient);   // <-- server-side Users API

const DB_ID       = process.env.APPWRITE_DATABASE_ID || '';
const MESSAGES_COL = process.env.APPWRITE_MESSAGES_COLLECTION_ID || 'messages';
const ROOMS_COL    = process.env.APPWRITE_ROOMS_COLLECTION_ID || 'rooms';
const DMS_COL      = process.env.APPWRITE_DMS_COLLECTION_ID || 'direct_messages';
const BUCKET_ID    = process.env.APPWRITE_BUCKET_ID || 'chat-media';

// ─── Socket.IO ────────────────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  maxHttpBufferSize: 50e6,
});

// ─── In-memory state ──────────────────────────────────────────────────────────
const onlineUsers  = new Map();   // socketId → user
const userSockets  = new Map();   // userId   → socketId
const roomMembers  = new Map();   // roomId   → Set<userId>
const messageHistory = new Map(); // roomId   → [{text,sender}]

// ─── Troll Detection ──────────────────────────────────────────────────────────
const TROLL_KEYWORDS = [
  'stupid', 'idiot', 'moron', 'dumb', 'hate you', 'loser', 'shut up',
  'trash', 'garbage', 'worthless', 'kill yourself', 'die', 'ugly',
];
const trollCounts = new Map();

function detectTroll(text) {
  const lower = text.toLowerCase();
  const found = TROLL_KEYWORDS.filter(kw => lower.includes(kw));
  return {
    isTroll: found.length >= 2 || (found.length === 1 && lower.split(' ').length < 6),
    keywords: found,
  };
}

function detectPrivateInfo(text) {
  const patterns = [
    {
      type: 'OTP',
      regex: /\b(?=[A-Za-z0-9]{4,8}\b)(?=.*\d)[A-Za-z0-9]+\b/,
      context: /(otp|code|verify|pin|passcode|one.?time)/i,
    },
    { type: 'Password',    regex: /(password|passwd|pwd)\s*[:=]\s*\S+/i },
    { type: 'Credit Card', regex: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/ },
    { type: 'SSN',         regex: /\b\d{3}-\d{2}-\d{4}\b/ },
  ];
  for (const p of patterns) {
    if (p.regex.test(text) && (!p.context || p.context.test(text))) {
      return { detected: true, type: p.type };
    }
  }
  return { detected: false };
}

async function getSoothingResponse(text, keywords) {
  if (process.env.GEMINI_API_KEY) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Someone in a chat used these aggressive words: "${keywords.join(', ')}". 
                Write a SHORT, warm, non-judgmental message (2-3 sentences) to gently remind them 
                that everyone here is human and deserves respect. Sound like a caring friend, not a bot.`,
              }],
            }],
          }),
        }
      );
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || defaultSoothingMessage();
    } catch { return defaultSoothingMessage(); }
  }
  return defaultSoothingMessage();
}

function defaultSoothingMessage() {
  const messages = [
    "Hey, take a breath! 💙 Everyone here is going through something — a little kindness goes a long way.",
    "Seems like things got heated! 🌿 It's okay to feel frustrated, but let's keep this space safe for everyone.",
    "We noticed your message was a bit intense. That's okay — we all have those moments. Let's reset! ✨",
    "Just a gentle nudge — this community thrives on good energy. Your words matter more than you know 🤙",
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}

// ─── File Upload ──────────────────────────────────────────────────────────────
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
});

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const SERVER_HOST = process.env.SERVER_HOST || `http://localhost:${process.env.PORT || 3001}`;
    const fileUrl = `${SERVER_HOST}/uploads/${req.file.filename}`;
    res.json({
      fileId: req.file.filename,
      url: fileUrl,
      name: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
    });
  } catch (err) {
    res.status(500).json({ error: 'Upload failed: ' + err.message });
  }
});

// ─── REST: User Search ────────────────────────────────────────────────────────
// Returns Appwrite users whose name/email matches the query (min 2 chars)
app.get('/users/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 2) return res.json([]);
  try {
    // Search by name first, fall back to listing and filtering
    const byName = await usersApi.list([Query.search('name', q), Query.limit(10)]);
    const results = byName.users.map(u => ({
      $id: u.$id,
      name: u.name,
      email: u.email,
    }));
    res.json(results);
  } catch (err) {
    console.error('User search error:', err.message);
    // Fallback: list all and filter client-side (if search index not enabled)
    try {
      const all = await usersApi.list([Query.limit(100)]);
      const lower = q.toLowerCase();
      const filtered = all.users
        .filter(u => u.name?.toLowerCase().includes(lower) || u.email?.toLowerCase().includes(lower))
        .slice(0, 10)
        .map(u => ({ $id: u.$id, name: u.name, email: u.email }));
      res.json(filtered);
    } catch {
      res.json([]);
    }
  }
});

// ─── REST: Rooms / Groups ─────────────────────────────────────────────────────
// List public groups only
app.get('/rooms', async (req, res) => {
  try {
    const response = await databases.listDocuments(DB_ID, ROOMS_COL, [
      Query.equal('isPrivate', false),
    ]);
    res.json(response.documents);
  } catch {
    res.json([
      { $id: 'general', name: 'General',   description: 'General chat for everyone', isPrivate: false },
      { $id: 'random',  name: 'Random',    description: 'Off-topic discussions',     isPrivate: false },
      { $id: 'tech',    name: 'Tech Talk', description: 'All things technology',     isPrivate: false },
    ]);
  }
});

// Create a new group
app.post('/rooms', async (req, res) => {
  const { name, description, isPrivate, creatorId } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  try {
    // Generate a short invite code only for private groups
    const inviteCode = isPrivate
      ? uuidv4().replace(/-/g, '').slice(0, 8).toUpperCase()
      : '';

    const doc = await databases.createDocument(DB_ID, ROOMS_COL, ID.unique(), {
      name: name.trim(),
      description: description?.trim() || '',
      isPrivate: !!isPrivate,
      inviteCode,
      creatorId: creatorId || '',
    });
    res.json({ ...doc, inviteCode }); // inviteCode shown to creator once
  } catch (err) {
    console.error('Create group error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Join a private group via invite code
app.post('/rooms/join', async (req, res) => {
  const { inviteCode } = req.body;
  if (!inviteCode) return res.status(400).json({ error: 'Invite code required' });
  try {
    const response = await databases.listDocuments(DB_ID, ROOMS_COL, [
      Query.equal('inviteCode', inviteCode.trim().toUpperCase()),
    ]);
    if (response.documents.length === 0) {
      return res.status(404).json({ error: 'Invalid or expired invite code' });
    }
    res.json(response.documents[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── REST: Room Messages ──────────────────────────────────────────────────────
app.get('/messages/:roomId', async (req, res) => {
  try {
    const response = await databases.listDocuments(DB_ID, MESSAGES_COL, [
      Query.equal('roomId', req.params.roomId),
      Query.orderDesc('$createdAt'),
      Query.limit(50),
    ]);
    res.json(response.documents.reverse());
  } catch {
    res.json([]);
  }
});

// ─── REST: Direct Messages (offline delivery / history) ───────────────────────
app.get('/dms/:userId1/:userId2', async (req, res) => {
  const { userId1, userId2 } = req.params;
  try {
    // Fetch both directions separately and merge (Appwrite OR is version-dependent)
    const [sent, received] = await Promise.all([
      databases.listDocuments(DB_ID, DMS_COL, [
        Query.equal('senderId',   userId1),
        Query.equal('recipientId', userId2),
        Query.orderAsc('$createdAt'),
        Query.limit(100),
      ]),
      databases.listDocuments(DB_ID, DMS_COL, [
        Query.equal('senderId',   userId2),
        Query.equal('recipientId', userId1),
        Query.orderAsc('$createdAt'),
        Query.limit(100),
      ]),
    ]);

    const all = [...sent.documents, ...received.documents]
      .sort((a, b) => new Date(a.$createdAt) - new Date(b.$createdAt))
      .slice(-100);
    res.json(all);
  } catch (err) {
    console.error('DM history error:', err.message);
    res.json([]);
  }
});

// ─── Socket.IO Events ─────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('🔌 Connected:', socket.id);

  // Auth
  socket.on('auth', ({ userId, username, avatar }) => {
    onlineUsers.set(socket.id, { userId, username, avatar, socketId: socket.id });
    userSockets.set(userId, socket.id);
    io.emit('online_users', Array.from(onlineUsers.values()));
    console.log(`👤 ${username} authenticated`);
  });

  // Join Room
  socket.on('join_room', ({ roomId }) => {
    socket.join(roomId);
    if (!roomMembers.has(roomId)) roomMembers.set(roomId, new Set());
    const user = onlineUsers.get(socket.id);
    if (user) {
      roomMembers.get(roomId).add(user.userId);
      io.to(roomId).emit('system_message', {
        roomId,
        text: `${user.username} joined`,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Leave Room
  socket.on('leave_room', ({ roomId }) => {
    socket.leave(roomId);
    const user = onlineUsers.get(socket.id);
    if (user && roomMembers.has(roomId)) {
      roomMembers.get(roomId).delete(user.userId);
      io.to(roomId).emit('system_message', {
        roomId,
        text: `${user.username} left`,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Room / Group Message
  socket.on('room_message', async (data) => {
    const { roomId, text, fileUrl, fileName, fileType, confirmed } = data;
    const user = onlineUsers.get(socket.id);
    if (!user) return;

    // Private info check
    if (text && !confirmed) {
      const privateCheck = detectPrivateInfo(text);
      if (privateCheck.detected) {
        socket.emit('private_info_warning', {
          type: privateCheck.type,
          message: `⚠️ Your message appears to contain a ${privateCheck.type}. Are you sure you want to share this in a group chat?`,
          pendingMessage: data,
        });
        return;
      }
    }

    // Troll detection
    if (text && !confirmed) {
      const { isTroll, keywords } = detectTroll(text);
      if (isTroll) {
        const countData = trollCounts.get(user.userId) || { count: 0 };
        countData.count++;
        trollCounts.set(user.userId, countData);
        const soothingMsg = await getSoothingResponse(text, keywords);
        socket.emit('troll_warning', {
          message: soothingMsg,
          severity: countData.count >= 3 ? 'muted' : 'warning',
        });
        if (countData.count >= 3) {
          socket.emit('muted', { message: "🤫 You've been given a 60-second cool-down. Take a breather!" });
          setTimeout(() => {
            trollCounts.set(user.userId, { count: 0 });
            socket.emit('unmuted', { message: "✅ You're back! Let's keep it positive 💪" });
          }, 60000);
        }
        return;
      }
    }

    let msgType = 'text';
    if (fileUrl) {
      const mime = fileType || '';
      if (mime.startsWith('image/')) msgType = 'image';
      else if (mime.startsWith('video/')) msgType = 'video';
      else msgType = 'file';
    }

    const message = {
      id: uuidv4(),
      roomId,
      senderId: user.userId,
      senderName: user.username,
      senderAvatar: user.avatar,
      text: text || null,
      fileUrl: fileUrl || null,
      fileName: fileName || null,
      fileType: fileType || null,
      timestamp: new Date().toISOString(),
      type: msgType,
    };

    if (!messageHistory.has(roomId)) messageHistory.set(roomId, []);
    const history = messageHistory.get(roomId);
    history.push({ text, sender: user.username });
    if (history.length > 50) history.shift();

    io.to(roomId).emit('room_message', message);
    console.log(`💬 [${roomId}] ${user.username}: ${text || '[file]'}`);

    // Persist
    try {
      await databases.createDocument(DB_ID, MESSAGES_COL, ID.unique(), {
        roomId,
        senderId: user.userId,
        senderName: user.username,
        text: text || '',
        fileUrl: fileUrl || '',
        fileType: fileType || '',
      });
    } catch (err) { console.warn('Room message persist error:', err.message); }
  });

  // Direct Message — persisted so offline users receive history on next login
  socket.on('direct_message', async (data) => {
    const { toUserId, text, fileUrl, fileName, fileType } = data;
    const user = onlineUsers.get(socket.id);
    if (!user) return;

    let msgType = 'text';
    if (fileUrl) {
      const mime = fileType || '';
      if (mime.startsWith('image/')) msgType = 'image';
      else if (mime.startsWith('video/')) msgType = 'video';
      else msgType = 'file';
    }

    const message = {
      id: uuidv4(),
      type: msgType,
      senderId: user.userId,
      senderName: user.username,
      senderAvatar: user.avatar,
      toUserId,
      text: text || null,
      fileUrl: fileUrl || null,
      fileName: fileName || null,
      fileType: fileType || null,
      timestamp: new Date().toISOString(),
      isDM: true,
    };

    // Always persist to Appwrite for offline delivery + history
    try {
      await databases.createDocument(DB_ID, DMS_COL, ID.unique(), {
        senderId: user.userId,
        senderName: user.username,
        senderAvatar: user.avatar || '',
        recipientId: toUserId,
        text: text || '',
        fileUrl: fileUrl || '',
        fileName: fileName || '',
        fileType: fileType || '',
        timestamp: new Date().toISOString(),
      });
    } catch (err) { console.warn('DM persist error:', err.message); }

    // Real-time delivery if recipient is online
    const recipientSocketId = userSockets.get(toUserId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('direct_message', message);
    }
    // Echo back to sender
    socket.emit('direct_message', message);
  });

  // Typing
  socket.on('typing_start', ({ roomId, toUserId }) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;
    if (roomId) {
      socket.to(roomId).emit('typing', { userId: user.userId, username: user.username, roomId });
    } else if (toUserId) {
      const sid = userSockets.get(toUserId);
      if (sid) io.to(sid).emit('typing', { userId: user.userId, username: user.username, isDM: true });
    }
  });

  socket.on('typing_stop', ({ roomId, toUserId }) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;
    if (roomId) {
      socket.to(roomId).emit('stop_typing', { userId: user.userId, roomId });
    } else if (toUserId) {
      const sid = userSockets.get(toUserId);
      if (sid) io.to(sid).emit('stop_typing', { userId: user.userId, isDM: true });
    }
  });

  // Confirm private-info warning and resend
  socket.on('confirm_send', (data) => {
    socket.emit('trigger_room_message', { ...data, confirmed: true });
  });

  // Disconnect
  socket.on('disconnect', () => {
    const user = onlineUsers.get(socket.id);
    if (user) {
      userSockets.delete(user.userId);
      onlineUsers.delete(socket.id);
      roomMembers.forEach((members, roomId) => {
        if (members.delete(user.userId)) {
          io.to(roomId).emit('system_message', {
            roomId,
            text: `${user.username} disconnected`,
            timestamp: new Date().toISOString(),
          });
        }
      });
      io.emit('online_users', Array.from(onlineUsers.values()));
    }
    console.log('🔌 Disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));