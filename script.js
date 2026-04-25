// Canvas Patch for Rainbow Lines
const originalMoveTo = CanvasRenderingContext2D.prototype.moveTo;
CanvasRenderingContext2D.prototype.moveTo = function(x, y) {
    this._lastX = x;
    this._lastY = y;
    originalMoveTo.call(this, x, y);
};

const originalStroke = CanvasRenderingContext2D.prototype.stroke;
CanvasRenderingContext2D.prototype.stroke = function() {
    if (window.pJS_rainbow_lines && this._lastX !== undefined) {
        let hue = Math.floor((this._lastX * 0.5 + this._lastY * 0.5 + Date.now() * 0.05) % 360);
        let currentStyle = this.strokeStyle;
        let alpha = 0.5;
        if(typeof currentStyle === 'string' && currentStyle.startsWith('rgba')) {
            let parts = currentStyle.split(',');
            if(parts.length === 4) alpha = parseFloat(parts[3] || 0.5);
        }
        this.strokeStyle = `hsla(${hue}, 100%, 60%, ${alpha})`;
    }
    originalStroke.call(this);
};

// State Variables
let currentQuizData = [];
let currentQuestionIndex = 0;
let answeredQuestionsCount = 0; // for partial tracking when stopping early
let score = 0;
let wrongAnswers = [];
let isRandomOrder = false;
let activeQuizFile = '';

// State Persistence
const SAVED_STATE_KEY = "quiz_saved_state";

function saveState() {
    if (!activeQuizFile) return;
    const stateObj = {
        activeQuizFile,
        isRandomOrder,
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
            isRandomOrder = stateObj.isRandomOrder;
            studentInfo.textContent = stateObj.studentInfoText;
            currentQuizData = stateObj.currentQuizData;
            currentQuestionIndex = stateObj.currentQuestionIndex;
            answeredQuestionsCount = stateObj.answeredQuestionsCount;
            score = stateObj.score;
            wrongAnswers = stateObj.wrongAnswers;
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
const homeScreen = document.getElementById('home-screen');
const quizScreen = document.getElementById('quiz-screen');
const resultScreen = document.getElementById('result-screen');
const orderRadios = document.getElementsByName('order');
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

function initParticles(colorType = 'normal') {
    let config = JSON.parse(JSON.stringify(particleConfig));
    
    // Clear previous CSS animations
    particlesContainer.classList.remove('rainbow-particles');
    
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
    } else {
        // Normal means Rainbow Mode
        window.pJS_rainbow_lines = true;
        config.particles.color.value = ["#ff0000", "#ff7f00", "#ffff00", "#00ff00", "#0000ff", "#4b0082", "#8b00ff"];
        config.particles.line_linked.color = "#ffffff";
        particlesContainer.classList.add('rainbow-particles');
    }

    if(window.pJSDom && window.pJSDom.length > 0){
        window.pJSDom[0].pJS.fn.vendors.destroypJS();
        window.pJSDom = [];
    }
    
    particlesJS('particles-js', config);
}

document.addEventListener('DOMContentLoaded', () => {
    if (loadState()) {
        homeScreen.classList.remove('active-screen');
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
        orderRadios.forEach(radio => {
            if (radio.checked) isRandomOrder = (radio.value === 'random');
        });
        
        if (file === 'quiz5.json') studentInfo.textContent = 'اختبار جامعة النهرين - الجزء الأول';
        else if (file === 'quiz6.json') studentInfo.textContent = 'اختبار جامعة النهرين - الجزء الثاني';
        else if (file === 'quiz4.json') studentInfo.textContent = 'اختبار اسئلة الذكاء الاصطناعي';
        else if (file === 'quiz1.json') studentInfo.textContent = 'اختبار دكتور عز الدين';
        else if (file === 'quiz2.json') studentInfo.textContent = 'اختبار جامعة الزهراء (group A)';
        else if (file === 'quiz3.json') studentInfo.textContent = 'اختبار جامعة الزهراء (group B)';

        loadQuiz(file);
    });
});

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
    // If the user hasn't clicked an answer for the current question yet, 
    // it shouldn't deduct points but we consider the quiz 'ended'.
    showResults();
});


