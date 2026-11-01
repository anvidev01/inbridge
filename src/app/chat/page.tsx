import React, { Suspense } from 'react';
import { ChatShell, ChatShellFromSearchParams } from '@/components/chat/ChatShell';

export const metadata = {
    title: 'Chat',
    description: 'Ask InBridge about Indian government schemes and services in English, Hindi or Hinglish, with links to official .gov.in sources where available.',
};

/**
 * /chat — supports ?q=<question> (fills the composer, never auto-sends) and
 * ?mode=grievance (complaint drafter). useSearchParams needs a Suspense
 * boundary; the fallback is the same shell without the URL values so the
 * page still prerenders.
 */
export default function ChatPage() {
    return (
        <main id="main-content" className="w-full h-dvh overflow-hidden">
            <Suspense fallback={<ChatShell />}>
                <ChatShellFromSearchParams />
            </Suspense>
        </main>
    );
}
