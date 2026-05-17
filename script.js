const originalMoveTo = CanvasRenderingContext2D.prototype.moveTo;
CanvasRenderingContext2D.prototype.moveTo = function (x, y) {
    this._lastX = x;
    this._lastY = y;
    originalMoveTo.call(this, x, y);
};

const originalStroke = CanvasRenderingContext2D.prototype.stroke;
CanvasRenderingContext2D.prototype.stroke = function () {
    if (document.body.classList.contains('academic-theme')) {
        let currentAlpha = 0.5;
        if (typeof this.strokeStyle === 'string' && this.strokeStyle.startsWith('rgba')) {
            let parts = this.strokeStyle.split(',');
            if (parts.length === 4) currentAlpha = parseFloat(parts[3]);
        }

        let r = 13, g = 110, b = 253; // Default Blue
        if (document.body.classList.contains('state-correct')) { r = 25; g = 135; b = 84; } // Green
        else if (document.body.classList.contains('state-incorrect')) { r = 220; g = 53; b = 69; } // Red
        else if (document.body.classList.contains('state-hard')) { r = 255; g = 136; b = 0; } // Orange
        else if (document.body.classList.contains('state-finished') || document.body.classList.contains('state-summary')) { r = 111; g = 66; b = 193; } // Purple

        // STRICTLY preserve the engine's original alpha calculation
        this.strokeStyle = `rgba(${r}, ${g}, ${b}, ${currentAlpha})`;
    } else if (window.pJS_rainbow_lines && this._lastX !== undefined) {
        let hue = Math.floor((this._lastX * 0.5 + this._lastY * 0.5 + Date.now() * 0.05) % 360);
        let currentAlpha = 0.5;
        if (typeof this.strokeStyle === 'string' && this.strokeStyle.startsWith('rgba')) {
            let parts = this.strokeStyle.split(',');
            if (parts.length === 4) currentAlpha = parseFloat(parts[3]);
        }
        this.strokeStyle = `hsla(${hue}, 100%, 60%, ${currentAlpha})`;
    }
    originalStroke.call(this);
};

const originalFill = CanvasRenderingContext2D.prototype.fill;
CanvasRenderingContext2D.prototype.fill = function (rule) {
    if (document.body.classList.contains('academic-theme')) {
        let currentAlpha = 1.0;
        if (typeof this.fillStyle === 'string' && this.fillStyle.startsWith('rgba')) {
            let parts = this.fillStyle.split(',');
            if (parts.length === 4) currentAlpha = parseFloat(parts[3]);
        }

        let r = 13, g = 110, b = 253;
        if (document.body.classList.contains('state-correct')) { r = 25; g = 135; b = 84; }
        else if (document.body.classList.contains('state-incorrect')) { r = 220; g = 53; b = 69; }
        else if (document.body.classList.contains('state-hard')) { r = 255; g = 136; b = 0; }
        else if (document.body.classList.contains('state-finished') || document.body.classList.contains('state-summary')) { r = 111; g = 66; b = 193; }

        this.fillStyle = `rgba(${r}, ${g}, ${b}, ${currentAlpha})`;
    }
    if (rule) originalFill.call(this, rule);
    else originalFill.call(this);
};

// State Variables
let currentQuizData = [];
let currentQuestionIndex = 0;
let answeredQuestionsCount = 0;
let score = 0;
let wrongAnswers = [];
let isRandomQuestions = false;
let isShuffleOptions = false;
let isSoundEnabled = true;
let activeQuizFile = '';
let currentTheme = 'academic';
let answerAudio = null;

// Gamification Assets
const soundsCorrect = ['assets/correct.mp3', 'assets/cheering.mp3', 'assets/yippeeeeeeeeeeeeee.mp3'];
const soundsWrong = ['assets/bruh.mp3', 'assets/fahhh.mp3', 'assets/vine-boom.mp3', 'assets/wrong-answer-sound-effect.mp3'];
const gifsCorrect = ['assets/cinema.gif', 'assets/squid-game-squid-game-2.gif'];
const gifsWrong = ['assets/brawl-stars-thumbs-down.gif', 'assets/clown-clown-bs.gif'];

