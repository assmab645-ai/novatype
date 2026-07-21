// script.js

let testTime = 15;
let timeLeft = testTime;
let timerInterval = null;
let testActive = false;
let testOver = false;
let showHud = true;
let currentMode = 'words';

let wordElements = [];
let currentWordIndex = 0;
let currentLetterIndex = 0;
let typedCharactersCount = 0;
let errorCharactersCount = 0;
let audioCtx = null;

// Audio engine setup
function initAudio() {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    } catch (e) {
        console.error("Web Audio Context could not initialize:", e);
    }
}

function playClickSound() {
    initAudio();
    if (!audioCtx || audioCtx.state === 'suspended') return;
    
    const now = audioCtx.currentTime;

    const clickOsc = audioCtx.createOscillator();
    const clickGain = audioCtx.createGain();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(3200, now);
    clickOsc.frequency.exponentialRampToValueAtTime(1400, now + 0.01);
    
    clickGain.gain.setValueAtTime(0.65, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.01);
    clickOsc.connect(clickGain);
    clickGain.connect(audioCtx.destination);
    
    const housingOsc = audioCtx.createOscillator();
    const housingGain = audioCtx.createGain();
    housingOsc.type = 'sine';
    housingOsc.frequency.setValueAtTime(360, now);
    housingOsc.frequency.exponentialRampToValueAtTime(80, now + 0.02);
    
    housingGain.gain.setValueAtTime(0.40, now); 
    housingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
    housingOsc.connect(housingGain);
    housingGain.connect(audioCtx.destination);
    
    clickOsc.start(now);
    clickOsc.stop(now + 0.01);
    housingOsc.start(now);
    housingOsc.stop(now + 0.02);
}

function playErrorSound() {
    initAudio();
    if (!audioCtx || audioCtx.state === 'suspended') return;

    const now = audioCtx.currentTime;
    const errorOsc = audioCtx.createOscillator();
    const errorGain = audioCtx.createGain();
    
    errorOsc.type = 'sawtooth';
    errorOsc.frequency.setValueAtTime(160, now);
    errorOsc.frequency.linearRampToValueAtTime(90, now + 0.06);
    
    errorGain.gain.setValueAtTime(0.55, now); 
    errorGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    
    errorOsc.connect(errorGain);
    errorGain.connect(audioCtx.destination);
    
    errorOsc.start(now);
    errorOsc.stop(now + 0.06);
}

// DOM Elements
const hiddenInput = document.getElementById('hidden-input');
const wordsWrapper = document.getElementById('words-wrapper');
const caret = document.getElementById('caret');
const timerDisplay = document.getElementById('timer-display');
const liveHud = document.getElementById('live-hud');
const resultScreen = document.getElementById('result-screen');
const restartAction = document.getElementById('restart-action');
const syncStatus = document.getElementById('sync-status');
const statusText = document.getElementById('status-text');
const gameClickZone = document.getElementById('game-click-zone');

// Tab Switching Controller
function switchTab(tabName) {
    const testView = document.getElementById('test-view');
    const historyView = document.getElementById('history-view');
    const navTestBtn = document.getElementById('nav-test-btn');
    const navHistoryBtn = document.getElementById('nav-history-btn');

    if (tabName === 'test') {
        if (testView) testView.style.display = 'block';
        if (historyView) historyView.style.display = 'none';

        if (navTestBtn) navTestBtn.classList.add('active');
        if (navHistoryBtn) navHistoryBtn.classList.remove('active');

        if (!testOver && hiddenInput) {
            hiddenInput.focus();
        }
    } else if (tabName === 'history') {
        if (historyView) historyView.style.display = 'block';
        if (testView) testView.style.display = 'none';

        if (navHistoryBtn) navHistoryBtn.classList.add('active');
        if (navTestBtn) navTestBtn.classList.remove('active');

        renderHistory();
    }
}

// Generator for Data Entry Numbers Mode
function generateRandomNumberString() {
    const length = Math.floor(Math.random() * 5) + 1;
    return Math.floor(Math.random() * Math.pow(10, length)).toString();
}

