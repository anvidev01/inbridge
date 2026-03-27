// scripts/generate-vector-store-simple.ts
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { OpenAIEmbeddings } from "@langchain/openai";

const documents = [
  {
    pageContent: "PM-KISAN Scheme provides ₹6,000 per year to eligible farmer families in three equal installments. Eligibility: Small and marginal farmer families with combined landholding up to 2 hectares. Required documents: Land records, Aadhaar card, bank account details. Apply through Common Service Centers or the PM-KISAN mobile app.",
    metadata: { id: "pm-kisan", type: "farmer_scheme" }
  },
  {
    pageContent: "Aadhaar services include enrollment, update, and download. For enrollment: Visit any Aadhaar center with proof of identity, proof of address, and date of birth proof. For updates: Use the online portal uidai.gov.in or visit Aadhaar centers. Download e-Aadhaar from the official website using your enrollment number.",
    metadata: { id: "aadhaar", type: "identity_service" }
  },
  {
    pageContent: "Government pension schemes include: 1) National Social Assistance Programme (NSAP) for elderly, widows, disabled 2) Atal Pension Yojana for unorganized sector workers 3) Employees' Pension Scheme for organized sector. Eligibility varies by scheme but generally requires age 60+ and income criteria.",
    metadata: { id: "pension", type: "social_security" }
  },
  {
    pageContent: "Employment programs: 1) MNREGA - 100 days guaranteed rural employment 2) National Career Service - Job portal and career counseling 3) Skill India Mission - Vocational training 4) StartUp India - Entrepreneurship support. Visit your local employment exchange or the National Career Service portal for registration.",
    metadata: { id: "employment", type: "employment" }
  },
  {
    pageContent: "Digital Ration Card application: 1) Apply through your state's food department portal 2) Visit Common Service Centers 3) Use the Ration Card mobile app. Required: Aadhaar card, address proof, income certificate, passport photos. The card provides subsidized food grains under the National Food Security Act.",
    metadata: { id: "ration-card", type: "food_security" }
  },
  {
    pageContent: "Ayushman Bharat PM-JAY provides health insurance coverage of ₹5 lakhs per family annually. Eligibility: Based on socio-economic caste census data. Coverage: Hospitalization, surgery, and medical treatments. Apply at empaneled hospitals or Common Service Centers. Bring Aadhaar and income certificate for verification.",
    metadata: { id: "health-insurance", type: "healthcare" }
  }
];

async function createVectorStore() {
  try {
    console.log('Creating vector store with ChromaDB...');
    
    // Use OpenAI embeddings (you can get a free API key)
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY || "dummy-key-for-now", // We'll handle this
    });

    // Create vector store
    const vectorStore = await Chroma.fromTexts(
      documents.map(doc => doc.pageContent),
      documents.map(doc => doc.metadata),
      embeddings,
      {
        collectionName: "government-schemes",
        url: "http://localhost:8000" // ChromaDB local server
      }
    );

    console.log('✅ Vector store created successfully with ChromaDB!');
    
  } catch (error) {
    console.log('ChromaDB approach failed, trying fallback...');
    await createSimpleJSONStore();
  }
}

// Fallback: Create a simple JSON-based knowledge store
async function createSimpleJSONStore() {
  const fs = require('fs');
  const path = require('path');
  
  const knowledgeBase = {
    schemes: documents,
    timestamp: new Date().toISOString(),
    version: "1.0"
  };
  
  // Create knowledge directory if it doesn't exist
  const knowledgeDir = path.join(process.cwd(), 'knowledge');
  if (!fs.existsSync(knowledgeDir)) {
    fs.mkdirSync(knowledgeDir, { recursive: true });
  }
  
  // Save to JSON file
  fs.writeFileSync(
    path.join(knowledgeDir, 'government-schemes.json'),
    JSON.stringify(knowledgeBase, null, 2)
  );
  
  console.log('✅ Simple knowledge store created at: knowledge/government-schemes.json');
  console.log('📝 You can use this for basic keyword matching until vector DB is set up');
}

createVectorStore().catch(console.error);