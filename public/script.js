const socket = io({
  query: { device: detectDevice() }
});

// Элементы DOM
const loginContainer = document.getElementById('login-container');
const chatApp = document.getElementById('chat-app');
const stepEmail = document.getElementById('step-email');
const stepCode = document.getElementById('step-code');
const emailInput = document.getElementById('email-input');
const sendCodeBtn = document.getElementById('send-code-btn');
const codeSentMessage = document.getElementById('code-sent-message');
const codeInput = document.getElementById('code-input');
const verifyCodeBtn = document.getElementById('verify-code-btn');
const authMessage = document.getElementById('auth-message');

// Модалка юзернейма
const usernameModal = document.getElementById('username-modal');
const regUsername = document.getElementById('reg-username');
const regFirstname = document.getElementById('reg-firstname');
const regLastname = document.getElementById('reg-lastname');
const usernameError = document.getElementById('username-error');
const regSubmit = document.getElementById('reg-submit');

// Основные элементы интерфейса
const usersList = document.getElementById('users-list');
const groupsList = document.getElementById('groups-list');
const channelsListDiv = document.getElementById('channels-list');
const channelsUl = document.getElementById('channels-ul');
const messagesDiv = document.getElementById('messages');
const chatHeader = document.getElementById('chat-header');
const chatTitle = document.getElementById('chat-title');
const chatStatus = document.getElementById('chat-status');
const chatAvatar = document.getElementById('chat-avatar');
const profileHeader = document.getElementById('profile-header');
const myNameSpan = document.getElementById('my-name');
const myStatusSpan = document.getElementById('my-status');
const myAvatar = document.getElementById('my-avatar');

// Вкладки
const tabContacts = document.getElementById('tab-contacts');
const tabGroups = document.getElementById('tab-groups');
const tabChannels = document.getElementById('tab-channels');
const tabAdmin = document.getElementById('tab-admin');

// Избранное
const savedMessagesBtn = document.getElementById('saved-messages-btn');

// Поиск
const searchInput = document.getElementById('search-contacts');

// Админка
const adminPanel = document.getElementById('admin-panel');
const onlineList = document.getElementById('online-users');
const offlineList = document.getElementById('offline-users');
const broadcastMessage = document.getElementById('broadcast-message');
const sendBroadcastBtn = document.getElementById('send-broadcast');
const broadcastStatus = document.getElementById('broadcast-status');

// Модалка профиля
const profileModal = document.getElementById('profile-modal');
const modalAvatar = document.getElementById('modal-avatar');
const avatarUpload = document.getElementById('avatar-upload');
const editFirstname = document.getElementById('edit-firstname');
const editLastname = document.getElementById('edit-lastname');
const editUsername = document.getElementById('edit-username');
const editStatus = document.getElementById('edit-status');
const saveProfileBtn = document.getElementById('save-profile');
const closeModal = document.querySelector('.close');

// Поле ввода и кнопки
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const attachBtn = document.getElementById('attach-btn');
const voiceBtn = document.getElementById('voice-btn');
const voicePanel = document.getElementById('voice-panel');
const stopRecordingBtn = document.getElementById('stop-recording');

// Группы
const groupNameInput = document.getElementById('group-name');
const createGroupBtn = document.getElementById('create-group-btn');

// Каналы
const newChannelName = document.getElementById('new-channel-name');
const newChannelDesc = document.getElementById('new-channel-desc');
const createChannelBtn = document.getElementById('create-channel');

// Состояния
let currentEmail = localStorage.getItem('tg_email') || null;
let currentChat = null; // { type: 'user' | 'group' | 'channel' | 'saved', id: string }
let allUsersList = [];
let mediaRecorder;
let audioChunks = [];

const BOT_ID = 'ai_bot';

// Определение устройства
function detectDevice() {
    const ua = navigator.userAgent;
    return (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) ? 'mobile' : 'desktop';
}

// Восстановление сессии
if (currentEmail) {
    loginContainer.style.display = 'none';
    chatApp.style.display = 'flex';
    socket.emit('restore session', { email: currentEmail });
} else {
    loginContainer.style.display = 'block';
    chatApp.style.display = 'none';
}