// State Persistence
const SAVED_STATE_KEY = "quiz_saved_state";

function saveState() {
    if (!activeQuizFile) return;
    const stateObj = {
        activeQuizFile,
        isRandomQuestions,
        isShuffleOptions,
        isSoundEnabled,
        studentInfoText: studentInfo.textContent,
        currentQuizData,
        currentQuestionIndex,
        answeredQuestionsCount,
        score,
        wrongAnswers
    };
    localStorage.setItem(SAVED_STATE_KEY, JSON.stringify(stateObj));
}

function loadState() {
    const saved = localStorage.getItem(SAVED_STATE_KEY);
    if (saved) {
        try {
            const stateObj = JSON.parse(saved);
            activeQuizFile = stateObj.activeQuizFile;
            isRandomQuestions = stateObj.isRandomQuestions;
            isShuffleOptions = stateObj.isShuffleOptions;
            isSoundEnabled = stateObj.isSoundEnabled !== undefined ? stateObj.isSoundEnabled : true;
            studentInfo.textContent = stateObj.studentInfoText;
            currentQuizData = stateObj.currentQuizData;
            currentQuestionIndex = stateObj.currentQuestionIndex;
            answeredQuestionsCount = stateObj.answeredQuestionsCount;
            score = stateObj.score;
            wrongAnswers = stateObj.wrongAnswers;

            if (isRandomQuestions) document.getElementById('chk-random-questions').checked = true;
            if (isShuffleOptions) document.getElementById('chk-shuffle-options').checked = true;
            document.getElementById('chk-enable-sounds').checked = isSoundEnabled;

            return true;
        } catch (e) {
            console.error("Failed to parse saved state", e);
            clearState();
        }
    }
    return false;
}

function clearState() {
    localStorage.removeItem(SAVED_STATE_KEY);
    activeQuizFile = '';
}

// DOM Elements
const landingScreen = document.getElementById('landing-screen');
const quizSelectionScreen = document.getElementById('home-screen');
const quizScreen = document.getElementById('quiz-screen');
const resultScreen = document.getElementById('result-screen');

// Routing Buttons
const btnGotoQuizzes = document.getElementById('btn-goto-quizzes');
const btnBackToLanding = document.getElementById('btn-back-to-landing');

const btnGotoMock = document.getElementById('btn-goto-mock');
const mockSelectionScreen = document.getElementById('mock-selection-screen');
const btnBackToLandingMock = document.getElementById('btn-back-to-landing-mock');
const chkMockRandom = document.getElementById('chk-mock-random');
const chkMockShuffle = document.getElementById('chk-mock-shuffle');
const chkMockSounds = document.getElementById('chk-mock-sounds');
const btnStartMock = document.querySelector('.btn-start-mock');

const newQuizzesScreen = document.getElementById('new-quizzes-screen');
const btnGotoNewQuizzes = document.getElementById('btn-goto-new-quizzes');
const btnBackToLandingNew = document.getElementById('btn-back-to-landing-new');
const chkNewRandom = document.getElementById('chk-new-random');
const chkNewShuffle = document.getElementById('chk-new-shuffle');
const chkNewSounds = document.getElementById('chk-new-sounds');

const chkRandomQuestions = document.getElementById('chk-random-questions');
const chkShuffleOptions = document.getElementById('chk-shuffle-options');
const startButtons = document.querySelectorAll('.quiz-card .btn');

const questionProgress = document.getElementById('question-progress');
const scoreDisplay = document.getElementById('score-display');
const hardBadge = document.getElementById('hard-badge');
const topicBadge = document.getElementById('topic-badge');
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const explanationContainer = document.getElementById('explanation-container');
const explanationAr = document.getElementById('explanation-ar');
const explanationEn = document.getElementById('explanation-en');
const nextBtn = document.getElementById('next-btn');

