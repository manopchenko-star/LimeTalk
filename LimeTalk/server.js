const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 10 * 1024 * 1024 // 10 МБ для голоса/видео
});

app.use(express.static('public'));

// ========== ФАЙЛОВЫЕ ХРАНИЛИЩА ==========
const USERS_FILE = path.join(__dirname, 'users.json');
const CHANNELS_FILE = path.join(__dirname, 'channels.json');
const REACTIONS_FILE = path.join(__dirname, 'reactions.json');

let usersByEmail = {};
let channels = {};
let reactions = {};

async function loadUsers() {
  try {
    const data = await fs.readFile(USERS_FILE, 'utf8');
    usersByEmail = JSON.parse(data);
  } catch { usersByEmail = {}; }
}
async function saveUsers() {
  await fs.writeFile(USERS_FILE, JSON.stringify(usersByEmail, null, 2));
}
async function loadChannels() {
  try {
    const data = await fs.readFile(CHANNELS_FILE, 'utf8');
    channels = JSON.parse(data);
  } catch { channels = {}; }
}
async function saveChannels() {
  await fs.writeFile(CHANNELS_FILE, JSON.stringify(channels, null, 2));
}
async function loadReactions() {
  try {
    const data = await fs.readFile(REACTIONS_FILE, 'utf8');
    reactions = JSON.parse(data);
  } catch { reactions = {}; }
}
async function saveReactions() {
  await fs.writeFile(REACTIONS_FILE, JSON.stringify(reactions, null, 2));
}

Promise.all([loadUsers(), loadChannels(), loadReactions()]).then(() => {
  console.log('Данные загружены');
});

// ========== НАСТРОЙКИ ПОЧТЫ (ЯНДЕКС) ==========
const transporter = nodemailer.createTransport({
  host: 'smtp.yandex.ru',
  port: 465,
  secure: true,
  auth: {
    user: 'manopchenko@yandex.ru',
    pass: 'ppczknhfeommtrqx'
  }
});
const EMAIL_FROM = 'manopchenko@yandex.ru';

// ========== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ==========
const pendingCodes = new Map();      // email -> { code, expires }
const adminAwaitingPassword = new Map(); // email -> true (ожидание пароля)
const adminAuthorized = new Set();   // email пользователей, прошедших пароль
const BOT_ID = 'ai_bot';
const BOT_NAME = '🤖 AI Bot';
const ADMIN_PASSWORD = 'Anopchenko2011'; // пароль для доступа к админке

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
function getUserEmailBySocketId(socketId) {
  for (let email in usersByEmail) {
    if (usersByEmail[email].socketId === socketId) return email;
  }
  return null;
}
function getChatId(user1, user2) {
  return [user1, user2].sort().join(':');
}

