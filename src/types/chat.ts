
export interface Message {
    id: string;
    text: string;
    isUser: boolean;
    timestamp: Date;
    sources?: string[];
    confidence?: number;
}

export type Language = 'en' | 'hi' | 'bn' | 'mr' | 'te' | 'hinglish';

export interface ChatState {
    messages: Message[];
    isLoading: boolean;
    isListening: boolean;
    language: Language;
}
