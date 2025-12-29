from django.urls import path
from . import views

app_name = 'core'

urlpatterns = [
    path('', views.home, name='home'),
    path('upload/', views.upload_pdf, name='upload_pdf'),
    path('workspace/<int:document_id>/', views.workspace, name='workspace'),
    path('api/summary/<int:document_id>/', views.generate_summary, name='generate_summary'),
    path('api/flashcards/<int:document_id>/', views.generate_flashcards, name='generate_flashcards'),
    path('api/quiz/<int:document_id>/', views.generate_quiz, name='generate_quiz'),
    path('api/ollama-status/', views.check_ollama_status, name='ollama_status'),
]