// ========== ОСНОВНОЙ ОБРАБОТЧИК ==========
io.on('connection', (socket) => {
  console.log('Новое подключение:', socket.id);

  // ----- АУТЕНТИФИКАЦИЯ -----
  socket.on('request login code', async ({ email }) => {
    const code = crypto.randomInt(100000, 999999).toString();
    const expires = Date.now() + 10 * 60 * 1000;
    pendingCodes.set(email, { code, expires });
    try {
      await transporter.sendMail({
        from: EMAIL_FROM,
        to: email,
        subject: 'Код для входа в LimeTalk',
        text: `Ваш код: ${code}\nДействителен 10 минут.`
      });
      socket.emit('code sent', { success: true });
    } catch (err) {
      console.error('Ошибка отправки письма:', err);
      socket.emit('code sent', { success: false, message: 'Ошибка отправки' });
    }
  });

  socket.on('authenticate', async ({ email, code }) => {
    const record = pendingCodes.get(email);
    if (!record || record.code !== code || record.expires < Date.now()) {
      socket.emit('auth result', { success: false, message: 'Неверный код' });
      return;
    }
    pendingCodes.delete(email);
    const device = socket.handshake.query.device || 'desktop';
    if (usersByEmail[email]) {
      const existing = usersByEmail[email];
      if (existing.socketId) {
        const oldSocket = io.sockets.sockets.get(existing.socketId);
        if (oldSocket) oldSocket.disconnect();
      }
      existing.socketId = socket.id;
      existing.device = device;
      existing.lastSeen = Date.now();
    } else {
      usersByEmail[email] = {
        email, username: email.split('@')[0], firstName: '', lastName: '',
        status: '', avatar: null, device, socketId: socket.id,
        registeredAt: Date.now(), verified: true, lastSeen: Date.now(), badge: false
      };
    }
    await saveUsers();
    socket.emit('auth result', { success: true, email });
    socket.join(email);
    broadcastUserList();
    socket.emit('authenticated', { email });
    // Отправка офлайн-сообщений
    if (usersByEmail[email].offlineMessages) {
      usersByEmail[email].offlineMessages.forEach(msg => {
        socket.emit('private message', msg);
      });
      delete usersByEmail[email].offlineMessages;
      await saveUsers();
    }
  });

  socket.on('restore session', async ({ email }) => {
    if (usersByEmail[email]) {
      const user = usersByEmail[email];
      if (user.socketId && user.socketId !== socket.id) {
        const oldSocket = io.sockets.sockets.get(user.socketId);
        if (oldSocket) oldSocket.disconnect();
      }
      user.socketId = socket.id;
      user.device = socket.handshake.query.device || 'desktop';
      user.lastSeen = Date.now();
      await saveUsers();
      socket.join(email);
      socket.emit('session restored', { email, username: user.username });
      broadcastUserList();
    } else {
      socket.emit('session expired');
    }
  });

  // ----- ПРОВЕРКА ЮЗЕРНЕЙМА -----
  socket.on('check username', (username, callback) => {
    const existing = Object.values(usersByEmail).find(u => u.username?.toLowerCase() === username.toLowerCase());
    callback({ available: !existing });
  });

  // ----- УСТАНОВКА ИМЕНИ -----
  socket.on('set username', async ({ email, username, firstName, lastName }) => {
    const existing = Object.values(usersByEmail).find(u => u.email !== email && u.username?.toLowerCase() === username.toLowerCase());
    if (existing) {
      socket.emit('username error', 'Юзернейм занят');
      return;
    }
    if (usersByEmail[email]) {
      usersByEmail[email].username = username;
      if (firstName !== undefined) usersByEmail[email].firstName = firstName;
      if (lastName !== undefined) usersByEmail[email].lastName = lastName;
      await saveUsers();
      socket.emit('username set', { username });
      broadcastUserList();
    }
  });

  // ----- ОБНОВЛЕНИЕ ПРОФИЛЯ -----
  socket.on('update profile', async (profile) => {
    const { email, firstName, lastName, username, status, avatar } = profile;
    if (!usersByEmail[email]) return;
    if (username !== usersByEmail[email].username) {
      const existing = Object.values(usersByEmail).find(u => u.email !== email && u.username?.toLowerCase() === username.toLowerCase());
      if (existing) {
        socket.emit('profile update error', 'Юзернейм занят');
        return;
      }
    }
    usersByEmail[email].firstName = firstName;
    usersByEmail[email].lastName = lastName;
    usersByEmail[email].username = username;
    usersByEmail[email].status = status;
    usersByEmail[email].avatar = avatar;
    await saveUsers();
    socket.emit('profile updated', usersByEmail[email]);
    broadcastUserList();
  });

  // ----- ЛИЧНЫЕ СООБЩЕНИЯ -----
  socket.on('private message', async ({ to, id, type, data, timestamp }) => {
    const fromEmail = getUserEmailBySocketId(socket.id);
    if (!fromEmail) return;
    const fromUser = usersByEmail[fromEmail];
    const msg = { id, from: fromEmail, fromUsername: fromUser.username, fromDevice: fromUser.device, type, data, timestamp, edited: false };
    if (to === BOT_ID) {
      await handleBotMessage(socket, fromEmail, data);
    } else {
      const targetUser = usersByEmail[to];
      if (targetUser && targetUser.socketId) {
        io.to(targetUser.socketId).emit('private message', msg);
      } else if (targetUser) {
        if (!targetUser.offlineMessages) targetUser.offlineMessages = [];
        targetUser.offlineMessages.push(msg);
        await saveUsers();
      }
    }
  });

  // ----- РЕДАКТИРОВАНИЕ СООБЩЕНИЙ -----
  socket.on('edit message', ({ msgId, newText, to }) => {
    const fromEmail = getUserEmailBySocketId(socket.id);
    if (!fromEmail) return;
    const targetUser = usersByEmail[to];
    if (targetUser && targetUser.socketId) {
      io.to(targetUser.socketId).emit('message edited', { msgId, newText, editor: fromEmail });
    }
    socket.emit('message edited ack', { msgId, newText });
  });

  // ----- РЕАКЦИИ -----
  socket.on('add reaction', ({ msgId, emoji, to }) => {
    const fromEmail = getUserEmailBySocketId(socket.id);
    if (!fromEmail) return;
    const chatId = getChatId(fromEmail, to);
    const key = `${chatId}:${msgId}`;
    if (!reactions[key]) reactions[key] = {};
    if (!reactions[key][emoji]) reactions[key][emoji] = [];
    if (!reactions[key][emoji].includes(fromEmail)) {
      reactions[key][emoji].push(fromEmail);
      saveReactions();
      const update = { chatId, msgId, emoji, users: reactions[key][emoji] };
      const targetUser = usersByEmail[to];
      if (targetUser && targetUser.socketId) io.to(targetUser.socketId).emit('reaction update', update);
      socket.emit('reaction update', update);
    }
  });

  socket.on('remove reaction', ({ msgId, emoji, to }) => {
    const fromEmail = getUserEmailBySocketId(socket.id);
    if (!fromEmail) return;
    const chatId = getChatId(fromEmail, to);
    const key = `${chatId}:${msgId}`;
    if (reactions[key] && reactions[key][emoji]) {
      reactions[key][emoji] = reactions[key][emoji].filter(e => e !== fromEmail);
      if (reactions[key][emoji].length === 0) delete reactions[key][emoji];
      saveReactions();
      const update = { chatId, msgId, emoji, users: reactions[key][emoji] || [] };
      const targetUser = usersByEmail[to];
      if (targetUser && targetUser.socketId) io.to(targetUser.socketId).emit('reaction update', update);
      socket.emit('reaction update', update);
    }
  });

  // ----- КАНАЛЫ -----
  socket.on('create channel', ({ name, description }) => {
    const email = getUserEmailBySocketId(socket.id);
    if (!email) return;
    if (channels[name]) {
      socket.emit('channel error', 'Канал с таким именем уже существует');
      return;
    }
    channels[name] = {
      owner: email,
      description: description || '',
      posts: [],
      subscribers: [email]
    };
    saveChannels();
    socket.emit('channel created', name);
  });

  socket.on('get channels', () => {
    const list = Object.keys(channels).map(name => ({
      name,
      description: channels[name].description,
      owner: channels[name].owner,
      postCount: channels[name].posts.length,
      subscribers: channels[name].subscribers.length
    }));
    socket.emit('channels list', list);
  });

  socket.on('subscribe channel', ({ name }) => {
    const email = getUserEmailBySocketId(socket.id);
    if (!email || !channels[name]) return;
    if (!channels[name].subscribers.includes(email)) {
      channels[name].subscribers.push(email);
      saveChannels();
      socket.emit('subscribed', name);
    }
  });

  socket.on('unsubscribe channel', ({ name }) => {
    const email = getUserEmailBySocketId(socket.id);
    if (!email || !channels[name]) return;
    channels[name].subscribers = channels[name].subscribers.filter(e => e !== email);
    saveChannels();
    socket.emit('unsubscribed', name);
  });

  socket.on('publish post', ({ channelName, content }) => {
    const email = getUserEmailBySocketId(socket.id);
    if (!email || !channels[channelName] || channels[channelName].owner !== email) return;
    const post = {
      id: Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      content,
      timestamp: Date.now(),
      edited: false
    };
    channels[channelName].posts.push(post);
    saveChannels();
    channels[channelName].subscribers.forEach(subEmail => {
      if (usersByEmail[subEmail] && usersByEmail[subEmail].socketId) {
        io.to(usersByEmail[subEmail].socketId).emit('new post', { channel: channelName, post });
      }
    });
    socket.emit('post published', { channel: channelName, post });
  });

  socket.on('get channel posts', ({ channelName }) => {
    if (!channels[channelName]) return;
    socket.emit('channel posts', { channel: channelName, posts: channels[channelName].posts });
  });

  // ----- ИЗБРАННОЕ -----
  socket.on('get saved messages', () => {
    const email = getUserEmailBySocketId(socket.id);
    if (!email) return;
    socket.emit('saved messages', usersByEmail[email]?.savedMessages || []);
  });

  socket.on('save message', (msg) => {
    const email = getUserEmailBySocketId(socket.id);
    if (!email) return;
    if (!usersByEmail[email].savedMessages) usersByEmail[email].savedMessages = [];
    const messageObj = {
      id: Date.now() + Math.random(),
      text: msg.text,
      timestamp: Date.now(),
      from: email
    };
    usersByEmail[email].savedMessages.push(messageObj);
    saveUsers();
    socket.emit('message saved', messageObj);
  });

  // ----- ЗАКРЕПЛЁННЫЕ СООБЩЕНИЯ -----
  const pinnedMessages = {};

  socket.on('pin message', ({ chatId, message }) => {
    const email = getUserEmailBySocketId(socket.id);
    if (!email) return;
    const participants = chatId.split(':');
    if (!participants.includes(email)) return;
    pinnedMessages[chatId] = {
      message: message,
      pinnedBy: email,
      timestamp: Date.now()
    };
    const other = participants.find(p => p !== email);
    if (other && usersByEmail[other] && usersByEmail[other].socketId) {
      io.to(usersByEmail[other].socketId).emit('pinned updated', { chatId, pinned: pinnedMessages[chatId] });
    }
    socket.emit('pinned updated', { chatId, pinned: pinnedMessages[chatId] });
  });

  socket.on('get pinned', ({ chatId }) => {
    socket.emit('pinned data', { chatId, pinned: pinnedMessages[chatId] || null });
  });

  // ----- АДМИН ПАНЕЛЬ (без привязки к email) -----
  socket.on('check admin status', () => {
    const email = getUserEmailBySocketId(socket.id);
    socket.emit('admin status check result', adminAuthorized.has(email));
  });

  socket.on('get admin users', () => {
    const email = getUserEmailBySocketId(socket.id);
    if (!adminAuthorized.has(email)) {
      socket.emit('admin error', 'Доступ запрещён');
      return;
    }
    const list = Object.values(usersByEmail).map(u => ({
      email: u.email,
      username: u.username,
      firstName: u.firstName,
      lastName: u.lastName,
      registeredAt: u.registeredAt,
      online: !!u.socketId,
      badge: u.badge || false,
      lastSeen: u.lastSeen
    }));
    socket.emit('admin users data', list);
  });

  socket.on('toggle badge', async ({ email, action }) => {
    const adminEmail = getUserEmailBySocketId(socket.id);
    if (!adminAuthorized.has(adminEmail)) {
      socket.emit('admin error', 'Доступ запрещён');
      return;
    }
    if (!usersByEmail[email]) return;
    usersByEmail[email].badge = (action === 'grant');
    await saveUsers();
    broadcastUserList();
    if (usersByEmail[email].socketId) {
      io.to(usersByEmail[email].socketId).emit('badge updated', usersByEmail[email].badge);
    }
    socket.emit('badge toggle success', { email, badge: usersByEmail[email].badge });
  });

  socket.on('broadcast from admin', async ({ message }) => {
    const adminEmail = getUserEmailBySocketId(socket.id);
    if (!adminAuthorized.has(adminEmail)) {
      socket.emit('broadcast result', { success: false, message: 'Доступ запрещён' });
      return;
    }
    let sentCount = 0;
    for (let email in usersByEmail) {
      const user = usersByEmail[email];
      const msg = {
        from: BOT_ID,
        fromUsername: BOT_NAME,
        fromDevice: 'bot',
        message: `📢 **Рассылка от администратора**\n\n${message}`
      };
      if (user.socketId) {
        io.to(user.socketId).emit('private message', msg);
        sentCount++;
      } else {
        if (!user.offlineMessages) user.offlineMessages = [];
        user.offlineMessages.push(msg);
      }
    }
    await saveUsers();
    socket.emit('broadcast result', { success: true, count: Object.keys(usersByEmail).length });
  });

  // ----- БОТ -----
  async function handleBotMessage(socket, fromEmail, text) {
    const lower = text.toLowerCase().trim();
    const user = usersByEmail[fromEmail];

    if (adminAwaitingPassword.has(fromEmail)) {
      adminAwaitingPassword.delete(fromEmail);
      if (lower === ADMIN_PASSWORD.toLowerCase()) {
        adminAuthorized.add(fromEmail);
        socket.emit('admin status', true);
        socket.emit('private message', {
          from: BOT_ID, fromUsername: BOT_NAME, fromDevice: 'bot',
          message: '✅ Доступ разрешён. Теперь вы можете использовать админ-панель.'
        });
      } else {
        socket.emit('private message', {
          from: BOT_ID, fromUsername: BOT_NAME, fromDevice: 'bot',
          message: '❌ Неверный пароль.'
        });
      }
      return;
    }

    if (lower === 'админ панель limetalk') {
      adminAwaitingPassword.set(fromEmail, true);
      socket.emit('private message', {
        from: BOT_ID, fromUsername: BOT_NAME, fromDevice: 'bot',
        message: '🔐 Введите пароль для доступа к админ-панели:'
      });
      return;
    }

    if (lower.includes('привет')) {
      socket.emit('private message', {
        from: BOT_ID, fromUsername: BOT_NAME, fromDevice: 'bot',
        message: `Привет, ${user.username}! Я бот LimeTalk.`
      });
    } else {
      socket.emit('private message', {
        from: BOT_ID, fromUsername: BOT_NAME, fromDevice: 'bot',
        message: 'Я не понял. Напиши "Админ панель LimeTalk", если хочешь стать админом.'
      });
    }
  }

  // ----- ОТКЛЮЧЕНИЕ -----
  socket.on('disconnect', async () => {
    for (let email in usersByEmail) {
      if (usersByEmail[email].socketId === socket.id) {
        usersByEmail[email].socketId = null;
        usersByEmail[email].lastSeen = Date.now();
        await saveUsers();
        break;
      }
    }
    broadcastUserList();
  });

  // ----- РАССЫЛКА СПИСКА ПОЛЬЗОВАТЕЛЕЙ -----
  function broadcastUserList() {
    const allUsers = Object.values(usersByEmail).map(u => ({
      id: u.email,
      username: u.username,
      firstName: u.firstName,
      lastName: u.lastName,
      avatar: u.avatar,
      status: u.status,
      badge: u.badge,
      online: !!u.socketId,
      lastSeen: u.lastSeen
    }));
    allUsers.push({ id: BOT_ID, username: BOT_NAME, device: 'bot', online: true, badge: false });
    io.emit('user list', allUsers);
  }
});

// ========== ЗАПУСК ==========
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`LimeTalk запущен на порту ${PORT}`);
});