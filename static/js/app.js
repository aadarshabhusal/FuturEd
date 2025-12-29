// FuturEd - Main Application JavaScript
// Note: PDF Viewer is now in pdf-viewer.js

// ===== Tabs =====
document.querySelectorAll('.tab-trigger').forEach(trigger => {
    trigger.addEventListener('click', () => {
        document.querySelectorAll('.tab-trigger').forEach(t => t.classList.remove('active'));
        trigger.classList.add('active');
        
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        const tabId = trigger. dataset.tab;
        document. getElementById(`tab-${tabId}`).classList.add('active');
    });
});

// ===== Utility Functions =====
function formatContent(text) {
    if (!text) return '';
    
    let formatted = text
        // Code blocks
        .replace(/```([\s\S]*?)```/g, '<pre style="background: hsl(var(--secondary)); padding: 1rem; border-radius: var(--radius); overflow-x: auto; margin: 0. 5rem 0; font-size: 0.875rem;"><code>$1</code></pre>')
        // Inline code
        .replace(/`([^`]+)`/g, '<code style="background: hsl(var(--secondary)); padding: 0.125rem 0.375rem; border-radius: 3px; font-size: 0.875rem;">$1</code>')
        // Bold
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // Headers (must be at line start)
        .replace(/^### (.*?)$/gm, '<h4 style="margin-top: 1rem; margin-bottom: 0.5rem; font-size: 1rem;">$1</h4>')
        .replace(/^## (.*?)$/gm, '<h3 style="margin-top: 1.25rem; margin-bottom: 0.5rem; font-size: 1.125rem;">$1</h3>')
        .replace(/^# (.*?)$/gm, '<h2 style="margin-top: 1.5rem; margin-bottom: 0.5rem; font-size: 1.25rem;">$1</h2>')
        // Bullet points
        .replace(/^[\-\*] (.*?)$/gm, '<li style="margin-left:  1.5rem; margin-bottom: 0.25rem;">$1</li>')
        // Numbered lists
        .replace(/^\d+\. (.*?)$/gm, '<li style="margin-left: 1.5rem; margin-bottom: 0.25rem;">$1</li>')
        // Line breaks
        .replace(/\n\n/g, '</p><p style="margin-bottom:  0.75rem;">')
        .replace(/\n/g, '<br>');
    
    // Wrap in paragraph if not starting with a block element
    if (! formatted.startsWith('<h') && !formatted.startsWith('<pre') && !formatted.startsWith('<li')) {
        formatted = '<p style="margin-bottom:  0.75rem;">' + formatted + '</p>';
    }
    
    return formatted;
}

function showNotification(message, type = 'info') {
    // Remove existing notifications
    document.querySelectorAll('.notification').forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.style.cssText = `
        position: fixed;
        bottom: 1rem;
        right: 1rem;
        padding: 1rem 1.5rem;
        background: ${type === 'error' ? '#fef2f2' :  'hsl(var(--card))'};
        border:  1px solid ${type === 'error' ? '#fecaca' : 'hsl(var(--border))'};
        border-radius: var(--radius);
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1000;
        max-width: 400px;
        animation: slideIn 0.3s ease;
    `;
    notification.innerHTML = `
        <div style="display: flex; align-items: start; gap: 0.75rem;">
            <p style="color: ${type === 'error' ? '#dc2626' : 'inherit'}; margin:  0; font-size: 0.875rem; flex: 1;">${message}</p>
            <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; cursor: pointer; padding: 0; color: hsl(var(--muted-foreground));">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// ===== Summary =====
function showSummaryState(state) {
    ['initial', 'loading', 'content', 'error']. forEach(s => {
        const el = document.getElementById(`summary-${s}`);
        if (el) el.classList.toggle('hidden', s !== state);
    });
}

