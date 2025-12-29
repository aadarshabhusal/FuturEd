from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
import json
import traceback
import requests

from . models import Document, Summary, Flashcard, Quiz, QuizQuestion
from . forms import DocumentUploadForm
from .services.pdf_service import extract_text_from_pdf
from .services.ollama_service import OllamaService


def home(request):
    """Home page with upload functionality."""
    form = DocumentUploadForm()
    recent_documents = Document.objects.all()[:5]
    return render(request, 'core/home.html', {
        'form': form,
        'recent_documents':  recent_documents
    })


@require_http_methods(["POST"])
def upload_pdf(request):
    """Handle PDF upload."""
    form = DocumentUploadForm(request.POST, request.FILES)
    if form.is_valid():
        document = form.save(commit=False)
        document.title = request.FILES['file'].name.replace('. pdf', '')
        document.save()
        
        # Extract text from PDF
        try:
            extracted_text = extract_text_from_pdf(document.file.path)
            document.extracted_text = extracted_text
            document.save()
        except Exception as e:
            print(f"Error extracting text: {e}")
            traceback.print_exc()
        
        return redirect('core:workspace', document_id=document.id)
    
    return render(request, 'core/home.html', {'form': form})


def workspace(request, document_id):
    """Workspace page with PDF viewer and tools."""
    document = get_object_or_404(Document, id=document_id)
    
    # Check Ollama status with detailed info
    ollama_status = {
        'available':  False,
        'models': [],
        'error': None,
        'server_running': False
    }
    
    try:
        # First check if server is reachable
        response = requests.get('http://localhost:11434', timeout=5)
        ollama_status['server_running'] = True
        
        # Then check models
        ollama = OllamaService()
        ollama_status['available'] = ollama.is_available()
        ollama_status['models'] = ollama.get_available_models()
        
    except requests.exceptions. ConnectionError:
        ollama_status['error'] = 'Cannot connect to localhost:11434'
    except Exception as e:
        ollama_status['error'] = str(e)
    
    return render(request, 'core/workspace.html', {
        'document': document,
        'ollama_status': ollama_status,
        'text_extracted': bool(document.extracted_text and len(document.extracted_text.strip()) > 100)
    })


@csrf_exempt
@require_http_methods(["POST"])
def generate_summary(request, document_id):
    """Generate summary for a document."""
    document = get_object_or_404(Document, id=document_id)
    
    # Check for force regeneration
    try:
        data = json.loads(request.body) if request.body else {}
        force_regenerate = data.get('regenerate', False)
    except:
        force_regenerate = False
    
    # Check if summary already exists and not forcing regeneration
    if not force_regenerate: 
        try:
            summary = document.summary
            return JsonResponse({
                'success': True,
                'summary': summary.content,
                'cached': True
            })
        except Summary.DoesNotExist:
            pass
    
    # Validate extracted text
    if not document.extracted_text or len(document.extracted_text.strip()) < 50:
        return JsonResponse({
            'success': False,
            'error': 'Could not extract enough text from this document.  Please ensure the PDF contains selectable text.'
        })
    
    try:
        ollama = OllamaService()
        
        if not ollama.is_available():
            return JsonResponse({
                'success': False,
                'error': 'Ollama is not available. Please ensure Ollama is running with a model installed.'
            })
        
        summary_text = ollama.generate_summary(document.extracted_text)
        
        # Save or update summary
        Summary.objects.update_or_create(
            document=document,
            defaults={'content': summary_text}
        )
        
        return JsonResponse({
            'success': True,
            'summary': summary_text,
            'cached': False
        })
    except Exception as e: 
        traceback.print_exc()
        return JsonResponse({
            'success': False,
            'error': str(e)
        })


