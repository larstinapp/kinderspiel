/**
 * Zahlen-Safari - Game Engine
 */

class SoundManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.enabled = true;
    }

    playTone(freq, type, duration) {
        if (!this.enabled) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.frequency.value = freq;
        osc.type = type;
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();

        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.00001, this.ctx.currentTime + duration);
        osc.stop(this.ctx.currentTime + duration);
    }

    playSuccess() {
        // Happy major chord arpeggio
        this.playTone(523.25, 'sine', 0.2); // C5
        setTimeout(() => this.playTone(659.25, 'sine', 0.2), 100); // E5
        setTimeout(() => this.playTone(783.99, 'sine', 0.4), 200); // G5
    }

    playError() {
        // Low discord
        this.playTone(150, 'sawtooth', 0.4);
        setTimeout(() => this.playTone(140, 'sawtooth', 0.4), 100);
    }

    playClick() {
        this.playTone(800, 'triangle', 0.05);
    }

    playPop() {
        this.playTone(600, 'sine', 0.1);
    }
    playPop() {
        this.playTone(600, 'sine', 0.1);
    }
}

class SafariDB {
    constructor() {
        this.STORAGE_KEY = 'safari_profiles_v1';
        this.data = this.load();
    }

    load() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            console.error('SafariDB Load Error:', e);
            return [];
        }
    }

    save() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
            console.log('SafariDB Saved:', this.data.length + ' profiles');
            return true;
        } catch (e) {
            console.error('SafariDB Save Error:', e);
            alert('Dein Fortschritt konnte nicht gespeichert werden! (Speicher voll oder deaktiviert?)');
            return false;
        }
    }

    addProfile(name, avatar) {
        if (!name) return null;
        const newProfile = {
            id: Date.now(),
            name: name,
            avatar: avatar,
            score: 0,
            created: new Date().toISOString()
        };
        this.data.push(newProfile);
        this.save();
        return newProfile;
    }

    updateScore(profileId, points) {
        const profile = this.data.find(p => p.id === profileId);
        if (profile) {
            profile.score += points;
            this.save();
            return profile.score;
        }
        return 0;
    }

    getProfiles() {
        return this.data.sort((a, b) => b.score - a.score);
    }
}

class NumberSafari {
    constructor() {
        this.audio = new SoundManager();
        this.db = new SafariDB();
        this.score = 0;
        this.currentMode = null;
        this.correctAnswer = null;
        this.currentUser = null;
        this.profiles = this.db.getProfiles();
        this.isProcessing = false; // Debounce flag

        this.animals = [
            'safari_lion_1767717591178.png',
            'safari_elephant_1767717606982.png',
            'safari_giraffe_1767717621407.png'
        ];

        // Caching DOM elements
        this.ui = {
            screens: document.querySelectorAll('.game-screen'),
            scoreDisplay: document.getElementById('score-display'),
            scoreValue: document.getElementById('score-value'),
            userDisplay: document.getElementById('user-display'),
            userName: document.getElementById('current-user-name'),
            userAvatar: document.getElementById('current-user-avatar'),
            backButton: document.getElementById('back-button'),
            feedbackOverlay: document.getElementById('feedback-overlay'),
            feedbackEmoji: document.getElementById('feedback-emoji'),
            feedbackMessage: document.getElementById('feedback-message'),
            feedbackAnim: document.getElementById('feedback-animation-container')
        };

        // Memory Game State
        this.memoryState = {
            flipped: [],
            locked: false,
            pairs: 0
        };

        this.init();
    }

