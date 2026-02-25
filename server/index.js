import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { Client, Databases, Storage, ID, Query } from 'node-appwrite';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());

// Appwrite setup
const appwriteClient = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
  .setProject(process.env.APPWRITE_PROJECT_ID || '')
  .setKey(process.env.APPWRITE_API_KEY || '');

const databases = new Databases(appwriteClient);
const storage = new Storage(appwriteClient);

const DB_ID = process.env.APPWRITE_DATABASE_ID || '';
const MESSAGES_COL = process.env.APPWRITE_MESSAGES_COLLECTION_ID || 'messages';
const ROOMS_COL = process.env.APPWRITE_ROOMS_COLLECTION_ID || 'rooms';
const BUCKET_ID = process.env.APPWRITE_BUCKET_ID || 'chat-media';

// Socket.IO
const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_URL || 'http://localhost:5173', methods: ['GET', 'POST'] },
  maxHttpBufferSize: 50e6, // 50MB for media
});

// In-memory state
const onlineUsers = new Map(); // socketId -> { userId, username, avatar }
const userSockets = new Map(); // userId -> socketId
const roomMembers = new Map(); // roomId -> Set of userIds
const messageHistory = new Map(); // roomId -> last 50 messages (for troll context)

// ─── Troll Detection ────────────────────────────────────────────────────────
const TROLL_KEYWORDS = [
  'stupid', 'idiot', 'moron', 'dumb', 'hate you', 'loser', 'shut up',
  'trash', 'garbage', 'worthless', 'kill yourself', 'die', 'ugly',
];

const trollCounts = new Map(); // userId -> { count, lastReset }
const bannedTopics = new Set(); // Set of topic fingerprints

function detectTroll(text) {
  const lower = text.toLowerCase();
  const found = TROLL_KEYWORDS.filter(kw => lower.includes(kw));
  return { isTroll: found.length >= 2 || (found.length === 1 && lower.split(' ').length < 6), keywords: found };
}

function detectOTP(text) {
  return /\b\d{4,8}\b/.test(text) && /(otp|code|verify|pin|passcode|one.?time)/i.test(text);
}

function detectPrivateInfo(text) {
  const patterns = [
    { type: 'OTP', regex: /\b\d{4,8}\b/, context: /(otp|code|verify|pin|passcode|one.?time)/i },
    { type: 'Password', regex: /(password|passwd|pwd)\s*[:=]\s*\S+/i },
    { type: 'Credit Card', regex: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/ },
    { type: 'SSN', regex: /\b\d{3}-\d{2}-\d{4}\b/ },
  ];

  for (const p of patterns) {
    if (p.regex.test(text) && (!p.context || p.context.test(text))) {
      return { detected: true, type: p.type };
    }
  }
  return { detected: false };
}

async function getSoothingResponse(trolledMessages, keywords) {
  // If Gemini key exists, use it; otherwise return a default
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
                text: `Someone in a chat used these words considered aggressive: "${keywords.join(', ')}". 
                Write a SHORT, warm, non-judgmental message (2-3 sentences) to gently remind them that 
                everyone here is human and deserves respect. Make it feel like it comes from a caring 
                friend, not a robot. Don't be preachy. Be understanding.`
              }]
            }]
          })
        }
      );
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || defaultSoothingMessage(keywords);
    } catch { return defaultSoothingMessage(keywords); }
  }
  return defaultSoothingMessage(keywords);
}