@csrf_exempt
@require_http_methods(["POST"])
def generate_flashcards(request, document_id):
    """Generate flashcards for a document."""
    document = get_object_or_404(Document, id=document_id)
    
    try:
        data = json.loads(request.body) if request.body else {}
        num_cards = min(max(int(data.get('num_cards', 5)), 1), 20)
    except:
        num_cards = 5
    
    # Validate extracted text
    if not document.extracted_text or len(document.extracted_text.strip()) < 50:
        return JsonResponse({
            'success': False,
            'error': 'Could not extract enough text from this document.'
        })
    
    try: 
        ollama = OllamaService()
        
        if not ollama.is_available():
            return JsonResponse({
                'success': False,
                'error': 'Ollama is not running. Please start Ollama first.'
            })
        
        # Delete existing flashcards
        document.flashcards.all().delete()
        
        flashcards_data = ollama.generate_flashcards(document. extracted_text, num_cards)
        
        flashcards = []
        for i, card in enumerate(flashcards_data):
            # Safely extract question and answer
            if isinstance(card, dict):
                question = card.get('question', 'Question unavailable')
                answer = card.get('answer', 'Answer unavailable')
            else:
                question = str(card)
                answer = 'Please regenerate flashcards.'
            
            fc = Flashcard.objects.create(
                document=document,
                question=question,
                answer=answer,
                order=i
            )
            flashcards.append({
                'id': fc.id,
                'question': fc.question,
                'answer': fc.answer
            })
        
        return JsonResponse({
            'success':  True,
            'flashcards': flashcards
        })
    except Exception as e: 
        traceback.print_exc()
        return JsonResponse({
            'success': False,
            'error': str(e)
        })


@csrf_exempt
@require_http_methods(["POST"])
def generate_quiz(request, document_id):
    """Generate quiz for a document."""
    document = get_object_or_404(Document, id=document_id)
    
    try: 
        data = json.loads(request.body) if request.body else {}
        num_questions = min(max(int(data.get('num_questions', 5)), 1), 15)
    except:
        num_questions = 5
    
    # Validate extracted text
    if not document.extracted_text or len(document.extracted_text. strip()) < 50:
        return JsonResponse({
            'success': False,
            'error': 'Could not extract enough text from this document.'
        })
    
    try: 
        ollama = OllamaService()
        
        if not ollama.is_available():
            return JsonResponse({
                'success': False,
                'error': 'Ollama is not running.  Please start Ollama first.'
            })
        
        quiz_data = ollama.generate_quiz(document.extracted_text, num_questions)
        
        # Create quiz
        quiz = Quiz. objects.create(document=document)
        
        questions = []
        for i, q in enumerate(quiz_data):
            # Safely extract question data with defaults
            if isinstance(q, dict):
                question_text = q.get('question', 'Question unavailable')
                options = q. get('options', ['Option A', 'Option B', 'Option C', 'Option D'])
                correct_answer = q.get('correct_answer', 0)
                explanation = q.get('explanation', '')
            else:
                question_text = str(q)
                options = ['Option A', 'Option B', 'Option C', 'Option D']
                correct_answer = 0
                explanation = ''
            
            # Ensure options is a valid list
            if not isinstance(options, list) or len(options) < 2:
                options = ['Option A', 'Option B', 'Option C', 'Option D']
            
            # Ensure all options are strings
            options = [str(opt) for opt in options[:4]]
            while len(options) < 4:
                options.append(f'Option {len(options) + 1}')
            
            # Ensure correct_answer is valid
            if not isinstance(correct_answer, int):
                try:
                    correct_answer = int(correct_answer)
                except:
                    correct_answer = 0
            correct_answer = max(0, min(correct_answer, len(options) - 1))
            
            question = QuizQuestion.objects.create(
                quiz=quiz,
                question_text=str(question_text),
                options=options,
                correct_answer=correct_answer,
                explanation=str(explanation) if explanation else '',
                order=i
            )
            questions.append({
                'id':  question.id,
                'question': question. question_text,
                'options': question.options,
                'correct_answer': question.correct_answer,
                'explanation': question.explanation
            })
        
        return JsonResponse({
            'success': True,
            'quiz_id': quiz.id,
            'questions': questions
        })
    except Exception as e:
        traceback.print_exc()
        return JsonResponse({
            'success': False,
            'error': str(e)
        })


@csrf_exempt
@require_http_methods(["GET"])
def check_ollama_status(request):
    """Check if Ollama is running and available."""
    status = {
        'server_reachable': False,
        'available': False,
        'models': [],
        'configured_model': '',
        'error':  None
    }
    
    try: 
        # Check server
        response = requests.get('http://localhost:11434', timeout=5)
        status['server_reachable'] = response.status_code == 200
        
        # Check models
        ollama = OllamaService()
        status['available'] = ollama.is_available()
        status['models'] = ollama.get_available_models()
        status['configured_model'] = ollama.model
        
    except requests.exceptions.ConnectionError:
        status['error'] = 'Cannot connect to Ollama server at localhost:11434'
    except Exception as e:
        status['error'] = str(e)
    
    return JsonResponse(status)