import fitz  # PyMuPDF


def extract_text_from_pdf(pdf_path:  str) -> str:
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
            text = page.get_text("text")
            if text. strip():
                text_content.append(f"--- Page {page_num + 1} ---\n{text}")
        
        doc.close()
        
    except Exception as e:
        raise Exception(f"Error extracting text from PDF: {str(e)}")
    
    return "\n\n".join(text_content)