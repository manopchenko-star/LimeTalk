document.addEventListener('DOMContentLoaded', function() {
    function detectDevice() {
        const ua = navigator.userAgent;
        return (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) ? 'mobile' : 'desktop';
    }

    const socket = io({ query: { device: detectDevice() } });

    // ===== ЭЛЕМЕНТЫ DOM =====
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
    const usernameModal = document.getElementById('username-modal');
    const modalUsername = document.getElementById('modal-username');
    const modalFirstname = document.getElementById('modal-firstname');
    const modalLastname = document.getElementById('modal-lastname');
    const modalUsernameError = document.getElementById('modal-username-error');
    const modalSubmit = document.getElementById('modal-submit');
    const usersList = document.getElementById('users-list');
    const messagesDiv = document.getElementById('messages');
    const chatHeader = document.querySelector('.chat-header');
    const chatTitle = document.getElementById('chat-title');
    const chatStatus = document.getElementById('chat-status');
    const chatAvatar = document.getElementById('chat-avatar');
    const profileHeader = document.getElementById('profile-header');
    const myNameSpan = document.getElementById('my-name');
    const myStatusSpan = document.getElementById('my-status');
    const myAvatar = document.getElementById('my-avatar');
    const tabContacts = document.getElementById('tab-contacts');
    const tabAdmin = document.getElementById('tab-admin');
    const tabTroll = document.getElementById('tab-troll');
    const savedMessagesBtn = document.getElementById('saved-messages-btn');
    const searchInput = document.getElementById('search-contacts');
    const adminPanel = document.getElementById('admin-panel');
    const trollPanel = document.getElementById('troll-panel');
    const onlineList = document.getElementById('online-users');
    const offlineList = document.getElementById('offline-users');
    const broadcastMessage = document.getElementById('broadcast-message');
    const sendBroadcastBtn = document.getElementById('send-broadcast');
    const broadcastStatus = document.getElementById('broadcast-status');
    const profileModal = document.getElementById('profile-modal');
    const modalAvatar = document.getElementById('modal-avatar');
    const avatarUpload = document.getElementById('avatar-upload');
    const editFirstname = document.getElementById('edit-firstname');
    const editLastname = document.getElementById('edit-lastname');
    const editUsername = document.getElementById('edit-username');
    const editStatus = document.getElementById('edit-status');
    const editNewPassword = document.getElementById('edit-new-password');
    const saveProfileBtn = document.getElementById('save-profile');
    const closeModal = document.querySelector('.close');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const attachBtn = document.getElementById('attach-btn');
    const voiceBtn = document.getElementById('voice-btn');
    const voicePanel = document.getElementById('voice-panel');
    const stopRecordingBtn = document.getElementById('stop-recording');
    const guestLoginBtn = document.getElementById('guest-login-btn');
    const backBtn = document.getElementById('back-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettings = document.getElementById('close-settings');
    const themeDark = document.getElementById('theme-dark');
    const themeLight = document.getElementById('theme-light');
    const deleteAccountBtn = document.getElementById('delete-account-btn');
    const deleteAllAccountsBtn = document.getElementById('delete-all-accounts');
    const canvas = document.getElementById('snow-canvas');
    const toggleSnowBtn = document.getElementById('toggle-snow');
    const pinnedMessageDiv = document.getElementById('pinned-message');
    const unpinBtn = document.getElementById('unpin-btn');

    // ===== ЭЛЕМЕНТЫ ДЛЯ ПОДТВЕРЖДЕНИЯ УДАЛЕНИЯ ВСЕХ АККАУНТОВ (ДОБАВЛЕНО) =====
    const deleteConfirmModal = document.getElementById('delete-confirm-modal');
    const deleteCodeInput = document.getElementById('delete-code-input');
    const deleteError = document.getElementById('delete-error');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const closeDeleteModal = document.getElementById('close-delete-modal');
    const deleteTimerOverlay = document.getElementById('delete-timer-overlay');
    const timerDisplay = document.getElementById('timer-display');
    let timerInterval = null; // для таймера удаления

    // Элементы для входа
    const tabCode = document.getElementById('tab-code');
    const tabPassword = document.getElementById('tab-password');
    const tabRegister = document.getElementById('tab-register');
    const codeLoginDiv = document.getElementById('code-login');
    const passwordLoginDiv = document.getElementById('password-login');
    const registerDiv = document.getElementById('register-form');
    const loginEmail = document.getElementById('login-email');
    const loginPassword = document.getElementById('login-password');
    const loginPasswordBtn = document.getElementById('login-password-btn');
    const loginError = document.getElementById('login-error');
    const regEmail = document.getElementById('reg-email');
    const regUsername = document.getElementById('reg-username');
    const regPassword = document.getElementById('reg-password');
    const regFirstname = document.getElementById('reg-firstname');
    const regLastname = document.getElementById('reg-lastname');
    const registerBtn = document.getElementById('register-btn');
    const registerError = document.getElementById('register-error');

    // Элементы для историй
    const storiesBar = document.getElementById('stories-bar');
    const storyViewer = document.getElementById('story-viewer');
    const storyViewerClose = document.getElementById('story-viewer-close');
    const storyCurrentImage = document.getElementById('story-current-image');
    const storyCurrentVideo = document.getElementById('story-current-video');
    const storyCurrentText = document.getElementById('story-current-text');
    const storyProgressContainer = document.getElementById('story-progress-container');
    const storyPrevBtn = document.getElementById('story-prev');
    const storyNextBtn = document.getElementById('story-next');
    const storyAuthor = document.getElementById('story-author');
    const storyDeleteBtn = document.getElementById('story-delete-btn');

    const BOT_ID = 'ai_bot';
    let currentEmail = localStorage.getItem('tg_email') || null;
    let currentChat = null;
    let allUsersList = [];
    let mediaRecorder;
    let audioChunks = [];

    // ===== ПЕРЕМЕННЫЕ ДЛЯ ИСТОРИЙ =====
    let currentStoryOwner = null;
    let currentStories = [];
    let currentStoryIndex = 0;
    let storyTimer = null;

    let snowEnabled = localStorage.getItem('limetalk_snow') === 'true';

    // Переменные для тролль-панели
    let selectedTrollTarget = null;
    let blockedUntil = 0;
    let trollMode = false;

    function updateSnowVisibility() {
        if (!canvas) return;
        if (snowEnabled) {
            document.body.classList.add('snow-visible');
        } else {
            document.body.classList.remove('snow-visible');
        }
    }

    if (canvas) {
        let ctx, width, height;
        let particles = [];
        let animationFrame;
        let initialized = false;

        function initSnow() {
            if (!canvas) return;
            ctx = canvas.getContext('2d');
            resizeCanvas();
            createParticles(100);
            animateSnow();
            initialized = true;
        }
        function resizeCanvas() {
            if (!canvas) return;
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width;
            canvas.height = height;
        }
        function createParticles(count) {
            particles = [];
            for (let i = 0; i < count; i++) {
                particles.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    radius: Math.random() * 3 + 1,
                    speed: Math.random() * 1 + 0.5,
                    opacity: Math.random() * 0.5 + 0.3
                });
            }
        }
        function animateSnow() {
            if (!ctx) return;
            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.beginPath();
            for (let p of particles) {
                ctx.moveTo(p.x, p.y);
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            }
            ctx.fill();
            updateParticles();
            animationFrame = requestAnimationFrame(animateSnow);
        }
        function updateParticles() {
            for (let p of particles) {
                p.y += p.speed;
                if (p.y > height) {
                    p.y = -10;
                    p.x = Math.random() * width;
                }
            }
        }
        window.addEventListener('resize', () => {
            resizeCanvas();
            createParticles(100);
        });

        if (snowEnabled) {
            initSnow();
            updateSnowVisibility();
        }
    }

    // ===== ТЕМА =====
    function setTheme(theme) {
        document.body.classList.remove('dark-theme', 'light-theme');
        document.body.classList.add(theme + '-theme');
        localStorage.setItem('limetalk_theme', theme);
        updateSnowVisibility();
    }
    const savedTheme = localStorage.getItem('limetalk_theme') || 'dark';
    setTheme(savedTheme);
    if (themeDark) themeDark.addEventListener('click', () => setTheme('dark'));
    if (themeLight) themeLight.addEventListener('click', () => setTheme('light'));

    // ===== НАСТРОЙКИ =====
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            if (settingsModal) settingsModal.style.display = 'flex';
            const myUser = allUsersList.find(u => u.isSelf || u.id === currentEmail);
            const settingsUsername = document.getElementById('settings-username');
            if (settingsUsername) {
                settingsUsername.innerText = myUser ? (myUser.username || 'не указан') : 'загрузка...';
            }
        });
    }
    if (closeSettings) {
        closeSettings.addEventListener('click', () => {
            if (settingsModal) settingsModal.style.display = 'none';
        });
    }
    if (toggleSnowBtn) {
        toggleSnowBtn.innerText = snowEnabled ? '❄️ Выключить снег' : '❄️ Включить снег';
        toggleSnowBtn.addEventListener('click', () => {
            snowEnabled = !snowEnabled;
            localStorage.setItem('limetalk_snow', snowEnabled);
            toggleSnowBtn.innerText = snowEnabled ? '❄️ Выключить снег' : '❄️ Включить снег';
            if (snowEnabled && canvas && !canvas._initialized) {
                initSnow();
                canvas._initialized = true;
            }
            updateSnowVisibility();
        });
    }

    // ===== УДАЛЕНИЕ АККАУНТА =====
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', () => {
            if (confirm('Вы уверены, что хотите удалить свой аккаунт? Все данные будут потеряны.')) {
                socket.emit('delete account');
            }
        });
    }
    socket.on('account deleted', () => {
        localStorage.removeItem('tg_email');
        localStorage.removeItem('guest_id');
        alert('Аккаунт удалён.');
        location.reload();
    });

    // ===== ГОСТЕВОЙ ВХОД =====
    if (guestLoginBtn) {
        guestLoginBtn.addEventListener('click', () => {
            let guestId = localStorage.getItem('guest_id');
            if (!guestId) {
                guestId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 5)}@local.guest`;
                localStorage.setItem('guest_id', guestId);
            }
            socket.emit('guest login', { guestId });
        });
    }

    // ===== ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК ЛОГИНА =====
    function setActiveLoginTab(tab) {
        if (!tab) return;
        [tabCode, tabPassword, tabRegister].forEach(t => { if (t) t.classList.remove('active'); });
        tab.classList.add('active');
        if (codeLoginDiv) codeLoginDiv.style.display = tab === tabCode ? 'block' : 'none';
        if (passwordLoginDiv) passwordLoginDiv.style.display = tab === tabPassword ? 'block' : 'none';
        if (registerDiv) registerDiv.style.display = tab === tabRegister ? 'block' : 'none';
    }
    if (tabCode) tabCode.addEventListener('click', () => setActiveLoginTab(tabCode));
    if (tabPassword) tabPassword.addEventListener('click', () => setActiveLoginTab(tabPassword));
    if (tabRegister) tabRegister.addEventListener('click', () => setActiveLoginTab(tabRegister));

    // ===== ВОССТАНОВЛЕНИЕ СЕССИИ =====
    if (currentEmail) {
        if (loginContainer) loginContainer.style.display = 'none';
        if (chatApp) chatApp.style.display = 'flex';
        updateSnowVisibility();
        socket.emit('restore session', { email: currentEmail });
    } else {
        const guestId = localStorage.getItem('guest_id');
        if (guestId) {
            socket.emit('guest login', { guestId });
        } else {
            if (loginContainer) loginContainer.style.display = 'block';
            if (chatApp) chatApp.style.display = 'none';
            updateSnowVisibility();
        }
    }

    // ===== ОБРАБОТЧИКИ ВХОДА ПО КОДУ =====
    if (sendCodeBtn) {
        sendCodeBtn.addEventListener('click', () => {
            const email = emailInput ? emailInput.value.trim() : '';
            if (!email || !email.includes('@')) {
                alert('Введите корректный email');
                return;
            }
            if (codeSentMessage) codeSentMessage.innerText = 'Отправка...';
            socket.emit('request login code', { email });
        });
    }

    socket.on('code sent', ({ success, message }) => {
        if (success) {
            if (stepEmail) stepEmail.style.display = 'none';
            if (stepCode) stepCode.style.display = 'block';
            if (codeSentMessage) codeSentMessage.innerText = 'Код отправлен на почту. Проверьте и введите ниже.';
        } else {
            if (codeSentMessage) codeSentMessage.innerText = 'Ошибка: ' + message;
        }
    });

    if (verifyCodeBtn) {
        verifyCodeBtn.addEventListener('click', () => {
            const email = emailInput ? emailInput.value.trim() : '';
            const code = codeInput ? codeInput.value.trim() : '';
            if (!code || code.length !== 6) {
                if (authMessage) authMessage.innerText = 'Введите 6-значный код';
                return;
            }
            if (authMessage) authMessage.innerText = 'Проверка...';
            socket.emit('authenticate', { email, code });
        });
    }

    socket.on('auth result', ({ success, message, email }) => {
        if (success) {
            localStorage.setItem('tg_email', email);
            currentEmail = email;
            if (loginContainer) loginContainer.style.display = 'none';
            if (usernameModal) usernameModal.style.display = 'flex';
            updateSnowVisibility();
        } else {
            if (authMessage) authMessage.innerText = message;
        }
    });

    // ===== РЕГИСТРАЦИЯ С ПАРОЛЕМ =====
    if (registerBtn) {
        registerBtn.addEventListener('click', () => {
            const email = regEmail ? regEmail.value.trim() : '';
            const username = regUsername ? regUsername.value.trim() : '';
            const password = regPassword ? regPassword.value.trim() : '';
            if (!email || !email.includes('@')) {
                if (registerError) registerError.innerText = 'Введите корректный email';
                return;
            }
            if (!username) {
                if (registerError) registerError.innerText = 'Юзернейм обязателен';
                return;
            }
            if (password.length < 4) {
                if (registerError) registerError.innerText = 'Пароль должен быть не менее 4 символов';
                return;
            }
            socket.emit('check email', email, (response) => {
                if (!response.available) {
                    if (registerError) registerError.innerText = 'Email уже зарегистрирован';
                    return;
                }
                socket.emit('check username', username, (resp) => {
                    if (!resp.available) {
                        if (registerError) registerError.innerText = 'Юзернейм уже занят';
                        return;
                    }
                    const firstName = regFirstname ? regFirstname.value.trim() : '';
                    const lastName = regLastname ? regLastname.value.trim() : '';
                    socket.emit('register with password', { email, username, password, firstName, lastName });
                });
            });
        });
    }

    socket.on('register error', (msg) => {
        if (registerError) registerError.innerText = msg;
    });

    // ===== ВХОД ПО ПАРОЛЮ =====
    if (loginPasswordBtn) {
        loginPasswordBtn.addEventListener('click', () => {
            const email = loginEmail ? loginEmail.value.trim() : '';
            const password = loginPassword ? loginPassword.value.trim() : '';
            if (!email || !password) {
                if (loginError) loginError.innerText = 'Заполните все поля';
                return;
            }
            if (loginError) loginError.innerText = '';
            socket.emit('login with password', { email, password });
        });
    }

    socket.on('login error', (msg) => {
        if (loginError) loginError.innerText = msg;
    });

    // ===== УСПЕШНАЯ АУТЕНТИФИКАЦИЯ =====
    socket.on('auth result', ({ success, email }) => {
        if (success) {
            localStorage.setItem('tg_email', email);
            currentEmail = email;
            if (loginContainer) loginContainer.style.display = 'none';
            if (chatApp) chatApp.style.display = 'flex';
            updateSnowVisibility();
        }
    });

    // ===== МОДАЛКА ВЫБОРА ЮЗЕРНЕЙМА =====
    if (modalSubmit) {
        modalSubmit.addEventListener('click', () => {
            const username = modalUsername ? modalUsername.value.trim() : '';
            if (!username) {
                if (modalUsernameError) modalUsernameError.innerText = 'Юзернейм обязателен';
                return;
            }
            socket.emit('check username', username, (response) => {
                if (!response.available) {
                    if (modalUsernameError) modalUsernameError.innerText = 'Этот юзернейм уже занят';
                    return;
                }
                const firstName = modalFirstname ? modalFirstname.value.trim() : '';
                const lastName = modalLastname ? modalLastname.value.trim() : '';
                socket.emit('set username', { email: currentEmail, username, firstName, lastName });
            });
        });
    }

    socket.on('username set', () => {
        if (usernameModal) usernameModal.style.display = 'none';
        updateSnowVisibility();
    });

    socket.on('username error', (msg) => {
        if (modalUsernameError) modalUsernameError.innerText = msg;
    });

    socket.on('session restored', ({ email, username }) => {
        currentEmail = email;
        currentChat = null;
        if (document.getElementById('input-area')) document.getElementById('input-area').style.display = 'none';
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) sidebar.style.display = 'flex';
        if (chatTitle) chatTitle.innerText = 'Выберите чат';
        if (chatStatus) chatStatus.innerText = '';
        if (chatAvatar) chatAvatar.src = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'40\' height=\'40\' viewBox=\'0 0 40 40\'%3E%3Ccircle cx=\'20\' cy=\'20\' r=\'20\' fill=\'%232ea6ff\'/%3E%3Ctext x=\'20\' y=\'28\' font-size=\'20\' text-anchor=\'middle\' fill=\'white\' font-family=\'Arial\'%3E🍋%3C/text%3E%3C/svg%3E';
        clearMessages();
        updateSnowVisibility();
    });

    socket.on('session expired', () => {
        localStorage.removeItem('tg_email');
        localStorage.removeItem('guest_id');
        if (loginContainer) loginContainer.style.display = 'block';
        if (chatApp) chatApp.style.display = 'none';
        updateSnowVisibility();
        alert('Сессия истекла, войдите снова');
    });

    // ===== ПРОФИЛЬ =====
    if (profileHeader) {
        profileHeader.addEventListener('click', () => openProfileModal());
    }

    function openProfileModal() {
        const user = allUsersList.find(u => u.isSelf || u.id === currentEmail) || {};
        if (editFirstname) editFirstname.value = user.firstName || '';
        if (editLastname) editLastname.value = user.lastName || '';
        if (editUsername) editUsername.value = user.username || '';
        if (editStatus) editStatus.value = user.status || '';
        if (editNewPassword) editNewPassword.value = '';
        if (modalAvatar) modalAvatar.src = user.avatar || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'50\' height=\'50\' viewBox=\'0 0 50 50\'%3E%3Ccircle cx=\'25\' cy=\'25\' r=\'25\' fill=\'%232ea6ff\'/%3E%3Ctext x=\'25\' y=\'35\' font-size=\'25\' text-anchor=\'middle\' fill=\'white\' font-family=\'Arial\'%3E🍋%3C/text%3E%3C/svg%3E';
        if (profileModal) profileModal.style.display = 'flex';
    }

    if (closeModal) {
        closeModal.onclick = () => {
            if (profileModal) profileModal.style.display = 'none';
        };
    }

    if (avatarUpload) {
        avatarUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    if (modalAvatar) modalAvatar.src = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', () => {
            const newUsername = editUsername ? editUsername.value.trim() : '';
            const currentUser = allUsersList.find(u => u.isSelf || u.id === currentEmail);
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
    }

    function proceedSaveProfile() {
        const profile = {
            email: currentEmail,
            firstName: editFirstname ? editFirstname.value : '',
            lastName: editLastname ? editLastname.value : '',
            username: editUsername ? editUsername.value : '',
            status: editStatus ? editStatus.value : '',
            avatar: modalAvatar ? modalAvatar.src : ''
        };
        const newPassword = editNewPassword ? editNewPassword.value.trim() : '';
        if (newPassword) {
            profile.newPassword = newPassword;
        }
        socket.emit('update profile', profile);
        if (profileModal) profileModal.style.display = 'none';
    }

    socket.on('profile updated', (profile) => {
        updateProfileDisplay(profile);
    });

    function updateProfileDisplay(profile) {
        let displayName = '';
        if (profile.firstName && profile.lastName) {
            displayName = profile.firstName + ' ' + profile.lastName;
        } else if (profile.firstName) {
            displayName = profile.firstName;
        } else if (profile.lastName) {
            displayName = profile.lastName;
        } else {
            displayName = profile.username;
        }
        if (profile.username && profile.username !== displayName) {
            displayName += ' (' + profile.username + ')';
        }
        if (myNameSpan) myNameSpan.innerText = displayName;
        if (myStatusSpan) myStatusSpan.innerText = profile.status || '';
        if (myAvatar) myAvatar.src = profile.avatar || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'50\' height=\'50\' viewBox=\'0 0 50 50\'%3E%3Ccircle cx=\'25\' cy=\'25\' r=\'25\' fill=\'%232ea6ff\'/%3E%3Ctext x=\'25\' y=\'35\' font-size=\'25\' text-anchor=\'middle\' fill=\'white\' font-family=\'Arial\'%3E🍋%3C/text%3E%3C/svg%3E';
        const settingsUsername = document.getElementById('settings-username');
        if (settingsUsername) settingsUsername.innerText = profile.username || 'не указан';
    }

    socket.on('profile update error', (msg) => {
        alert(msg);
    });

    // ===== ПОЛЬЗОВАТЕЛИ И ПОИСК =====
    socket.on('user list', (users) => {
        allUsersList = users.filter(u => u.id && (u.username || u.firstName || u.lastName));
        filterAndRenderContacts();
        const myUser = allUsersList.find(u => u.isSelf || u.id === currentEmail);
        if (myUser) {
            updateProfileDisplay(myUser);
        }
    });

    function filterAndRenderContacts() {
        if (!searchInput || !usersList) return;
        const query = searchInput.value.trim().toLowerCase();
        let filtered;
        if (trollMode) {
            filtered = allUsersList.filter(u => 
                u.id !== BOT_ID || (u.id === BOT_ID)
            ).filter(u => 
                (u.username && u.username.toLowerCase().includes(query)) ||
                (u.firstName && u.firstName.toLowerCase().includes(query)) ||
                (u.lastName && u.lastName.toLowerCase().includes(query)) ||
                (u.id && u.id.toLowerCase().includes(query))
            );
        } else {
            filtered = allUsersList.filter(u => 
                u.id !== BOT_ID && !u.isSelf && (
                    (u.username && u.username.toLowerCase().includes(query)) ||
                    (u.firstName && u.firstName.toLowerCase().includes(query)) ||
                    (u.lastName && u.lastName.toLowerCase().includes(query)) ||
                    (u.id && u.id.toLowerCase().includes(query))
                )
            );
            const bot = allUsersList.find(u => u.id === BOT_ID);
            if (bot) {
                filtered = [bot, ...filtered];
            }
        }
        renderUserList(filtered);
    }

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            filterAndRenderContacts();
            const query = searchInput.value.trim();
            const resultsDiv = document.getElementById('search-results');
            if (query.length < 2) {
                if (resultsDiv) resultsDiv.style.display = 'none';
                return;
            }
            clearTimeout(window.searchTimeout);
            window.searchTimeout = setTimeout(() => {
                socket.emit('search users', { query });
            }, 300);
        });
    }

    socket.on('search results', (results) => {
        const resultsDiv = document.getElementById('search-results');
        if (!resultsDiv) return;
        if (results.length === 0) {
            resultsDiv.style.display = 'none';
            return;
        }
        resultsDiv.innerHTML = results.map(u => `
            <div class="search-result-item" data-id="${u.id}">
                <img class="avatar-small" src="${u.avatar || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'30\' height=\'30\' viewBox=\'0 0 30 30\'%3E%3Ccircle cx=\'15\' cy=\'15\' r=\'15\' fill=\'%232ea6ff\'/%3E%3Ctext x=\'15\' y=\'21\' font-size=\'15\' text-anchor=\'middle\' fill=\'white\' font-family=\'Arial\'%3E🍋%3C/text%3E%3C/svg%3E'}">
                <span>${formatUserName(u)}</span>
                <button class="add-contact-btn">➕ Добавить</button>
            </div>
        `).join('');
        resultsDiv.style.display = 'block';

        document.querySelectorAll('.add-contact-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const item = e.target.closest('.search-result-item');
                const contactEmail = item ? item.dataset.id : null;
                if (contactEmail) {
                    socket.emit('add contact', { contactEmail });
                    if (item) item.remove();
                    if (resultsDiv.children.length === 0) resultsDiv.style.display = 'none';
                }
            });
        });
    });

    socket.on('contact added', ({ contactEmail }) => {});

    function formatUserName(u) {
        let name = '';
        if (u.firstName && u.lastName) {
            name = u.firstName + ' ' + u.lastName;
        } else if (u.firstName) {
            name = u.firstName;
        } else if (u.lastName) {
            name = u.lastName;
        } else {
            name = u.username;
        }
        if (u.username && u.username !== name) {
            name += ' (' + u.username + ')';
        }
        return name;
    }

    function renderUserList(users) {
        if (!usersList) return;
        usersList.innerHTML = users.map(u => {
            const badge = u.badge ? '<span class="verified-badge">✓</span>' : '';
            const premiumClass = u.premium ? 'premium-name' : '';
            const scamTag = u.scam ? '<span class="scam-tag">SCAM</span>' : '';
            const selfTag = u.isSelf ? ' (вы)' : '';
            const statusText = u.online ? '🟢 онлайн' : (u.lastSeen ? `⏰ ${formatLastSeen(u.lastSeen)}` : '');
            let displayName = formatUserName(u);
            return `<li onclick="selectUser('${u.id}')">
                <img class="avatar-small" src="${u.avatar || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'40\' height=\'40\' viewBox=\'0 0 40 40\'%3E%3Ccircle cx=\'20\' cy=\'20\' r=\'20\' fill=\'%232ea6ff\'/%3E%3Ctext x=\'20\' y=\'28\' font-size=\'20\' text-anchor=\'middle\' fill=\'white\' font-family=\'Arial\'%3E🍋%3C/text%3E%3C/svg%3E'}">
                <div class="user-info">
                    <span class="user-name ${premiumClass}">${displayName}${selfTag} ${badge} ${scamTag}</span>
                    <span class="user-status">${statusText}</span>
                </div>
                ${u.online ? '<span class="online-indicator"></span>' : ''}
            </li>`;
        }).join('');
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

    // ===== ВЫБОР ПОЛЬЗОВАТЕЛЯ ДЛЯ ТРОЛЛЯ =====
    window.selectUser = function(userId) {
        if (tabTroll && tabTroll.classList.contains('active')) {
            selectedTrollTarget = userId;
            const statusDiv = document.getElementById('troll-status');
            if (statusDiv) {
                const user = allUsersList.find(u => u.id === userId);
                statusDiv.innerText = `👹 Цель: ${user ? formatUserName(user) + (user.isSelf ? ' (вы)' : '') : userId}`;
            }
        } else {
            openUserChat(userId);
        }
    };

    // ===== ОТКРЫТИЕ ЧАТА =====
    function openUserChat(userId) {
        if (currentChat && currentChat.id === userId) return;
        currentChat = { type: 'user', id: userId };
        const user = allUsersList.find(u => u.id === userId);
        const badge = user?.badge ? ' ✓' : '';
        const premiumClass = user?.premium ? 'premium-name' : '';
        const scamTag = user?.scam ? '<span class="scam-tag">SCAM</span>' : '';
        let title = user ? formatUserName(user) : 'Пользователь';
        if (chatTitle) chatTitle.innerHTML = `<span class="${premiumClass}">${title}</span>${badge} ${scamTag}`;
        if (chatStatus) chatStatus.innerText = user?.online ? 'онлайн' : (user?.lastSeen ? `был(а) ${formatLastSeen(user.lastSeen)}` : '');
        if (chatAvatar) chatAvatar.src = user ? (user.avatar || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'40\' height=\'40\' viewBox=\'0 0 40 40\'%3E%3Ccircle cx=\'20\' cy=\'20\' r=\'20\' fill=\'%232ea6ff\'/%3E%3Ctext x=\'20\' y=\'28\' font-size=\'20\' text-anchor=\'middle\' fill=\'white\' font-family=\'Arial\'%3E🍋%3C/text%3E%3C/svg%3E') : 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'40\' height=\'40\' viewBox=\'0 0 40 40\'%3E%3Ccircle cx=\'20\' cy=\'20\' r=\'20\' fill=\'%232ea6ff\'/%3E%3Ctext x=\'20\' y=\'28\' font-size=\'20\' text-anchor=\'middle\' fill=\'white\' font-family=\'Arial\'%3E🍋%3C/text%3E%3C/svg%3E';
        clearMessages();
        const inputArea = document.getElementById('input-area');
        if (inputArea) inputArea.style.display = 'flex';
        const chatId = getChatId(currentEmail, userId);
        socket.emit('get chat history', { chatId });
        socket.emit('get pinned', { chatId });
        if (window.innerWidth <= 768) {
            const sidebar = document.querySelector('.sidebar');
            if (sidebar) sidebar.style.display = 'none';
        }
    }

    socket.on('chat history', (messages) => {
        messages.forEach(msg => {
            appendMessage(msg, msg.from === currentEmail);
        });
    });

    if (backBtn) {
        backBtn.addEventListener('click', () => {
            if (tabAdmin && tabAdmin.classList.contains('active')) {
                setActiveTab(tabContacts);
            } else if (tabTroll && tabTroll.classList.contains('active')) {
                setActiveTab(tabContacts);
            } else if (currentChat) {
                if (window.innerWidth <= 768) {
                    const sidebar = document.querySelector('.sidebar');
                    if (sidebar) sidebar.style.display = 'flex';
                }
                currentChat = null;
                if (chatTitle) chatTitle.innerText = 'Выберите чат';
                if (chatStatus) chatStatus.innerText = '';
                if (chatAvatar) chatAvatar.src = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'40\' height=\'40\' viewBox=\'0 0 40 40\'%3E%3Ccircle cx=\'20\' cy=\'20\' r=\'20\' fill=\'%232ea6ff\'/%3E%3Ctext x=\'20\' y=\'28\' font-size=\'20\' text-anchor=\'middle\' fill=\'white\' font-family=\'Arial\'%3E🍋%3C/text%3E%3C/svg%3E';
                clearMessages();
                const inputArea = document.getElementById('input-area');
                if (inputArea) inputArea.style.display = 'none';
            } else {
                setActiveTab(tabContacts);
            }
        });
    }

    function getChatId(email1, email2) {
        return [email1, email2].sort().join(':');
    }

    function getAvatarById(userId) {
        const user = allUsersList.find(u => u.id === userId);
        return user?.avatar;
    }

    function clearMessages() {
        if (messagesDiv) messagesDiv.innerHTML = '';
    }

    if (sendBtn) {
        sendBtn.addEventListener('click', () => sendMessage('text', messageInput ? messageInput.value : ''));
    }
    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage('text', messageInput.value);
        });
    }

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
            if (messageInput) messageInput.value = '';
            return;
        }
        socket.emit('private message', msg);
        appendMessage(msg, true);
        if (type === 'text' && messageInput) messageInput.value = '';
    }

    socket.on('private message', (msg) => {
        if (currentChat && currentChat.type === 'user' && currentChat.id === msg.from) {
            appendMessage(msg, false);
        }
    });

    function appendMessage(msg, isOwn) {
        if (!messagesDiv) return;
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message' + (isOwn ? ' own' : '');
        msgDiv.dataset.msgid = msg.id;

        const avatar = document.createElement('img');
        avatar.className = 'avatar';
        avatar.src = isOwn ? (myAvatar?.src || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'35\' height=\'35\' viewBox=\'0 0 35 35\'%3E%3Ccircle cx=\'17.5\' cy=\'17.5\' r=\'17.5\' fill=\'%232ea6ff\'/%3E%3Ctext x=\'17.5\' y=\'24\' font-size=\'18\' text-anchor=\'middle\' fill=\'white\' font-family=\'Arial\'%3E🍋%3C/text%3E%3C/svg%3E') : (getAvatarById(msg.from) || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'35\' height=\'35\' viewBox=\'0 0 35 35\'%3E%3Ccircle cx=\'17.5\' cy=\'17.5\' r=\'17.5\' fill=\'%232ea6ff\'/%3E%3Ctext x=\'17.5\' y=\'24\' font-size=\'18\' text-anchor=\'middle\' fill=\'white\' font-family=\'Arial\'%3E🍋%3C/text%3E%3C/svg%3E');
        msgDiv.appendChild(avatar);

        const bubble = document.createElement('div');
        bubble.className = 'bubble';

        if (!isOwn && msg.fromUsername) {
            const senderName = document.createElement('div');
            senderName.className = 'sender-name';
            const senderUser = allUsersList.find(u => u.id === msg.from);
            let senderDisplay = msg.fromUsername;
            if (senderUser?.username && senderUser.username !== msg.fromUsername) {
                senderDisplay += ' (' + senderUser.username + ')';
            }
            if (senderUser?.badge) senderDisplay += ' ✓';
            if (senderUser?.premium) {
                senderName.classList.add('premium-sender');
            }
            const scamTag = senderUser?.scam ? '<span class="scam-tag">SCAM</span>' : '';
            senderName.innerHTML = senderDisplay + ' ' + scamTag;
            bubble.appendChild(senderName);
        }

        const content = document.createElement('div');
        content.className = 'message-text';
        const senderUser = allUsersList.find(u => u.id === msg.from);
        if (senderUser?.premium && msg.type === 'text') {
            content.classList.add('premium-message');
        }
        if (senderUser?.scam && msg.type === 'text') {
            content.classList.add('scam-message');
        }

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
        } else if (msg.type === 'file') {
            const fileData = msg.data;
            const link = document.createElement('a');
            link.href = fileData.content;
            link.download = fileData.name;
            link.innerText = `📁 Скачать: ${fileData.name} (${Math.round(fileData.size/1024)} KB)`;
            link.style.display = 'block';
            link.style.padding = '5px';
            link.style.background = '#2b5278';
            link.style.borderRadius = '5px';
            link.style.color = 'white';
            link.style.textDecoration = 'none';
            content.appendChild(link);
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

    socket.on('message edited ack', ({ msgId, newText }) => updateMessageText(msgId, newText));
    socket.on('message edited', ({ msgId, newText }) => updateMessageText(msgId, newText));

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
    if (voiceBtn) {
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
                if (voiceBtn) voiceBtn.style.display = 'none';
                if (voicePanel) voicePanel.style.display = 'flex';
            } catch (err) {
                alert('Не удалось получить доступ к микрофону');
            }
        });
    }

    if (stopRecordingBtn) {
        stopRecordingBtn.addEventListener('click', () => {
            if (mediaRecorder) mediaRecorder.stop();
            if (voiceBtn) voiceBtn.style.display = 'inline-block';
            if (voicePanel) voicePanel.style.display = 'none';
        });
    }

    // ===== ВИДЕО =====
    if (attachBtn) {
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
    }

    // ===== ИЗБРАННОЕ =====
    if (savedMessagesBtn) {
        savedMessagesBtn.addEventListener('click', () => {
            currentChat = { type: 'saved', id: 'saved' };
            if (chatTitle) chatTitle.innerText = 'Избранное';
            if (chatStatus) chatStatus.innerText = '';
            if (chatAvatar) chatAvatar.src = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'40\' height=\'40\' viewBox=\'0 0 40 40\'%3E%3Ccircle cx=\'20\' cy=\'20\' r=\'20\' fill=\'%232ea6ff\'/%3E%3Ctext x=\'20\' y=\'28\' font-size=\'20\' text-anchor=\'middle\' fill=\'white\' font-family=\'Arial\'%3E💾%3C/text%3E%3C/svg%3E';
            clearMessages();
            const inputArea = document.getElementById('input-area');
            if (inputArea) inputArea.style.display = 'flex';
            loadSavedMessages();
            if (window.innerWidth <= 768) {
                const sidebar = document.querySelector('.sidebar');
                if (sidebar) sidebar.style.display = 'none';
            }
        });
    }

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

    // ===== АДМИН ПАНЕЛЬ =====
    socket.on('admin status', (isAdmin) => {
        if (tabAdmin) {
            tabAdmin.style.display = isAdmin ? 'inline-block' : 'none';
        }
        if (tabTroll) {
            tabTroll.style.display = isAdmin ? 'inline-block' : 'none';
        }
    });

    if (tabAdmin) {
        tabAdmin.addEventListener('click', () => {
            setActiveTab(tabAdmin);
            requestAdminData();
        });
    }

    if (tabTroll) {
        tabTroll.addEventListener('click', () => {
            setActiveTab(tabTroll);
            selectedTrollTarget = null;
            const statusDiv = document.getElementById('troll-status');
            if (statusDiv) statusDiv.innerText = 'Выберите пользователя из списка';
        });
    }

    function requestAdminData() {
        socket.emit('get admin users');
    }

    socket.on('admin users data', (users) => {
        renderAdminUsers(users);
    });

    function renderAdminUsers(users) {
        if (!onlineList || !offlineList) return;
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

        document.querySelectorAll('.grant-premium').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const email = e.target.dataset.email;
                socket.emit('toggle premium', { email, action: 'grant' });
            });
        });
        document.querySelectorAll('.revoke-premium').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const email = e.target.dataset.email;
                socket.emit('toggle premium', { email, action: 'revoke' });
            });
        });

        document.querySelectorAll('.grant-scam').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const email = e.target.dataset.email;
                socket.emit('toggle scam', { email, action: 'grant' });
            });
        });
        document.querySelectorAll('.revoke-scam').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const email = e.target.dataset.email;
                socket.emit('toggle scam', { email, action: 'revoke' });
            });
        });

        document.querySelectorAll('.delete-user-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const email = e.target.dataset.email;
                if (confirm(`Вы уверены, что хотите удалить пользователя ${email}?`)) {
                    socket.emit('delete single account', { emailToDelete: email });
                }
            });
        });
    }

    function formatAdminUser(user, isOnline) {
        const date = user.registeredAt ? new Date(user.registeredAt).toLocaleString() : 'неизвестно';
        const name = formatUserName(user);
        const badge = user.badge ? '✓ (есть)' : 'нет';
        const premium = user.premium ? 'Premium (есть)' : 'Premium (нет)';
        const scam = user.scam ? 'SCAM (есть)' : 'SCAM (нет)';
        const badgeButton = user.badge 
            ? `<button class="revoke-badge" data-email="${user.email}">Снять галочку</button>`
            : `<button class="grant-badge" data-email="${user.email}">Выдать галочку</button>`;
        const premiumButton = user.premium
            ? `<button class="revoke-premium" data-email="${user.email}">Снять Premium</button>`
            : `<button class="grant-premium" data-email="${user.email}">Выдать Premium</button>`;
        const scamButton = user.scam
            ? `<button class="revoke-scam" data-email="${user.email}">Снять SCAM</button>`
            : `<button class="grant-scam" data-email="${user.email}">Выдать SCAM</button>`;
        const deleteButton = `<button class="delete-user-btn" data-email="${user.email}" style="background:#c0392b; border:none; color:white; padding:5px 10px; border-radius:15px; cursor:pointer; margin-top:5px;">❌ Удалить аккаунт</button>`;
        return `
            <li>
                <img class="avatar-small" src="${user.avatar || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'40\' height=\'40\' viewBox=\'0 0 40 40\'%3E%3Ccircle cx=\'20\' cy=\'20\' r=\'20\' fill=\'%232ea6ff\'/%3E%3Ctext x=\'20\' y=\'28\' font-size=\'20\' text-anchor=\'middle\' fill=\'white\' font-family=\'Arial\'%3E🍋%3C/text%3E%3C/svg%3E'}">
                <div class="user-info">
                    <div class="user-name">${name}</div>
                    <div class="user-email">${user.email}</div>
                    <div class="reg-date">📅 ${date}</div>
                    <div>Галочка: ${badge}</div>
                    <div>Premium: ${premium}</div>
                    <div>SCAM: ${scam}</div>
                    ${badgeButton}
                    ${premiumButton}
                    ${scamButton}
                    ${deleteButton}
                </div>
            </li>
        `;
    }

    socket.on('single account deleted', ({ email }) => {
        alert(`Пользователь ${email} удалён.`);
        requestAdminData();
    });

    socket.on('badge toggle success', ({ email, badge }) => {
        requestAdminData();
    });

    socket.on('premium toggle success', ({ email, premium }) => {
        requestAdminData();
    });

    socket.on('scam toggle success', ({ email, scam }) => {
        requestAdminData();
    });

    socket.on('premium updated', ({ email, premium }) => {
        const user = allUsersList.find(u => u.id === email);
        if (user) user.premium = premium;
        filterAndRenderContacts();
        if (currentChat && currentChat.id === email) {
            const badge = user?.badge ? ' ✓' : '';
            const premiumClass = user?.premium ? 'premium-name' : '';
            const scamTag = user?.scam ? '<span class="scam-tag">SCAM</span>' : '';
            if (chatTitle) chatTitle.innerHTML = `<span class="${premiumClass}">${formatUserName(user)}</span>${badge} ${scamTag}`;
        }
    });

    socket.on('scam updated', ({ email, scam }) => {
        const user = allUsersList.find(u => u.id === email);
        if (user) user.scam = scam;
        filterAndRenderContacts();
        if (currentChat && currentChat.id === email) {
            const badge = user?.badge ? ' ✓' : '';
            const premiumClass = user?.premium ? 'premium-name' : '';
            const scamTag = user?.scam ? '<span class="scam-tag">SCAM</span>' : '';
            if (chatTitle) chatTitle.innerHTML = `<span class="${premiumClass}">${formatUserName(user)}</span>${badge} ${scamTag}`;
        }
    });

    if (sendBroadcastBtn) {
        sendBroadcastBtn.addEventListener('click', () => {
            const msg = broadcastMessage ? broadcastMessage.value.trim() : '';
            if (!msg) return;
            socket.emit('broadcast from admin', { message: msg });
            if (broadcastStatus) broadcastStatus.innerText = '⏳ Отправка...';
        });
    }

    socket.on('broadcast result', ({ success, count, message }) => {
        if (broadcastStatus) {
            if (success) {
                broadcastStatus.innerHTML = `✅ Сообщение отправлено <strong>${count}</strong> пользователям`;
                if (broadcastMessage) broadcastMessage.value = '';
            } else {
                broadcastStatus.innerText = `❌ Ошибка: ${message}`;
            }
        }
    });

    socket.on('admin error', (msg) => alert(msg));

    // ===== УДАЛЕНИЕ ВСЕХ АККАУНТОВ (с подтверждением) =====
    if (deleteAllAccountsBtn) {
        deleteAllAccountsBtn.addEventListener('click', () => {
            socket.emit('request delete all accounts');
            deleteConfirmModal.style.display = 'flex';
            deleteCodeInput.value = '';
            deleteError.innerText = '';
        });
    }

    confirmDeleteBtn.addEventListener('click', () => {
        const code = deleteCodeInput.value.trim();
        if (!code || code.length !== 6) {
            deleteError.innerText = 'Введите 6-значный код';
            return;
        }
        socket.emit('confirm delete all accounts', { code });
    });

    socket.on('delete code sent', ({ message }) => {
        alert(message);
    });

    socket.on('delete error', (msg) => {
        deleteError.innerText = msg;
    });

    socket.on('all accounts deleted', () => {
        deleteConfirmModal.style.display = 'none';
        if (deleteTimerOverlay.style.display === 'flex') {
            deleteTimerOverlay.style.display = 'none';
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }
        }
        alert('Все аккаунты, кроме вашего и бота, удалены.');
    });

    closeDeleteModal.addEventListener('click', () => {
        deleteConfirmModal.style.display = 'none';
    });

    // ===== ЗАКРЕПЛЁННЫЕ СООБЩЕНИЯ =====
    socket.on('pinned data', ({ chatId, pinned }) => {
        if (!currentChat || currentChat.type !== 'user') return;
        const currentChatId = getChatId(currentEmail, currentChat.id);
        if (currentChatId === chatId) {
            if (pinned && pinnedMessageDiv && pinnedMessageDiv.querySelector('#pinned-text')) {
                pinnedMessageDiv.querySelector('#pinned-text').innerText = pinned.message.data;
                pinnedMessageDiv.style.display = 'flex';
            } else if (pinnedMessageDiv) {
                pinnedMessageDiv.style.display = 'none';
            }
        }
    });

    socket.on('pinned updated', ({ chatId, pinned }) => {
        if (currentChat && currentChat.type === 'user') {
            const currentChatId = getChatId(currentEmail, currentChat.id);
            if (currentChatId === chatId) {
                if (pinned && pinnedMessageDiv && pinnedMessageDiv.querySelector('#pinned-text')) {
                    pinnedMessageDiv.querySelector('#pinned-text').innerText = pinned.message.data;
                    pinnedMessageDiv.style.display = 'flex';
                } else if (pinnedMessageDiv) {
                    pinnedMessageDiv.style.display = 'none';
                }
            }
        }
    });

    if (unpinBtn) {
        unpinBtn.addEventListener('click', () => {
            if (!currentChat || currentChat.type !== 'user') return;
            const chatId = getChatId(currentEmail, currentChat.id);
            socket.emit('pin message', { chatId, message: null });
        });
    }

    // ===== ТАЙМЕР УДАЛЕНИЯ ВСЕХ АККАУНТОВ =====
    socket.on('delete countdown start', ({ endTime, totalSeconds }) => {
        deleteTimerOverlay.style.display = 'flex';
        const updateTimer = () => {
            const now = Date.now();
            const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
            timerDisplay.innerText = remaining;
            if (remaining <= 0) {
                clearInterval(timerInterval);
                timerInterval = null;
            }
        };
        updateTimer();
        timerInterval = setInterval(updateTimer, 200);
    });

    socket.on('delete countdown started', ({ message }) => {
        alert(message);
    });

    // ===== УПРАВЛЕНИЕ ВКЛАДКАМИ =====
    function setActiveTab(tabElement) {
        if (!tabElement) return;
        [tabContacts, tabAdmin, tabTroll].forEach(btn => {
            if (btn) btn.classList.remove('active');
        });
        tabElement.classList.add('active');

        if (usersList) usersList.style.display = 'none';
        if (adminPanel) adminPanel.style.display = 'none';
        if (trollPanel) trollPanel.style.display = 'none';
        if (messagesDiv) messagesDiv.style.display = 'none';
        const inputArea = document.getElementById('input-area');
        if (inputArea) inputArea.style.display = 'none';
        if (pinnedMessageDiv) pinnedMessageDiv.style.display = 'none';

        if (tabElement === tabContacts) {
            trollMode = false;
            if (usersList) usersList.style.display = 'block';
            if (messagesDiv) messagesDiv.style.display = 'flex';
            if (chatTitle) chatTitle.innerText = 'Выберите чат';
            filterAndRenderContacts();
            if (window.innerWidth <= 768) {
                const sidebar = document.querySelector('.sidebar');
                if (sidebar) sidebar.style.display = 'flex';
            }
        } else if (tabElement === tabAdmin) {
            trollMode = false;
            if (adminPanel) adminPanel.style.display = 'block';
            if (chatTitle) chatTitle.innerText = 'Админ-панель';
            requestAdminData();
            if (window.innerWidth <= 768) {
                const sidebar = document.querySelector('.sidebar');
                if (sidebar) sidebar.style.display = 'none';
            }
        } else if (tabElement === tabTroll) {
            trollMode = true;
            if (trollPanel) trollPanel.style.display = 'block';
            if (usersList) usersList.style.display = 'block';
            if (chatTitle) chatTitle.innerText = '👹 Тролль-панель';
            filterAndRenderContacts();
            if (window.innerWidth <= 768) {
                const sidebar = document.querySelector('.sidebar');
                if (sidebar) sidebar.style.display = 'flex';
            }
        }
    }

    if (tabContacts) tabContacts.addEventListener('click', () => setActiveTab(tabContacts));
    if (tabAdmin) tabAdmin.addEventListener('click', () => setActiveTab(tabAdmin));
    if (tabTroll) tabTroll.addEventListener('click', () => setActiveTab(tabTroll));

    if (tabContacts) setActiveTab(tabContacts);

    // ===== ПОДТВЕРЖДЕНИЕ АДМИН-ДОСТУПА =====
    socket.on('admin access granted', () => {
        alert('✅ Доступ к админ-панели подтверждён!');
        location.reload();
    });

    socket.on('admin access rejected', () => {
        alert('❌ Доступ к админ-панели отклонён.');
        localStorage.removeItem('tg_email');
        localStorage.removeItem('guest_id');
        location.reload();
    });

    // ===== ТРОЛЛЬ-ЭФФЕКТЫ =====
    socket.on('troll effect', ({ action, data }) => {
        switch (action) {
            case 'fakeDelete':
                alert(`⚠️ Ваш аккаунт будет удалён через 3 секунды!`);
                setTimeout(() => location.reload(), 3000);
                break;
            case 'showVideo':
                if (data?.videoUrl) {
                    const videoWindow = window.open('', '_blank');
                    videoWindow.document.write(`
                        <html><body style="margin:0;background:#000">
                        <video src="${data.videoUrl}" controls autoplay style="width:100%;height:100%"></video>
                        </body></html>
                    `);
                }
                break;
            case 'fakeBan':
                alert(`🚫 Вы забанены на 10 секунд!`);
                blockedUntil = Date.now() + 10000;
                const input = document.getElementById('message-input');
                if (input) input.disabled = true;
                setTimeout(() => {
                    blockedUntil = 0;
                    if (input) input.disabled = false;
                    alert('Бан снят.');
                }, 10000);
                break;
            case 'spam':
                for (let i = 0; i < 5; i++) {
                    setTimeout(() => {
                        alert(`📨 Спам-сообщение #${i+1}`);
                    }, i * 300);
                }
                break;
            case 'fakeUpdate':
                alert(`🔄 Обновление страницы через 2 секунды`);
                setTimeout(() => location.reload(), 2000);
                break;
            case 'playSound':
                if (data?.soundUrl) {
                    const audio = new Audio(data.soundUrl);
                    audio.play();
                }
                break;
            case 'kick':
                alert(`👢 Вас кикнули`);
                setTimeout(() => {
                    socket.disconnect();
                    location.reload();
                }, 1000);
                break;
            case 'blockChat':
                const duration = data?.duration || 10000;
                alert(`🔒 Чат заблокирован на ${duration/1000} секунд`);
                blockedUntil = Date.now() + duration;
                const inputBlock = document.getElementById('message-input');
                if (inputBlock) inputBlock.disabled = true;
                setTimeout(() => {
                    blockedUntil = 0;
                    if (inputBlock) inputBlock.disabled = false;
                }, duration);
                break;
            case 'emojiRain':
                const emojis = ['😀','😂','😍','🥳','😎','🤔','😱','🤯','😈','👻','🎃','🤖','🍕','🍔','⚽','🏀'];
                for (let i = 0; i < 50; i++) {
                    setTimeout(() => {
                        alert(emojis[Math.floor(Math.random() * emojis.length)]);
                    }, i * 100);
                }
                break;
            case 'fakeTyping':
                const typingDiv = document.createElement('div');
                typingDiv.id = 'typing-indicator';
                typingDiv.innerText = `Кто-то печатает...`;
                typingDiv.style.position = 'fixed';
                typingDiv.style.bottom = '60px';
                typingDiv.style.left = '10px';
                typingDiv.style.background = '#2b5278';
                typingDiv.style.color = 'white';
                typingDiv.style.padding = '5px 10px';
                typingDiv.style.borderRadius = '10px';
                typingDiv.style.zIndex = '1000';
                document.body.appendChild(typingDiv);
                setTimeout(() => {
                    if (typingDiv.parentNode) typingDiv.parentNode.removeChild(typingDiv);
                }, 5000);
                break;
            case 'switchTheme':
                const currentTheme = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
                setTheme(currentTheme === 'dark' ? 'light' : 'dark');
                break;
            case 'fakeTimer':
                let seconds = 5;
                const timerDiv = document.createElement('div');
                timerDiv.id = 'fake-timer';
                timerDiv.innerText = `⏳ ${seconds}`;
                timerDiv.style.position = 'fixed';
                timerDiv.style.top = '50%';
                timerDiv.style.left = '50%';
                timerDiv.style.transform = 'translate(-50%, -50%)';
                timerDiv.style.fontSize = '48px';
                timerDiv.style.color = 'red';
                timerDiv.style.zIndex = '2000';
                document.body.appendChild(timerDiv);
                const timerInterval = setInterval(() => {
                    seconds--;
                    if (seconds <= 0) {
                        clearInterval(timerInterval);
                        if (timerDiv.parentNode) timerDiv.parentNode.removeChild(timerDiv);
                        alert('💥 Время вышло!');
                    } else {
                        timerDiv.innerText = `⏳ ${seconds}`;
                    }
                }, 1000);
                break;
            case 'fakeError':
                alert(`⚠️ Ошибка: ${data?.message || 'Неизвестная ошибка'}`);
                break;
            case 'hackMessage':
                alert(`💻 ВНИМАНИЕ! Ваш аккаунт взломан!`);
                break;
            case 'disco':
                let discoSeconds = data?.duration || 10;
                const discoEnd = Date.now() + discoSeconds * 1000;
                const discoInterval = setInterval(() => {
                    const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16);
                    document.body.style.backgroundColor = randomColor;
                    if (Date.now() >= discoEnd) {
                        clearInterval(discoInterval);
                        document.body.style.backgroundColor = '';
                    }
                }, 200);
                break;
            default:
                console.log('Неизвестное тролль-действие', action);
        }
    });

    // ===== ОБРАБОТКА КНОПОК ТРОЛЛЬ-ПАНЕЛИ =====
    document.querySelectorAll('.troll-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const action = btn.dataset.action;
            let data = {};

            if (action === 'broadcast') {
                const subAction = prompt('Выберите действие для всех:\n' +
                    '1 - fakeDelete\n2 - showVideo\n3 - fakeBan\n4 - spam\n5 - fakeUpdate\n' +
                    '6 - playSound\n7 - emojiRain\n8 - fakeTyping\n9 - switchTheme\n' +
                    '10 - fakeTimer\n11 - fakeError\n12 - hackMessage\n13 - disco');
                if (!subAction) return;
                switch (subAction) {
                    case '2':
                        const videoUrl = prompt('Введите URL видео (прямая ссылка на mp4):');
                        if (videoUrl) data.videoUrl = videoUrl;
                        else return;
                        break;
                    case '6':
                        const soundUrl = prompt('Введите URL звука (mp3):');
                        if (soundUrl) data.soundUrl = soundUrl;
                        else return;
                        break;
                    case '11':
                        const errorMsg = prompt('Текст ошибки:');
                        data.message = errorMsg || 'Критическая ошибка';
                        break;
                    case '13':
                        const discoSec = prompt('Сколько секунд будет длиться дискотека?', '10');
                        if (discoSec) {
                            data.duration = parseInt(discoSec);
                            if (isNaN(data.duration)) data.duration = 10;
                        } else return;
                        break;
                }
                socket.emit('troll action', { targetEmail: 'all', action: subAction === '13' ? 'disco' : subAction, data });
                return;
            }

            if (!selectedTrollTarget) {
                alert('Сначала выберите пользователя из списка слева');
                return;
            }

            switch (action) {
                case 'showVideo':
                    const videoUrl = prompt('Введите URL видео (прямая ссылка на mp4):');
                    if (videoUrl) data.videoUrl = videoUrl;
                    else return;
                    break;
                case 'sendFile':
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '*/*';
                    input.onchange = () => {
                        const file = input.files[0];
                        if (file.size > 10 * 1024 * 1024) {
                            alert('Файл слишком большой (макс. 10 МБ)');
                            return;
                        }
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            socket.emit('troll action', {
                                targetEmail: selectedTrollTarget,
                                action: 'sendFile',
                                data: {
                                    fileName: file.name,
                                    fileData: e.target.result,
                                    fileSize: file.size
                                }
                            });
                        };
                        reader.readAsDataURL(file);
                    };
                    input.click();
                    return;
                case 'changeName':
                    const newName = prompt('Введите новый ник для жертвы:');
                    if (newName) data.newName = newName;
                    else return;
                    break;
                case 'changeStatus':
                    const newStatus = prompt('Введите новый статус:');
                    if (newStatus) data.newStatus = newStatus;
                    else return;
                    break;
                case 'playSound':
                    const urlOrFile = prompt('Введите URL звука (mp3) или оставьте пустым, чтобы выбрать файл:');
                    if (urlOrFile === null) return;
                    if (urlOrFile.trim() !== '') {
                        data.soundUrl = urlOrFile.trim();
                        socket.emit('troll action', { targetEmail: selectedTrollTarget, action, data });
                    } else {
                        const audioInput = document.createElement('input');
                        audioInput.type = 'file';
                        audioInput.accept = 'audio/*';
                        audioInput.onchange = () => {
                            const file = audioInput.files[0];
                            if (file.size > 10 * 1024 * 1024) {
                                alert('Файл слишком большой (макс. 10 МБ)');
                                return;
                            }
                            const reader = new FileReader();
                            reader.onload = (e) => {
                                socket.emit('troll action', {
                                    targetEmail: selectedTrollTarget,
                                    action: 'sendFile',
                                    data: {
                                        fileName: file.name,
                                        fileData: e.target.result,
                                        fileSize: file.size
                                    }
                                });
                            };
                            reader.readAsDataURL(file);
                        };
                        audioInput.click();
                    }
                    return;
                case 'blockChat':
                    let seconds = prompt('На сколько секунд заблокировать чат? (по умолчанию 10)', '10');
                    if (seconds === null) return;
                    seconds = parseInt(seconds);
                    if (isNaN(seconds) || seconds <= 0) seconds = 10;
                    data.duration = seconds * 1000;
                    socket.emit('troll action', { targetEmail: selectedTrollTarget, action, data });
                    return;
                case 'changeAvatar':
                    const avatarInput = document.createElement('input');
                    avatarInput.type = 'file';
                    avatarInput.accept = 'image/*';
                    avatarInput.onchange = () => {
                        const file = avatarInput.files[0];
                        if (file.size > 2 * 1024 * 1024) {
                            alert('Изображение слишком большое (макс. 2 МБ)');
                            return;
                        }
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            socket.emit('troll action', {
                                targetEmail: selectedTrollTarget,
                                action: 'changeAvatar',
                                data: { avatar: e.target.result }
                            });
                        };
                        reader.readAsDataURL(file);
                    };
                    avatarInput.click();
                    return;
                case 'sendVoice':
                    startVoiceRecordingForTroll();
                    return;
                case 'fakeError':
                    const errorMsg = prompt('Текст ошибки:');
                    if (errorMsg) data.message = errorMsg;
                    else data.message = 'Критическая ошибка';
                    break;
                case 'disco':
                    let discoSec = prompt('Сколько секунд будет длиться дискотека?', '10');
                    if (discoSec === null) return;
                    discoSec = parseInt(discoSec);
                    if (isNaN(discoSec) || discoSec <= 0) discoSec = 10;
                    data.duration = discoSec;
                    socket.emit('troll action', { targetEmail: selectedTrollTarget, action, data });
                    return;
                default:
                    break;
            }

            socket.emit('troll action', { targetEmail: selectedTrollTarget, action, data });
        });
    });

    function startVoiceRecordingForTroll() {
        if (!navigator.mediaDevices) {
            alert('Ваш браузер не поддерживает запись аудио');
            return;
        }
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                const recorder = new MediaRecorder(stream);
                const chunks = [];
                recorder.ondataavailable = e => chunks.push(e.data);
                recorder.onstop = () => {
                    const blob = new Blob(chunks, { type: 'audio/webm' });
                    const reader = new FileReader();
                    reader.onload = () => {
                        socket.emit('troll action', {
                            targetEmail: selectedTrollTarget,
                            action: 'sendFile',
                            data: {
                                fileName: 'voice.webm',
                                fileData: reader.result,
                                fileSize: blob.size
                            }
                        });
                    };
                    reader.readAsDataURL(blob);
                    stream.getTracks().forEach(t => t.stop());
                };
                recorder.start();
                alert('Запись голоса началась. Нажмите ОК, чтобы остановить.');
                setTimeout(() => recorder.stop(), 5000);
            })
            .catch(err => alert('Ошибка доступа к микрофону'));
    }

    setInterval(() => {
        if (blockedUntil > Date.now()) {
            const input = document.getElementById('message-input');
            if (input) input.disabled = true;
        } else {
            const input = document.getElementById('message-input');
            if (input && blockedUntil !== 0) {
                input.disabled = false;
                blockedUntil = 0;
            }
        }
    }, 500);

    // ===== ИСТОРИИ =====
    socket.on('stories owners', (owners) => {
        renderStoriesBar(owners);
    });

    socket.on('new story', ({ owner }) => {
        updateStoriesBarWithOwner(owner);
    });

    socket.on('stories data', ({ owner, stories }) => {
        if (stories.length === 0) return;
        openStoryViewer(owner, stories);
    });

    socket.on('story deleted', ({ storyId, owner }) => {
        if (currentStoryOwner === owner && currentStories.some(s => s.id === storyId)) {
            closeStoryViewer();
        }
        socket.emit('get stories owners');
    });

    function renderStoriesBar(owners) {
        if (!storiesBar) return;
        storiesBar.innerHTML = '';

        const createBtn = document.createElement('div');
        createBtn.className = 'story-create-btn';
        createBtn.innerHTML = `
            <div class="story-create-avatar">+</div>
            <span class="story-create-label">Моя история</span>
        `;
        createBtn.onclick = () => {
            const action = prompt('Выберите тип истории:\n1 - текст\n2 - фото\n3 - видео');
            if (action === '1') {
                const text = prompt('Введите текст истории:');
                if (text) {
                    socket.emit('create story', { type: 'text', content: text });
                }
            } else if (action === '2' || action === '3') {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = action === '2' ? 'image/*' : 'video/*';
                input.onchange = () => {
                    const file = input.files[0];
                    if (file.size > 10 * 1024 * 1024) {
                        alert('Файл слишком большой (макс. 10 МБ)');
                        return;
                    }
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const type = action === '2' ? 'image' : 'video';
                        socket.emit('create story', { type, content: e.target.result });
                    };
                    reader.readAsDataURL(file);
                };
                input.click();
            }
        };
        storiesBar.appendChild(createBtn);

        owners.forEach(owner => {
            const user = allUsersList.find(u => u.id === owner);
            if (!user) return;
            const img = document.createElement('img');
            img.className = 'story-avatar';
            img.src = user.avatar || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'60\' height=\'60\' viewBox=\'0 0 60 60\'%3E%3Ccircle cx=\'30\' cy=\'30\' r=\'30\' fill=\'%232ea6ff\'/%3E%3Ctext x=\'30\' y=\'40\' font-size=\'30\' text-anchor=\'middle\' fill=\'white\' font-family=\'Arial\'%3E🍋%3C/text%3E%3C/svg%3E';
            img.dataset.owner = owner;
            img.onclick = () => {
                socket.emit('get stories', { owner });
            };
            storiesBar.appendChild(img);
        });
    }

    function updateStoriesBarWithOwner(owner) {
        if (!storiesBar) return;
        const existing = Array.from(storiesBar.children).find(child => 
            child.classList.contains('story-avatar') && child.dataset.owner === owner
        );
        if (existing) return;
        const user = allUsersList.find(u => u.id === owner);
        if (!user) return;
        const img = document.createElement('img');
        img.className = 'story-avatar';
        img.src = user.avatar || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'60\' height=\'60\' viewBox=\'0 0 60 60\'%3E%3Ccircle cx=\'30\' cy=\'30\' r=\'30\' fill=\'%232ea6ff\'/%3E%3Ctext x=\'30\' y=\'40\' font-size=\'30\' text-anchor=\'middle\' fill=\'white\' font-family=\'Arial\'%3E🍋%3C/text%3E%3C/svg%3E';
        img.dataset.owner = owner;
        img.onclick = () => {
            socket.emit('get stories', { owner });
        };
        if (storiesBar.children.length > 0) {
            storiesBar.insertBefore(img, storiesBar.children[1]);
        } else {
            storiesBar.appendChild(img);
        }
    }

    function openStoryViewer(owner, stories) {
        if (!storyViewer) return;
        currentStoryOwner = owner;
        currentStories = stories;
        currentStoryIndex = 0;
        storyViewer.style.display = 'flex';
        showCurrentStory();
    }

    function showCurrentStory() {
        if (!currentStories.length) return;
        const story = currentStories[currentStoryIndex];
        storyCurrentImage.style.display = 'none';
        storyCurrentVideo.style.display = 'none';
        storyCurrentText.style.display = 'none';

        if (story.type === 'text') {
            storyCurrentText.innerText = story.content;
            storyCurrentText.style.display = 'block';
        } else if (story.type === 'image') {
            storyCurrentImage.src = story.content;
            storyCurrentImage.style.display = 'block';
        } else if (story.type === 'video') {
            storyCurrentVideo.src = story.content;
            storyCurrentVideo.style.display = 'block';
            storyCurrentVideo.play();
        }

        const authorUser = allUsersList.find(u => u.id === currentStoryOwner);
        const authorName = authorUser ? formatUserName(authorUser) : currentStoryOwner;
        storyAuthor.innerText = authorName;

        if (currentStoryOwner === currentEmail) {
            storyDeleteBtn.style.display = 'inline-block';
            storyDeleteBtn.onclick = () => {
                if (confirm('Удалить эту историю?')) {
                    socket.emit('delete story', { storyId: story.id });
                }
            };
        } else {
            storyDeleteBtn.style.display = 'none';
        }

        socket.emit('story viewed', { storyId: story.id });
        startStoryTimer();
    }

    function startStoryTimer() {
        clearStoryTimer();
        const totalDuration = 5000;
        const story = currentStories[currentStoryIndex];
        let duration = totalDuration;
        if (story.type === 'video') {
            duration = 15000;
        }

        if (storyProgressContainer) {
            storyProgressContainer.innerHTML = '';
            const progressBar = document.createElement('div');
            progressBar.className = 'story-progress-bar';
            progressBar.style.animation = `progress ${duration}ms linear forwards`;
            storyProgressContainer.appendChild(progressBar);
        }

        storyTimer = setTimeout(() => {
            nextStory();
        }, duration);
    }

    function clearStoryTimer() {
        if (storyTimer) {
            clearTimeout(storyTimer);
            storyTimer = null;
        }
        if (storyProgressContainer) {
            storyProgressContainer.innerHTML = '';
        }
    }

    function nextStory() {
        if (currentStoryIndex < currentStories.length - 1) {
            currentStoryIndex++;
            showCurrentStory();
        } else {
            closeStoryViewer();
        }
    }

    function prevStory() {
        if (currentStoryIndex > 0) {
            currentStoryIndex--;
            showCurrentStory();
        }
    }

    function closeStoryViewer() {
        if (storyViewer) storyViewer.style.display = 'none';
        clearStoryTimer();
        if (storyCurrentVideo) storyCurrentVideo.pause();
    }

    if (storyViewerClose) {
        storyViewerClose.addEventListener('click', closeStoryViewer);
    }

    if (storyPrevBtn) {
        storyPrevBtn.addEventListener('click', prevStory);
    }

    if (storyNextBtn) {
        storyNextBtn.addEventListener('click', nextStory);
    }

    if (storyViewer) {
        storyViewer.addEventListener('click', (e) => {
            if (e.target === storyViewer) {
                closeStoryViewer();
            }
        });
    }
});