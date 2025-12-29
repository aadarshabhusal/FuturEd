from django.db import models
import json


class Document(models.Model):
    """Model to store uploaded PDF documents."""
    title = models.CharField(max_length=255)
    file = models.FileField(upload_to='uploads/')
    extracted_text = models.TextField(blank=True, null=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title

    class Meta:
        ordering = ['-uploaded_at']


class Summary(models.Model):
    """Model to store generated summaries."""
    document = models.OneToOneField(Document, on_delete=models.CASCADE, related_name='summary')
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Summary for {self.document.title}"


class Flashcard(models. Model):
    """Model to store flashcards."""
    document = models.ForeignKey(Document, on_delete=models. CASCADE, related_name='flashcards')
    question = models.TextField()
    answer = models.TextField()
    order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Flashcard {self.order} for {self.document.title}"

    class Meta: 
        ordering = ['order']


class Quiz(models.Model):
    """Model to store quizzes."""
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name='quizzes')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Quiz for {self. document.title}"


class QuizQuestion(models. Model):
    """Model to store quiz questions."""
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name='questions')
    question_text = models.TextField()
    options = models.JSONField()  # List of options
    correct_answer = models.IntegerField()  # Index of correct option
    explanation = models.TextField(blank=True, null=True)
    order = models.IntegerField(default=0)

    def __str__(self):
        return f"Question {self.order} for Quiz {self.quiz. id}"

    class Meta:
        ordering = ['order']