import { createGroq } from '@ai-sdk/groq'
import { streamText, convertToModelMessages, UIMessage } from 'ai'
import { systemPrompt } from '@/lib/ai/system-prompt'

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY!
})

export const runtime = 'edge'
export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const messages: UIMessage[] = body.messages ?? []
    const languageInstruction = body.languageInstruction
      ? `\n\nIMPORTANT: ${body.languageInstruction}`
      : '\n\nIMPORTANT: Always respond in English only.'

    const sourcesInstruction = `
\n\nCRITICAL MUST DO: You must always provide 1 to 3 authentic Indian government portal links relevant to the user's query at the VERY BEGINNING of your response.
You MUST format this exactly as a JSON array inside a ---SOURCES--- block like this:
---SOURCES---
[{"title": "Card Title", "url": "https://gov.in/link"}]
---END_SOURCES---
Then, after the ---END_SOURCES--- line, provide your detailed answer. IMPORTANT: Any URLs you mention in your detailed answer MUST be formatted as standard Markdown links (e.g. [Link Text](https://...)) so they are clickable.`

    const result = await streamText({
      model: groq('llama-3.3-70b-versatile'),
      system: systemPrompt + languageInstruction + sourcesInstruction,
      messages: await convertToModelMessages(messages),
    })
    return result.toUIMessageStreamResponse()
  } catch (error: any) {
    console.error('Chat API Error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'An error occurred.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}