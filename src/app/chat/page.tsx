import React from 'react';
import { ChatShell } from '@/components/chat/ChatShell';

export const metadata = {
    title: 'Chat',
    description: 'Ask InBridge about Indian government schemes and services in English, Hindi or Hinglish. Answers link to official .gov.in sources.',
};

export default function ChatPage() {
    return (
        <main id="main-content" className="w-full h-dvh overflow-hidden">
            <ChatShell />
        </main>
    );
}
