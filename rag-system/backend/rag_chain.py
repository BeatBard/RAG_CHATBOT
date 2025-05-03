from langchain_community.document_loaders import TextLoader
from langchain_mistralai.chat_models import ChatMistralAI
from langchain_mistralai.embeddings import MistralAIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain_core.prompts import ChatPromptTemplate
from langchain.chains import create_retrieval_chain
import os
from dotenv import load_dotenv
import time
from typing import Optional

# Load environment variables from .env file
load_dotenv()

def get_rag_chain():
    api_key = os.getenv("MISTRAL_API_KEY")
    if not api_key:
        raise ValueError("MISTRAL_API_KEY environment variable is not set. Please create a .env file with your MistralAI API key.")

    loader = TextLoader("essay.txt")
    docs = loader.load()
    splitter = RecursiveCharacterTextSplitter()
    chunks = splitter.split_documents(docs)

    embeddings = MistralAIEmbeddings(model="mistral-embed", mistral_api_key=api_key)
    vector = FAISS.from_documents(chunks, embeddings)

    retriever = vector.as_retriever()

    prompt = ChatPromptTemplate.from_template(
        "Answer the following question based only on the provided context:\n\n<context>\n{context}\n</context>\n\nQuestion: {input}"
    )
    model = ChatMistralAI(mistral_api_key=api_key)
    document_chain = create_stuff_documents_chain(model, prompt)

    return create_retrieval_chain(retriever, document_chain)

def invoke_with_retry(chain, input_data: dict, max_retries: int = 3) -> Optional[dict]:
    """Invoke the chain with retry logic for rate limiting."""
    for attempt in range(max_retries):
        try:
            return chain.invoke(input_data)
        except Exception as e:
            if "rate limit" in str(e).lower():
                if attempt < max_retries - 1:
                    # Exponential backoff: 2^attempt seconds
                    wait_time = 2 ** attempt
                    time.sleep(wait_time)
                    continue
            raise
    return None
