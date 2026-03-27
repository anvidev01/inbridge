import React from 'react';
import { ChatShell } from '@/components/chat/ChatShell';

export const metadata = {
    title: 'InBridge',
    description: 'Chat with the official InBridge Assistant for help with government services.',
};

export default function ChatPage() {
    return (
        <main className="w-full h-screen overflow-hidden">
            <ChatShell />
        </main>
    );
}
