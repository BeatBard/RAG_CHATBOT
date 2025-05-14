"""
Improved Retrieval‑Augmented Generation (RAG) chain that:
  • Uses smaller, strategic text chunks for more precise retrieval
  • Implements similarity search with limited results
  • Handles off-topic questions properly
  • Maintains conversation memory with summaries
"""

from langchain_community.document_loaders import TextLoader
from langchain_mistralai.chat_models import ChatMistralAI
from langchain_mistralai.embeddings import MistralAIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_core.prompts import ChatPromptTemplate
from langchain.chains import ConversationalRetrievalChain
from langchain.memory import ConversationSummaryMemory

import os
import time
import logging
from dotenv import load_dotenv
from typing import Optional

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ────────────────────────────────────────────────────────────────────────────
#  Load environment variables (.env should contain MISTRAL_API_KEY=sk‑***)
# ────────────────────────────────────────────────────────────────────────────
load_dotenv()


# ────────────────────────────────────────────────────────────────────────────
#  Improved RAG chain builder
# ────────────────────────────────────────────────────────────────────────────
def get_rag_chain(document_path="essay.txt"):
    """Return an improved ConversationalRetrievalChain with better chunking and retrieval."""
    api_key = os.getenv("MISTRAL_API_KEY")
    if not api_key:
        raise ValueError(
            "❌  MISTRAL_API_KEY not found.  Add it to your .env file."
        )

    # 1️⃣  Load document and split into strategic chunks
    try:
        if not os.path.exists(document_path):
            logger.error(f"❌ {document_path} file not found. Please create this file before continuing.")
            raise FileNotFoundError(f"{document_path} file not found in the current directory")
            
        docs = TextLoader(document_path).load()
        logger.info(f"✅ Successfully loaded {document_path}")
    except Exception as e:
        logger.error(f"❌ Error loading document: {str(e)}")
        raise ValueError(f"Failed to load {document_path}: {str(e)}")
    
    # Use smaller chunks with some overlap for better context
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=400,        # Smaller chunks (about 1-2 paragraphs)
        chunk_overlap=50,      # Some overlap to maintain context between chunks
        separators=["\n## ", "\n\n", "\n", " ", ""]  # Split on section markers first
    )
    
    chunks = text_splitter.split_documents(docs)
    logger.info(f"Document split into {len(chunks)} chunks")

    # 2️⃣  Embed chunks with Mistral and create optimized retriever
    embeddings = MistralAIEmbeddings(
        model="mistral-embed", 
        mistral_api_key=api_key
    )
    vector_db = FAISS.from_documents(chunks, embeddings)
    
    # Create a retriever that only returns the most relevant chunks
    retriever = vector_db.as_retriever(
        search_type="similarity",  # Use similarity search
        search_kwargs={
            "k": 3  # Return only top 3 most relevant chunks
        }
    )
    
    logger.info("Created vector store and optimized retriever")

    # 3️⃣  Set up language models
    # Higher temperature for more creative summaries
    summary_llm = ChatMistralAI(
        mistral_api_key=api_key, 
        temperature=0.3,
        model="mistral-large-latest"
    )
    
    # Lower temperature for factual answers
    qa_llm = ChatMistralAI(
        mistral_api_key=api_key, 
        temperature=0.1,
        model="mistral-large-latest"
    )
    
    logger.info("Created Mistral models for summaries and QA")

    # 4️⃣  Conversation‑summary memory - using default prompt
    memory = ConversationSummaryMemory(
        llm=summary_llm,
        memory_key="chat_history",
        return_messages=True,
        verbose=True,
        output_key="answer"  # Explicitly tell memory which output key to store
    )
    
    logger.info("Created conversation summary memory")

    # 5️⃣  Improved prompt with "not found" handling
    qa_prompt = ChatPromptTemplate.from_template(
        """Answer the following question based on the provided context AND the chat history.
        
<context>
{context}
</context>

Chat History:
{chat_history}

Question: {question}

Guidelines:
1. If the question is a greeting (like "hello", "hi", etc.), respond with a friendly greeting.
2. If the question is small talk or casual conversation, respond naturally without requiring info from the context.
3. If the answer is IN THE CONTEXT, provide it based on that information.
4. If the answer is IN THE CHAT HISTORY, use that information to respond.
5. If the answer cannot be found in either the context or chat history, respond with "I don't have information about that in my knowledge base."
6. NEVER make up information that isn't in the context or chat history.
"""
    )

    # 6️⃣  Build improved Conversational Retrieval chain
    rag_chain = ConversationalRetrievalChain.from_llm(
        llm=qa_llm,
        retriever=retriever,
        memory=memory,
        combine_docs_chain_kwargs={"prompt": qa_prompt},
        verbose=True,
        return_source_documents=True,
        return_generated_question=False,  # Don't return the generated question
        rephrase_question=False,  # Disable question rephrasing
    )
    
    logger.info("Created improved RAG chain with disabled question rephrasing")
    
    return rag_chain


# ────────────────────────────────────────────────────────────────────────────
#  Safe wrapper to retry on rate‑limit errors
# ────────────────────────────────────────────────────────────────────────────
def invoke_with_retry(
    chain,
    input_data: dict,
    max_retries: int = 3
) -> Optional[dict]:
    """
    Call chain.invoke(input_data) with automatic exponential‑backoff retries
    when the Mistral API returns a rate‑limit error.
    """
    for attempt in range(max_retries):
        try:
            return chain.invoke(input_data)
        except Exception as e:
            logger.error(f"Attempt {attempt+1} failed: {str(e)}")
            if "rate limit" in str(e).lower() and attempt < max_retries - 1:
                wait = 2 ** attempt  # 1s, 2s, 4s ...
                logger.info(f"Rate limit hit, waiting {wait}s before retry")
                time.sleep(wait)
                continue
            raise  # re‑raise anything else
    return None 