// Modal & Stop Buttons
const stopQuizBtn = document.getElementById('stop-quiz-btn');
const stopModal = document.getElementById('stop-modal');
const modalConfirmBtn = document.getElementById('modal-confirm');
const modalCancelBtn = document.getElementById('modal-cancel');

// Result Screen
const finalScoreText = document.getElementById('final-score-text');
const wrongAnswersList = document.getElementById('wrong-answers-list');
const homeBtn = document.getElementById('home-btn');
const particlesContainer = document.getElementById('particles-js');
const studentInfo = document.querySelector('.student-info');

// Theme Elements
const themeAcademicBtn = document.getElementById('theme-academic');
const themeRgbBtn = document.getElementById('theme-rgb');
const themeRipple = document.getElementById('theme-ripple');

// Routing Event Listeners
btnGotoQuizzes.addEventListener('click', () => {
    landingScreen.classList.remove('active-screen');
    quizSelectionScreen.classList.add('active-screen');
});

btnBackToLanding.addEventListener('click', () => {
    quizSelectionScreen.classList.remove('active-screen');
    landingScreen.classList.add('active-screen');
});

if (btnGotoMock) {
    btnGotoMock.addEventListener('click', () => {
        landingScreen.classList.remove('active-screen');
        mockSelectionScreen.classList.add('active-screen');
    });
}

if (btnBackToLandingMock) {
    btnBackToLandingMock.addEventListener('click', () => {
        mockSelectionScreen.classList.remove('active-screen');
        landingScreen.classList.add('active-screen');
    });
}

btnGotoNewQuizzes.addEventListener('click', () => {
    landingScreen.classList.remove('active-screen');
    newQuizzesScreen.classList.add('active-screen');
});

btnBackToLandingNew.addEventListener('click', () => {
    newQuizzesScreen.classList.remove('active-screen');
    landingScreen.classList.add('active-screen');
});

// Theme Logic
function setTheme(theme) {
    if (currentTheme === theme) return;

    themeRipple.classList.remove('hidden', 'animate-to-academic', 'animate-to-rgb');
    void themeRipple.offsetWidth; // Force reflow

    if (theme === 'academic') {
        themeRipple.classList.add('animate-to-academic');
        setTimeout(() => {
            document.body.classList.add('academic-theme');

            // Re-init particles state based on quiz situation
            const currentMode = document.body.classList.contains('state-hard') ? 'hard' :
                document.body.classList.contains('state-correct') ? 'success' :
                    document.body.classList.contains('state-incorrect') ? 'error' : 'normal';
            initParticles(currentMode);

            themeAcademicBtn.classList.add('active');
            themeRgbBtn.classList.remove('active');
        }, 400); // apply visual swap mid-ripple
        setTimeout(() => { themeRipple.classList.add('hidden'); }, 850);
    } else {
        themeRipple.classList.add('animate-to-rgb');
        setTimeout(() => {
            document.body.classList.remove('academic-theme');

            const currentMode = document.body.classList.contains('state-hard') ? 'hard' :
                document.body.classList.contains('state-correct') ? 'success' :
                    document.body.classList.contains('state-incorrect') ? 'error' : 'normal';
            initParticles(currentMode);

            themeRgbBtn.classList.add('active');
            themeAcademicBtn.classList.remove('active');
        }, 400); // apply visual swap mid-ripple
        setTimeout(() => { themeRipple.classList.add('hidden'); }, 850);
    }
    currentTheme = theme;
}

themeAcademicBtn.addEventListener('click', () => setTheme('academic'));
themeRgbBtn.addEventListener('click', () => setTheme('rgb'));


