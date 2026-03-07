const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcrypt');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 10 * 1024 * 1024 // 10 МБ
});

app.use(express.static('public'));

// ========== ФАЙЛОВЫЕ ХРАНИЛИЩА ==========
const USERS_FILE = path.join(__dirname, 'users.json');
const REACTIONS_FILE = path.join(__dirname, 'reactions.json');
const MESSAGES_FILE = path.join(__dirname, 'messages.json');
const STORIES_FILE = path.join(__dirname, 'stories.json');

let usersByEmail = {};
let reactions = {};
let messageHistory = {};
let stories = [];

async function loadUsers() {
  try {
    const data = await fs.readFile(USERS_FILE, 'utf8');
    usersByEmail = JSON.parse(data);
    for (let email in usersByEmail) {
      if (usersByEmail[email].premium) {
        adminAuthorized.add(email);
      }
    }
  } catch { usersByEmail = {}; }
}
async function saveUsers() {
  await fs.writeFile(USERS_FILE, JSON.stringify(usersByEmail, null, 2));
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
async function loadMessages() {
  try {
    const data = await fs.readFile(MESSAGES_FILE, 'utf8');
    messageHistory = JSON.parse(data);
  } catch { messageHistory = {}; }
}
async function saveMessages() {
  await fs.writeFile(MESSAGES_FILE, JSON.stringify(messageHistory, null, 2));
}
async function loadStories() {
  try {
    const data = await fs.readFile(STORIES_FILE, 'utf8');
    stories = JSON.parse(data);
  } catch { stories = []; }
}
async function saveStories() {
  await fs.writeFile(STORIES_FILE, JSON.stringify(stories, null, 2));
}

Promise.all([loadUsers(), loadReactions(), loadMessages(), loadStories()]).then(() => {
  console.log('Данные загружены');
  cleanExpiredStories();
  setInterval(cleanExpiredStories, 60 * 60 * 1000);
});

// ========== ПОЧТА ==========
const transporter = nodemailer.createTransport({
  host: 'smtp.yandex.ru',
  port: 465,
  secure: true,
  auth: {
    user: 'LimeTalk@yandex.ru',
    pass: 'faysyctndhepofnm'
  }
});
const EMAIL_FROM = 'LimeTalk@yandex.ru';

// ========== TELEGRAM-БОТ ==========
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || '7284208495:AAEaty-Squbuvdv6yyc-evC5ns5Vu8xuA5A';
const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID || '1523825366';
const USE_WEBHOOK = false; // false для локальной разработки, true для Render

if (!USE_WEBHOOK) {
  const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
  bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    if (msg.text === '/start') {
      bot.sendMessage(chatId, `Ваш Telegram ID: ${chatId}`);
    }
  });
  bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;
    const confirmation = pendingAdminConfirmations.get(String(chatId));
    if (!confirmation) {
      await bot.sendMessage(chatId, 'Нет активного запроса на подтверждение.');
      return;
    }
    const { email, socketId } = confirmation;

    if (data === 'confirm_admin') {
      adminAuthorized.add(email);
      if (usersByEmail[email]) {
        usersByEmail[email].adminByBot = true;
        await saveUsers();
      }
      await bot.sendMessage(chatId, '✅ Доступ к админ-панели подтверждён. Можете вернуться в чат.');
      if (socketId) {
        io.to(socketId).emit('admin access granted');
      }
    } else if (data === 'reject_admin') {
      await bot.sendMessage(chatId, '❌ Доступ отклонён.');
      if (socketId) {
        io.to(socketId).emit('admin access rejected');
      }
    }
    pendingAdminConfirmations.delete(String(chatId));
    await bot.answerCallbackQuery(callbackQuery.id);
  });
  global.telegramBot = bot;
} else {
  // Webhook (для Render)
  const bot = new TelegramBot(TELEGRAM_TOKEN);
  const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://limetalk.onrender.com';
  bot.setWebHook(`${WEBHOOK_URL}/bot${TELEGRAM_TOKEN}`);
  app.post(`/bot${TELEGRAM_TOKEN}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  });
  bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    if (msg.text === '/start') {
      bot.sendMessage(chatId, `Ваш Telegram ID: ${chatId}`);
    }
  });
  bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;
    const confirmation = pendingAdminConfirmations.get(String(chatId));
    if (!confirmation) {
      await bot.sendMessage(chatId, 'Нет активного запроса на подтверждение.');
      return;
    }
    const { email, socketId } = confirmation;

    if (data === 'confirm_admin') {
      adminAuthorized.add(email);
      if (usersByEmail[email]) {
        usersByEmail[email].adminByBot = true;
        await saveUsers();
      }
      await bot.sendMessage(chatId, '✅ Доступ к админ-панели подтверждён.');
      if (socketId) {
        io.to(socketId).emit('admin access granted');
      }
    } else if (data === 'reject_admin') {
      await bot.sendMessage(chatId, '❌ Доступ отклонён.');
      if (socketId) {
        io.to(socketId).emit('admin access rejected');
      }
    }
    pendingAdminConfirmations.delete(String(chatId));
    await bot.answerCallbackQuery(callbackQuery.id);
  });
  global.telegramBot = bot;
}

// ========== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ==========
const pendingCodes = new Map();          // email -> { code, expires }
const adminAwaitingPassword = new Map(); // не используется
const adminAuthorized = new Set();       // email администраторов
const pendingDeletions = new Map();      // email -> { code, expires }
const pendingAdminConfirmations = new Map(); // telegramChatId (string) -> { email, socketId }
let deleteTimer = null;
let deleteScheduled = false;
const BOT_ID = 'ai_bot';
const BOT_NAME = '🤖 AI Bot';
const ADMIN_PASSWORD = 'Anopchenko2011';

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

async function broadcastUserListForSocket(socket) {
  const email = getUserEmailBySocketId(socket.id);
  if (!email) return;
  const userList = [];
  for (let e in usersByEmail) {
    const u = usersByEmail[e];
    userList.push({
      id: u.email,
      username: u.username,
      firstName: u.firstName,
      lastName: u.lastName,
      avatar: u.avatar,
      status: u.status,
      badge: u.badge,
      premium: u.premium || false,
      scam: u.scam || false,
      online: !!u.socketId,
      lastSeen: u.lastSeen,
      isSelf: e === email
    });
  }
  // Явно добавляем бота
  userList.push({
    id: BOT_ID,
    username: BOT_NAME,
    device: 'bot',
    online: true,
    badge: false,
    premium: false,
    scam: false,
    isSelf: false
  });
  socket.emit('user list', userList);
}

async function sendBotMessage(toEmail, text) {
  const msg = {
    id: Date.now() + '-' + Math.random().toString(36).substr(2, 5),
    from: BOT_ID,
    fromUsername: BOT_NAME,
    fromDevice: 'bot',
    type: 'text',
    data: text,
    timestamp: Date.now(),
    edited: false
  };
  const chatId = getChatId(toEmail, BOT_ID);
  if (!messageHistory[chatId]) messageHistory[chatId] = [];
  messageHistory[chatId].push(msg);
  await saveMessages();

  const targetUser = usersByEmail[toEmail];
  if (targetUser && targetUser.socketId) {
    io.to(targetUser.socketId).emit('private message', msg);
  } else if (targetUser) {
    if (!targetUser.offlineMessages) targetUser.offlineMessages = [];
    targetUser.offlineMessages.push(msg);
    await saveUsers();
  }
}

async function requestAdminAccess(socket, userEmail) {
  const user = usersByEmail[userEmail];
  if (!user) return;
  if (!global.telegramBot || !ADMIN_TELEGRAM_ID) {
    socket.emit('admin access error', '❌ Telegram-бот не настроен.');
    return;
  }
  pendingAdminConfirmations.set(String(ADMIN_TELEGRAM_ID), {
    email: userEmail,
    socketId: socket.id
  });
  try {
    const inlineKeyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Подтвердить доступ', callback_data: 'confirm_admin' },
            { text: '❌ Отклонить', callback_data: 'reject_admin' }
          ]
        ]
      }
    };
    await global.telegramBot.sendMessage(
      ADMIN_TELEGRAM_ID,
      `🔐 Пользователь ${user.username} (${userEmail}) запрашивает доступ к админ-панели.`,
      inlineKeyboard
    );
    socket.emit('admin access request sent', { message: 'Запрос отправлен администратору.' });
  } catch (err) {
    console.error('Ошибка отправки в Telegram:', err);
    socket.emit('admin access error', '❌ Не удалось отправить запрос.');
  }
}

async function performDeleteAll(adminEmail) {
  if (!deleteScheduled) return;
  console.log(`Удаление всех аккаунтов (кроме ${adminEmail} и бота) по таймеру`);
  const usersToDelete = Object.keys(usersByEmail).filter(e => e !== adminEmail && e !== BOT_ID);
  for (let e of usersToDelete) {
    const user = usersByEmail[e];
    if (user && user.socketId) {
      io.to(user.socketId).emit('account deleted');
    }
    adminAuthorized.delete(e);
    delete usersByEmail[e];
  }
  await saveUsers();
  deleteScheduled = false;
  deleteTimer = null;
  for (let e in usersByEmail) {
    if (usersByEmail[e].socketId) {
      broadcastUserListForSocket(io.sockets.sockets.get(usersByEmail[e].socketId));
    }
  }
  const adminSocket = usersByEmail[adminEmail]?.socketId;
  if (adminSocket) {
    io.to(adminSocket).emit('all accounts deleted');
  }
}

function cleanExpiredStories() {
  const now = Date.now();
  const before = stories.length;
  stories = stories.filter(s => s.expiresAt > now);
  if (stories.length !== before) {
    saveStories();
    console.log(`Очищено ${before - stories.length} устаревших историй`);
  }
}

function getStoryOwnersForUser(email) {
  const activeStories = stories.filter(s => s.expiresAt > Date.now());
  const owners = [...new Set(activeStories.map(s => s.owner))];
  return owners.filter(o => o !== BOT_ID);
}

io.on('connection', (socket) => {
  console.log('Новое подключение:', socket.id);

  const email = getUserEmailBySocketId(socket.id);
  if (email) {
    const owners = getStoryOwnersForUser(email);
    socket.emit('stories owners', owners);
  }

  socket.on('get stories owners', () => {
    const email = getUserEmailBySocketId(socket.id);
    if (email) {
      const owners = getStoryOwnersForUser(email);
      socket.emit('stories owners', owners);
    }
  });

  // ----- ИСТОРИИ -----
  socket.on('create story', async ({ type, content }) => {
    const email = getUserEmailBySocketId(socket.id);
    if (!email) return;
    const story = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      owner: email,
      type,
      content,
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      viewedBy: []
    };
    stories.push(story);
    await saveStories();
    for (let u in usersByEmail) {
      if (usersByEmail[u].socketId && u !== BOT_ID) {
        io.to(usersByEmail[u].socketId).emit('new story', { owner: email });
      }
    }
  });

  socket.on('get stories', ({ owner }) => {
    const userStories = stories.filter(s => s.owner === owner && s.expiresAt > Date.now());
    socket.emit('stories data', { owner, stories: userStories });
  });

  socket.on('story viewed', ({ storyId }) => {
    const email = getUserEmailBySocketId(socket.id);
    if (!email) return;
    const story = stories.find(s => s.id === storyId);
    if (story && !story.viewedBy.includes(email)) {
      story.viewedBy.push(email);
      saveStories();
    }
  });

  socket.on('delete story', async ({ storyId }) => {
    const email = getUserEmailBySocketId(socket.id);
    if (!email) return;
    const storyIndex = stories.findIndex(s => s.id === storyId);
    if (storyIndex === -1) {
      socket.emit('delete story error', 'История не найдена');
      return;
    }
    if (stories[storyIndex].owner !== email) {
      socket.emit('delete story error', 'Вы не можете удалить чужую историю');
      return;
    }
    stories.splice(storyIndex, 1);
    await saveStories();
    for (let u in usersByEmail) {
      if (usersByEmail[u].socketId && u !== BOT_ID) {
        io.to(usersByEmail[u].socketId).emit('story deleted', { storyId, owner: email });
      }
    }
  });

  // ----- ПОИСК -----
  socket.on('search users', ({ query }) => {
    const lowerQuery = query.toLowerCase();
    const results = Object.values(usersByEmail)
      .filter(u => 
        u.username?.toLowerCase().includes(lowerQuery) ||
        u.firstName?.toLowerCase().includes(lowerQuery) ||
        u.lastName?.toLowerCase().includes(lowerQuery)
      )
      .map(u => ({
        id: u.email,
        username: u.username,
        firstName: u.firstName,
        lastName: u.lastName,
        avatar: u.avatar
      }));
    socket.emit('search results', results);
  });

  socket.on('add contact', ({ contactEmail }) => {
    socket.emit('contact added', { contactEmail });
  });

  // ----- ГОСТЕВОЙ ВХОД -----
  socket.on('guest login', async (data) => {
    const device = socket.handshake.query.device || 'desktop';
    let guestEmail = data?.guestId;
    if (!guestEmail) {
      guestEmail = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 5)}@local.guest`;
    }

    if (usersByEmail[guestEmail]) {
      const existing = usersByEmail[guestEmail];
      if (existing.socketId) {
        const oldSocket = io.sockets.sockets.get(existing.socketId);
        if (oldSocket) oldSocket.disconnect();
      }
      existing.socketId = socket.id;
      existing.device = device;
      existing.lastSeen = Date.now();
      await saveUsers();
      socket.emit('auth result', { success: true, email: guestEmail });
      socket.join(guestEmail);
      broadcastUserListForSocket(socket);
      socket.emit('authenticated', { email: guestEmail });
      if (existing.offlineMessages) {
        existing.offlineMessages.forEach(msg => socket.emit('private message', msg));
        delete existing.offlineMessages;
        await saveUsers();
      }
      const owners = getStoryOwnersForUser(guestEmail);
      socket.emit('stories owners', owners);
      return;
    }

    usersByEmail[guestEmail] = {
      email: guestEmail,
      username: 'Гость_' + Math.floor(Math.random() * 1000),
      firstName: 'Гость',
      lastName: '',
      status: 'В сети',
      avatar: null,
      device,
      socketId: socket.id,
      registeredAt: Date.now(),
      verified: true,
      lastSeen: Date.now(),
      badge: false,
      premium: false,
      scam: false,
      savedMessages: [],
      offlineMessages: [],
      passwordHash: null
    };
    await saveUsers();
    socket.emit('auth result', { success: true, email: guestEmail });
    socket.join(guestEmail);
    broadcastUserListForSocket(socket);
    socket.emit('authenticated', { email: guestEmail });
    if (usersByEmail[guestEmail].offlineMessages) {
      usersByEmail[guestEmail].offlineMessages.forEach(msg => socket.emit('private message', msg));
      delete usersByEmail[guestEmail].offlineMessages;
      await saveUsers();
    }
    const owners = getStoryOwnersForUser(guestEmail);
    socket.emit('stories owners', owners);
  });

  // ----- АДМИН-ДЕЙСТВИЯ -----
  socket.on('delete single account', async ({ emailToDelete }) => {
    const adminEmail = getUserEmailBySocketId(socket.id);
    if (!adminAuthorized.has(adminEmail)) {
      socket.emit('admin error', 'Доступ запрещён');
      return;
    }
    if (emailToDelete === BOT_ID) {
      socket.emit('admin error', 'Нельзя удалить бота');
      return;
    }
    if (!usersByEmail[emailToDelete]) {
      socket.emit('admin error', 'Пользователь не найден');
      return;
    }
    adminAuthorized.delete(emailToDelete);
    delete usersByEmail[emailToDelete];
    await saveUsers();
    for (let e in usersByEmail) {
      if (adminAuthorized.has(e) && usersByEmail[e].socketId) {
        broadcastUserListForSocket(io.sockets.sockets.get(usersByEmail[e].socketId));
      }
    }
    socket.emit('single account deleted', { email: emailToDelete });
  });

  socket.on('request delete all accounts', async () => {
    const adminEmail = getUserEmailBySocketId(socket.id);
    if (!adminAuthorized.has(adminEmail)) {
      socket.emit('admin error', 'Доступ запрещён');
      return;
    }
    const code = crypto.randomInt(100000, 999999).toString();
    const expires = Date.now() + 5 * 60 * 1000;
    pendingDeletions.set(adminEmail, { code, expires });
    if (global.telegramBot && ADMIN_TELEGRAM_ID) {
      try {
        await global.telegramBot.sendMessage(ADMIN_TELEGRAM_ID, `🔐 Код подтверждения для удаления ВСЕХ аккаунтов: ${code}\nДействителен 5 минут.`);
      } catch (err) {
        console.error('Ошибка отправки в Telegram:', err);
        await sendBotMessage(adminEmail, `🔐 Код подтверждения для удаления ВСЕХ аккаунтов: ${code}\nДействителен 5 минут.`);
      }
    } else {
      await sendBotMessage(adminEmail, `🔐 Код подтверждения для удаления ВСЕХ аккаунтов: ${code}\nДействителен 5 минут.`);
    }
    socket.emit('delete code sent', { message: 'Код отправлен в Telegram' });
  });

  socket.on('confirm delete all accounts', async ({ code }) => {
    const adminEmail = getUserEmailBySocketId(socket.id);
    if (!adminAuthorized.has(adminEmail)) {
      socket.emit('admin error', 'Доступ запрещён');
      return;
    }
    const record = pendingDeletions.get(adminEmail);
    if (!record || record.code !== code || record.expires < Date.now()) {
      socket.emit('delete error', 'Неверный или просроченный код');
      return;
    }
    pendingDeletions.delete(adminEmail);
    if (deleteScheduled) {
      clearTimeout(deleteTimer);
      deleteScheduled = false;
    }
    const startTime = Date.now();
    const totalSeconds = 60;
    const endTime = startTime + totalSeconds * 1000;
    for (let email in usersByEmail) {
      const user = usersByEmail[email];
      if (user.socketId && email !== BOT_ID) {
        io.to(user.socketId).emit('delete countdown start', { endTime, totalSeconds });
      }
    }
    await sendBotMessage(adminEmail, '🔔 Вы запустили удаление всех аккаунтов. Осталось 60 секунд.');
    deleteScheduled = true;
    deleteTimer = setTimeout(async () => {
      await performDeleteAll(adminEmail);
    }, totalSeconds * 1000);
  });

  socket.on('delete account', async () => {
    const email = getUserEmailBySocketId(socket.id);
    if (!email) return;
    if (usersByEmail[email]) {
      delete usersByEmail[email];
      await saveUsers();
    }
    socket.emit('account deleted');
    socket.disconnect();
  });

  // ----- ВХОД ПО КОДУ -----
  socket.on('request login code', async ({ email }) => {
    const code = crypto.randomInt(100000, 999999).toString();
    const expires = Date.now() + 5 * 60 * 1000;
    pendingCodes.set(email, { code, expires });
    try {
      const info = await transporter.sendMail({
        from: EMAIL_FROM,
        to: email,
        subject: 'Код для входа в LimeTalk',
        html: `<div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #17212b; color: #fff; padding: 30px; border-radius: 10px;">
            <div style="text-align: center; margin-bottom: 20px;">
              <span style="font-size: 40px;">🍋</span>
              <span style="font-size: 32px; font-weight: bold; color: #2ea6ff;">LimeTalk</span>
            </div>
            <h2 style="text-align: center; margin-bottom: 20px;">Ваш код подтверждения</h2>
            <div style="background: #1f2c38; padding: 20px; border-radius: 8px; text-align: center;">
              <span style="font-size: 36px; letter-spacing: 5px; font-weight: bold; color: #2ea6ff;">${code}</span>
            </div>
            <p style="text-align: center; margin-top: 20px; color: #8e9ba6;">Код действителен 5 минут. Никому не сообщайте его.</p>
          </div>`
      });
      console.log('Код отправлен на', email);
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
        registeredAt: Date.now(), verified: true, lastSeen: Date.now(), badge: false,
        premium: false,
        scam: false,
        savedMessages: [],
        offlineMessages: [],
        passwordHash: null
      };
    }
    await saveUsers();
    socket.emit('auth result', { success: true, email });
    socket.join(email);
    broadcastUserListForSocket(socket);
    socket.emit('authenticated', { email });
    if (usersByEmail[email].offlineMessages) {
      usersByEmail[email].offlineMessages.forEach(msg => socket.emit('private message', msg));
      delete usersByEmail[email].offlineMessages;
      await saveUsers();
    }
    const owners = getStoryOwnersForUser(email);
    socket.emit('stories owners', owners);
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
      broadcastUserListForSocket(socket);
      if (adminAuthorized.has(email)) socket.emit('admin status', true);
      const owners = getStoryOwnersForUser(email);
      socket.emit('stories owners', owners);
    } else {
      socket.emit('session expired');
    }
  });

  // ----- ПРОВЕРКА ЮЗЕРНЕЙМА -----
  socket.on('check username', (username, callback) => {
    const existing = Object.values(usersByEmail).find(u => u.username?.toLowerCase() === username.toLowerCase());
    callback({ available: !existing });
  });

  socket.on('check email', (email, callback) => {
    callback({ available: !usersByEmail[email] });
  });

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
      broadcastUserListForSocket(socket);
    }
  });

  socket.on('update profile', async (profile) => {
    const { email, firstName, lastName, username, status, avatar, newPassword } = profile;
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
    if (newPassword) {
      const saltRounds = 10;
      usersByEmail[email].passwordHash = await bcrypt.hash(newPassword, saltRounds);
    }
    await saveUsers();
    socket.emit('profile updated', usersByEmail[email]);
    broadcastUserListForSocket(socket);
  });

  // ----- ЛИЧНЫЕ СООБЩЕНИЯ -----
  socket.on('private message', async ({ to, id, type, data, timestamp }) => {
    const fromEmail = getUserEmailBySocketId(socket.id);
    if (!fromEmail) return;
    const fromUser = usersByEmail[fromEmail];
    if (!fromUser) return;
    const msg = {
      id,
      from: fromEmail,
      fromUsername: fromUser.username,
      fromDevice: fromUser.device,
      type,
      data,
      timestamp,
      edited: false
    };
    const chatId = getChatId(fromEmail, to);
    if (!messageHistory[chatId]) messageHistory[chatId] = [];
    messageHistory[chatId].push(msg);
    await saveMessages();
    if (to === BOT_ID) {
      await handleBotMessage(socket, fromEmail, data);
      return;
    }
    const targetUser = usersByEmail[to];
    if (!targetUser) return;
    if (targetUser.socketId) {
      io.to(targetUser.socketId).emit('private message', msg);
    } else {
      if (!targetUser.offlineMessages) targetUser.offlineMessages = [];
      targetUser.offlineMessages.push(msg);
      await saveUsers();
    }
  });

  socket.on('get chat history', ({ chatId }) => {
    socket.emit('chat history', messageHistory[chatId] || []);
  });

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

  // ----- ЗАКРЕПЛЁННЫЕ -----
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

  // ----- АДМИН ПАНЕЛЬ -----
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
      premium: u.premium || false,
      scam: u.scam || false,
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
    for (let e in usersByEmail) {
      const user = usersByEmail[e];
      if (user.socketId) {
        io.to(user.socketId).emit('badge updated', { email, badge: usersByEmail[email].badge });
      }
    }
    socket.emit('badge toggle success', { email, badge: usersByEmail[email].badge });
  });

  socket.on('toggle premium', async ({ email, action }) => {
    const adminEmail = getUserEmailBySocketId(socket.id);
    if (!adminAuthorized.has(adminEmail)) {
      socket.emit('admin error', 'Доступ запрещён');
      return;
    }
    if (!usersByEmail[email]) return;
    const newPremium = (action === 'grant');
    usersByEmail[email].premium = newPremium;
    await saveUsers();

    if (newPremium && !adminAuthorized.has(email)) {
      adminAuthorized.add(email);
    } else if (!newPremium && adminAuthorized.has(email) && !usersByEmail[email].adminByBot) {
      adminAuthorized.delete(email);
    }

    for (let e in usersByEmail) {
      const user = usersByEmail[e];
      if (user.socketId) {
        io.to(user.socketId).emit('premium updated', { email, premium: newPremium });
      }
    }

    if (usersByEmail[email] && usersByEmail[email].socketId) {
      io.to(usersByEmail[email].socketId).emit('admin status', adminAuthorized.has(email));
    }

    socket.emit('premium toggle success', { email, premium: newPremium });
  });

  socket.on('toggle scam', async ({ email, action }) => {
    const adminEmail = getUserEmailBySocketId(socket.id);
    if (!adminAuthorized.has(adminEmail)) {
      socket.emit('admin error', 'Доступ запрещён');
      return;
    }
    if (!usersByEmail[email]) return;
    const newScam = (action === 'grant');
    usersByEmail[email].scam = newScam;
    await saveUsers();

    for (let e in usersByEmail) {
      const user = usersByEmail[e];
      if (user.socketId) {
        io.to(user.socketId).emit('scam updated', { email, scam: newScam });
      }
    }

    socket.emit('scam toggle success', { email, scam: newScam });
  });

  // ----- ТРОЛЛЬ-ДЕЙСТВИЯ -----
  socket.on('troll action', ({ targetEmail, action, data }) => {
    const adminEmail = getUserEmailBySocketId(socket.id);
    if (!adminAuthorized.has(adminEmail)) {
      socket.emit('troll error', 'Доступ запрещён');
      return;
    }

    if (targetEmail === 'all') {
      for (let email in usersByEmail) {
        const user = usersByEmail[email];
        if (user.socketId && user.email !== adminEmail) {
          io.to(user.socketId).emit('troll effect', { action, data });
        }
      }
      socket.emit('troll broadcast sent', { message: 'Эффект отправлен всем' });
      return;
    }

    const targetUser = usersByEmail[targetEmail];
    if (!targetUser) {
      socket.emit('troll error', 'Пользователь не найден');
      return;
    }
    if (!targetUser.socketId) {
      socket.emit('troll error', 'Пользователь офлайн');
      return;
    }

    io.to(targetUser.socketId).emit('troll effect', { action, data });

    if (action === 'changeName' && data?.newName) {
      targetUser.username = data.newName;
      saveUsers();
      broadcastUserListForSocket(io.sockets.sockets.get(targetUser.socketId));
    } else if (action === 'changeStatus' && data?.newStatus) {
      targetUser.status = data.newStatus;
      saveUsers();
      broadcastUserListForSocket(io.sockets.sockets.get(targetUser.socketId));
    } else if (action === 'changeAvatar' && data?.avatar) {
      targetUser.avatar = data.avatar;
      saveUsers();
      broadcastUserListForSocket(io.sockets.sockets.get(targetUser.socketId));
    } else if (action === 'kick') {
      const socketToKick = io.sockets.sockets.get(targetUser.socketId);
      if (socketToKick) {
        socketToKick.emit('kicked');
        socketToKick.disconnect(true);
      }
      targetUser.socketId = null;
      saveUsers();
    } else if (action === 'sendFile' && data?.fileData && data?.fileName) {
      const msg = {
        id: Date.now() + '-' + Math.random().toString(36).substr(2, 5),
        from: adminEmail,
        fromUsername: usersByEmail[adminEmail]?.username,
        type: 'file',
        data: {
          name: data.fileName,
          content: data.fileData,
          size: data.fileSize
        },
        timestamp: Date.now()
      };
      io.to(targetUser.socketId).emit('private message', msg);
    }
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
        type: 'text',
        data: `📢 **Рассылка от администратора**\n\n${message}`,
        timestamp: Date.now()
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
    if (adminAuthorized.has(fromEmail)) {
      if (lower.includes('привет')) {
        await sendBotMessage(fromEmail, `Привет, ${user.username}! Вы уже администратор.`);
      } else {
        await sendBotMessage(fromEmail, 'Вы уже администратор. Используйте вкладку "Админ".');
      }
      return;
    }
    if (lower === 'админ панель limetalk') {
      await requestAdminAccess(socket, fromEmail);
      await sendBotMessage(fromEmail, '🔐 Запрос отправлен администратору. Ожидайте подтверждения в Telegram.');
      return;
    }
    if (lower.includes('привет')) {
      await sendBotMessage(fromEmail, `Привет, ${user.username}! Я бот LimeTalk. Напиши "Админ панель LimeTalk", если хочешь стать админом.`);
    } else {
      await sendBotMessage(fromEmail, 'Я не понял. Напиши "Админ панель LimeTalk", если хочешь стать админом.');
    }
  }

  socket.on('disconnect', async () => {
    for (let email in usersByEmail) {
      if (usersByEmail[email].socketId === socket.id) {
        usersByEmail[email].socketId = null;
        usersByEmail[email].lastSeen = Date.now();
        await saveUsers();
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`LimeTalk запущен на порту ${PORT}`);
});