async function generateSummary(regenerate = false) {
    if (typeof OLLAMA_AVAILABLE !== 'undefined' && ! OLLAMA_AVAILABLE) {
        showNotification('Ollama is not connected. Please start Ollama and refresh the page.', 'error');
        return;
    }
    
    if (typeof TEXT_EXTRACTED !== 'undefined' && !TEXT_EXTRACTED) {
        showNotification('No text could be extracted from this PDF.', 'error');
        return;
    }
    
    showSummaryState('loading');
    
    try {
        const response = await fetch(`/api/summary/${DOCUMENT_ID}/`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ regenerate: regenerate })
        });
        
        const data = await response.json();
        
        if (data. success) {
            const contentEl = document.getElementById('summary-content');
            contentEl. innerHTML = `
                <div class="summary-text">${formatContent(data.summary)}</div>
                <div style="margin-top:  1.5rem; padding-top: 1rem; border-top:  1px solid hsl(var(--border));">
                    <button id="regenerate-summary-btn" class="btn btn-ghost btn-sm">Regenerate Summary</button>
                </div>
            `;
            
            document.getElementById('regenerate-summary-btn')?.addEventListener('click', () => generateSummary(true));
            
            showSummaryState('content');
            
            // Trigger MathJax
            if (window.MathJax) {
                MathJax.typesetPromise();
            }
            
            if (data.cached) {
                showNotification('Loaded cached summary.  Click "Regenerate" to create a new one.');
            }
        } else {
            document.getElementById('summary-error-text').textContent = data.error;
            showSummaryState('error');
        }
    } catch (error) {
        console.error('Summary generation error:', error);
        document.getElementById('summary-error-text').textContent = 'Failed to connect to the server. Please try again. ';
        showSummaryState('error');
    }
}

document.getElementById('generate-summary-btn')?.addEventListener('click', () => generateSummary(false));
document.getElementById('retry-summary-btn')?.addEventListener('click', () => generateSummary(false));

// ===== Flashcards =====
let flashcards = [];
let currentCardIndex = 0;

function showFlashcardsState(state) {
    ['initial', 'loading', 'display', 'error'].forEach(s => {
        const el = document.getElementById(`flashcards-${s}`);
        if (el) el.classList.toggle('hidden', s !== state);
    });
}

function displayCurrentCard() {
    if (flashcards.length === 0) return;
    
    const card = flashcards[currentCardIndex];
    document.getElementById('flashcard-question').innerHTML = formatContent(card.question);
    document.getElementById('flashcard-answer').innerHTML = formatContent(card.answer);
    document.getElementById('current-card').textContent = currentCardIndex + 1;
    document.getElementById('total-cards').textContent = flashcards.length;
    
    // Reset flip state
    document.getElementById('flashcard').classList.remove('flipped');
    
    // Update navigation buttons
    const prevBtn = document.getElementById('prev-card');
    const nextBtn = document.getElementById('next-card');
    if (prevBtn) prevBtn.disabled = currentCardIndex === 0;
    if (nextBtn) nextBtn.disabled = currentCardIndex === flashcards.length - 1;
    
    // Trigger MathJax
    if (window. MathJax) {
        MathJax.typesetPromise();
    }
}

