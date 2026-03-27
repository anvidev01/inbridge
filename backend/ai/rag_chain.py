import os
from langchain_groq import ChatGroq
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_core.prompts import PromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser

class RAGChain:
    def __init__(self, connection_string: str):
        # Use a lightweight huggingface model for local/free embeddings
        self.embeddings = HuggingFaceEmbeddings(model_name="paraphrase-MiniLM-L3-v2")
        self.llm = ChatGroq(model="llama3-8b-8192", temperature=0)
        
        if os.path.exists("faiss_index"):
            self.vectorstore = FAISS.load_local("faiss_index", self.embeddings, allow_dangerous_deserialization=True)
            self.retriever = self.vectorstore.as_retriever(search_kwargs={"k": 2})
        else:
            print("Warning: FAISS index not found. Using empty retriever.")
            self.retriever = lambda x: []
        
        template = """You are a helpful assistant for the InBridge Govt platform. Use the following pieces of retrieved context to answer the question.
If you don't know the answer, just say that you don't know. Never ask for Aadhaar numbers.

Context: {context}

Question: {question}

Answer:"""
        self.prompt = PromptTemplate.from_template(template)
        
        self.chain = (
            {"context": self.retriever, "question": RunnablePassthrough()}
            | self.prompt
            | self.llm
            | StrOutputParser()
        )

    def ask(self, query: str, citizen_id: str) -> str:
        # citizen_id is logged for audit purposes
        return self.chain.invoke(query)
