from langchain_community.document_loaders import TextLoader
from langchain_mistralai.chat_models import ChatMistralAI
from langchain_mistralai.embeddings import MistralAIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain_core.prompts import ChatPromptTemplate
from langchain.chains import create_retrieval_chain
import os

def get_rag_chain():
    api_key = os.getenv("MISTRAL_API_KEY")

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