// ===== ЛОГИКА ВХОДА =====
sendCodeBtn.addEventListener('click', () => {
    const email = emailInput.value.trim();
    if (!email || !email.includes('@')) {
        alert('Введите корректный email');
        return;
    }
    codeSentMessage.innerText = 'Отправка...';
    socket.emit('request login code', { email });
});

socket.on('code sent', ({ success, message }) => {
    if (success) {
        stepEmail.style.display = 'none';
        stepCode.style.display = 'block';
        codeSentMessage.innerText = 'Код отправлен на почту. Проверьте и введите ниже.';
    } else {
        codeSentMessage.innerText = 'Ошибка: ' + message;
    }
});

verifyCodeBtn.addEventListener('click', () => {
    const email = emailInput.value.trim();
    const code = codeInput.value.trim();
    if (!code || code.length !== 6) {
        authMessage.innerText = 'Введите 6-значный код';
        return;
    }
    authMessage.innerText = 'Проверка...';
    socket.emit('authenticate', { email, code });
});

socket.on('auth result', ({ success, message, email }) => {
    if (success) {
        localStorage.setItem('tg_email', email);
        currentEmail = email;
        loginContainer.style.display = 'none';
        usernameModal.style.display = 'flex';
    } else {
        authMessage.innerText = message;
    }
});

// ===== ВЫБОР ЮЗЕРНЕЙМА =====
regSubmit.addEventListener('click', () => {
    const username = regUsername.value.trim();
    if (!username) {
        usernameError.innerText = 'Юзернейм обязателен';
        return;
    }
    socket.emit('check username', username, (response) => {
        if (!response.available) {
            usernameError.innerText = 'Этот юзернейм уже занят';
            return;
        }
        const firstName = regFirstname.value.trim();
        const lastName = regLastname.value.trim();
        socket.emit('set username', { email: currentEmail, username, firstName, lastName });
    });
});

socket.on('username set', () => {
    usernameModal.style.display = 'none';
    chatApp.style.display = 'flex';
    loadMyProfile();
});

socket.on('username error', (msg) => {
    usernameError.innerText = msg;
});

socket.on('session restored', ({ email, username }) => {
    currentEmail = email;
    loadMyProfile();
});

// ===== ПРОФИЛЬ =====
function loadMyProfile() {
    // Данные придут в user list, но пока просто заглушка
    // Можно запросить отдельно, но для простоты используем usersByEmail
}

profileHeader.addEventListener('click', () => openProfileModal());

function openProfileModal() {
    const user = allUsersList.find(u => u.id === currentEmail) || {};
    editFirstname.value = user.firstName || '';
    editLastname.value = user.lastName || '';
    editUsername.value = user.username || '';
    editStatus.value = user.status || '';
    modalAvatar.src = user.avatar || 'default-avatar.png';
    profileModal.style.display = 'flex';
}

closeModal.onclick = () => profileModal.style.display = 'none';

avatarUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            modalAvatar.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
});

saveProfileBtn.addEventListener('click', () => {
    const newUsername = editUsername.value.trim();
    const currentUser = allUsersList.find(u => u.id === currentEmail);
    if (newUsername !== currentUser?.username) {
        socket.emit('check username', newUsername, (response) => {
            if (!response.available) {
                alert('Этот юзернейм уже занят');
                return;
            }
            proceedSaveProfile();
        });
    } else {
        proceedSaveProfile();
    }
});

function proceedSaveProfile() {
    const profile = {
        email: currentEmail,
        firstName: editFirstname.value,
        lastName: editLastname.value,
        username: editUsername.value,
        status: editStatus.value,
        avatar: modalAvatar.src
    };
    socket.emit('update profile', profile);
    profileModal.style.display = 'none';
}

socket.on('profile updated', (profile) => {
    myNameSpan.innerText = profile.firstName + ' ' + profile.lastName || profile.username;
    myStatusSpan.innerText = profile.status || '';
    myAvatar.src = profile.avatar || 'default-avatar.png';
});

socket.on('profile update error', (msg) => {
    alert(msg);
});

