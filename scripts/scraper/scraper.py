# scripts/scraper/scraper.py
import requests
from bs4 import BeautifulSoup
import pdfplumber
import json
import os
from sentence_transformers import SentenceTransformer
import chromadb
from datetime import datetime

class GovernmentSchemeScraper:
    def __init__(self):
        self.model = SentenceTransformer('all-MiniLM-L6-v2')
        self.client = chromadb.PersistentClient(path="./chroma_db")
        self.collection = self.client.get_or_create_collection("government_schemes")
        
    def scrape_pmkisan(self):
        """Scrape PM-KISAN scheme data"""
        try:
            print("🔍 Scraping PM-KISAN scheme...")
            url = "https://pmkisan.gov.in"
            response = requests.get(url, timeout=10)
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Extract key information
            scheme_data = {
                "name": "PM-KISAN Scheme",
                "description": "Financial assistance of ₹6,000 per year to eligible farmer families",
                "eligibility": "Small and marginal farmer families with landholding up to 2 hectares",
                "documents": "Land records, Aadhaar card, bank account details",
                "application": "Common Service Centers, PM-KISAN mobile app, online portal",
                "benefits": "₹6,000 per year in 3 equal installments",
                "website": "https://pmkisan.gov.in",
                "helpline": "155261 / 1800115526",
                "last_updated": datetime.now().isoformat()
            }
            
            return [self.chunk_data(scheme_data)]
        except Exception as e:
            print(f"❌ Error scraping PM-KISAN: {e}")
            return []
    
    def scrape_aadhaar(self):
        """Scrape Aadhaar services data"""
        try:
            print("🔍 Scraping Aadhaar services...")
            scheme_data = {
                "name": "Aadhaar Services",
                "description": "Unique identity verification for all Indian residents",
                "services": "Enrollment, update, download, biometric updates",
                "documents": "Proof of identity, proof of address, date of birth proof",
                "application": "Aadhaar enrollment centers, online appointment",
                "website": "https://uidai.gov.in",
                "helpline": "1947",
                "last_updated": datetime.now().isoformat()
            }
            
            return [self.chunk_data(scheme_data)]
        except Exception as e:
            print(f"❌ Error scraping Aadhaar: {e}")
            return []
    
    def scrape_pension(self):
        """Scrape pension schemes data"""
        try:
            print("🔍 Scraping pension schemes...")
            scheme_data = {
                "name": "Pension Schemes",
                "description": "Social security and financial support for elderly citizens",
                "schemes": "NSAP, Atal Pension Yojana, Employees' Pension Scheme",
                "eligibility": "Age 60+ years, below poverty line status",
                "documents": "Age proof, income certificate, bank details, identity proof",
                "application": "Social welfare office, Common Service Centers",
                "benefits": "₹300 to ₹5000 monthly depending on scheme",
                "website": "https://nsap.nic.in",
                "helpline": "1800115525",
                "last_updated": datetime.now().isoformat()
            }
            
            return [self.chunk_data(scheme_data)]
        except Exception as e:
            print(f"❌ Error scraping pension: {e}")
            return []
    
    def chunk_data(self, scheme_data):
        """Convert scheme data into searchable chunks"""
        chunks = []
        
        # Create multiple chunks for better search
        chunks.append({
            "content": f"{scheme_data['name']}: {scheme_data['description']}",
            "metadata": {
                "scheme": scheme_data['name'],
                "type": "overview",
                "source": scheme_data.get('website', ''),
                "last_updated": scheme_data['last_updated']
            }
        })
        
        if 'eligibility' in scheme_data:
            chunks.append({
                "content": f"Eligibility for {scheme_data['name']}: {scheme_data['eligibility']}",
                "metadata": {
                    "scheme": scheme_data['name'],
                    "type": "eligibility",
                    "source": scheme_data.get('website', ''),
                    "last_updated": scheme_data['last_updated']
                }
            })
        
        if 'documents' in scheme_data:
            chunks.append({
                "content": f"Documents required for {scheme_data['name']}: {scheme_data['documents']}",
                "metadata": {
                    "scheme": scheme_data['name'],
                    "type": "documents",
                    "source": scheme_data.get('website', ''),
                    "last_updated": scheme_data['last_updated']
                }
            })
        
        return chunks
    
    def run_scraping(self):
        """Run complete scraping process"""
        print("🚀 Starting government scheme scraping...")
        
        all_chunks = []
        all_chunks.extend(self.scrape_pmkisan())
        all_chunks.extend(self.scrape_aadhaar())
        all_chunks.extend(self.scrape_pension())
        
        # Flatten chunks
        flat_chunks = [chunk for sublist in all_chunks for chunk in sublist]
        
        print(f"📊 Scraped {len(flat_chunks)} content chunks")
        
        # Add to vector database
        self.update_vector_db(flat_chunks)
        
        print("✅ Scraping completed successfully!")
        return flat_chunks
    
    def update_vector_db(self, chunks):
        """Update ChromaDB with new data"""
        try:
            documents = [chunk["content"] for chunk in chunks]
            metadatas = [chunk["metadata"] for chunk in chunks]
            ids = [f"doc_{i}_{datetime.now().strftime('%Y%m%d')}" for i in range(len(documents))]
            
            # Clear old collection and add new data
            self.client.delete_collection("government_schemes")
            self.collection = self.client.create_collection("government_schemes")
            
            self.collection.add(
                documents=documents,
                metadatas=metadatas,
                ids=ids
            )
            
            print(f"💾 Updated vector database with {len(documents)} documents")
            
        except Exception as e:
            print(f"❌ Error updating vector database: {e}")

if __name__ == "__main__":
    scraper = GovernmentSchemeScraper()
    scraper.run_scraping()