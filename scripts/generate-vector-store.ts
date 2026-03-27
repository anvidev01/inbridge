import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
import { Document } from "@langchain/core/documents";

const documents = [
  new Document({
    pageContent: "PM-KISAN Scheme provides ₹6,000 per year to eligible farmer families in three equal installments. Eligibility: Small and marginal farmer families with combined landholding up to 2 hectares. Required documents: Land records, Aadhaar card, bank account details. Apply through Common Service Centers or the PM-KISAN mobile app.",
    metadata: { id: "pm-kisan" }
  }),
  new Document({
    pageContent: "Aadhaar services include enrollment, update, and download. For enrollment: Visit any Aadhaar center with proof of identity, proof of address, and date of birth proof. For updates: Use the online portal uidai.gov.in or visit Aadhaar centers. Download e-Aadhaar from the official website using your enrollment number.",
    metadata: { id: "aadhaar" }
  }),
  new Document({
    pageContent: "Government pension schemes include: 1) National Social Assistance Programme (NSAP) for elderly, widows, disabled 2) Atal Pension Yojana for unorganized sector workers 3) Employees' Pension Scheme for organized sector. Eligibility varies by scheme but generally requires age 60+ and income criteria.",
    metadata: { id: "pension" }
  }),
  new Document({
    pageContent: "Employment programs: 1) MNREGA - 100 days guaranteed rural employment 2) National Career Service - Job portal and career counseling 3) Skill India Mission - Vocational training 4) StartUp India - Entrepreneurship support. Visit your local employment exchange or the National Career Service portal for registration.",
    metadata: { id: "employment" }
  }),
  new Document({
    pageContent: "Digital Ration Card application: 1) Apply through your state's food department portal 2) Visit Common Service Centers 3) Use the Ration Card mobile app. Required: Aadhaar card, address proof, income certificate, passport photos. The card provides subsidized food grains under the National Food Security Act.",
    metadata: { id: "ration-card" }
  }),
  new Document({
    pageContent: "Ayushman Bharat PM-JAY provides health insurance coverage of ₹5 lakhs per family annually. Eligibility: Based on socio-economic caste census data. Coverage: Hospitalization, surgery, and medical treatments. Apply at empaneled hospitals or Common Service Centers. Bring Aadhaar and income certificate for verification.",
    metadata: { id: "health-insurance" }
  }),
  new Document({
    pageContent: "Thank you for your query! I can help you with various government services including PM-KISAN for farmers, Aadhaar services, pension schemes, employment programs, digital ration cards, and health insurance. Could you please specify which service you need assistance with?",
    metadata: { id: "default" }
  })
];

async function createVectorStore() {
  const embeddings = new HuggingFaceTransformersEmbeddings({
    model: "Xenova/all-MiniLM-L6-v2"
  });

  const vectorStore = await FaissStore.fromDocuments(
    documents,
    embeddings
  );

  await vectorStore.save("vector_store");
  console.log("Vector store created successfully!");
}

createVectorStore().catch(console.error);