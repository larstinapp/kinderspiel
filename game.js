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
        // Gentle "try again" sound.
        this.playTone(392, 'sine', 0.16);
        setTimeout(() => this.playTone(330, 'sine', 0.18), 120);
    }

    playClick() {
        this.playTone(800, 'triangle', 0.05);
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
            feedbackAnim: document.getElementById('feedback-animation-container'),
            tutorialOverlay: document.getElementById('tutorial-overlay'),
            tutorialImage: document.getElementById('tutorial-image')
        };

        // Tutorial images for each game mode
        this.tutorialImages = {
            count: 'tutorial_count.png',
            find: 'tutorial_find.png',
            comparison: 'tutorial_compare.png',
            memory: 'tutorial_memory.png'
        };

        // Track which tutorials have been seen (reset on page reload)
        this.seenTutorials = {};

        // Memory Game State
        this.memoryState = {
            flipped: [],
            locked: false,
            pairs: 0
        };

        // Round counter for break after 10 rounds per game mode
        this.roundsPlayed = 0;
        this.BREAK_AFTER_ROUNDS = 6;
        this.successMessages = ['Richtig!', 'Super!', 'Klasse!', 'Du kannst das!', 'Juhu!'];

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

        const sorted = [...this.db.getProfiles()].sort((a, b) => b.score - a.score);

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
        this.ui.feedbackOverlay.classList.remove('visible');
        this.ui.feedbackOverlay.classList.add('hidden');
        this.ui.feedbackMessage.innerHTML = '';
        this.showScreen('start-screen');
    }

    // --- Game Logic ---

    startMode(mode) {
        this.isProcessing = false;
        this.currentMode = mode;
        this.roundsPlayed = 0;
        this.showScreen(`${mode}-screen`);

        // Show tutorial if not seen yet
        if (!this.seenTutorials[mode]) {
            this.showTutorial(mode);
        } else {
            this.nextLevel();
        }
    }

    showTutorial(mode) {
        const tutorialImg = this.tutorialImages[mode];
        if (tutorialImg && this.ui.tutorialOverlay) {
            this.ui.tutorialImage.src = tutorialImg;
            this.ui.tutorialOverlay.classList.remove('hidden');
            this.ui.tutorialOverlay.classList.add('visible');
            this.audio.playPop();
        } else {
            this.nextLevel();
        }
    }

    closeTutorial() {
        this.ui.tutorialOverlay.classList.remove('visible');
        this.ui.tutorialOverlay.classList.add('hidden');
        this.seenTutorials[this.currentMode] = true;
        this.audio.playClick();
        this.nextLevel();
    }

    nextLevel() {
        this.isProcessing = false;

        // Check if break is needed (after 10 rounds)
        if (this.roundsPlayed > 0 && this.roundsPlayed % this.BREAK_AFTER_ROUNDS === 0) {
            this.showBreakScreen();
            return;
        }

        switch (this.currentMode) {
            case 'count': this.setupCountMode(); break;
            case 'find': this.setupFindMode(); break;
            case 'comparison': this.setupComparisonMode(); break;
            case 'memory': this.setupMemoryMode(); break;
        }
    }

    showBreakScreen() {
        // Create a friendly break overlay
        const overlay = this.ui.feedbackOverlay;
        this.ui.feedbackEmoji.textContent = '🌟';
        this.ui.feedbackMessage.innerHTML = `
            <div style="font-size: 1.3rem; margin-bottom: 1rem;">Super gemacht! Du hast schon ${this.roundsPlayed} Runden gespielt!</div>
            <div style="font-size: 1rem; margin-bottom: 1.5rem;">Zeit für eine Trinkpause? 🧃</div>
            <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
                <button class="btn btn-primary" onclick="game.continueAfterBreak()" style="font-size: 1rem;">Weiter spielen! 🎮</button>
                <button class="btn btn-secondary" onclick="game.showStartScreen()" style="font-size: 1rem;">Anderes Spiel 🔄</button>
            </div>
        `;
        overlay.classList.remove('hidden');
        overlay.classList.add('visible');

        // Play a gentle sound
        this.audio.playSuccess();
    }

    continueAfterBreak() {
        this.ui.feedbackOverlay.classList.remove('visible');
        this.ui.feedbackOverlay.classList.add('hidden');
        this.ui.feedbackMessage.innerHTML = ''; // Reset message

        // Continue playing - increment happens in handleSuccess, so go to next level
        switch (this.currentMode) {
            case 'count': this.setupCountMode(); break;
            case 'find': this.setupFindMode(); break;
            case 'comparison': this.setupComparisonMode(); break;
            case 'memory': this.setupMemoryMode(); break;
        }
    }

    // Mode: Count (1-9)
    setupCountMode() {
        const count = this.randomNumberForMode('count');
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

        this.setCoach('count', count <= 5 ? 'Du kannst mit dem Finger mitzaehlen.' : 'Nimm dir Zeit beim Zaehlen.');
        this.generateOptions(options, count, 3, this.getNumberLimit('count'));
    }

    // Mode: Find (1-9)
    setupFindMode() {
        const target = this.randomNumberForMode('find');
        this.correctAnswer = target;
        document.getElementById('target-number').textContent = target;

        const options = document.getElementById('find-options');
        options.innerHTML = '';
        this.setCoach('find', target <= 5 ? 'Schau genau hin.' : 'Die Zahl steht auf einem der grossen Knoepfe.');
        this.generateOptions(options, target, 4, this.getNumberLimit('find'));
    }

    // Mode: Comparison
    setupComparisonMode() {
        // Ensure distinct values
        let left = this.randomNumberForMode('comparison');
        let right;
        do { right = this.randomNumberForMode('comparison'); } while (right === left);

        this.correctAnswer = left > right ? 'left' : 'right';

        const leftBox = document.getElementById('compare-left');
        const rightBox = document.getElementById('compare-right');

        this.fillBox(leftBox, left);
        this.fillBox(rightBox, right);
        this.setCoach('comparison', 'Welche Gruppe sieht groesser aus?');
    }

    fillBox(box, count) {
        box.innerHTML = ''; // Clear previous content
        box.style.borderColor = '';
        const animalImg = this.animals[Math.floor(Math.random() * this.animals.length)];

        for (let i = 0; i < count; i++) {
            const img = document.createElement('img');
            img.src = animalImg;
            img.className = 'animal-item';
            const animalSize = count > 3 ? 44 : 64;
            img.style.width = `${animalSize}px`;
            img.style.height = `${animalSize}px`;
            box.appendChild(img);
        }
    }

    checkComparison(side) {
        if (this.isProcessing) return;
        this.isProcessing = true;

        // Visual feedback on selection
        const selectedBox = document.getElementById(`compare-${side}`);

        if (side === this.correctAnswer) {
            selectedBox.style.borderColor = 'var(--success)';
            this.handleSuccess();
        } else {
            selectedBox.classList.add('shake');
            selectedBox.style.borderColor = 'var(--danger)';
            this.handleError();
            this.setCoach('comparison', 'Fast! Versuch die andere Seite.');
            setTimeout(() => {
                selectedBox.classList.remove('shake');
                selectedBox.style.borderColor = '';
                this.isProcessing = false;
            }, 700);
        }
    }

    // Mode: Memory
    setupMemoryMode() {
        const grid = document.getElementById('memory-grid');
        grid.innerHTML = '';
        const pairsCount = this.roundsPlayed < 3 ? 2 : 3;
        this.memoryState = { flipped: [], locked: false, pairs: 0, totalPairs: pairsCount };
        grid.dataset.pairs = pairsCount;

        const usedValues = [];

        while (usedValues.length < pairsCount) {
            let val = Math.floor(Math.random() * 5) + 1;
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

                if (this.memoryState.pairs === this.memoryState.totalPairs) {
                    this.handleLevelComplete(); // Memory full level complete
                }
            }, 1000);
        } else {
            this.audio.playError();
            this.setCoach('memory', 'Das war fast. Schau noch einmal.');
            setTimeout(() => {
                first.card.classList.remove('flipped');
                second.card.classList.remove('flipped');
                this.memoryState.flipped = [];
                this.memoryState.locked = false;
            }, 1000);
        }
    }

    // --- Helpers ---

    getNumberLimit(mode) {
        if (mode === 'comparison') return 5;
        if (this.roundsPlayed < 5) return 5;
        if (this.roundsPlayed < 10) return 7;
        return 9;
    }

    randomNumberForMode(mode) {
        return Math.floor(Math.random() * this.getNumberLimit(mode)) + 1;
    }

    setCoach(mode, text) {
        const coach = document.getElementById(`${mode}-coach`);
        if (coach) coach.textContent = text;
    }

    generateOptions(container, correct, count, maxNumber = 9) {
        const opts = [correct];
        while (opts.length < count) {
            const low = Math.max(1, correct - 2);
            const high = Math.min(maxNumber, correct + 2);
            let r = Math.floor(Math.random() * (high - low + 1)) + low;
            if (opts.includes(r)) r = Math.floor(Math.random() * maxNumber) + 1;
            if (!opts.includes(r)) opts.push(r);
        }
        opts.sort((a, b) => a - b);

        opts.forEach(val => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.textContent = val;
            btn.setAttribute('aria-label', `Antwort ${val}`);
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
            btnElement.style.background = '#FFE8A3';
            btnElement.style.color = 'var(--text-main)';
            btnElement.classList.add('shake');
            this.setCoach(this.currentMode, 'Fast! Versuch noch einmal.');
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
        this.roundsPlayed++; // Count this round
        this.ui.scoreValue.textContent = this.score;

        // Save to DB
        if (this.currentUser) {
            this.db.updateScore(this.currentUser.id, 10);
        }

        // Visual Confetti
        confetti({
            particleCount: 60,
            spread: 70,
            origin: { y: 0.6 }
        });

        this.showFeedback(true);
    }

    handleLevelComplete() {
        // Special handling for memory game completion
        this.score += 20; // Bonus
        this.roundsPlayed++; // Count this round (memory game)
        this.ui.scoreValue.textContent = this.score;
        if (this.currentUser) {
            this.db.updateScore(this.currentUser.id, 20);
        }
        confetti({ particleCount: 90, spread: 100 });
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

        const msg = this.successMessages[Math.floor(Math.random() * this.successMessages.length)];
        this.ui.feedbackEmoji.textContent = '🎉';
        this.ui.feedbackMessage.textContent = msg;
        this.ui.feedbackOverlay.classList.remove('hidden');
        this.ui.feedbackOverlay.classList.add('visible');

        setTimeout(() => {
            this.ui.feedbackOverlay.classList.remove('visible');
            this.ui.feedbackOverlay.classList.add('hidden');
            this.nextLevel();
        }, 1000);
    }
}

// Start Game
const game = new NumberSafari();