// ===== ПОЛЬЗОВАТЕЛИ И ПОИСК =====
socket.on('user list', (users) => {
    allUsersList = users;
    filterAndRenderContacts();
});

function filterAndRenderContacts() {
    const query = searchInput.value.trim().toLowerCase();
    const filtered = allUsersList.filter(u => 
        u.id !== BOT_ID && (
            (u.username && u.username.toLowerCase().includes(query)) ||
            (u.firstName && u.firstName.toLowerCase().includes(query)) ||
            (u.lastName && u.lastName.toLowerCase().includes(query)) ||
            (u.id && u.id.toLowerCase().includes(query))
        )
    );
    renderUserList(filtered);
}

searchInput.addEventListener('input', filterAndRenderContacts);

function renderUserList(users) {
    usersList.innerHTML = users.map(u => {
        const badge = u.badge ? '<span class="verified-badge">✓</span>' : '';
        const statusText = u.online ? '🟢 онлайн' : (u.lastSeen ? `⏰ ${formatLastSeen(u.lastSeen)}` : '');
        return `<li onclick="openUserChat('${u.id}')">
            <img class="avatar-small" src="${u.avatar || 'default-avatar.png'}">
            <div class="user-info">
                <span class="user-name">${u.firstName ? u.firstName + ' ' + u.lastName : u.username} ${badge}</span>
                <span class="user-status">${statusText}</span>
            </div>
            ${u.online ? '<span class="online-indicator"></span>' : ''}
        </li>`;
    }).join('');
    // Добавляем бота в конец или отдельно? Пока не включаем в общий список.
}