// Start Particles
const particleConfig = {
    particles: {
        number: { value: 80, density: { enable: true, value_area: 800 } },
        color: { value: ["#ff0000", "#ff7f00", "#ffff00", "#00ff00", "#0000ff", "#4b0082", "#8b00ff"] },
        shape: { type: "circle", stroke: { width: 0, color: "#000000" }, polygon: { nb_sides: 5 } },
        opacity: { value: 0.8, random: false },
        size: { value: 4, random: true },
        line_linked: { enable: true, distance: 150, color: "#ffffff", opacity: 0.4, width: 2 },
        move: { enable: true, speed: 3, direction: "none", random: false, straight: false, out_mode: "out", bounce: false }
    },
    interactivity: {
        detect_on: "canvas",
        events: { onhover: { enable: true, mode: "grab" }, onclick: { enable: true, mode: "push" }, resize: true },
        modes: { grab: { distance: 180, line_linked: { opacity: 1 } }, push: { particles_nb: 4 }, remove: { particles_nb: 2 } }
    },
    retina_detect: true
};

function updateLiveNetworkState(state) {
    if (!window.pJSDom || !window.pJSDom.length) return;
    let pJS = window.pJSDom[0].pJS;
    
    if (document.body.classList.contains('academic-theme')) {
        pJS.particles.move.enable = true;
        pJS.particles.move.speed = 0;
        window.pJS_rainbow_lines = false;
    } else {
        if (state === 'success') {
            window.pJS_rainbow_lines = false;
            pJS.particles.color.value = "#00ff00";
            pJS.particles.line_linked.color = "#00ff00";
        } else if (state === 'error') {
            window.pJS_rainbow_lines = false;
            pJS.particles.color.value = "#ff0000";
            pJS.particles.line_linked.color = "#ff0000";
        } else if (state === 'hard') {
            window.pJS_rainbow_lines = false;
            pJS.particles.color.value = "#FF4500";
            pJS.particles.line_linked.color = "#FF4500";
        } else if (state === 'finished') {
            window.pJS_rainbow_lines = false;
            pJS.particles.color.value = "#9b59b6";
            pJS.particles.line_linked.color = "#9b59b6";
        } else {
            window.pJS_rainbow_lines = true;
            pJS.particles.color.value = ["#ff0000", "#ff7f00", "#ffff00", "#00ff00", "#0000ff", "#4b0082", "#8b00ff"];
            pJS.particles.line_linked.color = "#ffffff";
        }
        pJS.fn.particlesRefresh();
    }
}

function updateLiveNetworkState(state) {
    if (!window.pJSDom || !window.pJSDom.length) return;
    let pJS = window.pJSDom[0].pJS;
    
    if (document.body.classList.contains('academic-theme')) {
        pJS.particles.move.enable = true;
        pJS.particles.move.speed = 0;
        window.pJS_rainbow_lines = false;
    } else {
        if (state === 'success') {
            window.pJS_rainbow_lines = false;
            pJS.particles.color.value = "#00ff00";
            pJS.particles.line_linked.color = "#00ff00";
        } else if (state === 'error') {
            window.pJS_rainbow_lines = false;
            pJS.particles.color.value = "#ff0000";
            pJS.particles.line_linked.color = "#ff0000";
        } else if (state === 'hard') {
            window.pJS_rainbow_lines = false;
            pJS.particles.color.value = "#FF4500";
            pJS.particles.line_linked.color = "#FF4500";
        } else if (state === 'finished') {
            window.pJS_rainbow_lines = false;
            pJS.particles.color.value = "#9b59b6";
            pJS.particles.line_linked.color = "#9b59b6";
        } else {
            window.pJS_rainbow_lines = true;
            pJS.particles.color.value = ["#ff0000", "#ff7f00", "#ffff00", "#00ff00", "#0000ff", "#4b0082", "#8b00ff"];
            pJS.particles.line_linked.color = "#ffffff";
        }
    }
    pJS.fn.particlesRefresh();
}

