// FuturEd - Main Application JavaScript

// ===== PDF Viewer =====
let pdfDoc = null;
let currentScale = 1.0;

async function initPDFViewer() {
    const pdfjsLib = window['pdfjs-dist/build/pdf'];
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    try {
        pdfDoc = await pdfjsLib. getDocument(PDF_URL).promise;
        renderAllPages();
    } catch (error) {
        console.error('Error loading PDF:', error);
        document.getElementById('pdf-viewer').innerHTML = '<p class="text-muted p-4">Error loading PDF</p>';
    }
}

async function renderAllPages() {
    const container = document.getElementById('pdf-viewer');
    container.innerHTML = '';

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: currentScale });

        const canvas = document.createElement('canvas');
        canvas.style.display = 'block';
        canvas.style.marginBottom = '10px';
        canvas.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
        
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        container.appendChild(canvas);

        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;
    }
}

// Zoom controls
document.getElementById('zoom-in')?.addEventListener('click', () => {
    if (currentScale < 2.0) {
        currentScale += 0.25;
        document. getElementById('zoom-level').textContent = Math.round(currentScale * 100) + '%';
        renderAllPages();
    }
});

document.getElementById('zoom-out')?.addEventListener('click', () => {
    if (currentScale > 0.5) {
        currentScale -= 0.25;
        document.getElementById('zoom-level').textContent = Math.round(currentScale * 100) + '%';
        renderAllPages();
    }
});

// ===== Tabs =====
document.querySelectorAll('.tab-trigger').forEach(trigger => {
    trigger.addEventListener('click', () => {
        // Remove active from all triggers
        document.querySelectorAll('.tab-trigger').forEach(t => t.classList.remove('active'));
        // Add active to clicked trigger
        trigger.classList.add('active');
        
        // Hide all tab contents
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        // Show selected tab content
        const tabId = trigger. dataset.tab;
        document.getElementById(`tab-${tabId}`).classList.add('active');
    });
});

// ===== Summary =====
function showSummaryState(state) {
    ['initial', 'loading', 'content', 'error']. forEach(s => {
        document.getElementById(`summary-${s}`).classList.toggle('hidden', s !== state);
    });
}

