'use client';

import { useState, useRef, useEffect, useOptimistic } from 'react';
import { createWorker } from 'tesseract.js';
import {
  Mic,
  MicOff,
  ArrowRight,
  Paperclip,
  Volume2,
  VolumeX,
  Globe,
  Loader2,
  Search,
  BookOpen,
  Plus,
  ArrowUpRight,
  Sparkles,
  Library
} from 'lucide-react';
import { Message, Language } from '@/types/chat';

// --- Language translations ---
const translations = {
  en: {
    welcome: "Where knowledge becomes accessible.",
    title: "InBridge",
    subtitle: "Ask anything about government schemes...",
    placeholder: "Ask follow-up...",
    listening: "Listening...",
    processing: "Reasoning...",
    error: "Unable to retrieve answer.",
    voiceOn: "Voice On",
    voiceOff: "Voice Off",
    stop: "Stop",
    upload: "Analyze",
    privacy: "Private",
    sources: "Sources",
    answer: "Answer",
    related: "Related"
  },
  hi: {
    welcome: "ज्ञान जहाँ सुलभ हो जाता है।",
    title: "InBridge",
    subtitle: "सरकारी योजनाओं के बारे में कुछ भी पूछें...",
    placeholder: "अगला प्रश्न पूछें...",
    listening: "सुन रहे हैं...",
    processing: "विचार कर रहे हैं...",
    error: "उत्तर प्राप्त करने में असमर्थ।",
    voiceOn: "आवाज़ चालू",
    voiceOff: "आवाज़ बंद",
    stop: "रोकें",
    upload: "विश्लेषण",
    privacy: "निजी",
    sources: "स्रोत",
    answer: "उत्तर",
    related: "संबंधित"
  },
  bn: {
    welcome: "যেখানে জ্ঞান সহজলভ্য হয়।",
    title: "ইনফোসেতু",
    subtitle: "সরকারি প্রকল্প সম্পর্কে যা খুশি জিজ্ঞাসা করুন...",
    placeholder: "পরবর্তী প্রশ্ন...",
    listening: "শুনছি...",
    processing: "ভাবছি...",
    error: "উত্তর পাওয়া যায়নি।",
    voiceOn: "ভয়েস চালু",
    voiceOff: "ভয়েস বন্ধ",
    stop: "থামুন",
    upload: "বিশ্লেষণ",
    privacy: "ব্যক্তিগত",
    sources: "উৎস",
    answer: "উত্তর",
    related: "সম্পর্কিত"
  },
  mr: {
    welcome: "जिथे ज्ञान सुलभ होते.",
    title: "इन्फोसेतू",
    subtitle: "सरकारी योजनांबद्दल काहीही विचारा...",
    placeholder: "पुढील प्रश्न...",
    listening: "ऐकत आहे...",
    processing: "विचार करत आहे...",
    error: "उत्तर मिळवता आले नाही.",
    voiceOn: "आवाज चालू",
    voiceOff: "आवाज बंद",
    stop: "थांबा",
    upload: "विश्लेषण",
    privacy: "खाजगी",
    sources: "स्त्रोत",
    answer: "उत्तर",
    related: "संबंधित"
  },
  te: {
    welcome: "జ్ఞానం అందుబాటులోకి వచ్చే చోట.",
    title: "ఇన్ఫోసేతు",
    subtitle: "ప్రభుత్వ పథకాల గురించి ఏదైనా అడగండి...",
    placeholder: "తదుపరి ప్రశ్న...",
    listening: "వింటున్నాను...",
    processing: "ఆలోచిస్తున్నాను...",
    error: "సమాధానం పొందలేకపోయాము.",
    voiceOn: "వాయిస్ ఆన్",
    voiceOff: "వాయిస్ ఆఫ్",
    stop: "ఆపు",
    upload: "విశ్లేషణ",
    privacy: "ప్రైవేట్",
    sources: "మూలాలు",
    answer: "సమాధానం",
    related: "సంబంధిత"
  },
  hinglish: {
    welcome: "Gyaan jahan accessible ho jaata hai.",
    title: "InBridge",
    subtitle: "Sarkari yojanayon ke baare mein kuch bhi puchein...",
    placeholder: "Agla sawaal...",
    listening: "Sun raha hoon...",
    processing: "Soch raha hoon...",
    error: "Jawab nahi mil raha hai.",
    voiceOn: "Voice On",
    voiceOff: "Voice Off",
    stop: "Roko",
    upload: "Analyze",
    privacy: "Private",
    sources: "Sources",
    answer: "Jawab",
    related: "Related"
  }
};