function initParticles(colorType = 'normal') {
    let config = JSON.parse(JSON.stringify(particleConfig));
    particlesContainer.classList.remove('rainbow-particles');

    let acColor = "#0D6EFD";
    if (colorType === 'success') acColor = "#28a745";
    else if (colorType === 'error') acColor = "#dc3545";
    else if (colorType === 'hard') acColor = "#fd7e14";
    else if (colorType === 'finished') acColor = "#6f42c1";

    // Academic Mode Overrides
    if (document.body.classList.contains('academic-theme')) {
        config.particles.move.enable = true;
        config.particles.move.speed = 0;
        config.particles.color.value = acColor;
        config.particles.line_linked.color = acColor;
        window.pJS_rainbow_lines = false;
    } else {
        // RGB Mode
        if (colorType === 'hard') {
            window.pJS_rainbow_lines = false;
            config.particles.color.value = "#FF4500";
            config.particles.line_linked.color = "#FF4500";
        } else if (colorType === 'success') {
            window.pJS_rainbow_lines = false;
            config.particles.color.value = "#00ff00";
            config.particles.line_linked.color = "#00ff00";
        } else if (colorType === 'error') {
            window.pJS_rainbow_lines = false;
            config.particles.color.value = "#ff0000";
            config.particles.line_linked.color = "#ff0000";
        } else if (colorType === 'finished') {
            window.pJS_rainbow_lines = false;
            config.particles.color.value = "#9b59b6";
            config.particles.line_linked.color = "#9b59b6";
        } else {
            // Rainbow
            window.pJS_rainbow_lines = true;
            config.particles.color.value = ["#ff0000", "#ff7f00", "#ffff00", "#00ff00", "#0000ff", "#4b0082", "#8b00ff"];
            config.particles.line_linked.color = "#ffffff";
            particlesContainer.classList.add('rainbow-particles');
        }
    }

    if (window.pJSDom && window.pJSDom.length > 0) {
        window.pJSDom[0].pJS.fn.vendors.destroypJS();
        window.pJSDom = [];
    }

    particlesJS('particles-js', config);
}

document.addEventListener('DOMContentLoaded', () => {
    if (loadState()) {
        landingScreen.classList.remove('active-screen');
        quizSelectionScreen.classList.remove('active-screen');
        quizScreen.classList.add('active-screen');
        renderQuestion();
    } else {
        initParticles('normal');
    }
});

// Event Listeners
startButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const file = btn.dataset.quiz;
        // Determine which screen the button belongs to and use its specific settings
        if (btn.closest('#new-quizzes-screen')) {
            isRandomQuestions = chkNewRandom.checked;
            isShuffleOptions = chkNewShuffle.checked;
            isSoundEnabled = chkNewSounds.checked;
        } else {
            isRandomQuestions = chkRandomQuestions.checked;
            isShuffleOptions = chkShuffleOptions.checked;
            isSoundEnabled = document.getElementById('chk-enable-sounds').checked;
        }

        if (file === 'quiz5.json') studentInfo.textContent = 'اختبار جامعة النهرين - الجزء الأول';
        else if (file === 'quiz6.json') studentInfo.textContent = 'اختبار جامعة النهرين - الجزء الثاني';
        else if (file === 'quiz1.json') studentInfo.textContent = 'اختبار دكتور عز الدين';
        else if (file === 'quiz2.json') studentInfo.textContent = 'اختبار جامعة الزهراء (group A)';
        else if (file === 'quiz3.json') studentInfo.textContent = 'اختبار جامعة الزهراء (group B)';
        else if (file === 't1.json') studentInfo.textContent = 'Introduction to Databases and DBMS';
        else if (file === 't2.json') studentInfo.textContent = 'Database Architecture & Data Models';
        else if (file === 't3.json') studentInfo.textContent = 'ER Modelling';
        else if (file === 't4.json') studentInfo.textContent = 'Relational Model & Schema Design';
        else if (file === 't5.json') studentInfo.textContent = 'Relational Algebra & Query Fundamentals';
        else if (file === 't6.json') studentInfo.textContent = 'SQL Basics (DDL & DML)';
        else if (file === 't7.json') studentInfo.textContent = 'Advanced SQL & Design';
        else if (file === 't8.json') studentInfo.textContent = 'Advanced DB Concepts';

        loadQuiz(file);
    });
});

