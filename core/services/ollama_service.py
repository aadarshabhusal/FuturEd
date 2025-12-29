import requests
import json
from django.conf import settings


class OllamaService:
    """Service for interacting with Ollama LLM."""
    
    def __init__(self):
        self.base_url = getattr(settings, 'OLLAMA_BASE_URL', 'http://localhost:11434')
        self.model = getattr(settings, 'OLLAMA_MODEL', 'llava-llama3:8b')
    
    def _generate(self, prompt: str) -> str:
        """Send a prompt to Ollama and get a response."""
        url = f"{self. base_url}/api/generate"
        
        payload = {
            "model":  self.model,
            "prompt": prompt,
            "stream": False
        }
        
        try:
            response = requests.post(url, json=payload, timeout=120)
            response. raise_for_status()
            result = response.json()
            return result. get('response', '')
        except requests. exceptions.RequestException as e:
            raise Exception(f"Error connecting to Ollama:  {str(e)}")
    
    def generate_summary(self, text: str) -> str:
        """Generate a comprehensive summary of the provided text."""
        # Truncate text if too long (to fit context window)
        max_chars = 8000
        if len(text) > max_chars:
            text = text[:max_chars] + "\n.. .[text truncated]..."
        
        prompt = f"""You are an expert academic summarizer. Please provide a comprehensive summary of the following lecture material or textbook content. 

Your summary should: 
1. Identify and explain the main topics and concepts
2. Highlight key definitions and important terms
3. Preserve any mathematical formulas or equations (use LaTeX notation like $equation$ for inline and $$equation$$ for block equations)
4. Organize the summary with clear headings and bullet points
5. Include any important examples or applications mentioned

Content to summarize: 

{text}

Please provide a well-structured, comprehensive summary: """

        return self._generate(prompt)
    
    def generate_flashcards(self, text: str, num_cards: int = 5) -> list:
        """Generate flashcards from the provided text."""
        max_chars = 6000
        if len(text) > max_chars:
            text = text[:max_chars] + "\n...[text truncated]..."
        
        prompt = f"""You are an expert educator creating study flashcards.  Based on the following content, create exactly {num_cards} flashcards. 

Each flashcard should: 
1. Have a clear, concise question on the front
2. Have a comprehensive but focused answer on the back
3. Cover key concepts, definitions, or important facts
4. Use LaTeX notation for any mathematical content (e.g., $x^2$ for inline math)

Content: 

{text}

Return the flashcards in this exact JSON format (no additional text, just the JSON array):
[
    {{"question": "What is.. .", "answer": "The answer is... "}},
    {{"question": "Explain...", "answer": "This means..."}}
]

Generate exactly {num_cards} flashcards:"""

        response = self._generate(prompt)
        
        # Parse JSON from response
        try:
            # Try to extract JSON from the response
            start = response.find('[')
            end = response.rfind(']') + 1
            if start != -1 and end > start:
                json_str = response[start:end]
                flashcards = json. loads(json_str)
                return flashcards[: num_cards]
        except json.JSONDecodeError:
            pass
        
        # Fallback:  create a simple flashcard if parsing fails
        return [{"question": "Review the material", "answer":  "Please try regenerating the flashcards. "}]
    
    def generate_quiz(self, text: str, num_questions: int = 5) -> list:
        """Generate a multiple-choice quiz from the provided text."""
        max_chars = 6000
        if len(text) > max_chars: 
            text = text[: max_chars] + "\n...[text truncated]..."
        
        prompt = f"""You are an expert educator creating a multiple-choice quiz. Based on the following content, create exactly {num_questions} quiz questions.

Each question should:
1. Test understanding of key concepts
2. Have exactly 4 options (A, B, C, D)
3. Have only one correct answer
4. Include a brief explanation for the correct answer
5. Use LaTeX notation for any mathematical content

Content:

{text}

Return the quiz in this exact JSON format (no additional text, just the JSON array):
[
    {{
        "question": "What is the main concept of... ?",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "correct_answer": 0,
        "explanation": "The correct answer is A because..."
    }}
]

Note: correct_answer is the index (0-3) of the correct option. 

Generate exactly {num_questions} questions:"""

        response = self._generate(prompt)
        
        # Parse JSON from response
        try: 
            start = response.find('[')
            end = response. rfind(']') + 1
            if start != -1 and end > start:
                json_str = response[start:end]
                questions = json.loads(json_str)
                return questions[:num_questions]
        except json.JSONDecodeError:
            pass
        
        # Fallback
        return [{
            "question":  "Please regenerate the quiz",
            "options":  ["Option A", "Option B", "Option C", "Option D"],
            "correct_answer": 0,
            "explanation": "There was an error generating the quiz."
        }]