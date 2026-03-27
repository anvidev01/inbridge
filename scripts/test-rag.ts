
// import fetch from 'node-fetch'; // Using native fetch

async function testQuery(query: string) {
    console.log(`\n\n🔎 Testing Query: "${query}"`);
    const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: query }),
    });

    const data = await response.json();
    console.log('📝 Response Status:', response.status);
    console.log('📤 Response Data:', JSON.stringify(data, null, 2));
}

async function runTests() {
    // 1. Vector Store Query (PM Kisan is in the generated vector store)
    await testQuery("How to apply for PM Kisan?");

    // 2. Tavily Fallback Query (Something likely not in local vector store)
    // "Digital Personal Data Protection Act 2023" is recent and specific.
    await testQuery("What are the key features of Digital Personal Data Protection Act 2023?");

    // 3. Generic greetings
    await testQuery("Hello");
}

runTests();
