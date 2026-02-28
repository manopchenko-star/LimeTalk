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
  maxHttpBufferSize: 10 * 1024 * 1024 // 10 МБ для голоса/видео
});

app.use(express.static('public'));

// ========== ФАЙЛОВЫЕ ХРАНИЛИЩА ==========
const USERS_FILE = path.join(__dirname, 'users.json');
const REACTIONS_FILE = path.join(__dirname, 'reactions.json');
const MESSAGES_FILE = path.join(__dirname, 'messages.json');

let usersByEmail = {};
let reactions = {};
let messageHistory = {};

async function loadUsers() {
  try {
    const data = await fs.readFile(USERS_FILE, 'utf8');
    usersByEmail = JSON.parse(data);
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

Promise.all([loadUsers(), loadReactions(), loadMessages()]).then(() => {
  console.log('Данные загружены');
});

// ========== НАСТРОЙКИ ПОЧТЫ (ЯНДЕКС) ==========
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

// ========== НАСТРОЙКИ TELEGRAM-БОТА ==========
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || '7284208495:AAEaty-Squbuvdv6yyc-evC5ns5Vu8xuA5A';
const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID || '1523825366'; // ваш ID

// Выбор режима: polling (для локальной разработки) или webhook (для Render)
const USE_WEBHOOK = false; // поставьте true, если на Render

if (!USE_WEBHOOK) {
  // Polling
  const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
  bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    if (msg.text === '/start') {
      bot.sendMessage(chatId, `Ваш Telegram ID: ${chatId}`);
    }
  });
  // Обработка callback_query (нажатие на кнопку)
  bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;

    console.log('Получен callback_query:', data);

    // Ожидаем данные в формате confirm_admin:requestId
    if (data.startsWith('confirm_admin:')) {
      const requestId = data.split(':')[1];
      console.log('requestId:', requestId);

      const confirmation = pendingAdminConfirmations.get(requestId);
      if (!confirmation) {
        console.log('Запрос не найден для requestId:', requestId);
        await bot.sendMessage(chatId, '❌ Запрос не найден или устарел. (Возможно, прошло более 5 минут)');
        await bot.answerCallbackQuery(callbackQuery.id);
        return;
      }

      const email = confirmation.email;
      console.log('Подтверждаем доступ для email:', email);

      // Добавляем пользователя в adminAuthorized
      adminAuthorized.add(email);

      // Отправляем сообщение в Telegram
      await bot.sendMessage(chatId, `✅ Доступ к админ-панели подтверждён для пользователя ${email}.`);

      // Уведомляем клиента через socket (если он ещё онлайн)
      if (confirmation.socketId) {
        io.to(confirmation.socketId).emit('admin access granted');
      }

      // Удаляем запись
      pendingAdminConfirmations.delete(requestId);

      // Отвечаем на callback, чтобы убрать "часики" на кнопке
      await bot.answerCallbackQuery(callbackQuery.id);
    } else {
      console.log('Неизвестный callback_data:', data);
    }
  });
  // Сохраняем бота в глобальной области
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
    if (data.startsWith('confirm_admin:')) {
      const requestId = data.split(':')[1];
      const confirmation = pendingAdminConfirmations.get(requestId);
      if (!confirmation) {
        await bot.sendMessage(chatId, '❌ Запрос не найден или устарел.');
        await bot.answerCallbackQuery(callbackQuery.id);
        return;
      }
      const email = confirmation.email;
      adminAuthorized.add(email);
      await bot.sendMessage(chatId, `✅ Доступ к админ-панели подтверждён для пользователя ${email}.`);
      if (confirmation.socketId) {
        io.to(confirmation.socketId).emit('admin access granted');
      }
      pendingAdminConfirmations.delete(requestId);
      await bot.answerCallbackQuery(callbackQuery.id);
    }
  });
  global.telegramBot = bot;
}

// ========== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ==========
const pendingCodes = new Map();          // email -> { code, expires } (для входа по коду)
const adminAuthorized = new Set();       // email пользователей, прошедших полную аутентификацию
const pendingDeletions = new Map();      // email -> { code, expires } для подтверждения удаления всех
const pendingAdminConfirmations = new Map(); // requestId -> { email, socketId, expires } для подтверждения админ-доступа
const BOT_ID = 'ai_bot';
const BOT_NAME = '🤖 AI Bot';

// Таймер для очистки устаревших запросов (каждую минуту)
setInterval(() => {
  const now = Date.now();
  for (let [requestId, conf] of pendingAdminConfirmations.entries()) {
    if (conf.expires < now) {
      pendingAdminConfirmations.delete(requestId);
      console.log(`Очищен устаревший запрос ${requestId}`);
    }
  }
}, 60 * 1000);

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