homeBtn.addEventListener('click', () => {
    clearState();
    resultScreen.classList.remove('active-screen');
    homeScreen.classList.add('active-screen');
    initParticles('normal');
    document.body.classList.remove('vignette-active', 'flash-success', 'flash-error');
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
        
        if (isRandomOrder) {
            data = shuffleArray(data);
        }

        activeQuizFile = filename;
        currentQuizData = data;
        currentQuestionIndex = 0;
        score = 0;
        answeredQuestionsCount = 0; // count updated on answer
        wrongAnswers = [];

        homeScreen.classList.remove('active-screen');
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
    
    // Reset UI
    nextBtn.classList.add('hidden');
    explanationContainer.classList.add('hidden');
    optionsContainer.innerHTML = '';
    questionProgress.textContent = `السؤال ${currentQuestionIndex + 1} / ${currentQuizData.length}`;
    scoreDisplay.textContent = `النتيجة: ${score}`;

    // Reset Flash Glow and body classes
    document.body.classList.remove('flash-success', 'flash-error');
    
    // Topic & Difficulty Logic
    if (qData.topic) {
        topicBadge.textContent = qData.topic;
        topicBadge.classList.remove('hidden');
    } else {
        topicBadge.classList.add('hidden');
    }

    if (qData.difficulty === 'hard') {
        hardBadge.classList.remove('hidden');
        document.body.classList.add('vignette-active');
        initParticles('hard');
    } else {
        hardBadge.classList.add('hidden');
        document.body.classList.remove('vignette-active');
        initParticles('normal');
    }

    // Populate question
    questionText.setAttribute("dir", "auto");
    questionText.textContent = qData.question;

    // Populate options
    qData.options.forEach((opt, index) => {
        const btn = document.createElement('button');
        btn.classList.add('option-btn');
        btn.setAttribute("dir", "auto");
        btn.textContent = opt;
        
        // Detect if text is arabic to set dir
        const arabicRegex = /[\u0600-\u06FF]/;
        if(arabicRegex.test(opt)) {
            btn.classList.add('arb');
        }

        btn.addEventListener('click', () => handleAnswer(opt, qData, btn));
        optionsContainer.appendChild(btn);
    });
}

// Handle Answer Logic
function handleAnswer(selectedOpt, qData, btnSelected) {
    // Disable all options once answered
    const allBtns = document.querySelectorAll('.option-btn');
    allBtns.forEach(b => b.disabled = true);

    answeredQuestionsCount++; // Increment answered tracking
    const isCorrect = (selectedOpt.trim() === qData.correct_answer.trim());
    
    // Restart animation by re-adding class
    document.body.classList.remove('flash-success', 'flash-error');
    // Force DOM Reflow
    void document.body.offsetWidth;

    if (isCorrect) {
        btnSelected.classList.add('correct');
        score++;
        scoreDisplay.textContent = `النتيجة: ${score}`;
        document.body.classList.add('flash-success');
        initParticles('success');
    } else {
        btnSelected.classList.add('wrong');
        
        // Highlight correct one
        allBtns.forEach(b => {
            if (b.textContent.trim() === qData.correct_answer.trim()) {
                b.classList.add('correct');
            }
        });

        // Store wrong answer
        wrongAnswers.push({
            question: qData.question,
            correct: qData.correct_answer,
            selected: selectedOpt
        });

        document.body.classList.add('flash-error');
        initParticles('error');
    }

    // Show explanations
    if (qData.explanation_ar || qData.explanation_en) {
        explanationAr.textContent = qData.explanation_ar || "لا يوجد شرح بالعربية.";
        explanationEn.textContent = qData.explanation_en || "";
        explanationContainer.classList.remove('hidden');
    }

    nextBtn.classList.remove('hidden');
}

// Show Results
function showResults() {
    clearState();
    quizScreen.classList.remove('active-screen');
    resultScreen.classList.add('active-screen');
    document.body.classList.remove('vignette-active', 'flash-success', 'flash-error');
    initParticles('normal'); // revert particles to default

    // Using answeredQuestionsCount to show partial / full score accurately
    const totalAttempted = answeredQuestionsCount;
    
    if(totalAttempted === 0) {
        finalScoreText.textContent = `لم تجب على أي سؤال.`;
    } else {
        finalScoreText.textContent = `النتيجة النهائية: ${score} من ${totalAttempted}`;
    }

    wrongAnswersList.innerHTML = '';
    
    if (wrongAnswers.length === 0 && totalAttempted > 0) {
        wrongAnswersList.innerHTML = '<p style="text-align:center; color: var(--success-color); font-size: 1.5rem; font-weight: bold; animation: text-rainbow 5s infinite;">عاش! أبدعت وأجبت على جميع الأسئلة بصورة صحيحة.</p>';
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
