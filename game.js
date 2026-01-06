class NumberSafari {
    constructor() {
        this.score = 0;
        this.currentMode = null;
        this.correctAnswer = null;
        this.currentUser = null;
        this.profiles = JSON.parse(localStorage.getItem('safari_profiles') || '[]');

        this.animals = [
            'safari_lion_1767717591178.png',
            'safari_elephant_1767717606982.png',
            'safari_giraffe_1767717621407.png'
        ];

        this.init();
    }

    init() {
        this.scoreElement = document.getElementById('score');
        this.backButton = document.getElementById('back-button');
        this.logoutButton = document.getElementById('logout-button');
        this.overlay = document.getElementById('feedback-overlay');
        this.feedbackEmoji = document.getElementById('feedback-emoji');
        this.feedbackMessage = document.getElementById('feedback-message');

        this.showProfileScreen();
    }

    // --- Profile Management ---

    showProfileScreen() {
        this.hideAllScreens();
        document.getElementById('profile-screen').classList.add('active');
        this.renderProfiles();
        this.updateHeader(false);
    }

    renderProfiles() {
        const grid = document.getElementById('profile-grid');
        grid.innerHTML = '';
        this.profiles.forEach(p => {
            const card = document.createElement('div');
            card.className = 'profile-card';
            card.onclick = () => this.login(p);
            card.innerHTML = `
                <img src="${p.avatar}" class="profile-avatar">
                <div class="profile-name">${p.name}</div>
            `;
            grid.appendChild(card);
        });
    }

    showCreateProfile() {
        this.hideAllScreens();
        document.getElementById('create-profile-screen').classList.add('active');
        const avatarGrid = document.getElementById('avatar-options');
        avatarGrid.innerHTML = '';
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
            };
            avatarGrid.appendChild(img);
        });
    }

    createProfile() {
        const nameInput = document.getElementById('new-profile-name');
        const name = nameInput.value.trim();
        if (!name) return alert('Bitte gib einen Namen ein!');

        const newProfile = {
            id: Date.now(),
            name: name,
            avatar: this.selectedAvatar,
            score: 0
        };

        this.profiles.push(newProfile);
        this.saveProfiles();
        nameInput.value = '';
        this.showProfileScreen();
    }

    login(profile) {
        this.currentUser = profile;
        this.score = profile.score;
        this.scoreElement.textContent = this.score;
        this.showStartScreen();
        this.updateHeader(true);
    }

    logout() {
        this.currentUser = null;
        this.showProfileScreen();
    }

    saveProfiles() {
        localStorage.setItem('safari_profiles', JSON.stringify(this.profiles));
    }

    updateHeader(showInfo) {
        const userInfo = document.getElementById('user-info');
        const scoreContainer = document.getElementById('score-container');
        if (showInfo && this.currentUser) {
            userInfo.classList.remove('hidden');
            scoreContainer.classList.remove('hidden');
            document.getElementById('current-user-name').textContent = this.currentUser.name;
            this.logoutButton.classList.remove('hidden');
        } else {
            userInfo.classList.add('hidden');
            scoreContainer.classList.add('hidden');
            this.logoutButton.classList.add('hidden');
        }
    }

    // --- Ranking ---

    showRankings() {
        this.hideAllScreens();
        document.getElementById('ranking-screen').classList.add('active');
        const list = document.getElementById('ranking-list');
        list.innerHTML = '';

        const sorted = [...this.profiles].sort((a, b) => b.score - a.score);
        sorted.forEach((p, i) => {
            const item = document.createElement('div');
            item.className = 'ranking-item';
            item.innerHTML = `
                <span class="ranking-rank">#${i + 1}</span>
                <span class="ranking-user">${p.name}</span>
                <span class="ranking-score">${p.score} ⭐</span>
            `;
            list.appendChild(item);
        });
    }

    // --- Game Logic ---

    startMode(mode) {
        this.currentMode = mode;
        this.hideAllScreens();
        document.getElementById(`${mode}-screen`).classList.add('active');
        this.backButton.classList.remove('hidden');
        this.logoutButton.classList.add('hidden');
        this.nextQuestion();
    }

    showStartScreen() {
        this.currentMode = null;
        this.hideAllScreens();
        document.getElementById('start-screen').classList.add('active');
        this.backButton.classList.add('hidden');
        if (this.currentUser) this.logoutButton.classList.remove('hidden');
    }

    hideAllScreens() {
        const screens = document.querySelectorAll('.screen');
        screens.forEach(s => s.classList.remove('active'));
    }

    nextQuestion() {
        if (this.currentMode === 'count') {
            this.setupCountMode();
        } else if (this.currentMode === 'find') {
            this.setupFindMode();
        } else if (this.currentMode === 'sequence') {
            this.setupSequenceMode();
        }
    }

    setupCountMode() {
        const count = Math.floor(Math.random() * 10) + 1;
        this.correctAnswer = count;

        const display = document.getElementById('animal-display');
        const optionsArea = document.getElementById('answer-options');
        display.innerHTML = '';
        optionsArea.innerHTML = '';

        for (let i = 0; i < count; i++) {
            const img = document.createElement('img');
            img.src = this.animals[Math.floor(Math.random() * this.animals.length)];
            img.className = 'animal-icon';
            img.style.animationDelay = `${Math.random() * 0.5}s`;
            display.appendChild(img);
        }

        this.generateNumberOptions(optionsArea, count);
    }

    setupFindMode() {
        const target = Math.floor(Math.random() * 10) + 1;
        this.correctAnswer = target;
        document.getElementById('target-number').textContent = target;

        const optionsArea = document.getElementById('find-options');
        optionsArea.innerHTML = '';
        this.generateNumberOptions(optionsArea, target);
    }

    setupSequenceMode() {
        const start = Math.floor(Math.random() * 7) + 1;
        const sequence = [start, start + 1, start + 2, start + 3];
        const missingIndex = Math.floor(Math.random() * 4);
        this.correctAnswer = sequence[missingIndex];

        const display = document.getElementById('sequence-display');
        const optionsArea = document.getElementById('sequence-options');
        display.innerHTML = '';
        optionsArea.innerHTML = '';

        sequence.forEach((num, index) => {
            const div = document.createElement('div');
            div.className = index === missingIndex ? 'seq-item missing' : 'seq-item';
            div.textContent = index === missingIndex ? '?' : num;
            display.appendChild(div);
        });

        this.generateNumberOptions(optionsArea, this.correctAnswer);
    }

    generateNumberOptions(container, correct) {
        let options = [correct];
        while (options.length < 4) {
            let rand = Math.floor(Math.random() * 10) + 1;
            if (!options.includes(rand)) options.push(rand);
        }
        options.sort((a, b) => a - b);

        options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.textContent = opt;
            btn.onclick = () => this.checkAnswer(opt);
            container.appendChild(btn);
        });
    }

    checkAnswer(answer) {
        if (answer === this.correctAnswer) {
            this.showFeedback(true);
        } else {
            this.showFeedback(false);
        }
    }

    showFeedback(isCorrect) {
        this.overlay.classList.add('visible');
        if (isCorrect) {
            this.score++;
            this.scoreElement.textContent = this.score;

            // Update profile score
            if (this.currentUser) {
                const profile = this.profiles.find(p => p.id === this.currentUser.id);
                if (profile) {
                    profile.score = this.score;
                    this.saveProfiles();
                }
            }

            this.feedbackEmoji.textContent = '✅';
            this.feedbackMessage.textContent = 'Richtig! Super gemacht!';
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
            });
        } else {
            this.feedbackEmoji.textContent = '❌';
            this.feedbackMessage.textContent = 'Ohoh, probier es nochmal!';
        }

        setTimeout(() => {
            this.overlay.classList.remove('visible');
            if (isCorrect) this.nextQuestion();
        }, 1500);
    }
}


const game = new NumberSafari();
