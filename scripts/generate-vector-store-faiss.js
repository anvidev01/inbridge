// scripts/generate-vector-store-faiss.js
const { FaissStore } = require("@langchain/community/vectorstores/faiss");
const { HuggingFaceTransformersEmbeddings } = require("@langchain/community/embeddings/huggingface_transformers");

const documents = [
  {
    pageContent: `PM-KISAN Scheme provides financial assistance of ₹6,000 per year to eligible farmer families, payable in three equal installments of ₹2,000 every four months.

ELIGIBILITY:
- Small and marginal farmer families
- Combined landholding up to 2 hectares
- Must possess valid land records
- Bank account mandatory for direct transfer

REQUIRED DOCUMENTS:
- Land records and ownership proof
- Aadhaar card of all family members
- Bank account details
- Identity proof (Voter ID, PAN, etc.)

APPLICATION PROCESS:
1. Visit Common Service Centers (CSCs)
2. Use PM-KISAN mobile application
3. Contact local agriculture office
4. Online through PM-KISAN portal

OFFICIAL WEBSITE: https://pmkisan.gov.in
HELPLINE: 155261 / 1800115526`,
    metadata: { 
      id: "pm-kisan", 
      type: "farmer_scheme",
      keywords: ["pmkisan", "kisan", "farmer", "agriculture", "6000"]
    }
  },
  {
    pageContent: `Aadhaar services provide unique identity verification for all Indian residents.

SERVICES AVAILABLE:
- New enrollment and registration
- Document updates and corrections
- Biometric updates
- e-Aadhaar download

REQUIRED DOCUMENTS:
- Proof of identity (Passport, PAN, etc.)
- Proof of address (Utility bill, Bank statement)
- Date of birth proof
- Recent passport photo

APPLICATION PROCESS:
1. Locate nearest Aadhaar enrollment center
2. Book appointment online at uidai.gov.in
3. Walk-in with required documents
4. Complete biometric registration

OFFICIAL PORTAL: https://uidai.gov.in
HELPLINE: 1947`,
    metadata: { 
      id: "aadhaar", 
      type: "identity_service",
      keywords: ["aadhaar", "uidai", "enrollment", "update", "identity"]
    }
  },
  {
    pageContent: `Government pension schemes provide social security to elderly citizens.

MAJOR PENSION SCHEMES:
1. National Social Assistance Programme (NSAP)
2. Atal Pension Yojana (APY)
3. Employees' Pension Scheme (EPS)

ELIGIBILITY CRITERIA:
- Age 60+ years for most schemes
- Below Poverty Line (BPL) status
- Specific age and income criteria

APPLICATION PROCESS:
1. Visit local social welfare office
2. Apply through Common Service Centers
3. Online application for some schemes

BENEFIT AMOUNT:
- Varies by scheme from ₹300 to ₹5000 monthly
- Direct bank transfer

OFFICIAL PORTAL: https://nsap.nic.in
HELPLINE: 1800115525`,
    metadata: { 
      id: "pension", 
      type: "social_security",
      keywords: ["pension", "elderly", "old age", "retirement"]
    }
  }
];

async function createVectorStore() {
  try {
    console.log('🚀 Initializing FAISS vector store...');
    
    // Use local embeddings (no API key needed)
    const embeddings = new HuggingFaceTransformersEmbeddings({
      model: "Xenova/all-MiniLM-L6-v2",
    });

    console.log('📚 Creating vector store from documents...');
    
    // Create FAISS vector store (file-based, no server needed)
    const vectorStore = await FaissStore.fromDocuments(
      documents,
      embeddings
    );

    // Save to disk
    await vectorStore.save("./vector_store");
    
    console.log('✅ Vector store created successfully!');
    console.log('📊 Documents processed:', documents.length);
    console.log('💾 Saved to: ./vector_store/');
    console.log('🎯 Ready for AI-powered search!');
    
  } catch (error) {
    console.error('❌ Error creating vector store:', error);
  }
}

// Run the function
createVectorStore();