    init() {
        // Initialize by showing profile screen
        this.showProfileScreen();

        // Add global click listener for sound
        document.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.closest('.profile-card')) {
                this.audio.playClick();
                // Resume AudioContext if suspended (browser requirements)
                if (this.audio.ctx.state === 'suspended') this.audio.ctx.resume();
            }
        });
    }

    // --- Navigation & UI ---

    hideAllScreens() {
        this.ui.screens.forEach(s => s.classList.remove('active'));
    }

    showScreen(id) {
        this.hideAllScreens();
        const screen = document.getElementById(id);
        if (screen) screen.classList.add('active');

        // Manage Back Button visibility
        if (id !== 'start-screen' && id !== 'profile-screen' && id !== 'create-profile-screen') {
            this.ui.backButton.classList.remove('hidden');
        } else {
            this.ui.backButton.classList.add('hidden');
        }
    }

    updateHeader() {
        if (this.currentUser) {
            this.ui.userDisplay.classList.remove('hidden');
            this.ui.scoreDisplay.classList.remove('hidden');
            this.ui.userName.textContent = this.currentUser.name;
            this.ui.userAvatar.src = this.currentUser.avatar;
            this.ui.scoreValue.textContent = this.score;
        } else {
            this.ui.userDisplay.classList.add('hidden');
            this.ui.scoreDisplay.classList.add('hidden');
        }
    }

    // --- Profile System ---

    showProfileScreen() {
        this.currentUser = null;
        this.updateHeader();
        this.showScreen('profile-screen');

        const list = document.getElementById('profile-list');
        list.innerHTML = '';

        if (this.profiles.length === 0) {
            list.innerHTML = '<p style="grid-column: 1/-1; font-style: italic;">Noch keine Profile. Erstelle eins!</p>';
        }

        this.db.getProfiles().forEach(p => {
            const card = document.createElement('div');
            card.className = 'profile-card';
            card.onclick = () => this.login(p);
            card.innerHTML = `
                <img src="${p.avatar}" class="profile-avatar" alt="Avatar">
                <div class="profile-name">${p.name}</div>
                <div style="font-size: 0.9rem; color: #888;">${p.score} ⭐</div>
            `;
            list.appendChild(card);
        });
    }

    showCreateProfile() {
        this.showScreen('create-profile-screen');
        const grid = document.getElementById('avatar-options');
        grid.innerHTML = '';
        this.selectedAvatar = this.animals[0];

        this.animals.forEach(a => {
            const img = document.createElement('img');
            img.src = a;
            img.className = 'avatar-option';
            if (a === this.selectedAvatar) img.classList.add('selected');

            img.onclick = (e) => {
                document.querySelectorAll('.avatar-option').forEach(opt => opt.classList.remove('selected'));
                e.target.classList.add('selected');
                this.selectedAvatar = a;
                this.audio.playPop();
            };
            grid.appendChild(img);
        });

        document.getElementById('new-profile-name').focus();
    }

    createProfile() {
        const nameInput = document.getElementById('new-profile-name');
        const name = nameInput.value.trim();
        if (!name) return alert('Bitte gib einen Namen ein!'); // Could be a nicer modal

        const newProfile = this.db.addProfile(name, this.selectedAvatar);
        this.profiles = this.db.getProfiles(); // Reload local list
        this.login(newProfile); // Auto-login

        nameInput.value = '';
        this.audio.playSuccess();
        this.showProfileScreen();
    }

    login(profile) {
        this.currentUser = profile;
        this.score = profile.score;
        this.updateHeader();
        this.showStartScreen();
    }

    logout() {
        this.currentUser = null;
        this.showProfileScreen();
    }

    saveProfiles() {
        // Deprecated: DB handles saving
    }

    showRankings() {
        this.showScreen('ranking-screen');
        const list = document.getElementById('ranking-list');
        list.innerHTML = '';

        const sorted = [...this.profiles].sort((a, b) => b.score - a.score);

        sorted.forEach((p, i) => {
            const item = document.createElement('div');
            item.style.cssText = 'display: flex; justify-content: space-between; padding: 1rem; border-bottom: 1px solid #eee; align-items: center;';

            let rankEmoji = i === 0 ? '🥇' : (i === 1 ? '🥈' : (i === 2 ? '🥉' : `#${i + 1}`));

            item.innerHTML = `
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <span style="font-weight: bold; font-size: 1.2rem; width: 30px;">${rankEmoji}</span>
                    <img src="${p.avatar}" style="width: 30px; height: 30px; border-radius: 50%;">
                    <span>${p.name}</span>
                </div>
                <span style="font-weight: bold; color: var(--primary);">${p.score} ⭐</span>
            `;
            list.appendChild(item);
        });
    }

    showStartScreen() {
        this.currentMode = null;
        this.showScreen('start-screen');
    }

    // --- Game Logic ---

    startMode(mode) {
        this.isProcessing = false;
        this.currentMode = mode;
        this.showScreen(`${mode}-screen`);
        this.nextLevel();
    }

    nextLevel() {
        this.isProcessing = false;
        switch (this.currentMode) {
            case 'count': this.setupCountMode(); break;
            case 'find': this.setupFindMode(); break;
            case 'comparison': this.setupComparisonMode(); break;
            case 'memory': this.setupMemoryMode(); break;
        }
    }

    // Mode: Count (1-9)
    setupCountMode() {
        const count = Math.floor(Math.random() * 9) + 1;
        this.correctAnswer = count;

        const display = document.getElementById('animal-display');
        const options = document.getElementById('answer-options');
        display.innerHTML = '';
        options.innerHTML = '';

        // Random animal type for this round
        const animalImg = this.animals[Math.floor(Math.random() * this.animals.length)];

        for (let i = 0; i < count; i++) {
            const img = document.createElement('img');
            img.src = animalImg;
            img.className = 'animal-item';
            // Slight random rotation for natural feel
            img.style.transform = `rotate(${Math.random() * 20 - 10}deg)`;
            display.appendChild(img);
        }

        this.generateOptions(options, count, 3);
    }

    // Mode: Find (1-9)
    setupFindMode() {
        const target = Math.floor(Math.random() * 9) + 1;
        this.correctAnswer = target;
        document.getElementById('target-number').textContent = target;

        const options = document.getElementById('find-options');
        options.innerHTML = '';
        this.generateOptions(options, target, 5); // More options for find mode
    }

    // Mode: Comparison
    setupComparisonMode() {
        // Ensure distinct values
        let left = Math.floor(Math.random() * 9) + 1;
        let right;
        do { right = Math.floor(Math.random() * 9) + 1; } while (right === left);

        this.correctAnswer = left > right ? 'left' : 'right';

        const leftBox = document.getElementById('compare-left');
        const rightBox = document.getElementById('compare-right');

        this.fillBox(leftBox, left);
        this.fillBox(rightBox, right);
    }

    fillBox(box, count) {
        box.innerHTML = ''; // Clear previous content
        const animalImg = this.animals[Math.floor(Math.random() * this.animals.length)];

        for (let i = 0; i < count; i++) {
            const img = document.createElement('img');
            img.src = animalImg;
            img.className = 'animal-item';
            img.style.width = count > 5 ? '40px' : '60px'; // Adjust size based on density
            img.style.height = count > 5 ? '40px' : '60px';
            box.appendChild(img);
        }
    }

    checkComparison(side) {
        if (this.isProcessing) return;

        // Visual feedback on selection
        const selectedBox = document.getElementById(`compare-${side}`);

        if (side === this.correctAnswer) {
            selectedBox.style.borderColor = 'var(--success)';
            this.handleSuccess();
        } else {
            selectedBox.classList.add('shake');
            selectedBox.style.borderColor = 'var(--danger)';
            setTimeout(() => selectedBox.classList.remove('shake'), 500);
            this.handleError();
        }
    }

    // Mode: Memory
    setupMemoryMode() {
        const grid = document.getElementById('memory-grid');
        grid.innerHTML = '';
        this.memoryState = { flipped: [], locked: false, pairs: 0 };

        // 3 pairs for 6 cards total
        const pairsCount = 3;
        const usedValues = [];

        while (usedValues.length < pairsCount) {
            let val = Math.floor(Math.random() * 6) + 1;
            if (!usedValues.includes(val)) usedValues.push(val);
        }

        let deck = [];
        usedValues.forEach(val => {
            deck.push({ val, type: 'num' });
            deck.push({ val, type: 'img' });
        });

        // Shuffle
        deck.sort(() => Math.random() - 0.5);

        deck.forEach(cardData => {
            const card = document.createElement('div');
            card.className = 'memory-card';

            const front = document.createElement('div');
            front.className = 'memory-card-front';

            const back = document.createElement('div');
            back.className = 'memory-card-back';

            if (cardData.type === 'num') {
                back.textContent = cardData.val;
            } else {
                const miniGrid = document.createElement('div');
                miniGrid.className = 'memory-mini-grid';
                const imgSrc = this.animals[0]; // Use lion for consistency in memory
                for (let i = 0; i < cardData.val; i++) {
                    const img = document.createElement('img');
                    img.src = imgSrc;
                    img.className = 'memory-mini-img';
                    miniGrid.appendChild(img);
                }
                back.appendChild(miniGrid);
            }

            card.appendChild(front);
            card.appendChild(back);

            card.onclick = () => this.flipCard(card, cardData);
            grid.appendChild(card);
        });
    }

    flipCard(card, data) {
        if (this.memoryState.locked || card.classList.contains('flipped')) return;

        this.audio.playPop();
        card.classList.add('flipped');
        this.memoryState.flipped.push({ card, data });

        if (this.memoryState.flipped.length === 2) {
            this.checkMemoryMatch();
        }
    }

    checkMemoryMatch() {
        this.memoryState.locked = true;
        const [first, second] = this.memoryState.flipped;

        const match = first.data.val === second.data.val;

        if (match) {
            this.audio.playSuccess();
            setTimeout(() => {
                first.card.style.visibility = 'hidden';
                second.card.style.visibility = 'hidden';
                this.memoryState.flipped = [];
                this.memoryState.locked = false;
                this.memoryState.pairs++;

                if (this.memoryState.pairs === 3) {
                    this.handleLevelComplete(); // Memory full level complete
                }
            }, 1000);
        } else {
            this.audio.playError();
            setTimeout(() => {
                first.card.classList.remove('flipped');
                second.card.classList.remove('flipped');
                this.memoryState.flipped = [];
                this.memoryState.locked = false;
            }, 1000);
        }
    }

    // --- Helpers ---

    generateOptions(container, correct, count) {
        const opts = [correct];
        while (opts.length < count) {
            let r = Math.floor(Math.random() * 9) + 1;
            if (!opts.includes(r)) opts.push(r);
        }
        opts.sort((a, b) => a - b);

        opts.forEach(val => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.textContent = val;
            btn.onclick = (e) => this.checkAnswer(val, e.target);
            container.appendChild(btn);
        });
    }

    checkAnswer(val, btnElement) {
        if (this.isProcessing) return;
        this.isProcessing = true;

        if (val === this.correctAnswer) {
            btnElement.style.background = 'var(--success)';
            btnElement.style.color = 'white';
            this.handleSuccess();
        } else {
            btnElement.style.background = 'var(--danger)';
            btnElement.style.color = 'white';
            btnElement.classList.add('shake');
            this.handleError();
            setTimeout(() => {
                this.isProcessing = false;
                btnElement.classList.remove('shake');
                btnElement.style.background = ''; // partial reset
                btnElement.style.color = '';
            }, 600);
        }
    }

    handleSuccess() {
        this.audio.playSuccess();
        this.score += 10;
        this.ui.scoreValue.textContent = this.score;

        // Save to DB
        if (this.currentUser) {
            this.db.updateScore(this.currentUser.id, 10);
        }

        // Visual Confetti
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
        });

        this.showFeedback(true);
    }

    handleLevelComplete() {
        // Special handling for memory game completion
        this.score += 20; // Bonus
        this.ui.scoreValue.textContent = this.score;
        if (this.currentUser) {
            this.db.updateScore(this.currentUser.id, 20);
        }
        confetti({ particleCount: 150, spread: 100 });
        this.showFeedback(true);
    }

    handleError() {
        this.audio.playError();
        // this.showFeedback(false); // Optional: Pop up for error? Maybe just shake is enough.
    }

    saveScore() {
        if (this.currentUser) {
            this.currentUser.score = this.score;
            this.db.updateScore(this.currentUser.id, 10); // Sync with 10 pts incr
            // Force refresh local reference if needed, though objects are ref linked usually
        }
    }

    showFeedback(isSuccess) {
        // Only showing success modal to move to next level
        if (!isSuccess) return;

        this.ui.feedbackEmoji.textContent = '🎉';
        this.ui.feedbackMessage.textContent = 'Richtig!';
        this.ui.feedbackOverlay.classList.add('visible');

        setTimeout(() => {
            this.ui.feedbackOverlay.classList.remove('visible');
            this.nextLevel();
        }, 1500);
    }
}

// Start Game
const game = new NumberSafari();
