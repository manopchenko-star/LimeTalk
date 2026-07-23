// server.js — ПОЛНАЯ ВЕРСИЯ LIME TALK С YANDEXGPT (АЛИСА)
require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcrypt');
// Если Node.js < 18, установи: npm install node-fetch@2 и раскомментируй строку ниже:
// const fetch = require('node-fetch');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 10 * 1024 * 1024 });

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
    try { const data = await fs.readFile(USERS_FILE, 'utf8'); usersByEmail = JSON.parse(data); } catch { usersByEmail = {}; }
    for (let email in usersByEmail) if (usersByEmail[email].premium) adminAuthorized.add(email);
}
async function saveUsers() { await fs.writeFile(USERS_FILE, JSON.stringify(usersByEmail, null, 2)); }
async function loadReactions() {
    try { const data = await fs.readFile(REACTIONS_FILE, 'utf8'); reactions = JSON.parse(data); } catch { reactions = {}; }
}
async function saveReactions() { await fs.writeFile(REACTIONS_FILE, JSON.stringify(reactions, null, 2)); }
async function loadMessages() {
    try { const data = await fs.readFile(MESSAGES_FILE, 'utf8'); messageHistory = JSON.parse(data); } catch { messageHistory = {}; }
}
async function saveMessages() { await fs.writeFile(MESSAGES_FILE, JSON.stringify(messageHistory, null, 2)); }
async function loadStories() {
    try { const data = await fs.readFile(STORIES_FILE, 'utf8'); stories = JSON.parse(data); } catch { stories = []; }
}
async function saveStories() { await fs.writeFile(STORIES_FILE, JSON.stringify(stories, null, 2)); }

Promise.all([loadUsers(), loadReactions(), loadMessages(), loadStories()]).then(() => {
    console.log('✅ Данные загружены');
    cleanExpiredStories();
    setInterval(cleanExpiredStories, 60 * 60 * 1000);
});

// ========== ПОЧТА ==========
const transporter = nodemailer.createTransport({
    host: 'smtp.yandex.ru',
    port: 465,
    secure: true,
    auth: { user: 'LimeTalk@yandex.ru', pass: 'faysyctndhepofnm' }
});
const EMAIL_FROM = 'LimeTalk@yandex.ru';

// ========== YANDEX GPT НАСТРОЙКИ ==========
const YANDEX_FOLDER_ID = 'b1g2cgrj2p40sc4sndvv';     // ⚠️ Замени на свой Folder ID
const YANDEX_API_KEY = 'AQVNwp-ckWilBrKj1JL41_QRhdKGB_62KNDl4fCC';        // ⚠️ Замени на свой API-ключ

const SYSTEM_PROMPT = `Ты — Алиса, голосовой помощник. Общайся вежливо, кратко, по-русски. Если не знаешь ответа, честно признайся.`;

async function callYandexGPT(prompt) {
    console.log(`📤 Запрос к YandexGPT: "${prompt.substring(0, 50)}..."`);
    try {
        const response = await fetch('https://llm.api.cloud.yandex.net/foundationModels/v1/completion', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Api-Key ${YANDEX_API_KEY}`,
                'x-folder-id': YANDEX_FOLDER_ID,
            },
            body: JSON.stringify({
                modelUri: `gpt://${YANDEX_FOLDER_ID}/yandexgpt-lite`,
                completionOptions: {
                    stream: false,
                    temperature: 0.7,
                    maxTokens: 2000,
                },
                messages: [
                    { role: 'system', text: SYSTEM_PROMPT },
                    { role: 'user', text: prompt }
                ],
            }),
        });

        if (!response.ok) {
            console.error('❌ Ошибка YandexGPT:', response.status, response.statusText);
            return '🤖 Извини, произошла ошибка при запросе к Алисе.';
        }

        const data = await response.json();
        const answer = data.result?.alternatives?.[0]?.message?.text;
        if (answer) {
            console.log(`✅ Алиса: ${answer.substring(0, 100)}...`);
            return answer;
        } else {
            console.error('❌ Пустой ответ от YandexGPT');
            return '🤖 Алиса не смогла ответить. Попробуй переформулировать.';
        }
    } catch (err) {
        console.error('❌ Сетевая ошибка:', err.message);
        return '🤖 Не удалось связаться с Алисой. Проверь интернет.';
    }
}