if (btnStartMock) {
    btnStartMock.addEventListener('click', () => {
        const file = btnStartMock.dataset.quiz;
        isRandomQuestions = chkMockRandom.checked;
        isShuffleOptions = chkMockShuffle.checked;
        isSoundEnabled = chkMockSounds.checked;

        studentInfo.textContent = 'الامتحان الوزاري التجريبي';

        loadQuiz(file);
    });
}

nextBtn.addEventListener('click', () => {
    currentQuestionIndex++;
    if (currentQuestionIndex < currentQuizData.length) {
        saveState();
        renderQuestion();
    } else {
        showResults();
    }
});

// Modal Logic
stopQuizBtn.addEventListener('click', () => {
    stopModal.classList.remove('hidden');
});

modalCancelBtn.addEventListener('click', () => {
    stopModal.classList.add('hidden');
});

modalConfirmBtn.addEventListener('click', () => {
    stopModal.classList.add('hidden');
    clearState();
    showResults();
});


homeBtn.addEventListener('click', () => {
    clearState();
    resultScreen.classList.remove('active-screen');
    landingScreen.classList.add('active-screen');

    document.body.classList.remove('vignette-active', 'flash-success', 'flash-error', 'state-correct', 'state-incorrect', 'state-hard', 'state-finished');
    updateLiveNetworkState('normal');
    studentInfo.textContent = 'اعداد الطالب: طه احمد غازي';
});

function shuffleArray(array) {
    let newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
}

// Load Quiz Data
async function loadQuiz(filename) {
    try {
        const response = await fetch(filename + "?v=" + new Date().getTime());
        let data = await response.json();

        if (isRandomQuestions) {
            data = shuffleArray(data);
        }

        activeQuizFile = filename;
        currentQuizData = data;
        currentQuestionIndex = 0;
        score = 0;
        answeredQuestionsCount = 0;
        wrongAnswers = [];

        quizSelectionScreen.classList.remove('active-screen');
        if (newQuizzesScreen) newQuizzesScreen.classList.remove('active-screen');
        if (mockSelectionScreen) mockSelectionScreen.classList.remove('active-screen');
        quizScreen.classList.add('active-screen');

        saveState();
        renderQuestion();
    } catch (err) {
        console.error("Failed to load quiz", err);
        alert("فشل تحميل الاختبار. تأكد من وجود ملف " + filename + " وأن محتواه ليس فارغاً بصيغة JSON.");
    }
}