function defaultSoothingMessage(keywords) {
  const messages = [
    "Hey, take a breath! 💙 Everyone here is going through something — a little kindness goes a long way. We're all in this together.",
    "Seems like things are heating up! 🌿 It's totally okay to feel frustrated, but let's keep this space a safe one for everyone. You good?",
    "We noticed your message was a bit intense. That's okay — we all have those moments. How about we reset and keep the vibes positive? ✨",
    "Just a gentle nudge — this community thrives on good energy. Your words matter more than you know. Let's keep it cool 🤙",
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}

// ─── File Upload ─────────────────────────────────────────────────────────────
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const fileId = ID.unique();
    // In production: upload to Appwrite storage
    // const result = await storage.createFile(BUCKET_ID, fileId, InputFile.fromBuffer(req.file.buffer, req.file.originalname));
    // For demo, we'll base64 it (in prod use Appwrite storage URL)
    const base64 = req.file.buffer.toString('base64');
    const dataUrl = `data:${req.file.mimetype};base64,${base64}`;
    res.json({ fileId, url: dataUrl, name: req.file.originalname, mimetype: req.file.mimetype });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// ─── REST: Get rooms & messages ───────────────────────────────────────────────
app.get('/rooms', async (req, res) => {
  try {
    const response = await databases.listDocuments(DB_ID, ROOMS_COL);
    res.json(response.documents);
  } catch {
    // Return demo rooms if Appwrite not configured
    res.json([
      { $id: 'general', name: 'General', description: 'General chat for everyone', isPrivate: false },
      { $id: 'random', name: 'Random', description: 'Off-topic discussions', isPrivate: false },
      { $id: 'tech', name: 'Tech Talk', description: 'All things technology', isPrivate: false },
    ]);
  }
});

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

// ─── Socket.IO Events ─────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('🔌 Socket connected:', socket.id);

  // ── Auth / Join ──
  socket.on('auth', ({ userId, username, avatar }) => {
    onlineUsers.set(socket.id, { userId, username, avatar, socketId: socket.id });
    userSockets.set(userId, socket.id);
    io.emit('online_users', Array.from(onlineUsers.values()));
    console.log(`👤 ${username} authenticated`);
  });

  // ── Join Room ──
  socket.on('join_room', async ({ roomId }) => {
    socket.join(roomId);
    if (!roomMembers.has(roomId)) roomMembers.set(roomId, new Set());
    const user = onlineUsers.get(socket.id);
    if (user) roomMembers.get(roomId).add(user.userId);

    // Send room member list
    const members = Array.from(roomMembers.get(roomId)).map(uid => {
      const sId = userSockets.get(uid);
      return sId ? onlineUsers.get(sId) : null;
    }).filter(Boolean);
    io.to(roomId).emit('room_members', { roomId, members });

    // System message
    if (user) {
      io.to(roomId).emit('system_message', {
        roomId,
        text: `${user.username} joined the room`,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ── Leave Room ──
  socket.on('leave_room', ({ roomId }) => {
    socket.leave(roomId);
    const user = onlineUsers.get(socket.id);
    if (user && roomMembers.has(roomId)) {
      roomMembers.get(roomId).delete(user.userId);
      io.to(roomId).emit('system_message', {
        roomId,
        text: `${user.username} left the room`,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ── Send Room Message ──
  socket.on('room_message', async (data) => {
    const { roomId, text, fileUrl, fileName, fileType } = data;
    const user = onlineUsers.get(socket.id);
    if (!user) return;

    // Check for private info in GROUP messages
    if (text) {
      const privateCheck = detectPrivateInfo(text);
      if (privateCheck.detected) {
        socket.emit('private_info_warning', {
          type: privateCheck.type,
          message: `⚠️ Your message appears to contain a ${privateCheck.type}. Are you sure you want to share this in a group chat?`,
          pendingMessage: data,
        });
        return; // Hold the message — client will confirm and re-send with confirmed: true
      }
    }

    // Troll detection
    if (text && !data.confirmed) {
      const { isTroll, keywords } = detectTroll(text);
      if (isTroll) {
        const count = trollCounts.get(user.userId) || { count: 0 };
        count.count++;
        trollCounts.set(user.userId, count);

        const soothingMsg = await getSoothingResponse(text, keywords);
        socket.emit('troll_warning', {
          message: soothingMsg,
          severity: count.count >= 3 ? 'muted' : 'warning',
        });

        if (count.count >= 3) {
          socket.emit('muted', { duration: 60000, message: '🤫 You\'ve been given a 60-second cool-down period. Take a breather!' });
          setTimeout(() => {
            trollCounts.set(user.userId, { count: 0 });
            socket.emit('unmuted', { message: '✅ You\'re back! Remember, let\'s keep it positive 💪' });
          }, 60000);
          return;
        }
        return; // Block the troll message
      }
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
      type: fileUrl ? (fileType?.startsWith('image') ? 'image' : 'file') : 'text',
    };

    // Track for troll context
    if (!messageHistory.has(roomId)) messageHistory.set(roomId, []);
    messageHistory.get(roomId).push({ text, sender: user.username });
    if (messageHistory.get(roomId).length > 50) messageHistory.get(roomId).shift();

    // Broadcast to room
    io.to(roomId).emit('room_message', message);

    // Persist to Appwrite (best-effort)
    try {
      await databases.createDocument(DB_ID, MESSAGES_COL, ID.unique(), {
        roomId, senderId: user.userId, senderName: user.username,
        text: text || '', fileUrl: fileUrl || '', fileType: fileType || '',
      });
    } catch { /* non-fatal */ }
  });

  // ── Direct Message ──
  socket.on('direct_message', async (data) => {
    const { toUserId, text, fileUrl, fileName, fileType } = data;
    const user = onlineUsers.get(socket.id);
    if (!user) return;

    const message = {
      id: uuidv4(),
      type: fileUrl ? (fileType?.startsWith('image') ? 'image' : 'file') : 'text',
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

    // Send to recipient
    const recipientSocketId = userSockets.get(toUserId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('direct_message', message);
    }
    // Echo to sender
    socket.emit('direct_message', message);
  });

  // ── Typing Indicators ──
  socket.on('typing_start', ({ roomId, toUserId }) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;
    if (roomId) {
      socket.to(roomId).emit('typing', { userId: user.userId, username: user.username, roomId });
    } else if (toUserId) {
      const recipientSid = userSockets.get(toUserId);
      if (recipientSid) io.to(recipientSid).emit('typing', { userId: user.userId, username: user.username, isDM: true });
    }
  });

  socket.on('typing_stop', ({ roomId, toUserId }) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;
    if (roomId) socket.to(roomId).emit('stop_typing', { userId: user.userId, roomId });
    else if (toUserId) {
      const recipientSid = userSockets.get(toUserId);
      if (recipientSid) io.to(recipientSid).emit('stop_typing', { userId: user.userId, isDM: true });
    }
  });

  // ── Confirm Private Info Send ──
  socket.on('confirm_send', (data) => {
    data.confirmed = true;
    socket.emit('room_message_confirmed', data);
    socket.emit('trigger_room_message', data); // client re-emits room_message
  });

  // ── Disconnect ──
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
    console.log('🔌 Socket disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
