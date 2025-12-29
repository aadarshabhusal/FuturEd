from django import forms
from . models import Document


class DocumentUploadForm(forms.ModelForm):
    """Form for uploading PDF documents."""
    
    class Meta: 
        model = Document
        fields = ['file']
        widgets = {
            'file': forms.FileInput(attrs={
                'accept': 'application/pdf',
                'class': 'hidden',
                'id': 'file-upload'
            })
        }

    def clean_file(self):
        file = self.cleaned_data. get('file')
        if file:
            if not file.name.endswith('.pdf'):
                raise forms.ValidationError('Only PDF files are allowed.')
            if file.size > 50 * 1024 * 1024:  # 50MB limit
                raise forms.ValidationError('File size must be under 50MB.')
        return file