// Render Question
function renderQuestion() {
    const qData = currentQuizData[currentQuestionIndex];

    nextBtn.classList.add('hidden');
    explanationContainer.classList.add('hidden');
    optionsContainer.innerHTML = '';
    questionProgress.textContent = `السؤال ${currentQuestionIndex + 1} / ${currentQuizData.length}`;
    scoreDisplay.textContent = `النتيجة: ${score}`;

    document.body.classList.remove('flash-success', 'flash-error', 'state-correct', 'state-incorrect', 'state-hard');

    if (qData.topic) {
        topicBadge.textContent = qData.topic;
        topicBadge.classList.remove('hidden');
    } else {
        topicBadge.classList.add('hidden');
    }

    if (activeQuizFile === 'superimportantexam.json') {
        hardBadge.classList.add('hidden');
        document.body.classList.add('vignette-active', 'state-hard');
        setTimeout(() => initParticles('hard'), 50);
    } else if (qData.difficulty === 'hard') {
        hardBadge.classList.remove('hidden');
        document.body.classList.add('vignette-active', 'state-hard');
        setTimeout(() => initParticles('hard'), 50);
    } else {
        hardBadge.classList.add('hidden');
        document.body.classList.remove('vignette-active');
        updateLiveNetworkState('normal');
    }

    questionText.setAttribute("dir", "auto");
    questionText.textContent = qData.question;

    let optionsToRender = [...qData.options];
    if (isShuffleOptions) {
        optionsToRender = shuffleArray(optionsToRender);
    }

    optionsToRender.forEach((opt, index) => {
        const btn = document.createElement('button');
        btn.classList.add('option-btn');
        btn.setAttribute("dir", "auto");
        btn.dataset.option = opt;

        const letter = String.fromCharCode(65 + index);
        btn.innerHTML = `<span class="opt-letter">${letter}. </span> ${opt}`;

        const arabicRegex = /[\u0600-\u06FF]/;
        if (arabicRegex.test(opt)) {
            btn.classList.add('arb');
        }

        btn.addEventListener('click', () => handleAnswer(opt, qData, btn));
        optionsContainer.appendChild(btn);
    });
}

function playRandomSound(arr) {
    if (!isSoundEnabled) return;
    const src = arr[Math.floor(Math.random() * arr.length)];
    const audioNode = new Audio(src);
    audioNode.cloneNode(true).play().catch(e => console.log('Audio overlap ignored', e));
}

function showGamification(isCorrect) {
    const overlay = document.getElementById('gamification-overlay');
    const content = document.getElementById('gamification-content');
    overlay.classList.remove('hidden');

    let html = '';
    let rand = Math.random();

    if (isCorrect) {
        playRandomSound(soundsCorrect);
        if (rand < 0.8) {
            html = '<div class="giant-check">✅</div>';
        } else {
            const gif = gifsCorrect[Math.floor(Math.random() * gifsCorrect.length)];
            html = `<img src="${gif}" class="gamification-gif">`;
        }
    } else {
        playRandomSound(soundsWrong);
        if (rand < 0.8) {
            html = '<div class="giant-cross">❌</div>';
        } else {
            const gif = gifsWrong[Math.floor(Math.random() * gifsWrong.length)];
            html = `<img src="${gif}" class="gamification-gif">`;
        }
    }

    content.innerHTML = html;

    setTimeout(() => {
        overlay.classList.add('hidden');
        content.innerHTML = '';
    }, 2000);
}

// Handle Answer Logic
function handleAnswer(selectedOpt, qData, btnSelected) {
    const allBtns = document.querySelectorAll('.option-btn');
    allBtns.forEach(b => b.disabled = true);

    answeredQuestionsCount++;
    const correctAns = qData.correct_answer || qData.answer;
    const isCorrect = (selectedOpt.trim() === correctAns.trim());

    document.body.classList.remove('flash-success', 'flash-error', 'state-correct', 'state-incorrect');
    void document.body.offsetWidth; // Force Reflow

    if (isCorrect) {
        btnSelected.classList.add('correct');
        score++;
        scoreDisplay.textContent = `النتيجة: ${score}`;
        document.body.classList.add('flash-success', 'state-correct');
        updateLiveNetworkState('success');
        showGamification(true);
    } else {
        btnSelected.classList.add('wrong');

        allBtns.forEach(b => {
            if (b.dataset.option.trim() === correctAns.trim()) {
                b.classList.add('correct');
            }
        });

        wrongAnswers.push({
            question: qData.question,
            correct: correctAns,
            selected: selectedOpt
        });

        document.body.classList.add('flash-error', 'state-incorrect');
        updateLiveNetworkState('error');
        showGamification(false);
    }

    const expAr = qData.explanation_ar || qData.explanation;
    const expEn = qData.explanation_en || "";

    if (expAr || expEn) {
        explanationAr.innerHTML = (expAr || "لا يوجد شرح بالعربية.").replace(/\n/g, '<br>');
        explanationEn.innerHTML = (expEn || "").replace(/\n/g, '<br>');
        explanationContainer.classList.remove('hidden');
    }

    nextBtn.classList.remove('hidden');
}