async function generateFlashcards() {
    if (typeof OLLAMA_AVAILABLE !== 'undefined' && !OLLAMA_AVAILABLE) {
        showNotification('Ollama is not connected. Please start Ollama and refresh the page.', 'error');
        return;
    }
    
    if (typeof TEXT_EXTRACTED !== 'undefined' && !TEXT_EXTRACTED) {
        showNotification('No text could be extracted from this PDF.', 'error');
        return;
    }
    
    const numCards = parseInt(document.getElementById('num-flashcards')?.value) || 5;
    showFlashcardsState('loading');
    
    try {
        const response = await fetch(`/api/flashcards/${DOCUMENT_ID}/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ num_cards: numCards })
        });
        
        const data = await response.json();
        
        if (data.success) {
            flashcards = data.flashcards;
            currentCardIndex = 0;
            displayCurrentCard();
            showFlashcardsState('display');
        } else {
            document.getElementById('flashcards-error-text').textContent = data.error;
            showFlashcardsState('error');
        }
    } catch (error) {
        console.error('Flashcards generation error:', error);
        document.getElementById('flashcards-error-text').textContent = 'Failed to connect to the server. ';
        showFlashcardsState('error');
    }
}

document.getElementById('generate-flashcards-btn')?.addEventListener('click', generateFlashcards);
document.getElementById('retry-flashcards-btn')?.addEventListener('click', generateFlashcards);
document.getElementById('regenerate-flashcards-btn')?.addEventListener('click', () => {
    showFlashcardsState('initial');
});

// Flashcard interactions
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

// Keyboard navigation for flashcards
document.addEventListener('keydown', (e) => {
    const flashcardsTab = document.getElementById('tab-flashcards');
    if (! flashcardsTab?. classList.contains('active')) return;
    if (flashcards.length === 0) return;
    
    if (e.key === 'ArrowLeft' && currentCardIndex > 0) {
        currentCardIndex--;
        displayCurrentCard();
    } else if (e.key === 'ArrowRight' && currentCardIndex < flashcards.length - 1) {
        currentCardIndex++;
        displayCurrentCard();
    } else if (e. key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('flashcard').classList.toggle('flipped');
    }
});

// ===== Quiz =====
let quizQuestions = [];
let currentQuestionIndex = 0;
let userAnswers = [];

function showQuizState(state) {
    ['initial', 'loading', 'display', 'results', 'review', 'error']. forEach(s => {
        const el = document.getElementById(`quiz-${s}`);
        if (el) el.classList.toggle('hidden', s !== state);
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
                <span class="option-label">${String.fromCharCode(65 + index)}</span>
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
            option.classList.add('selected');
            userAnswers[currentQuestionIndex] = parseInt(option.dataset.index);
        });
    });
    
    // Update navigation
    const prevBtn = document.getElementById('prev-question');
    const nextBtn = document.getElementById('next-question');
    const submitBtn = document.getElementById('submit-quiz');
    
    if (prevBtn) prevBtn.classList.toggle('hidden', currentQuestionIndex === 0);
    if (nextBtn) nextBtn.classList.toggle('hidden', currentQuestionIndex === quizQuestions. length - 1);
    if (submitBtn) submitBtn.classList.toggle('hidden', currentQuestionIndex !== quizQuestions.length - 1);
    
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
    const container = document.getElementById('quiz-review-content');
    
    let reviewHtml = quizQuestions.map((question, qIndex) => {
        const userAnswer = userAnswers[qIndex];
        const isCorrect = userAnswer === question.correct_answer;
        
        let optionsHtml = question.options.map((option, oIndex) => {
            let classes = 'quiz-option';
            if (oIndex === question.correct_answer) classes += ' correct';
            else if (oIndex === userAnswer && !isCorrect) classes += ' incorrect';
            
            return `
                <div class="${classes}" style="cursor: default;">
                    <span class="option-label">${String.fromCharCode(65 + oIndex)}</span>
                    <span>${formatContent(option)}</span>
                </div>
            `;
        }).join('');
        
        return `
            <div class="quiz-question" style="margin-bottom: 2rem; padding-bottom: 2rem; border-bottom: 1px solid hsl(var(--border));">
                <p class="question-number" style="color: ${isCorrect ? '#22c55e' :  '#ef4444'};">
                    Question ${qIndex + 1} - ${isCorrect ? 'Correct' : 'Incorrect'}
                </p>
                <p class="question-text">${formatContent(question.question)}</p>
                <div class="quiz-options">${optionsHtml}</div>
                ${question.explanation ? `<div class="explanation"><strong>Explanation:</strong> ${formatContent(question.explanation)}</div>` : ''}
            </div>
        `;
    }).join('');
    
    container.innerHTML = reviewHtml;
    showQuizState('review');
    
    // Trigger MathJax
    if (window.MathJax) {
        MathJax.typesetPromise();
    }
}

async function generateQuiz() {
    if (typeof OLLAMA_AVAILABLE !== 'undefined' && ! OLLAMA_AVAILABLE) {
        showNotification('Ollama is not connected.  Please start Ollama and refresh the page. ', 'error');
        return;
    }
    
    if (typeof TEXT_EXTRACTED !== 'undefined' && ! TEXT_EXTRACTED) {
        showNotification('No text could be extracted from this PDF.', 'error');
        return;
    }
    
    const numQuestions = parseInt(document.getElementById('num-questions')?.value) || 5;
    showQuizState('loading');
    
    try {
        const response = await fetch(`/api/quiz/${DOCUMENT_ID}/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ num_questions:  numQuestions })
        });
        
        const data = await response.json();
        
        if (data.success) {
            quizQuestions = data.questions;
            currentQuestionIndex = 0;
            userAnswers = new Array(quizQuestions.length).fill(null);
            displayCurrentQuestion();
            showQuizState('display');
        } else {
            document.getElementById('quiz-error-text').textContent = data.error;
            showQuizState('error');
        }
    } catch (error) {
        console.error('Quiz generation error:', error);
        document.getElementById('quiz-error-text').textContent = 'Failed to connect to the server. ';
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

// ===== CSS Animations =====
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);