// ========== ФУНКЦИЯ ДЛЯ ОТПРАВКИ СООБЩЕНИЙ ВНУТРЕННЕГО БОТА ==========
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

// ========== ФУНКЦИЯ ДЛЯ ОТПРАВКИ ЗАПРОСА АДМИНУ ==========
async function requestAdminAccess(socket, userEmail) {
  const user = usersByEmail[userEmail];
  if (!user) return;

  if (!global.telegramBot || !ADMIN_TELEGRAM_ID) {
    socket.emit('admin access error', '❌ Telegram-бот не настроен.');
    return;
  }

  // Генерируем уникальный ID запроса
  const requestId = crypto.randomBytes(8).toString('hex');
  const expires = Date.now() + 5 * 60 * 1000; // 5 минут

  // Сохраняем запрос
  pendingAdminConfirmations.set(requestId, {
    email: userEmail,
    socketId: socket.id,
    expires: expires
  });

  console.log(`Создан запрос ${requestId} для ${userEmail}, expires: ${new Date(expires).toLocaleString()}`);

  try {
    const inlineKeyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Подтвердить доступ', callback_data: `confirm_admin:${requestId}` }]
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

// ========== ОСНОВНОЙ ОБРАБОТЧИК ==========
io.on('connection', (socket) => {
  console.log('Новое подключение:', socket.id);

  // ----- ГОСТЕВОЙ ВХОД -----
  socket.on('guest login', async () => {
    const device = socket.handshake.query.device || 'desktop';
    const guestEmail = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 5)}@local.guest`;
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
  });

  // ----- УДАЛЕНИЕ ОДНОГО АККАУНТА (для админа) -----
  socket.on('delete single account', async ({ emailToDelete }) => {
    const adminEmail = getUserEmailBySocketId(socket.id);
    if (!adminAuthorized.has(adminEmail)) {
      socket.emit('admin error', 'Доступ запрещён');
      return;
    }
    if (!usersByEmail[emailToDelete]) {
      socket.emit('admin error', 'Пользователь не найден');
      return;
    }
    delete usersByEmail[emailToDelete];
    await saveUsers();
    for (let e in usersByEmail) {
      if (adminAuthorized.has(e) && usersByEmail[e].socketId) {
        broadcastUserListForSocket(io.sockets.sockets.get(usersByEmail[e].socketId));
      }
    }
    socket.emit('single account deleted', { email: emailToDelete });
  });

  // ----- ЗАПРОС НА УДАЛЕНИЕ ВСЕХ АККАУНТОВ (генерация кода) -----
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

  // ----- ПОДТВЕРЖДЕНИЕ УДАЛЕНИЯ ВСЕХ АККАУНТОВ -----
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

    const usersToDelete = Object.keys(usersByEmail).filter(e => e !== adminEmail && e !== BOT_ID);
    for (let e of usersToDelete) {
      delete usersByEmail[e];
    }
    await saveUsers();

    socket.emit('all accounts deleted');
    for (let e in usersByEmail) {
      if (usersByEmail[e].socketId) {
        broadcastUserListForSocket(io.sockets.sockets.get(usersByEmail[e].socketId));
      }
    }
  });

  // ----- ЗАПРОС АДМИН-ДОСТУПА (обработчик от клиента) -----
  socket.on('request admin access', async () => {
    const email = getUserEmailBySocketId(socket.id);
    if (!email) return;
    await requestAdminAccess(socket, email);
  });

  // ----- УДАЛЕНИЕ АККАУНТА (самостоятельное) -----
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

  // ----- РЕГИСТРАЦИЯ С ПАРОЛЕМ -----
  socket.on('register with password', async ({ email, username, password, firstName, lastName }) => {
    if (usersByEmail[email]) {
      socket.emit('register error', 'Email уже зарегистрирован');
      return;
    }
    const existing = Object.values(usersByEmail).find(u => u.username?.toLowerCase() === username.toLowerCase());
    if (existing) {
      socket.emit('register error', 'Юзернейм уже занят');
      return;
    }
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const device = socket.handshake.query.device || 'desktop';
    usersByEmail[email] = {
      email,
      username,
      firstName: firstName || '',
      lastName: lastName || '',
      status: '',
      avatar: null,
      device,
      socketId: socket.id,
      registeredAt: Date.now(),
      verified: true,
      lastSeen: Date.now(),
      badge: false,
      savedMessages: [],
      offlineMessages: [],
      passwordHash
    };
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
  });

  // ----- ВХОД ПО ПАРОЛЮ -----
  socket.on('login with password', async ({ email, password }) => {
    const user = usersByEmail[email];
    if (!user || !user.passwordHash) {
      socket.emit('login error', 'Неверный email или пароль');
      return;
    }
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      socket.emit('login error', 'Неверный email или пароль');
      return;
    }
    const device = socket.handshake.query.device || 'desktop';
    if (user.socketId) {
      const oldSocket = io.sockets.sockets.get(user.socketId);
      if (oldSocket) oldSocket.disconnect();
    }
    user.socketId = socket.id;
    user.device = device;
    user.lastSeen = Date.now();
    await saveUsers();
    socket.emit('auth result', { success: true, email });
    socket.join(email);
    broadcastUserListForSocket(socket);
    socket.emit('authenticated', { email });
    if (user.offlineMessages) {
      user.offlineMessages.forEach(msg => socket.emit('private message', msg));
      delete user.offlineMessages;
      await saveUsers();
    }
  });

  // ----- ЗАПРОС КОДА (почта) -----
  socket.on('request login code', async ({ email }) => {
    const code = crypto.randomInt(100000, 999999).toString();
    const expires = Date.now() + 5 * 60 * 1000;
    pendingCodes.set(email, { code, expires });
    try {
      const info = await transporter.sendMail({
        from: EMAIL_FROM,
        to: email,
        subject: 'Код для входа в LimeTalk',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #17212b; color: #fff; padding: 30px; border-radius: 10px;">
            <div style="text-align: center; margin-bottom: 20px;">
              <span style="font-size: 40px;">🍋</span>
              <span style="font-size: 32px; font-weight: bold; color: #2ea6ff;">LimeTalk</span>
            </div>
            <h2 style="text-align: center; margin-bottom: 20px;">Ваш код подтверждения</h2>
            <div style="background: #1f2c38; padding: 20px; border-radius: 8px; text-align: center;">
              <span style="font-size: 36px; letter-spacing: 5px; font-weight: bold; color: #2ea6ff;">${code}</span>
            </div>
            <p style="text-align: center; margin-top: 20px; color: #8e9ba6;">Код действителен 5 минут. Никому не сообщайте его.</p>
          </div>
        `
      });
      console.log('Код отправлен на', email, 'Preview URL:', nodemailer.getTestMessageUrl(info));
      socket.emit('code sent', { success: true });
    } catch (err) {
      console.error('Ошибка отправки письма:', err);
      socket.emit('code sent', { success: false, message: 'Ошибка отправки' });
    }
  });

  // ----- АУТЕНТИФИКАЦИЯ ПО КОДУ -----
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
  });

  // ----- ВОССТАНОВЛЕНИЕ СЕССИИ -----
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
    } else {
      socket.emit('session expired');
    }
  });

  // ----- ПРОВЕРКА ЮЗЕРНЕЙМА -----
  socket.on('check username', (username, callback) => {
    const existing = Object.values(usersByEmail).find(u => u.username?.toLowerCase() === username.toLowerCase());
    callback({ available: !existing });
  });

  // ----- ПРОВЕРКА EMAIL -----
  socket.on('check email', (email, callback) => {
    callback({ available: !usersByEmail[email] });
  });

  // ----- УСТАНОВКА ИМЕНИ (после входа по коду) -----
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

  // ----- ОБНОВЛЕНИЕ ПРОФИЛЯ -----
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

  // ----- ПОЛУЧЕНИЕ ИСТОРИИ СООБЩЕНИЙ -----
  socket.on('get chat history', ({ chatId }) => {
    socket.emit('chat history', messageHistory[chatId] || []);
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
      // Отправляем запрос админу напрямую
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
  });

  // ----- ФУНКЦИЯ ДЛЯ ОТПРАВКИ СПИСКА ПОЛЬЗОВАТЕЛЕЙ (кроме себя) + БОТ -----
  async function broadcastUserListForSocket(socket) {
    const email = getUserEmailBySocketId(socket.id);
    if (!email) return;
    const userList = [];
    for (let e in usersByEmail) {
      if (e === email) continue;
      const u = usersByEmail[e];
      userList.push({
        id: u.email,
        username: u.username,
        firstName: u.firstName,
        lastName: u.lastName,
        avatar: u.avatar,
        status: u.status,
        badge: u.badge,
        online: !!u.socketId,
        lastSeen: u.lastSeen
      });
    }
    userList.push({
      id: BOT_ID,
      username: BOT_NAME,
      device: 'bot',
      online: true,
      badge: false
    });
    socket.emit('user list', userList);
  }
});

// ========== ЗАПУСК ==========
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`LimeTalk запущен на порту ${PORT}`);
});