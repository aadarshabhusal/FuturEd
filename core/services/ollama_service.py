import requests
import json
import re
from django.conf import settings


class OllamaService:
    """Service for interacting with Ollama LLM."""
    
    def __init__(self):
        self.base_url = getattr(settings, 'OLLAMA_BASE_URL', 'http://localhost:11434')
        self.model = getattr(settings, 'OLLAMA_MODEL', 'llama3.2:1b')
        self.timeout = 300  # 5 minutes
    
    def is_available(self) -> bool:
        """Check if Ollama server is running."""
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=10)
            if response.status_code == 200:
                models = response.json().get('models', [])
                model_names = [m.get('name', '') for m in models]
                
                # Check for exact or partial match
                for name in model_names: 
                    if self.model == name or self.model in name or name.startswith(self.model. split(':')[0]):
                        return True
                
                # If configured model not found but others exist, use first available
                if models: 
                    return True
                    
                return False
            return False
        except: 
            return False
    
    def get_available_models(self) -> list:
        """Get list of available models."""
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=10)
            if response. status_code == 200:
                models = response.json().get('models', [])
                return [m.get('name', '') for m in models]
            return []
        except:
            return []
    
    def _get_working_model(self) -> str:
        """Get a working model name."""
        models = self.get_available_models()
        
        # First try configured model
        for name in models:
            if self.model == name or self.model in name: 
                return name
        
        # Fallback to first available
        if models: 
            print(f"[Ollama] Using fallback model: {models[0]}")
            return models[0]
        
        return self.model
    
    def _generate(self, prompt: str, temperature: float = 0.7) -> str:
        """Send a prompt to Ollama and get a response."""
        url = f"{self.base_url}/api/generate"
        model = self._get_working_model()
        
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": 2048,
            }
        }
        
        print(f"[Ollama] Generating with model: {model}")
        print(f"[Ollama] Prompt length: {len(prompt)} chars")
        
        try:
            response = requests.post(url, json=payload, timeout=self.timeout)
            response.raise_for_status()
            result = response.json()
            
            generated = result.get('response', '')
            print(f"[Ollama] Generated {len(generated)} chars")
            
            if not generated.strip():
                raise Exception("Model returned empty response")
            
            return generated
            
        except requests.exceptions. Timeout:
            raise Exception("Request timed out.  Try a shorter document.")
        except requests.exceptions.ConnectionError:
            raise Exception("Cannot connect to Ollama.  Run 'ollama serve' first.")
        except requests.exceptions.RequestException as e: 
            raise Exception(f"Ollama error: {str(e)}")
    
    def generate_summary(self, text: str) -> str:
        """Generate a summary of the text."""
        # Limit text length for faster processing
        max_chars = 4000
        if len(text) > max_chars: 
            text = text[: max_chars] + "\n[Content truncated...]"
        
        prompt = f"""Please provide a comprehensive summary of the following educational content. 

Structure your summary as follows:
1. **Overview**: Brief 2-3 sentence overview
2. **Key Topics**: Main subjects covered
3. **Important Concepts**: Key definitions and ideas
4. **Takeaways**: Main points to remember

Content to summarize:
---
{text}
---

Summary:"""

        return self._generate(prompt, temperature=0.5)
    
    def generate_flashcards(self, text: str, num_cards: int = 5) -> list:
        """Generate flashcards from text."""
        max_chars = 3000
        if len(text) > max_chars:
            text = text[:max_chars]
        
        prompt = f"""Based on the following educational content, create exactly {num_cards} study flashcards. 
Each flashcard must have a question and an answer.

Content:
---
{text}
---

You must respond with ONLY a valid JSON array in this exact format (no markdown, no explanation, just the JSON):
[
  {{"question": "What is the first concept?", "answer":  "The first concept is..."}},
  {{"question": "What is the second concept?", "answer": "The second concept is..."}}
]

Create {num_cards} flashcards now: """

        response = self._generate(prompt, temperature=0.6)
        return self._parse_flashcards(response, num_cards)
    
    def generate_quiz(self, text: str, num_questions: int = 5) -> list:
        """Generate quiz questions from text."""
        max_chars = 3000
        if len(text) > max_chars:
            text = text[:max_chars]
        
        prompt = f"""Based on the following educational content, create exactly {num_questions} multiple choice quiz questions.
Each question must have exactly 4 options and one correct answer.

Content:
---
{text}
---

You must respond with ONLY a valid JSON array in this exact format (no markdown, no explanation, just the JSON):
[
  {{
    "question": "What is the main topic?",
    "options": ["First option", "Second option", "Third option", "Fourth option"],
    "correct_answer": 0,
    "explanation": "The first option is correct because..."
  }}
]

Important: correct_answer must be a number (0, 1, 2, or 3) indicating which option is correct. 

Create {num_questions} quiz questions now: """

        response = self._generate(prompt, temperature=0.6)
        return self._parse_quiz(response, num_questions)
    
    def _parse_flashcards(self, response: str, expected_count: int) -> list:
        """Parse flashcards from LLM response."""
        print(f"[Ollama] Parsing flashcards response...")
        
        try:
            # Find JSON array in response
            start = response.find('[')
            end = response.rfind(']') + 1
            
            if start != -1 and end > start:
                json_str = response[start:end]
                
                # Clean common issues
                json_str = self._clean_json(json_str)
                
                result = json.loads(json_str)
                
                if isinstance(result, list) and len(result) > 0:
                    flashcards = []
                    for item in result[: expected_count]: 
                        # Handle both dict and other formats
                        if isinstance(item, dict):
                            flashcards.append({
                                'question': str(item.get('question', 'Question not available')),
                                'answer': str(item.get('answer', 'Answer not available'))
                            })
                        elif isinstance(item, str):
                            # If it's a string, try to use it as both Q and A
                            flashcards.append({
                                'question': item,
                                'answer': 'Please regenerate flashcards.'
                            })
                    
                    if flashcards: 
                        return flashcards
        
        except json.JSONDecodeError as e:
            print(f"[Ollama] JSON parse error: {e}")
            print(f"[Ollama] Response preview: {response[:500]}")
        except Exception as e: 
            print(f"[Ollama] Parse error: {e}")
        
        # Return fallback
        return [{"question": "Error generating flashcards.  Please try again.", "answer": "Click 'Generate' to retry with the content."}]
    
    def _parse_quiz(self, response: str, expected_count: int) -> list:
        """Parse quiz questions from LLM response."""
        print(f"[Ollama] Parsing quiz response...")
        
        try:
            # Find JSON array in response
            start = response.find('[')
            end = response.rfind(']') + 1
            
            if start != -1 and end > start:
                json_str = response[start:end]
                
                # Clean common issues
                json_str = self._clean_json(json_str)
                
                result = json.loads(json_str)
                
                if isinstance(result, list) and len(result) > 0:
                    questions = []
                    for item in result[:expected_count]:
                        # Validate and extract question data
                        if isinstance(item, dict):
                            # Get question text
                            question_text = item.get('question', 'Question not available')
                            if not isinstance(question_text, str):
                                question_text = str(question_text)
                            
                            # Get options - ensure it's a list of strings
                            options = item.get('options', [])
                            if not isinstance(options, list) or len(options) < 2:
                                options = ['Option A', 'Option B', 'Option C', 'Option D']
                            else:
                                # Ensure all options are strings
                                options = [str(opt) for opt in options[: 4]]
                                # Pad if needed
                                while len(options) < 4:
                                    options.append(f'Option {len(options) + 1}')
                            
                            # Get correct answer - ensure it's a valid integer
                            correct_answer = item.get('correct_answer', 0)
                            if isinstance(correct_answer, str):
                                # Try to parse string like "A", "B", "0", "1"
                                if correct_answer.upper() in ['A', 'B', 'C', 'D']:
                                    correct_answer = ord(correct_answer. upper()) - ord('A')
                                else:
                                    try:
                                        correct_answer = int(correct_answer)
                                    except: 
                                        correct_answer = 0
                            elif not isinstance(correct_answer, int):
                                correct_answer = 0
                            
                            # Clamp to valid range
                            correct_answer = max(0, min(correct_answer, len(options) - 1))
                            
                            # Get explanation
                            explanation = item.get('explanation', '')
                            if not isinstance(explanation, str):
                                explanation = str(explanation) if explanation else ''
                            
                            questions.append({
                                'question':  question_text,
                                'options':  options,
                                'correct_answer':  correct_answer,
                                'explanation':  explanation
                            })
                    
                    if questions: 
                        return questions
        
        except json.JSONDecodeError as e:
            print(f"[Ollama] JSON parse error: {e}")
            print(f"[Ollama] Response preview:  {response[:500]}")
        except Exception as e:
            print(f"[Ollama] Parse error: {e}")
            import traceback
            traceback.print_exc()
        
        # Return fallback
        return [{
            "question":  "Error generating quiz.  Please try again.",
            "options": ["Try again", "Use different content", "Check if Ollama is running", "Refresh the page"],
            "correct_answer": 0,
            "explanation": "There was an error parsing the quiz response from the AI model."
        }]
    
    def _clean_json(self, json_str: str) -> str:
        """Clean common JSON formatting issues from LLM output."""
        # Remove markdown code blocks if present
        json_str = re.sub(r'```json\s*', '', json_str)
        json_str = re.sub(r'```\s*', '', json_str)
        
        # Remove trailing commas before ] or }
        json_str = re.sub(r',\s*([}\]])', r'\1', json_str)
        
        # Fix common escape issues
        json_str = json_str.replace('\\"', '"')
        
        # Remove control characters except valid whitespace
        json_str = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', json_str)
        
        return json_str.strip()