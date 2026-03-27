import os
import argparse
from langchain_community.document_loaders import PyMuPDFLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS

def ingest_file(file_path: str, connection_string: str):
    print(f"Loading {file_path}...")
    
    if file_path.endswith('.pdf'):
        loader = PyMuPDFLoader(file_path)
    else:
        loader = TextLoader(file_path)
        
    docs = loader.load()
    
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        add_start_index=True
    )
    splits = text_splitter.split_documents(docs)
    print(f"Split into {len(splits)} chunks.")
    
    # Use an even lighter HuggingFace embedding model for local Docker
    embeddings = HuggingFaceEmbeddings(model_name="paraphrase-MiniLM-L3-v2")
    
    print("Storing in FAISS...")
    vectorstore = FAISS.from_documents(splits, embeddings)
    vectorstore.save_local("faiss_index")
    print("Ingestion complete.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", required=True, help="Path to PDF or TXT file")
    args = parser.parse_args()
    
    db_url = os.getenv("DB_URL", "postgresql://inbridge:inbridge_secret@localhost:5432/inbridge_db")
    # Replace placeholder host if running inside docker but targeted at another container
    db_url = db_url.replace("localhost", "postgres") if "localhost" in db_url else db_url
    
    ingest_file(args.file, db_url)
