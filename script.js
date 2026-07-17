// script.js

let testTime = 15;
let timeLeft = testTime;
let timerInterval = null;
let testActive = false;
let testOver = false;
let showHud = true;

let wordElements = [];
let currentWordIndex = 0;
let currentLetterIndex = 0;
let typedCharactersCount = 0;
let errorCharactersCount = 0;
let audioCtx = null;

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

const hiddenInput = document.getElementById('hidden-input');
const wordsWrapper = document.getElementById('words-wrapper');
const caret = document.getElementById('caret');
const timerDisplay = document.getElementById('timer-display');
const liveHud = document.getElementById('live-hud');
const testScreen = document.getElementById('test-screen');
const resultScreen = document.getElementById('result-screen');
const restartAction = document.getElementById('restart-action');

function generateWords() {
    wordsWrapper.innerHTML = '';
    wordsWrapper.style.top = "0px"; 
    wordElements = [];
    
    for (let i = 0; i < 300; i++) {
        const randomWord = wordsPool[Math.floor(Math.random() * wordsPool.length)];
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
        hiddenInput.focus();
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

    // MONKEYTYPE LINE LOCK ENGINE: Row 1 = 0px, Row 2 = 48px. 
    // If text drops to Row 3 (96px+), we scroll the screen up to keep the word on row 2.
    if (targetTop >= 96) {
        const scrollAmount = targetTop - 48;
        wordsWrapper.style.top = `-${scrollAmount}px`;
        caret.style.top = `54px`; // Static Row 2 baseline offset anchor
    } else {
        wordsWrapper.style.top = "0px";
        caret.style.top = `${targetTop + 6}px`;
    }

    caret.style.left = `${targetLeft}px`;
}

function calculateMetrics() {
    const timeElapsed = (testTime - timeLeft) / 60;
    if (timeElapsed <= 0) return { wpm: 0, acc: 100 };
    const wpm = Math.round((typedCharactersCount / 5) / timeElapsed);
    const acc = typedCharactersCount > 0 
        ? Math.round(((typedCharactersCount - errorCharactersCount) / typedCharactersCount) * 100) 
        : 100;
    return { wpm: Math.max(0, wpm), acc: Math.max(0, acc) };
}

function startTest() {
    testActive = true;
    timerDisplay.classList.add('visible');
    if(showHud) liveHud.classList.add('visible');
    
    timerInterval = setInterval(() => {
        timeLeft--;
        timerDisplay.innerText = timeLeft;
        
        const metrics = calculateMetrics();
        document.getElementById('live-wpm').innerText = metrics.wpm;
        document.getElementById('live-acc').innerText = `${metrics.acc}%`;

        if (timeLeft <= 0) endTest();
    }, 1000);
}

function endTest() {
    clearInterval(timerInterval);
    testActive = false;
    testOver = true;
    
    testScreen.style.display = 'none';
    resultScreen.style.display = 'block';
    caret.style.display = 'none';

    const finalMetrics = calculateMetrics();
    document.getElementById('res-wpm').innerText = finalMetrics.wpm;
    document.getElementById('res-acc').innerText = `${finalMetrics.acc}%`;
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

    testScreen.style.display = 'block';
    resultScreen.style.display = 'none';
    caret.style.display = 'block';
    
    hiddenInput.value = '';
    generateWords();
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
    if(testActive && !showHud) liveHud.classList.remove('visible');
    if(testActive && showHud) liveHud.classList.add('visible');
}

// BACKSPACE INTERCEPTION KEYDOWN TRACKER
window.addEventListener('keydown', (e) => {
    if (testOver) return;

    if (e.key === 'Escape') {
        resetTest();
        return;
    }

    const currentWord = wordElements[currentWordIndex];
    if (!currentWord) return;
    const letters = currentWord.querySelectorAll('.letter');

    // Runs backspace character cleanup safely
    if (e.key === 'Backspace') {
        if (currentLetterIndex > 0) {
            currentLetterIndex--;
            const letterToReset = letters[currentLetterIndex];
            
            if (letterToReset) {
                // If it's an extra character added past word limit, delete it from HTML DOM
                if (letterToReset.classList.contains('extra')) {
                    letterToReset.remove();
                } else {
                    // Reset regular characters back to gray untyped status
                    letterToReset.className = 'letter';
                }
            }
            updateCaretPosition();
        }
    }
});

// CORE INPUT PROCESSING LOOP
hiddenInput.addEventListener('input', (e) => {
    if (testOver) return;
    initAudio();

    if (!testActive && hiddenInput.value.length > 0) startTest();

    caret.classList.remove('blink');

    const currentWord = wordElements[currentWordIndex];
    if (!currentWord) return;
    
    const letters = currentWord.querySelectorAll('.letter');
    const inputValue = hiddenInput.value;

    // Skip tracking for backspaces in the input container to prevent dual-processing bugs
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
        // Appends extra character letters if you mistype past the length of the word
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

document.addEventListener('click', () => {
    if (testOver) return;
    initAudio(); 
    hiddenInput.focus();
});

restartAction.addEventListener('click', (e) => {
    e.stopPropagation();
    resetTest();
});

generateWords();