export default function ChatInterface() {
  const [language, setLanguage] = useState<Language>('en');
  // Fallback to English if translation missing (though we defined all)
  const txt = translations[language] || translations['en'];
  const [messages, setMessages] = useState<Message[]>([]); // Start empty for clean landing

  // Optimistic UI update
  const [optimisticMessages, addOptimisticMessage] = useOptimistic(
    messages,
    (state, newMessage: Message) => [...state, newMessage]
  );

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeechEnabled, setIsSpeechEnabled] = useState(true);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<any>(null);
  const [isClient, setIsClient] = useState(false);

  // Initialize browser APIs
  useEffect(() => {
    setIsClient(true);
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.lang = language === 'en' ? 'en-IN' : 'hi-IN';
      recognition.interimResults = false;
      recognitionRef.current = recognition;

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
      };

      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
    }
    synthRef.current = window.speechSynthesis;
  }, [language]);

  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = language === 'en' ? 'en-IN' : 'hi-IN';
    }
  }, [language]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [optimisticMessages, isLoading, isProcessingImage]);

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en' ? 'hi' : 'en');
  };

  const stopSpeaking = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
  };

  const speak = (text: string) => {
    if (!isSpeechEnabled || !synthRef.current) return;
    stopSpeaking();
    const cleanText = text.replace(/[*#]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = language === 'en' ? 'en-IN' : 'hi-IN';
    utterance.rate = 1.1;
    utterance.pitch = 1.0;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    synthRef.current.speak(utterance);
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    stopSpeaking();
    const userText = input;
    setInput('');

    const userMsg: Message = {
      id: Date.now().toString(),
      text: userText,
      isUser: true,
      timestamp: new Date()
    };

    addOptimisticMessage(userMsg);
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText, language: language })
      });

      const data = await res.json();

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: data.answer || data.response || "No structured answer found.",
        isUser: false,
        timestamp: new Date(),
        sources: data.citations?.map((c: any) => c.title || c.url || "Verified Source")
      };

      setMessages(prev => [...prev, aiMsg]);
      speak(data.answer || data.response);

    } catch (e: any) {
      console.error("Chat Error:", e);
      const errorMsg: Message = {
        id: Date.now().toString(),
        text: "I encountered an error retrieving that information.",
        isUser: false,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingImage(true);
    try {
      const worker = await createWorker('eng');
      const { data: { text } } = await worker.recognize(file);
      await worker.terminate();

      if (text.trim()) {
        const ocrMsg = `[Document Context]: ${text.substring(0, 150)}...`;
        setInput(prev => (prev ? `${prev}\n\n${ocrMsg}` : ocrMsg));
      }
    } catch (err) {
      console.error(err);
      alert('Failed to read image');
    } finally {
      setIsProcessingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      stopSpeaking();
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  return (
    <div className="flex h-screen bg-[#f9f9f9] text-[#111111] font-sans">

      {/* Sidebar (Visual Only) */}
      <aside className="hidden md:flex flex-col w-64 border-r border-gray-200 bg-[#f9f9f9] p-4 space-y-4">
        <div className="flex items-center space-x-2 px-2 pb-4">
          <div className="w-8 h-8 bg-black rounded-md flex items-center justify-center text-white">
            <Library className="w-5 h-5" />
          </div>
          <span className="font-serif font-bold text-xl tracking-tight">InBridge</span>
        </div>

        <button className="flex items-center space-x-3 bg-white border border-gray-200 rounded-full px-4 py-3 shadow-sm hover:shadow-md transition text-sm font-medium text-gray-700">
          <Plus className="w-4 h-4" />
          <span>New Thread</span>
        </button>

        <nav className="space-y-1">
          <div className="px-3 py-2 text-sm font-medium text-gray-900 rounded-lg bg-gray-100 flex items-center space-x-3">
            <Search className="w-4 h-4" />
            <span>Home</span>
          </div>
          <div className="px-3 py-2 text-sm font-medium text-gray-500 rounded-lg hover:bg-gray-100 flex items-center space-x-3 cursor-pointer">
            <Globe className="w-4 h-4" />
            <span>Discover</span>
          </div>
          <div className="px-3 py-2 text-sm font-medium text-gray-500 rounded-lg hover:bg-gray-100 flex items-center space-x-3 cursor-pointer">
            <Library className="w-4 h-4" />
            <span>Library</span>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative bg-white">

        {/* Header - Mobile Only or Minimal */}
        <header className="md:hidden p-4 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white/80 backdrop-blur z-10">
          <span className="font-serif font-bold text-xl">InBridge</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="text-sm font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-md border-none focus:ring-0 cursor-pointer outline-none"
          >
            <option value="en">English</option>
            <option value="hi">हिंदी</option>
            <option value="hinglish">Hinglish</option>
            <option value="bn">বাংলা</option>
            <option value="mr">मराठी</option>
            <option value="te">తెలుగు</option>
          </select>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto w-full">
          <div className="max-w-[750px] mx-auto px-4 py-8 md:py-12 pb-32">

            {optimisticMessages.length === 0 ? (
              // Landing State
              <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 text-center">
                <h1 className="font-serif text-4xl md:text-5xl text-gray-900">{txt.welcome}</h1>
                <p className="text-gray-500 text-lg md:text-xl font-light">{txt.subtitle}</p>
              </div>
            ) : (
              // Chat Flow
              <div className="space-y-10">
                {optimisticMessages.map((msg, idx) => (
                  <div key={msg.id} className="animate-in fade-in duration-500">
                    {msg.isUser ? (
                      // User Query Style
                      <h2 className="text-2xl md:text-3xl font-serif text-gray-900 mb-6 border-b border-gray-100 pb-4">
                        {msg.text}
                      </h2>
                    ) : (
                      // AI Response (Answer Engine Style)
                      <div className="space-y-6">

                        {/* Sources Grid */}
                        {msg.sources && msg.sources.length > 0 && (
                          <div className="space-y-3">
                            <div className="flex items-center space-x-2 text-sm font-medium text-gray-900">
                              <BookOpen className="w-4 h-4" />
                              <span>{txt.sources}</span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {msg.sources.map((s, i) => (
                                <div key={i} className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600 truncate hover:bg-gray-100 cursor-pointer transition">
                                  <div className="font-medium text-gray-900 truncate mb-1">{s}</div>
                                  <div className="flex items-center space-x-1 text-gray-400">
                                    <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                                    <span>1</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Answer Text */}
                        <div className="space-y-3">
                          <div className="flex items-center space-x-2 text-sm font-medium text-gray-900">
                            <Sparkles className="w-4 h-4 text-teal-600" />
                            <span>{txt.answer}</span>
                          </div>
                          <div className="prose prose-slate max-w-none text-gray-800 leading-relaxed text-[16px] md:text-[17px]">
                            <p className="whitespace-pre-wrap">{msg.text}</p>
                          </div>
                        </div>

                        {/* Related / Actions */}
                        <div className="flex items-center space-x-4 pt-2">
                          <button className="flex items-center space-x-2 text-xs text-gray-500 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-full transition">
                            <ArrowUpRight className="w-3 h-3" />
                            <span>Share</span>
                          </button>
                          <button className="flex items-center space-x-2 text-xs text-gray-500 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-full transition">
                            <Plus className="w-3 h-3" />
                            <span>Follow-up</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Loading Skeleton */}
                {(isLoading || isProcessingImage) && (
                  <div className="space-y-4 animate-pulse">
                    <div className="flex items-center space-x-2 text-sm font-medium text-gray-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{isProcessingImage ? 'Reading...' : txt.processing}</span>
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-100 rounded w-3/4"></div>
                      <div className="h-4 bg-gray-100 rounded w-full"></div>
                      <div className="h-4 bg-gray-100 rounded w-5/6"></div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Floating Input Bar */}
        <div className="absolute bottom-6 left-0 right-0 px-4 pointer-events-none">
          <div className="max-w-[700px] mx-auto pointer-events-auto">
            <div className="relative group bg-white border border-gray-200 shadow-lg rounded-[32px] hover:border-gray-300 hover:shadow-xl transition-all duration-300">
              <div className="flex items-end p-2">

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 text-gray-400 hover:text-gray-600 transition disabled:opacity-50"
                  title={txt.upload}
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />

                <div className="flex-1 min-h-[50px] flex items-center">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder={isListening ? txt.listening : (messages.length > 0 ? txt.placeholder : txt.subtitle)}
                    className="w-full bg-transparent border-none focus:outline-none focus:ring-0 text-gray-900 placeholder:text-gray-400 text-base resize-none py-3 max-h-32 scrollbar-none"
                    rows={1}
                    disabled={isLoading}
                  />
                </div>

                <div className="flex items-center space-x-1 pr-1 pb-1">
                  {/* Voice Toggle */}
                  <button
                    onClick={() => setIsSpeechEnabled(!isSpeechEnabled)}
                    className={`p-2 rounded-full transition ${isSpeechEnabled ? 'text-teal-600 bg-teal-50' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    {isSpeechEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </button>

                  {/* Mic */}
                  {isClient && recognitionRef.current && (
                    <button
                      onClick={toggleListening}
                      className={`p-2 rounded-full transition ${isListening ? 'text-red-500 bg-red-50 animate-pulse' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>
                  )}

                  {/* Send */}
                  <button
                    onClick={handleSendMessage}
                    disabled={!input.trim() || isLoading}
                    className={`p-2 rounded-full transition-all duration-200 ${!input.trim() || isLoading
                      ? 'bg-gray-100 text-gray-300'
                      : 'bg-teal-500 text-white hover:bg-teal-600 shadow-sm'
                      }`}
                  >
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-center mt-3 space-x-4 text-[11px] text-gray-400 font-medium items-center">
              <div className="flex items-center space-x-1 group hover:text-gray-600 transition cursor-pointer relative">
                <Globe className="w-3 h-3" />
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as Language)}
                  className="bg-transparent border-none p-0 pr-4 text-[11px] font-medium focus:ring-0 cursor-pointer text-gray-500 appearance-none outline-none"
                >
                  <option value="en">English</option>
                  <option value="hi">हिंदी</option>
                  <option value="hinglish">Hinglish</option>
                  <option value="bn">বাংলা</option>
                  <option value="mr">मराठी</option>
                  <option value="te">తెలుగు</option>
                </select>
              </div>
              <span>•</span>
              <span>{txt.privacy}</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}