function generateWords() {
    wordsWrapper.innerHTML = '';
    wordsWrapper.style.top = "0px"; 
    wordElements = [];
    
    for (let i = 0; i < 300; i++) {
        let randomWord = '';
        if (currentMode === 'numbers') {
            randomWord = generateRandomNumberString();
        } else {
            randomWord = wordsPool[Math.floor(Math.random() * wordsPool.length)];
        }

        const wordDiv = document.createElement('div');
        wordDiv.className = 'word';
        
        for (let j = 0; j < randomWord.length; j++) {
            const letterSpan = document.createElement('span');
            letterSpan.className = 'letter';
            letterSpan.innerText = randomWord[j];
            wordDiv.appendChild(letterSpan);
        }
        wordsWrapper.appendChild(wordDiv);
        wordElements.push(wordDiv);
    }
    
    setTimeout(() => {
        updateCaretPosition(); 
        if (hiddenInput) hiddenInput.focus();
    }, 50);
}

function updateCaretPosition() {
    if (testOver || wordElements.length === 0) return;
    
    const currentWord = wordElements[currentWordIndex];
    if (!currentWord) return;
    
    const letters = currentWord.querySelectorAll('.letter');
    
    let targetLeft = currentWord.offsetLeft; 
    let targetTop = currentWord.offsetTop;

    if (currentLetterIndex < letters.length) {
        const currentLetter = letters[currentLetterIndex];
        targetLeft = currentLetter.offsetLeft;
    } else {
        if (letters.length > 0) {
            const lastLetter = letters[letters.length - 1];
            targetLeft = lastLetter.offsetLeft + lastLetter.offsetWidth;
        }
    }

    if (targetTop >= 96) {
        const scrollAmount = targetTop - 48;
        wordsWrapper.style.top = `-${scrollAmount}px`;
        caret.style.top = `54px`;
    } else {
        wordsWrapper.style.top = "0px";
        caret.style.top = `${targetTop + 6}px`;
    }

    caret.style.left = `${targetLeft}px`;
}

// UPDATED: Calculates Net WPM, Gross (Raw) WPM, and Accuracy with 0% clamp
function calculateMetrics() {
    const timeElapsed = (testTime - timeLeft) / 60;
    if (timeElapsed <= 0 || typedCharactersCount === 0) {
        return { netWpm: 0, rawWpm: 0, acc: 100 };
    }

    // Gross WPM (Raw physical typing speed)
    const rawWpm = Math.round((typedCharactersCount / 5) / timeElapsed);

    // Accuracy Calculation
    const correctChars = typedCharactersCount - errorCharactersCount;
    const acc = correctChars > 0 
        ? Math.round((correctChars / typedCharactersCount) * 100) 
        : 0;

    // Net WPM Calculation (Clamped to 0 if accuracy is 0%)
    let netWpm = 0;
    if (acc > 0) {
        netWpm = Math.round(rawWpm * (acc / 100));
    }

    return {
        netWpm: Math.max(0, netWpm),
        rawWpm: Math.max(0, rawWpm),
        acc: Math.max(0, acc)
    };
}

function startTest() {
    testActive = true;
    timerDisplay.classList.add('visible');
    if (showHud) liveHud.classList.add('visible');
    
    timerInterval = setInterval(() => {
        timeLeft--;
        timerDisplay.innerText = timeLeft;
        
        const metrics = calculateMetrics();
        const liveWpmElem = document.getElementById('live-wpm');
        const liveRawWpmElem = document.getElementById('live-raw-wpm');
        const liveAccElem = document.getElementById('live-acc');

        if (liveWpmElem) liveWpmElem.innerText = metrics.netWpm;
        if (liveRawWpmElem) liveRawWpmElem.innerText = metrics.rawWpm;
        if (liveAccElem) liveAccElem.innerText = `${metrics.acc}%`;

        if (timeLeft <= 0) endTest();
    }, 1000);
}