function formatLastSeen(timestamp) {
    if (!timestamp) return 'никогда';
    const now = Date.now();
    const diffSeconds = Math.floor((now - timestamp) / 1000);
    if (diffSeconds < 60) return 'только что';
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes} мин. назад`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} ч. назад`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} дн. назад`;
}

// ===== ОТКРЫТИЕ ЧАТА =====
window.openUserChat = function(userId) {
    currentChat = { type: 'user', id: userId };
    const user = allUsersList.find(u => u.id === userId);
    const badge = user?.badge ? ' ✓' : '';
    chatTitle.innerText = (user ? (user.firstName + ' ' + user.lastName || user.username) : 'Пользователь') + badge;
    chatStatus.innerText = user?.online ? 'онлайн' : (user?.lastSeen ? `был(а) ${formatLastSeen(user.lastSeen)}` : '');
    chatAvatar.src = user ? (user.avatar || 'default-avatar.png') : 'default-avatar.png';
    clearMessages();
    document.getElementById('input-area').style.display = 'flex';
    // Запросить закреплённое
    const chatId = getChatId(currentEmail, userId);
    socket.emit('get pinned', { chatId });
};

function getChatId(email1, email2) {
    return [email1, email2].sort().join(':');
}

// ===== СООБЩЕНИЯ =====
sendBtn.addEventListener('click', () => sendMessage('text', messageInput.value));
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage('text', messageInput.value);
});

function sendMessage(type, data) {
    if (!currentChat) return;
    const msgId = Date.now() + '-' + Math.random().toString(36).substr(2, 5);
    const msg = {
        id: msgId,
        to: currentChat.id,
        type: type,
        data: data,
        timestamp: Date.now()
    };
    if (currentChat.type === 'saved') {
        socket.emit('save message', { text: data });
        // пока не ждём ответа, добавим локально?
        messageInput.value = '';
        return;
    }
    socket.emit('private message', msg);
    // Показать своё сообщение сразу (оптимистично)
    appendMessage(msg, true);
    if (type === 'text') messageInput.value = '';
}

socket.on('private message', (msg) => {
    if (currentChat && currentChat.type === 'user' && currentChat.id === msg.from) {
        appendMessage(msg, false);
    } else {
        // Можно уведомить
    }
});

function appendMessage(msg, isOwn) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message' + (isOwn ? ' own' : '');
    msgDiv.dataset.msgid = msg.id;

    const avatar = document.createElement('img');
    avatar.className = 'avatar';
    avatar.src = isOwn ? (myAvatar.src || 'default-avatar.png') : (getAvatarById(msg.from) || 'default-avatar.png');
    msgDiv.appendChild(avatar);

    const bubble = document.createElement('div');
    bubble.className = 'bubble';

    if (!isOwn && msg.fromUsername) {
        const senderName = document.createElement('div');
        senderName.className = 'sender-name';
        const senderUser = allUsersList.find(u => u.id === msg.from);
        senderName.innerText = msg.fromUsername + (senderUser?.badge ? ' ✓' : '');
        bubble.appendChild(senderName);
    }

    const content = document.createElement('div');
    content.className = 'message-text';
    if (msg.type === 'text') {
        content.innerText = msg.data;
    } else if (msg.type === 'audio') {
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.src = msg.data;
        content.appendChild(audio);
    } else if (msg.type === 'video') {
        const video = document.createElement('video');
        video.controls = true;
        video.src = msg.data;
        video.style.maxWidth = '250px';
        content.appendChild(video);
    }
    bubble.appendChild(content);

    if (msg.edited) {
        const editedSpan = document.createElement('span');
        editedSpan.className = 'edited-mark';
        editedSpan.innerText = ' (изменено)';
        bubble.appendChild(editedSpan);
    }

    const time = document.createElement('div');
    time.className = 'time';
    time.innerText = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    bubble.appendChild(time);

    // Реакции
    const reactionsDiv = document.createElement('div');
    reactionsDiv.className = 'reactions';
    bubble.appendChild(reactionsDiv);

    if (!isOwn && currentChat && currentChat.type === 'user') {
        const reactionRow = document.createElement('div');
        reactionRow.className = 'reaction-buttons';
        ['❤️', '👍', '👎', '😄'].forEach(emoji => {
            const btn = document.createElement('span');
            btn.innerText = emoji;
            btn.onclick = () => {
                socket.emit('add reaction', { msgId: msg.id, emoji, to: currentChat.id });
            };
            reactionRow.appendChild(btn);
        });
        bubble.appendChild(reactionRow);
    }

    // Кнопка редактирования для своих сообщений
    if (isOwn && msg.type === 'text' && currentChat && currentChat.type === 'user') {
        const editBtn = document.createElement('span');
        editBtn.innerText = '✎';
        editBtn.className = 'edit-btn';
        editBtn.onclick = () => {
            const newText = prompt('Редактировать сообщение:', msg.data);
            if (newText && newText !== msg.data) {
                socket.emit('edit message', { msgId: msg.id, newText, to: currentChat.id });
            }
        };
        bubble.appendChild(editBtn);
    }

    msgDiv.appendChild(bubble);
    messagesDiv.appendChild(msgDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function getAvatarById(userId) {
    const user = allUsersList.find(u => u.id === userId);
    return user?.avatar;
}

// Редактирование
socket.on('message edited ack', ({ msgId, newText }) => {
    updateMessageText(msgId, newText);
});
socket.on('message edited', ({ msgId, newText }) => {
    updateMessageText(msgId, newText);
});

function updateMessageText(msgId, newText) {
    const msgDiv = document.querySelector(`.message[data-msgid="${msgId}"]`);
    if (msgDiv) {
        const textDiv = msgDiv.querySelector('.message-text');
        if (textDiv) textDiv.innerText = newText;
        let editedSpan = msgDiv.querySelector('.edited-mark');
        if (!editedSpan) {
            editedSpan = document.createElement('span');
            editedSpan.className = 'edited-mark';
            editedSpan.innerText = ' (изменено)';
            msgDiv.querySelector('.bubble').insertBefore(editedSpan, msgDiv.querySelector('.time'));
        }
    }
}

// Реакции
socket.on('reaction update', ({ chatId, msgId, emoji, users }) => {
    const msgDiv = document.querySelector(`.message[data-msgid="${msgId}"]`);
    if (msgDiv) {
        let reactionsDiv = msgDiv.querySelector('.reactions');
        if (!reactionsDiv) {
            reactionsDiv = document.createElement('div');
            reactionsDiv.className = 'reactions';
            msgDiv.querySelector('.bubble').appendChild(reactionsDiv);
        }
        let emojiSpan = reactionsDiv.querySelector(`[data-emoji="${emoji}"]`);
        if (!emojiSpan) {
            emojiSpan = document.createElement('span');
            emojiSpan.dataset.emoji = emoji;
            reactionsDiv.appendChild(emojiSpan);
        }
        emojiSpan.innerText = `${emoji} ${users.length}`;
    }
});

// ===== ГОЛОСОВЫЕ =====
voiceBtn.addEventListener('click', async () => {
    if (!navigator.mediaDevices) {
        alert('Ваш браузер не поддерживает запись аудио');
        return;
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        mediaRecorder.ondataavailable = event => audioChunks.push(event.data);
        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = () => {
                sendMessage('audio', reader.result);
            };
            stream.getTracks().forEach(track => track.stop());
        };
        mediaRecorder.start();
        voiceBtn.style.display = 'none';
        voicePanel.style.display = 'flex';
    } catch (err) {
        alert('Не удалось получить доступ к микрофону');
    }
});

stopRecordingBtn.addEventListener('click', () => {
    mediaRecorder.stop();
    voiceBtn.style.display = 'inline-block';
    voicePanel.style.display = 'none';
});

// ===== ВИДЕО =====
attachBtn.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    input.onchange = () => {
        const file = input.files[0];
        if (file.size > 10 * 1024 * 1024) {
            alert('Файл слишком большой (макс. 10 МБ)');
            return;
        }
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            sendMessage('video', reader.result);
        };
    };
    input.click();
});

// ===== ИЗБРАННОЕ =====
savedMessagesBtn.addEventListener('click', () => {
    currentChat = { type: 'saved', id: 'saved' };
    chatTitle.innerText = 'Избранное';
    chatStatus.innerText = '';
    chatAvatar.src = '💾';
    clearMessages();
    document.getElementById('input-area').style.display = 'flex';
    loadSavedMessages();
});

function loadSavedMessages() {
    socket.emit('get saved messages');
}

socket.on('saved messages', (msgs) => {
    msgs.forEach(msg => {
        appendMessage({ from: 'saved', data: msg.text, timestamp: msg.timestamp }, true);
    });
});

socket.on('message saved', (msg) => {
    if (currentChat && currentChat.type === 'saved') {
        appendMessage({ from: 'saved', data: msg.text, timestamp: msg.timestamp }, true);
    }
});

// ===== КАНАЛЫ =====
tabChannels.addEventListener('click', () => {
    setActiveTab('channels');
    loadChannels();
});

createChannelBtn.addEventListener('click', () => {
    const name = newChannelName.value.trim();
    const desc = newChannelDesc.value.trim();
    if (name) {
        socket.emit('create channel', { name, description: desc });
        newChannelName.value = '';
        newChannelDesc.value = '';
    }
});

function loadChannels() {
    socket.emit('get channels');
}

socket.on('channels list', (channels) => {
    channelsUl.innerHTML = channels.map(ch => `
        <li onclick="openChannel('${ch.name}')">
            <strong>${ch.name}</strong><br>
            <small>${ch.description}</small><br>
            <small>📝 ${ch.postCount} постов | 👥 ${ch.subscribers} подписчиков</small>
        </li>
    `).join('');
});

socket.on('channel created', (name) => {
    alert(`Канал ${name} создан`);
    loadChannels();
});

window.openChannel = function(channelName) {
    currentChat = { type: 'channel', id: channelName };
    chatTitle.innerText = `Канал: ${channelName}`;
    chatStatus.innerText = '';
    chatAvatar.src = '📢';
    clearMessages();
    document.getElementById('input-area').style.display = 'none';
    socket.emit('get channel posts', { channelName });
};

socket.on('channel posts', ({ channel, posts }) => {
    posts.forEach(post => {
        appendChannelPost(post);
    });
});

socket.on('new post', ({ channel, post }) => {
    if (currentChat && currentChat.type === 'channel' && currentChat.id === channel) {
        appendChannelPost(post);
    }
});

function appendChannelPost(post) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message';
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.innerHTML = `
        <div class="sender-name">📢 Канал</div>
        <div>${post.content}</div>
        <div class="time">${new Date(post.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
    `;
    msgDiv.appendChild(bubble);
    messagesDiv.appendChild(msgDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// ===== ГРУППЫ (заглушка, можно добавить позже) =====
tabGroups.addEventListener('click', () => {
    setActiveTab('groups');
});

createGroupBtn.addEventListener('click', () => {
    // Реализация групп опущена для краткости, но может быть добавлена аналогично каналам
    alert('Группы пока в разработке');
});

// ===== АДМИН ПАНЕЛЬ =====
socket.on('admin status', (isAdmin) => {
    if (isAdmin) {
        tabAdmin.style.display = 'inline-block';
    }
});

tabAdmin.addEventListener('click', () => {
    setActiveTab('admin');
    requestAdminData();
});

function requestAdminData() {
    socket.emit('get admin users');
}

socket.on('admin users data', (users) => {
    renderAdminUsers(users);
});

function renderAdminUsers(users) {
    const online = users.filter(u => u.online);
    const offline = users.filter(u => !u.online);
    onlineList.innerHTML = online.map(u => formatAdminUser(u, true)).join('');
    offlineList.innerHTML = offline.map(u => formatAdminUser(u, false)).join('');

    document.querySelectorAll('.grant-badge').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const email = e.target.dataset.email;
            socket.emit('toggle badge', { email, action: 'grant' });
        });
    });
    document.querySelectorAll('.revoke-badge').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const email = e.target.dataset.email;
            socket.emit('toggle badge', { email, action: 'revoke' });
        });
    });
}

function formatAdminUser(user, isOnline) {
    const date = user.registeredAt ? new Date(user.registeredAt).toLocaleString() : 'неизвестно';
    const name = user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : (user.username || user.email);
    const badge = user.badge ? '✓ (есть)' : 'нет';
    const button = user.badge 
        ? `<button class="revoke-badge" data-email="${user.email}">Снять галочку</button>`
        : `<button class="grant-badge" data-email="${user.email}">Выдать галочку</button>`;
    return `
        <li>
            <img class="avatar-small" src="${user.avatar || 'default-avatar.png'}">
            <div class="user-info">
                <div class="user-name">${name}</div>
                <div class="user-email">${user.email}</div>
                <div class="reg-date">📅 ${date}</div>
                <div>Галочка: ${badge}</div>
                ${button}
            </div>
        </li>
    `;
}

sendBroadcastBtn.addEventListener('click', () => {
    const msg = broadcastMessage.value.trim();
    if (!msg) return;
    socket.emit('broadcast from admin', { message: msg });
    broadcastStatus.innerText = '⏳ Отправка...';
});

socket.on('broadcast result', ({ success, count, message }) => {
    if (success) {
        broadcastStatus.innerHTML = `✅ Сообщение отправлено <strong>${count}</strong> пользователям`;
        broadcastMessage.value = '';
    } else {
        broadcastStatus.innerText = `❌ Ошибка: ${message}`;
    }
});

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
function clearMessages() {
    messagesDiv.innerHTML = '';
}

function setActiveTab(tab) {
    [tabContacts, tabGroups, tabChannels, tabAdmin].forEach(btn => btn.classList.remove('active'));
    document.getElementById('users-list').style.display = 'none';
    document.getElementById('groups-list').style.display = 'none';
    document.getElementById('channels-list').style.display = 'none';
    adminPanel.style.display = 'none';

    if (tab === 'contacts') {
        tabContacts.classList.add('active');
        document.getElementById('users-list').style.display = 'block';
    } else if (tab === 'groups') {
        tabGroups.classList.add('active');
        document.getElementById('groups-list').style.display = 'block';
    } else if (tab === 'channels') {
        tabChannels.classList.add('active');
        document.getElementById('channels-list').style.display = 'block';
    } else if (tab === 'admin') {
        tabAdmin.classList.add('active');
        adminPanel.style.display = 'block';
    }
}

// Инициализация: скрываем админку и т.д.