// Show Results
function showResults() {
    clearState();
    quizScreen.classList.remove('active-screen');

    const totalAttempted = answeredQuestionsCount;

    if (score === 0 && totalAttempted > 0 && isSoundEnabled) {
        // Patrick Zero Score Logic
        const zeroOverlay = document.getElementById('zero-score-overlay');
        zeroOverlay.classList.remove('hidden', 'fade-out');

        let patrickAudio = new Audio('assets/patricksong.mp3');
        patrickAudio.play().catch(e => console.log('Audio disabled until interacted', e));
        setTimeout(() => { patrickAudio.pause(); patrickAudio.currentTime = 0; }, 10000); // CHANGED TO 10 SECONDS

        setTimeout(() => {
            zeroOverlay.classList.add('fade-out');
            setTimeout(() => {
                zeroOverlay.classList.add('hidden');
                displayFinalResults(totalAttempted);
            }, 1000);
        }, 5000);

    } else if (score === totalAttempted && totalAttempted > 0 && isSoundEnabled) {
        // Aizen Perfect Score Logic
        const perfectOverlay = document.getElementById('perfect-score-overlay');
        const perfectText = document.getElementById('perfect-text');
        perfectText.textContent = `نتيجتك كاملة: ${score} من ${totalAttempted}!`;
        perfectOverlay.classList.remove('hidden', 'fade-out');

        let aizenAudio = null;
        if (isSoundEnabled) {
            aizenAudio = new Audio('assets/aizen-sosuke-soul-society.mp3');
            aizenAudio.play().catch(e => console.log('Audio disabled until interacted', e));
        }

        setTimeout(() => {
            if (aizenAudio) { aizenAudio.pause(); aizenAudio.currentTime = 0; }
            perfectOverlay.classList.add('fade-out');
            setTimeout(() => {
                perfectOverlay.classList.add('hidden');
                displayFinalResults(totalAttempted);
            }, 1000);
        }, 10000); // EXTENDED TO 10 SECONDS

    } else {
        displayFinalResults(totalAttempted);
    }
}

function displayFinalResults(totalAttempted) {
    resultScreen.classList.add('active-screen');
    document.body.classList.remove('vignette-active', 'flash-success', 'flash-error', 'state-correct', 'state-incorrect', 'state-hard');

    document.body.classList.add('state-finished');
    updateLiveNetworkState('finished');

    if (totalAttempted === 0) {
        finalScoreText.textContent = `لم تجب على أي سؤال.`;
    } else {
        finalScoreText.textContent = `النتيجة النهائية: ${score} من ${totalAttempted}`;
    }

    wrongAnswersList.innerHTML = '';

    if (wrongAnswers.length === 0 && totalAttempted > 0) {
        wrongAnswersList.innerHTML = `
            <p style="text-align:center; color: var(--success-color); font-size: 1.5rem; font-weight: bold; animation: text-rainbow 5s infinite;">عاش! أبدعت وأجبت على جميع الأسئلة بصورة صحيحة.</p>
            <img src="assets/aizen-aizen-sosuke.gif" alt="Aizen Perfect" class="result-aizen-gif">
        `;
    } else if (wrongAnswers.length > 0) {
        wrongAnswers.forEach(wa => {
            const div = document.createElement('div');
            div.classList.add('wrong-item');

            div.innerHTML = `
                <div class="q-text">${wa.question}</div>
                <div>إجابتك: <span class="user-ans">${wa.selected}</span></div>
                <div>الإجابة الصحيحة: <span class="corr-ans">${wa.correct}</span></div>
            `;
            wrongAnswersList.appendChild(div);
        });
    }
}