function endTest() {
    clearInterval(timerInterval);
    testActive = false;
    testOver = true;
    
    if (gameClickZone) gameClickZone.style.display = 'none';
    if (resultScreen) resultScreen.style.display = 'block';
    if (caret) caret.style.display = 'none';

    const finalMetrics = calculateMetrics();
    const resWpmElem = document.getElementById('res-wpm');
    const resRawWpmElem = document.getElementById('res-raw-wpm');
    const resAccElem = document.getElementById('res-acc');

    if (resWpmElem) resWpmElem.innerText = finalMetrics.netWpm;
    if (resRawWpmElem) resRawWpmElem.innerText = finalMetrics.rawWpm;
    if (resAccElem) resAccElem.innerText = `${finalMetrics.acc}%`;

    saveResult(finalMetrics.netWpm, finalMetrics.rawWpm, finalMetrics.acc);
}

function resetTest() {
    clearInterval(timerInterval);
    timeLeft = testTime;
    timerDisplay.innerText = timeLeft;
    timerDisplay.classList.remove('visible');
    liveHud.classList.remove('visible');
    
    testActive = false;
    testOver = false;
    currentWordIndex = 0;
    currentLetterIndex = 0;
    typedCharactersCount = 0;
    errorCharactersCount = 0;

    if (gameClickZone) gameClickZone.style.display = 'block';
    if (resultScreen) resultScreen.style.display = 'none';
    if (caret) caret.style.display = 'block';
    
    if (hiddenInput) hiddenInput.value = '';
    generateWords();
}

function setMode(mode) {
    if (testActive) return;
    currentMode = mode;
    document.getElementById('mode-words').classList.toggle('active', mode === 'words');
    document.getElementById('mode-numbers').classList.toggle('active', mode === 'numbers');
    resetTest();
}

function changeTime(seconds) {
    if (testActive) return;
    testTime = seconds;
    const parent = document.getElementById('time-opts');
    parent.querySelectorAll('.opt-item').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.innerText) === seconds);
    });
    resetTest();
}

function setTheme(themeName) {
    document.body.className = themeName === 'novatype' ? 'theme-novatype' : `theme-${themeName}`;
    const parent = document.getElementById('theme-opts');
    parent.querySelectorAll('.opt-item').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('onclick').includes(themeName));
    });
}

function toggleHud() {
    showHud = !showHud;
    document.getElementById('hud-toggle').classList.toggle('active', showHud);
    document.getElementById('hud-toggle').innerText = showHud ? 'visible' : 'hidden';
    if (testActive && !showHud) liveHud.classList.remove('visible');
    if (testActive && showHud) liveHud.classList.add('visible');
}

// Local Storage & Online Sync
function saveResult(netWpm, rawWpm, accuracy) {
    const newEntry = {
        id: Date.now(),
        mode: currentMode,
        wpm: netWpm,
        rawWpm: rawWpm,
        accuracy: accuracy,
        date: new Date().toLocaleDateString()
    };

    const history = JSON.parse(localStorage.getItem('novaTypeHistory') || '[]');
    history.unshift(newEntry);
    localStorage.setItem('novaTypeHistory', JSON.stringify(history));
}

