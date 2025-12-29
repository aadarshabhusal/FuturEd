import fitz  # PyMuPDF


def extract_text_from_pdf(pdf_path: str) -> str:
    """
    Extract text content from a PDF file. 
    
    Args:
        pdf_path: Path to the PDF file
        
    Returns:
        Extracted text as a string
    """
    text_content = []
    
    try:
        doc = fitz.open(pdf_path)
        
        for page_num in range(len(doc)):
            page = doc[page_num]
            
            # Try to extract text
            text = page.get_text("text")
            
            # If no text found, try with different extraction method
            if not text.strip():
                text = page.get_text("blocks")
                if isinstance(text, list):
                    text = "\n".join([block[4] for block in text if len(block) > 4 and isinstance(block[4], str)])
            
            if text and text.strip():
                text_content.append(f"--- Page {page_num + 1} ---\n{text.strip()}")
        
        doc.close()
        
    except Exception as e:
        raise Exception(f"Error extracting text from PDF: {str(e)}")
    
    full_text = "\n\n".join(text_content)
    
    # Basic validation
    if len(full_text.strip()) < 50:
        raise Exception("Could not extract meaningful text from PDF.  The document may be scanned or image-based.")
    
    return full_text


def get_pdf_info(pdf_path:  str) -> dict:
    """
    Get information about a PDF file. 
    
    Args:
        pdf_path: Path to the PDF file
        
    Returns:
        Dictionary with PDF metadata
    """
    try:
        doc = fitz.open(pdf_path)
        info = {
            'num_pages': len(doc),
            'metadata': doc.metadata,
            'has_text': False
        }
        
        # Check if PDF has extractable text
        for page_num in range(min(3, len(doc))):  # Check first 3 pages
            page = doc[page_num]
            text = page.get_text("text")
            if text. strip():
                info['has_text'] = True
                break
        
        doc.close()
        return info
        
    except Exception as e:
        return {'error': str(e)}