async function generateSummary() {
    showSummaryState('loading');
    
    try {
        const response = await fetch(`/api/summary/${DOCUMENT_ID}/`, {
            method:  'POST',
            headers:  { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        
        if (data.success) {
            document. getElementById('summary-content').innerHTML = formatContent(data.summary);
            showSummaryState('content');
            // Trigger MathJax to render any LaTeX
            if (window.MathJax) {
                MathJax.typesetPromise();
            }
        } else {
            document.getElementById('summary-error-text').textContent = data.error;
            showSummaryState('error');
        }
    } catch (error) {
        document.getElementById('summary-error-text').textContent = 'Failed to connect to the server.';
        showSummaryState('error');
    }
}

document.getElementById('generate-summary-btn')?.addEventListener('click', generateSummary);
document.getElementById('retry-summary-btn')?.addEventListener('click', generateSummary);

// ===== Flashcards =====
let flashcards = [];
let currentCardIndex = 0;

function showFlashcardsState(state) {
    ['initial', 'loading', 'display', 'error'].forEach(s => {
        document.getElementById(`flashcards-${s}`).classList.toggle('hidden', s !== state);
    });
}

function displayCurrentCard() {
    if (flashcards.length === 0) return;
    
    const card = flashcards[currentCardIndex];
    document.getElementById('flashcard-question').innerHTML = formatContent(card.question);
    document.getElementById('flashcard-answer').innerHTML = formatContent(card.answer);
    document.getElementById('current-card').textContent = currentCardIndex + 1;
    document. getElementById('total-cards').textContent = flashcards.length;
    
    // Reset flip state
    document. getElementById('flashcard').classList.remove('flipped');
    
    // Update navigation buttons
    document.getElementById('prev-card').disabled = currentCardIndex === 0;
    document.getElementById('next-card').disabled = currentCardIndex === flashcards.length - 1;
    
    // Trigger MathJax
    if (window. MathJax) {
        MathJax.typesetPromise();
    }
}

async function generateFlashcards() {
    const numCards = parseInt(document.getElementById('num-flashcards').value) || 5;
    showFlashcardsState('loading');
    
    try {
        const response = await fetch(`/api/flashcards/${DOCUMENT_ID}/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ num_cards: numCards })
        });
        
        const data = await response.json();
        
        if (data.success) {
            flashcards = data. flashcards;
            currentCardIndex = 0;
            displayCurrentCard();
            showFlashcardsState('display');
        } else {
            document.getElementById('flashcards-error-text').textContent = data.error;
            showFlashcardsState('error');
        }
    } catch (error) {
        document. getElementById('flashcards-error-text').textContent = 'Failed to connect to the server.';
        showFlashcardsState('error');
    }
}

document.getElementById('generate-flashcards-btn')?.addEventListener('click', generateFlashcards);
document.getElementById('retry-flashcards-btn')?.addEventListener('click', generateFlashcards);
document.getElementById('regenerate-flashcards-btn')?.addEventListener('click', () => {
    showFlashcardsState('initial');
});

// Flashcard navigation
document.getElementById('flashcard')?.addEventListener('click', () => {
    document.getElementById('flashcard').classList.toggle('flipped');
});

document.getElementById('prev-card')?.addEventListener('click', () => {
    if (currentCardIndex > 0) {
        currentCardIndex--;
        displayCurrentCard();
    }
});

document.getElementById('next-card')?.addEventListener('click', () => {
    if (currentCardIndex < flashcards.length - 1) {
        currentCardIndex++;
        displayCurrentCard();
    }
});

// ===== Quiz =====
let quizQuestions = [];
let currentQuestionIndex = 0;
let userAnswers = [];

function showQuizState(state) {
    ['initial', 'loading', 'display', 'results', 'review', 'error'].forEach(s => {
        document.getElementById(`quiz-${s}`).classList.toggle('hidden', s !== state);
    });
}

function displayCurrentQuestion() {
    if (quizQuestions.length === 0) return;
    
    const question = quizQuestions[currentQuestionIndex];
    const container = document.getElementById('quiz-questions');
    
    let optionsHtml = question.options.map((option, index) => {
        const isSelected = userAnswers[currentQuestionIndex] === index;
        return `
            <div class="quiz-option ${isSelected ? 'selected' : ''}" data-index="${index}">
                <span class="option-label">${String. fromCharCode(65 + index)}</span>
                <span>${formatContent(option)}</span>
            </div>
        `;
    }).join('');
    
    container.innerHTML = `
        <div class="quiz-question">
            <p class="question-number">Question ${currentQuestionIndex + 1} of ${quizQuestions.length}</p>
            <p class="question-text">${formatContent(question.question)}</p>
            <div class="quiz-options">${optionsHtml}</div>
        </div>
    `;
    
    // Add click handlers to options
    container.querySelectorAll('.quiz-option').forEach(option => {
        option.addEventListener('click', () => {
            container.querySelectorAll('.quiz-option').forEach(o => o.classList. remove('selected'));
            option.classList. add('selected');
            userAnswers[currentQuestionIndex] = parseInt(option.dataset. index);
        });
    });
    
    // Update navigation
    document.getElementById('prev-question').classList.toggle('hidden', currentQuestionIndex === 0);
    document.getElementById('next-question').classList.toggle('hidden', currentQuestionIndex === quizQuestions.length - 1);
    document.getElementById('submit-quiz').classList.toggle('hidden', currentQuestionIndex !== quizQuestions.length - 1);
    
    // Trigger MathJax
    if (window.MathJax) {
        MathJax.typesetPromise();
    }
}

function showQuizResults() {
    let correctCount = 0;
    quizQuestions.forEach((q, i) => {
        if (userAnswers[i] === q.correct_answer) {
            correctCount++;
        }
    });
    
    const percentage = Math.round((correctCount / quizQuestions.length) * 100);
    document.getElementById('quiz-score').textContent = `${correctCount}/${quizQuestions.length}`;
    document.getElementById('quiz-percentage').textContent = `${percentage}% correct`;
    
    showQuizState('results');
}

function showQuizReview() {
    const container = document. getElementById('quiz-review-content');
    
    let reviewHtml = quizQuestions.map((question, qIndex) => {
        const userAnswer = userAnswers[qIndex];
        const isCorrect = userAnswer === question.correct_answer;
        
        let optionsHtml = question. options.map((option, oIndex) => {
            let classes = 'quiz-option';
            if (oIndex === question.correct_answer) classes += ' correct';
            else if (oIndex === userAnswer && ! isCorrect) classes += ' incorrect';
            
            return `
                <div class="${classes}">
                    <span class="option-label">${String. fromCharCode(65 + oIndex)}</span>
                    <span>${formatContent(option)}</span>
                </div>
            `;
        }).join('');
        
        return `
            <div class="quiz-question" style="margin-bottom: 2rem; padding-bottom: 2rem; border-bottom: 1px solid hsl(var(--border));">
                <p class="question-number">Question ${qIndex + 1} ${isCorrect ? '- Correct' : '- Incorrect'}</p>
                <p class="question-text">${formatContent(question.question)}</p>
                <div class="quiz-options">${optionsHtml}</div>
                ${question.explanation ? `<div class="explanation"><strong>Explanation:</strong> ${formatContent(question.explanation)}</div>` : ''}
            </div>
        `;
    }).join('');
    
    container.innerHTML = reviewHtml;
    showQuizState('review');
    
    // Trigger MathJax
    if (window. MathJax) {
        MathJax.typesetPromise();
    }
}

async function generateQuiz() {
    const numQuestions = parseInt(document.getElementById('num-questions').value) || 5;
    showQuizState('loading');
    
    try {
        const response = await fetch(`/api/quiz/${DOCUMENT_ID}/`, {
            method:  'POST',
            headers: { 'Content-Type':  'application/json' },
            body: JSON.stringify({ num_questions: numQuestions })
        });
        
        const data = await response.json();
        
        if (data.success) {
            quizQuestions = data.questions;
            currentQuestionIndex = 0;
            userAnswers = new Array(quizQuestions.length).fill(null);
            displayCurrentQuestion();
            showQuizState('display');
        } else {
            document.getElementById('quiz-error-text').textContent = data. error;
            showQuizState('error');
        }
    } catch (error) {
        document.getElementById('quiz-error-text').textContent = 'Failed to connect to the server.';
        showQuizState('error');
    }
}

document.getElementById('generate-quiz-btn')?.addEventListener('click', generateQuiz);
document.getElementById('retry-quiz-btn')?.addEventListener('click', generateQuiz);

document.getElementById('prev-question')?.addEventListener('click', () => {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        displayCurrentQuestion();
    }
});

document.getElementById('next-question')?.addEventListener('click', () => {
    if (currentQuestionIndex < quizQuestions.length - 1) {
        currentQuestionIndex++;
        displayCurrentQuestion();
    }
});

document.getElementById('submit-quiz')?.addEventListener('click', showQuizResults);
document.getElementById('review-quiz')?.addEventListener('click', showQuizReview);
document.getElementById('back-to-results')?.addEventListener('click', () => showQuizState('results'));
document.getElementById('new-quiz')?.addEventListener('click', () => {
    showQuizState('initial');
});

// ===== Utility Functions =====
function formatContent(text) {
    if (!text) return '';
    
    // Convert markdown-style formatting to HTML
    let formatted = text
        // Bold
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*(.*? )\*/g, '<em>$1</em>')
        // Line breaks
        .replace(/\n/g, '<br>')
        // Headers
        .replace(/^### (.*?)$/gm, '<h4>$1</h4>')
        .replace(/^## (.*?)$/gm, '<h3>$1</h3>')
        .replace(/^# (.*?)$/gm, '<h2>$1</h2>');
    
    return formatted;
}

// ===== Initialize =====
document. addEventListener('DOMContentLoaded', () => {
    if (typeof PDF_URL !== 'undefined') {
        initPDFViewer();
    }
});