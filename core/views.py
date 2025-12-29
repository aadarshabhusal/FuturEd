from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
import json

from .models import Document, Summary, Flashcard, Quiz, QuizQuestion
from . forms import DocumentUploadForm
from .services.pdf_service import extract_text_from_pdf
from .services.ollama_service import OllamaService


def home(request):
    """Home page with upload functionality."""
    form = DocumentUploadForm()
    recent_documents = Document.objects. all()[:5]
    return render(request, 'core/home. html', {
        'form': form,
        'recent_documents': recent_documents
    })


@require_http_methods(["POST"])
def upload_pdf(request):
    """Handle PDF upload."""
    form = DocumentUploadForm(request.POST, request.FILES)
    if form.is_valid():
        document = form.save(commit=False)
        document.title = request.FILES['file'].name. replace('.pdf', '')
        document.save()
        
        # Extract text from PDF
        try:
            extracted_text = extract_text_from_pdf(document.file.path)
            document.extracted_text = extracted_text
            document.save()
        except Exception as e:
            print(f"Error extracting text: {e}")
        
        return redirect('core:workspace', document_id=document.id)
    
    return render(request, 'core/home.html', {'form': form})


def workspace(request, document_id):
    """Workspace page with PDF viewer and tools."""
    document = get_object_or_404(Document, id=document_id)
    return render(request, 'core/workspace. html', {
        'document': document
    })


@csrf_exempt
@require_http_methods(["POST"])
def generate_summary(request, document_id):
    """Generate summary for a document."""
    document = get_object_or_404(Document, id=document_id)
    
    # Check if summary already exists
    try:
        summary = document.summary
        return JsonResponse({
            'success': True,
            'summary': summary. content,
            'cached': True
        })
    except Summary.DoesNotExist: 
        pass
    
    if not document.extracted_text:
        return JsonResponse({
            'success': False,
            'error': 'No text could be extracted from this document.'
        })
    
    try:
        ollama = OllamaService()
        summary_text = ollama.generate_summary(document. extracted_text)
        
        # Save summary
        summary = Summary. objects.create(
            document=document,
            content=summary_text
        )
        
        return JsonResponse({
            'success': True,
            'summary':  summary_text,
            'cached': False
        })
    except Exception as e: 
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
        data = json.loads(request.body)
        num_cards = int(data.get('num_cards', 5))
    except:
        num_cards = 5
    
    if not document.extracted_text:
        return JsonResponse({
            'success': False,
            'error':  'No text could be extracted from this document.'
        })
    
    try: 
        # Delete existing flashcards for this document
        document.flashcards. all().delete()
        
        ollama = OllamaService()
        flashcards_data = ollama.generate_flashcards(document.extracted_text, num_cards)
        
        flashcards = []
        for i, card in enumerate(flashcards_data):
            fc = Flashcard. objects.create(
                document=document,
                question=card['question'],
                answer=card['answer'],
                order=i
            )
            flashcards.append({
                'id':  fc.id,
                'question': fc.question,
                'answer': fc. answer
            })
        
        return JsonResponse({
            'success':  True,
            'flashcards': flashcards
        })
    except Exception as e: 
        return JsonResponse({
            'success':  False,
            'error': str(e)
        })


@csrf_exempt
@require_http_methods(["POST"])
def generate_quiz(request, document_id):
    """Generate quiz for a document."""
    document = get_object_or_404(Document, id=document_id)
    
    try: 
        data = json. loads(request.body)
        num_questions = int(data.get('num_questions', 5))
    except: 
        num_questions = 5
    
    if not document. extracted_text: 
        return JsonResponse({
            'success':  False,
            'error': 'No text could be extracted from this document.'
        })
    
    try:
        ollama = OllamaService()
        quiz_data = ollama.generate_quiz(document.extracted_text, num_questions)
        
        # Create quiz
        quiz = Quiz.objects. create(document=document)
        
        questions = []
        for i, q in enumerate(quiz_data):
            question = QuizQuestion. objects.create(
                quiz=quiz,
                question_text=q['question'],
                options=q['options'],
                correct_answer=q['correct_answer'],
                explanation=q.get('explanation', ''),
                order=i
            )
            questions.append({
                'id':  question.id,
                'question': question.question_text,
                'options': question.options,
                'correct_answer': question. correct_answer,
                'explanation':  question.explanation
            })
        
        return JsonResponse({
            'success': True,
            'quiz_id': quiz.id,
            'questions': questions
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error':  str(e)
        })