// ========== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ==========
const pendingCodes = new Map();
const adminAuthorized = new Set();
const pendingDeletions = new Map();
let deleteTimer = null;
let deleteScheduled = false;
const BOT_ID = 'ai_bot';
const BOT_NAME = '🥏 Алиса';

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
function getUserEmailBySocketId(socketId) {
    for (let email in usersByEmail) if (usersByEmail[email].socketId === socketId) return email;
    return null;
}
function getChatId(user1, user2) { return [user1, user2].sort().join(':'); }

async function broadcastUserListForSocket(socket) {
    const email = getUserEmailBySocketId(socket.id);
    if (!email) return;
    const userList = [];
    for (let e in usersByEmail) {
        const u = usersByEmail[e];
        userList.push({
            id: u.email, username: u.username, firstName: u.firstName, lastName: u.lastName,
            avatar: u.avatar, status: u.status, badge: u.badge, premium: u.premium || false,
            scam: u.scam || false, online: !!u.socketId, lastSeen: u.lastSeen, isSelf: e === email
        });
    }
    userList.push({
        id: BOT_ID, username: BOT_NAME, device: 'bot', online: true,
        badge: false, premium: false, scam: false, isSelf: false
    });
    socket.emit('user list', userList);
}

async function sendBotMessage(toEmail, text) {
    const msg = {
        id: Date.now() + '-' + Math.random().toString(36).substr(2, 5),
        from: BOT_ID, fromUsername: BOT_NAME, fromDevice: 'bot',
        type: 'text', data: text, timestamp: Date.now(), edited: false
    };
    const chatId = getChatId(toEmail, BOT_ID);
    if (!messageHistory[chatId]) messageHistory[chatId] = [];
    messageHistory[chatId].push(msg);
    await saveMessages();
    const target = usersByEmail[toEmail];
    if (target && target.socketId) io.to(target.socketId).emit('private message', msg);
    else if (target) {
        if (!target.offlineMessages) target.offlineMessages = [];
        target.offlineMessages.push(msg);
        await saveUsers();
    }
}

async function requestAdminAccess(socket, userEmail) {
    await sendBotMessage(userEmail, '⚠️ Функция выдачи прав администратора отключена (нет Telegram).');
    socket.emit('admin access error', 'Telegram не используется');
}

async function performDeleteAll(adminEmail) {
    if (!deleteScheduled) return;
    console.log(`Удаление всех аккаунтов (кроме ${adminEmail} и бота)`);
    const toDelete = Object.keys(usersByEmail).filter(e => e !== adminEmail && e !== BOT_ID);
    for (let e of toDelete) {
        if (usersByEmail[e].socketId) io.to(usersByEmail[e].socketId).emit('account deleted');
        adminAuthorized.delete(e);
        delete usersByEmail[e];
    }
    await saveUsers();
    deleteScheduled = false;
    clearTimeout(deleteTimer);
    for (let e in usersByEmail) if (usersByEmail[e].socketId) broadcastUserListForSocket(io.sockets.sockets.get(usersByEmail[e].socketId));
    const adminSocket = usersByEmail[adminEmail]?.socketId;
    if (adminSocket) io.to(adminSocket).emit('all accounts deleted');
}

function cleanExpiredStories() {
    const now = Date.now();
    const before = stories.length;
    stories = stories.filter(s => s.expiresAt > now);
    if (stories.length !== before) saveStories();
}
function getStoryOwnersForUser(email) {
    const active = stories.filter(s => s.expiresAt > Date.now());
    const owners = [...new Set(active.map(s => s.owner))];
    return owners.filter(o => o !== BOT_ID);
}