function renderHistory() {
    const historyList = document.getElementById('history-list');
    if (!historyList) return;

    const history = JSON.parse(localStorage.getItem('novaTypeHistory') || '[]');
    historyList.innerHTML = '';

    // Separate stats & calculate lifetime averages
    let wordsCount = 0, wordsWpmSum = 0, wordsAccSum = 0;
    let numbersCount = 0, numbersWpmSum = 0, numbersAccSum = 0;

    history.forEach(item => {
        if (item.mode === 'numbers') {
            numbersCount++;
            numbersWpmSum += Number(item.wpm) || 0;
            numbersAccSum += Number(item.accuracy) || 0;
        } else {
            wordsCount++;
            wordsWpmSum += Number(item.wpm) || 0;
            wordsAccSum += Number(item.accuracy) || 0;
        }
    });

    const avgWordsWpm = wordsCount > 0 ? Math.round(wordsWpmSum / wordsCount) : 0;
    const avgWordsAcc = wordsCount > 0 ? Math.round(wordsAccSum / wordsCount) : 0;

    const avgNumbersWpm = numbersCount > 0 ? Math.round(numbersWpmSum / numbersCount) : 0;
    const avgNumbersAcc = numbersCount > 0 ? Math.round(numbersAccSum / numbersCount) : 0;

    // Render Lifetime Averages Cards
    const wordsWpmElem = document.getElementById('avg-words-wpm');
    const wordsAccElem = document.getElementById('avg-words-acc');
    const numbersWpmElem = document.getElementById('avg-numbers-wpm');
    const numbersAccElem = document.getElementById('avg-numbers-acc');

    if (wordsWpmElem) wordsWpmElem.innerText = avgWordsWpm;
    if (wordsAccElem) wordsAccElem.innerText = `${avgWordsAcc}%`;
    if (numbersWpmElem) numbersWpmElem.innerText = avgNumbersWpm;
    if (numbersAccElem) numbersAccElem.innerText = `${avgNumbersAcc}%`;

    // Render Table Rows
    if (history.length === 0) {
        historyList.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem; opacity:0.5;">No history recorded yet</td></tr>`;
        return;
    }

    history.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.mode}</td>
            <td>${item.wpm}</td>
            <td>${item.rawWpm || item.wpm}</td>
            <td>${item.accuracy}%</td>
            <td>${item.date}</td>
        `;
        historyList.appendChild(tr);
    });
}

function updateNetworkStatus() {
    if (!syncStatus || !statusText) return;
    if (navigator.onLine) {
        syncStatus.className = 'sync-status online';
        statusText.innerText = 'online';
    } else {
        syncStatus.className = 'sync-status offline';
        statusText.innerText = 'offline';
    }
}

window.addEventListener('online', updateNetworkStatus);
window.addEventListener('offline', updateNetworkStatus);

// Input & Event Listeners
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        resetTest();
        return;
    }

    if (testOver) return;

    const currentWord = wordElements[currentWordIndex];
    if (!currentWord) return;
    const letters = currentWord.querySelectorAll('.letter');

    if (e.key === 'Backspace') {
        if (currentLetterIndex > 0) {
            currentLetterIndex--;
            const letterToReset = letters[currentLetterIndex];
            
            if (letterToReset) {
                if (letterToReset.classList.contains('extra')) {
                    letterToReset.remove();
                } else {
                    letterToReset.className = 'letter';
                }
            }
            updateCaretPosition();
        }
    }
});

hiddenInput.addEventListener('input', (e) => {
    if (testOver) return;
    initAudio();

    if (!testActive && hiddenInput.value.length > 0) startTest();

    caret.classList.remove('blink');

    const currentWord = wordElements[currentWordIndex];
    if (!currentWord) return;
    
    const letters = currentWord.querySelectorAll('.letter');
    const inputValue = hiddenInput.value;

    if (e.inputType === 'deleteContentBackward') {
        return;
    }

    if (inputValue.endsWith(' ')) {
        playClickSound();
        if (currentLetterIndex < letters.length) {
            errorCharactersCount += (letters.length - currentLetterIndex);
        }
        currentWordIndex++;
        currentLetterIndex = 0;
        hiddenInput.value = '';
        
        typedCharactersCount += 1;
        updateCaretPosition();
        return;
    }

    typedCharactersCount++;
    const expectedLetter = letters[currentLetterIndex];

    if (expectedLetter) {
        const typedChar = inputValue[inputValue.length - 1];
        if (typedChar === expectedLetter.innerText) {
            expectedLetter.classList.add('correct');
            playClickSound();
        } else {
            expectedLetter.classList.add('incorrect');
            errorCharactersCount++;
            playErrorSound();
        }
        currentLetterIndex++;
    } else {
        const extraSpan = document.createElement('span');
        extraSpan.className = 'letter extra';
        extraSpan.innerText = inputValue[inputValue.length - 1];
        currentWord.appendChild(extraSpan);
        currentLetterIndex++;
        errorCharactersCount++;
        playErrorSound();
    }

    updateCaretPosition();
});

document.addEventListener('click', (e) => {
    if (e.target.closest('.top-nav') || e.target.closest('#history-view')) return;

    if (testOver) {
        resetTest();
        return;
    }
    
    initAudio(); 
    if (hiddenInput) hiddenInput.focus();
});

if (restartAction) {
    restartAction.addEventListener('click', (e) => {
        e.stopPropagation();
        resetTest();
    });
}

// Initial Setup
switchTab('test');
updateNetworkStatus();
generateWords();
