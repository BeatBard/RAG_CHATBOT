"""
Test script for PDF document loading.
Run this script to test if PDF loading functionality works correctly.
"""
import os
import logging
from pathlib import Path
from rag_chain import load_document, get_rag_chain

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def test_pdf_loading():
    """Test PDF document loading functionality."""
    # Check if test PDF exists, otherwise create one
    test_pdf_path = Path("uploads/test.pdf")
    
    if not test_pdf_path.exists():
        logger.warning(f"Test PDF not found at {test_pdf_path}. Please create a test PDF file.")
        logger.info("You can use any PDF file for testing. Rename it to 'test.pdf' and place it in the 'uploads' directory.")
        return
    
    try:
        # Test document loading
        logger.info(f"Testing PDF loading from {test_pdf_path}")
        docs = load_document(str(test_pdf_path))
        logger.info(f"Successfully loaded PDF with {len(docs)} pages/documents")
        
        # Test RAG chain with PDF
        logger.info(f"Testing RAG chain with PDF document")
        rag_chain = get_rag_chain(document_path=str(test_pdf_path))
        logger.info(f"Successfully created RAG chain with PDF document")
        
        return True
    except Exception as e:
        logger.error(f"Error testing PDF functionality: {str(e)}")
        return False

if __name__ == "__main__":
    # Create uploads directory if it doesn't exist
    os.makedirs("uploads", exist_ok=True)
    
    logger.info("Starting PDF support test")
    result = test_pdf_loading()
    
    if result:
        logger.info("✅ PDF support test passed. Your system can now process PDF documents.")
    else:
        logger.error("❌ PDF support test failed. Please check the error messages above.")
        logger.info("Troubleshooting tips:")
        logger.info("1. Make sure you've installed all required dependencies: pypdf, unstructured, unstructured-inference")
        logger.info("2. Make sure your test PDF file is valid and accessible")
        logger.info("3. Check if your PDF is not encrypted or password-protected") 