// ========== ОБРАБОТЧИК СООБЩЕНИЙ БОТА ==========
async function handleBotMessage(socket, fromEmail, text) {
    const lower = text.toLowerCase().trim();
    if (lower === 'админ панель limetalk') {
        await requestAdminAccess(socket, fromEmail);
        return;
    }
    const answer = await callYandexGPT(text);
    await sendBotMessage(fromEmail, answer);
}

// ========== SOCKET.IO ОБРАБОТЧИКИ (ПОЛНАЯ ВЕРСИЯ) ==========
io.on('connection', (socket) => {
    console.log('🟢 Новое подключение:', socket.id);

    broadcastUserListForSocket(socket);

    const emailOnConnect = getUserEmailBySocketId(socket.id);
    if (emailOnConnect) socket.emit('stories owners', getStoryOwnersForUser(emailOnConnect));

    socket.on('get stories owners', () => {
        const email = getUserEmailBySocketId(socket.id);
        if (email) socket.emit('stories owners', getStoryOwnersForUser(email));
    });

    socket.on('create story', async ({ type, content }) => {
        const email = getUserEmailBySocketId(socket.id);
        if (!email) return;
        const story = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2,5)}`,
            owner: email, type, content, createdAt: Date.now(),
            expiresAt: Date.now() + 24*60*60*1000, viewedBy: []
        };
        stories.push(story);
        await saveStories();
        for (let u in usersByEmail) if (usersByEmail[u].socketId && u !== BOT_ID) io.to(usersByEmail[u].socketId).emit('new story', { owner: email });
    });

    socket.on('get stories', ({ owner }) => {
        const userStories = stories.filter(s => s.owner === owner && s.expiresAt > Date.now());
        socket.emit('stories data', { owner, stories: userStories });
    });

    socket.on('story viewed', async ({ storyId }) => {
        const email = getUserEmailBySocketId(socket.id);
        if (!email) return;
        const story = stories.find(s => s.id === storyId);
        if (story && !story.viewedBy.includes(email)) { story.viewedBy.push(email); await saveStories(); }
    });

    socket.on('delete story', async ({ storyId }) => {
        const email = getUserEmailBySocketId(socket.id);
        if (!email) return;
        const idx = stories.findIndex(s => s.id === storyId);
        if (idx === -1 || stories[idx].owner !== email) return;
        stories.splice(idx,1);
        await saveStories();
        for (let u in usersByEmail) if (usersByEmail[u].socketId && u !== BOT_ID) io.to(usersByEmail[u].socketId).emit('story deleted', { storyId, owner: email });
    });

    socket.on('search users', ({ query }) => {
        const lower = query.toLowerCase();
        const results = Object.values(usersByEmail).filter(u =>
            u.username?.toLowerCase().includes(lower) || u.firstName?.toLowerCase().includes(lower) || u.lastName?.toLowerCase().includes(lower))
            .map(u => ({ id: u.email, username: u.username, firstName: u.firstName, lastName: u.lastName, avatar: u.avatar }));
        socket.emit('search results', results);
    });
    socket.on('add contact', ({ contactEmail }) => { socket.emit('contact added', { contactEmail }); });

    // Аутентификация
    socket.on('guest login', async (data) => {
        const device = socket.handshake.query.device || 'desktop';
        let guestEmail = data?.guestId || `guest_${Date.now()}_${Math.random().toString(36).substr(2,5)}@local.guest`;
        if (usersByEmail[guestEmail]) {
            const existing = usersByEmail[guestEmail];
            if (existing.socketId) io.sockets.sockets.get(existing.socketId)?.disconnect();
            existing.socketId = socket.id; existing.device = device; existing.lastSeen = Date.now();
            await saveUsers();
            socket.emit('auth result', { success: true, email: guestEmail });
            socket.join(guestEmail);
            broadcastUserListForSocket(socket);
            if (existing.offlineMessages) {
                existing.offlineMessages.forEach(msg => socket.emit('private message', msg));
                delete existing.offlineMessages; await saveUsers();
            }
            socket.emit('stories owners', getStoryOwnersForUser(guestEmail));
            return;
        }
        usersByEmail[guestEmail] = {
            email: guestEmail, username: 'Гость_' + Math.floor(Math.random()*1000), firstName: 'Гость', lastName: '',
            status: 'В сети', avatar: null, device, socketId: socket.id, registeredAt: Date.now(),
            verified: true, lastSeen: Date.now(), badge: false, premium: false, scam: false,
            savedMessages: [], offlineMessages: [], passwordHash: null
        };
        await saveUsers();
        socket.emit('auth result', { success: true, email: guestEmail });
        socket.join(guestEmail);
        broadcastUserListForSocket(socket);
        socket.emit('stories owners', getStoryOwnersForUser(guestEmail));
    });

    socket.on('request login code', async ({ email }) => {
        const code = crypto.randomInt(100000,999999).toString();
        pendingCodes.set(email, { code, expires: Date.now()+5*60000 });
        try {
            await transporter.sendMail({ from: EMAIL_FROM, to: email, subject: 'Код для входа в LimeTalk', html: `<div>Ваш код: <b>${code}</b></div>` });
            socket.emit('code sent', { success: true });
        } catch(e) { socket.emit('code sent', { success: false, message: 'Ошибка отправки' }); }
    });

    socket.on('authenticate', async ({ email, code }) => {
        const record = pendingCodes.get(email);
        if (!record || record.code !== code || record.expires < Date.now()) { socket.emit('auth result', { success: false, message: 'Неверный код' }); return; }
        pendingCodes.delete(email);
        const device = socket.handshake.query.device || 'desktop';
        if (usersByEmail[email]) {
            const existing = usersByEmail[email];
            if (existing.socketId) io.sockets.sockets.get(existing.socketId)?.disconnect();
            existing.socketId = socket.id; existing.device = device; existing.lastSeen = Date.now();
        } else {
            usersByEmail[email] = {
                email, username: email.split('@')[0], firstName: '', lastName: '', status: '', avatar: null,
                device, socketId: socket.id, registeredAt: Date.now(), verified: true, lastSeen: Date.now(),
                badge: false, premium: false, scam: false, savedMessages: [], offlineMessages: [], passwordHash: null
            };
        }
        await saveUsers();
        socket.emit('auth result', { success: true, email });
        socket.join(email);
        broadcastUserListForSocket(socket);
        if (usersByEmail[email].offlineMessages) {
            usersByEmail[email].offlineMessages.forEach(msg => socket.emit('private message', msg));
            delete usersByEmail[email].offlineMessages; await saveUsers();
        }
        socket.emit('stories owners', getStoryOwnersForUser(email));
    });

    socket.on('restore session', async ({ email }) => {
        if (usersByEmail[email]) {
            const user = usersByEmail[email];
            if (user.socketId && user.socketId !== socket.id) io.sockets.sockets.get(user.socketId)?.disconnect();
            user.socketId = socket.id; user.device = socket.handshake.query.device || 'desktop'; user.lastSeen = Date.now();
            await saveUsers();
            socket.join(email);
            socket.emit('session restored', { email, username: user.username });
            broadcastUserListForSocket(socket);
            if (adminAuthorized.has(email)) socket.emit('admin status', true);
            socket.emit('stories owners', getStoryOwnersForUser(email));
        } else socket.emit('session expired');
    });

    // Профиль
    socket.on('check username', (username, callback) => {
        const exists = Object.values(usersByEmail).some(u => u.username?.toLowerCase() === username.toLowerCase());
        callback({ available: !exists });
    });
    socket.on('check email', (email, callback) => { callback({ available: !usersByEmail[email] }); });
    socket.on('set username', async ({ email, username, firstName, lastName }) => {
        const exists = Object.values(usersByEmail).find(u => u.email !== email && u.username?.toLowerCase() === username.toLowerCase());
        if (exists) { socket.emit('username error', 'Юзернейм занят'); return; }
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
            const exists = Object.values(usersByEmail).find(u => u.email !== email && u.username?.toLowerCase() === username.toLowerCase());
            if (exists) { socket.emit('profile update error', 'Юзернейм занят'); return; }
        }
        usersByEmail[email].firstName = firstName; usersByEmail[email].lastName = lastName;
        usersByEmail[email].username = username; usersByEmail[email].status = status;
        usersByEmail[email].avatar = avatar;
        if (newPassword) usersByEmail[email].passwordHash = await bcrypt.hash(newPassword, 10);
        await saveUsers();
        socket.emit('profile updated', usersByEmail[email]);
        broadcastUserListForSocket(socket);
    });

    // Личные сообщения
    socket.on('private message', async ({ to, id, type, data, timestamp }) => {
        const fromEmail = getUserEmailBySocketId(socket.id);
        if (!fromEmail) return;
        const fromUser = usersByEmail[fromEmail];
        if (!fromUser) return;
        const msg = { id, from: fromEmail, fromUsername: fromUser.username, type, data, timestamp, edited: false };
        const chatId = getChatId(fromEmail, to);
        if (!messageHistory[chatId]) messageHistory[chatId] = [];
        messageHistory[chatId].push(msg);
        await saveMessages();
        if (to === BOT_ID) {
            await handleBotMessage(socket, fromEmail, data);
            return;
        }
        const target = usersByEmail[to];
        if (target && target.socketId) io.to(target.socketId).emit('private message', msg);
        else if (target) {
            if (!target.offlineMessages) target.offlineMessages = [];
            target.offlineMessages.push(msg);
            await saveUsers();
        }
    });
    socket.on('get chat history', ({ chatId }) => { socket.emit('chat history', messageHistory[chatId] || []); });
    socket.on('edit message', ({ msgId, newText, to }) => {
        const fromEmail = getUserEmailBySocketId(socket.id);
        if (!fromEmail) return;
        const target = usersByEmail[to];
        if (target && target.socketId) io.to(target.socketId).emit('message edited', { msgId, newText, editor: fromEmail });
        socket.emit('message edited ack', { msgId, newText });
    });

    // Реакции
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
            const target = usersByEmail[to];
            if (target && target.socketId) io.to(target.socketId).emit('reaction update', update);
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
            if (reactions[key][emoji].length===0) delete reactions[key][emoji];
            saveReactions();
            const update = { chatId, msgId, emoji, users: reactions[key][emoji] || [] };
            const target = usersByEmail[to];
            if (target && target.socketId) io.to(target.socketId).emit('reaction update', update);
            socket.emit('reaction update', update);
        }
    });

    // Избранное
    socket.on('get saved messages', () => {
        const email = getUserEmailBySocketId(socket.id);
        if (email) socket.emit('saved messages', usersByEmail[email]?.savedMessages || []);
    });
    socket.on('save message', (msg) => {
        const email = getUserEmailBySocketId(socket.id);
        if (!email) return;
        if (!usersByEmail[email].savedMessages) usersByEmail[email].savedMessages = [];
        const obj = { id: Date.now()+Math.random(), text: msg.text, timestamp: Date.now(), from: email };
        usersByEmail[email].savedMessages.push(obj);
        saveUsers();
        socket.emit('message saved', obj);
    });

    // Закреплённые
    const pinnedMessages = {};
    socket.on('pin message', ({ chatId, message }) => {
        const email = getUserEmailBySocketId(socket.id);
        if (!email) return;
        const participants = chatId.split(':');
        if (!participants.includes(email)) return;
        pinnedMessages[chatId] = { message, pinnedBy: email, timestamp: Date.now() };
        const other = participants.find(p => p !== email);
        if (other && usersByEmail[other] && usersByEmail[other].socketId) io.to(usersByEmail[other].socketId).emit('pinned updated', { chatId, pinned: pinnedMessages[chatId] });
        socket.emit('pinned updated', { chatId, pinned: pinnedMessages[chatId] });
    });
    socket.on('get pinned', ({ chatId }) => { socket.emit('pinned data', { chatId, pinned: pinnedMessages[chatId] || null }); });

    // Админ-панель
    socket.on('get admin users', () => {
        const email = getUserEmailBySocketId(socket.id);
        if (!adminAuthorized.has(email)) { socket.emit('admin error', 'Доступ запрещён'); return; }
        const list = Object.values(usersByEmail).map(u => ({
            email: u.email, username: u.username, firstName: u.firstName, lastName: u.lastName,
            registeredAt: u.registeredAt, online: !!u.socketId, badge: u.badge||false,
            premium: u.premium||false, scam: u.scam||false, lastSeen: u.lastSeen
        }));
        socket.emit('admin users data', list);
    });
    socket.on('toggle badge', async ({ email, action }) => {
        const admin = getUserEmailBySocketId(socket.id);
        if (!adminAuthorized.has(admin)) { socket.emit('admin error','Доступ запрещён'); return; }
        if (!usersByEmail[email]) return;
        usersByEmail[email].badge = (action === 'grant');
        await saveUsers();
        for (let e in usersByEmail) if (usersByEmail[e].socketId) io.to(usersByEmail[e].socketId).emit('badge updated', { email, badge: usersByEmail[email].badge });
        socket.emit('badge toggle success', { email, badge: usersByEmail[email].badge });
    });
    socket.on('toggle premium', async ({ email, action }) => {
        const admin = getUserEmailBySocketId(socket.id);
        if (!adminAuthorized.has(admin)) { socket.emit('admin error','Доступ запрещён'); return; }
        if (!usersByEmail[email]) return;
        usersByEmail[email].premium = (action === 'grant');
        await saveUsers();
        for (let e in usersByEmail) if (usersByEmail[e].socketId) io.to(usersByEmail[e].socketId).emit('premium updated', { email, premium: usersByEmail[email].premium });
        socket.emit('premium toggle success', { email, premium: usersByEmail[email].premium });
    });
    socket.on('toggle scam', async ({ email, action }) => {
        const admin = getUserEmailBySocketId(socket.id);
        if (!adminAuthorized.has(admin)) { socket.emit('admin error','Доступ запрещён'); return; }
        if (!usersByEmail[email]) return;
        usersByEmail[email].scam = (action === 'grant');
        await saveUsers();
        for (let e in usersByEmail) if (usersByEmail[e].socketId) io.to(usersByEmail[e].socketId).emit('scam updated', { email, scam: usersByEmail[email].scam });
        socket.emit('scam toggle success', { email, scam: usersByEmail[email].scam });
    });
    socket.on('delete single account', async ({ emailToDelete }) => {
        const admin = getUserEmailBySocketId(socket.id);
        if (!adminAuthorized.has(admin)) { socket.emit('admin error','Доступ запрещён'); return; }
        if (emailToDelete === BOT_ID) { socket.emit('admin error','Нельзя удалить бота'); return; }
        if (!usersByEmail[emailToDelete]) { socket.emit('admin error','Пользователь не найден'); return; }
        adminAuthorized.delete(emailToDelete);
        delete usersByEmail[emailToDelete];
        await saveUsers();
        for (let e in usersByEmail) if (adminAuthorized.has(e) && usersByEmail[e].socketId) broadcastUserListForSocket(io.sockets.sockets.get(usersByEmail[e].socketId));
        socket.emit('single account deleted', { email: emailToDelete });
    });
    socket.on('request delete all accounts', async () => {
        const admin = getUserEmailBySocketId(socket.id);
        if (!adminAuthorized.has(admin)) { socket.emit('admin error','Доступ запрещён'); return; }
        const code = crypto.randomInt(100000,999999).toString();
        pendingDeletions.set(admin, { code, expires: Date.now()+5*60000 });
        await sendBotMessage(admin, `🔐 Код для удаления всех аккаунтов: ${code}\nДействителен 5 минут.`);
        socket.emit('delete code sent', { message: 'Код отправлен в чат с ботом' });
    });
    socket.on('confirm delete all accounts', async ({ code }) => {
        const admin = getUserEmailBySocketId(socket.id);
        if (!adminAuthorized.has(admin)) { socket.emit('admin error','Доступ запрещён'); return; }
        const rec = pendingDeletions.get(admin);
        if (!rec || rec.code !== code || rec.expires < Date.now()) { socket.emit('delete error','Неверный код'); return; }
        pendingDeletions.delete(admin);
        if (deleteScheduled) clearTimeout(deleteTimer);
        const totalSeconds = 60;
        const endTime = Date.now() + totalSeconds*1000;
        for (let email in usersByEmail) if (usersByEmail[email].socketId && email !== BOT_ID) io.to(usersByEmail[email].socketId).emit('delete countdown start', { endTime, totalSeconds });
        deleteScheduled = true;
        deleteTimer = setTimeout(async () => await performDeleteAll(admin), totalSeconds*1000);
    });
    socket.on('delete account', async () => {
        const email = getUserEmailBySocketId(socket.id);
        if (email && usersByEmail[email]) { delete usersByEmail[email]; await saveUsers(); }
        socket.emit('account deleted');
        socket.disconnect();
    });

    // Тролль-панель
    socket.on('troll action', ({ targetEmail, action, data }) => {
        const admin = getUserEmailBySocketId(socket.id);
        if (!adminAuthorized.has(admin)) { socket.emit('troll error', 'Доступ запрещён'); return; }
        if (targetEmail === 'all') {
            for (let email in usersByEmail) {
                const user = usersByEmail[email];
                if (user.socketId && user.email !== admin) io.to(user.socketId).emit('troll effect', { action, data });
            }
            socket.emit('troll broadcast sent', { message: 'Эффект отправлен всем' });
            return;
        }
        const target = usersByEmail[targetEmail];
        if (!target || !target.socketId) { socket.emit('troll error','Пользователь не найден или офлайн'); return; }
        io.to(target.socketId).emit('troll effect', { action, data });
        if (action === 'changeName' && data?.newName) {
            target.username = data.newName; saveUsers(); broadcastUserListForSocket(io.sockets.sockets.get(target.socketId));
        } else if (action === 'changeStatus' && data?.newStatus) {
            target.status = data.newStatus; saveUsers(); broadcastUserListForSocket(io.sockets.sockets.get(target.socketId));
        } else if (action === 'changeAvatar' && data?.avatar) {
            target.avatar = data.avatar; saveUsers(); broadcastUserListForSocket(io.sockets.sockets.get(target.socketId));
        } else if (action === 'kick') {
            io.sockets.sockets.get(target.socketId)?.disconnect(true);
            target.socketId = null; saveUsers();
        } else if (action === 'sendFile' && data?.fileData && data?.fileName) {
            const msg = { id: Date.now()+'-'+Math.random().toString(36).substr(2,5), from: admin, fromUsername: usersByEmail[admin]?.username, type: 'file', data: { name: data.fileName, content: data.fileData, size: data.fileSize }, timestamp: Date.now() };
            io.to(target.socketId).emit('private message', msg);
        }
    });
    socket.on('broadcast from admin', async ({ message }) => {
        const admin = getUserEmailBySocketId(socket.id);
        if (!adminAuthorized.has(admin)) { socket.emit('broadcast result', { success: false, message: 'Доступ запрещён' }); return; }
        for (let email in usersByEmail) {
            const user = usersByEmail[email];
            const msg = { from: BOT_ID, fromUsername: BOT_NAME, type: 'text', data: `📢 **Рассылка от администратора**\n\n${message}`, timestamp: Date.now() };
            if (user.socketId) io.to(user.socketId).emit('private message', msg);
            else { if (!user.offlineMessages) user.offlineMessages = []; user.offlineMessages.push(msg); }
        }
        await saveUsers();
        socket.emit('broadcast result', { success: true, count: Object.keys(usersByEmail).length });
    });

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
    console.log(`🍋 LimeTalk запущен на порту ${PORT}`);
    console.log(`🥏 Бот Алиса готов отвечать`);
});