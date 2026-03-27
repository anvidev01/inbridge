import React from 'react';

export interface ChatHistoryItem {
    id: string;
    title: string;
    updatedAt: Date;
}

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
    history: ChatHistoryItem[];
    currentChatId: string | null;
    onSelectChat: (id: string) => void;
    onNewChat: () => void;
    onDeleteChat: (id: string) => void;
    onServiceClick: (message: string) => void;
    user: string | null;
    onOpenLogin: () => void;
    onLogout: () => void;
}

const SERVICES = [
    {
        label: 'Identity & ID Cards',
        message: 'What are the available identity and ID card services in India? (e.g. Aadhaar, PAN, Voter ID)',
        icon: (
            <svg className="text-neutral-500 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="14" x="3" y="5" rx="2" ry="2" /><path d="M7 15h4M15 15h2M7 11h2M15 11h2" /></svg>
        ),
    },
    {
        label: 'Health & Wellness',
        message: 'What government health and wellness schemes are available in India? (e.g. Ayushman Bharat, PMJAY)',
        icon: (
            <svg className="text-neutral-500 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /><path d="M12 5 9.04 7.96a2.17 2.17 0 0 0 0 3.08v0c.82.82 2.13.85 3 .07l2.07-1.9a2.82 2.82 0 0 1 3.79 0l2.96 2.66" /></svg>
        ),
    },
    {
        label: 'Education & Grants',
        message: 'What education grants, scholarships, and schemes are available from the Government of India?',
        icon: (
            <svg className="text-neutral-500 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /></svg>
        ),
    },
    {
        label: 'Official Documents',
        message: 'How can I apply for official government documents in India? (e.g. Passport, Birth Certificate, Domicile)',
        icon: (
            <svg className="text-neutral-500 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><line x1="16" x2="8" y1="13" y2="13" /><line x1="16" x2="8" y1="17" y2="17" /><line x1="10" x2="8" y1="9" y2="9" /></svg>
        ),
    },
];

export function Sidebar({ isOpen, onClose, history, currentChatId, onSelectChat, onNewChat, onDeleteChat, onServiceClick, user, onOpenLogin, onLogout }: SidebarProps) {

    return (
        <>
            {/* Mobile overlay */}
            {isOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-white/20 z-20 transition-opacity"
                    onClick={onClose}
                    aria-hidden="true"
                />
            )}

            {/* Sidebar Container */}
            <div
                className={`fixed lg:static inset-y-0 left-0 z-30 w-[260px] bg-[#171717] border-r border-neutral-800 transform transition-transform duration-200 ease-in-out flex flex-col h-full
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
            >

                {/* Header - Brand Logo */}
                <div className="p-5 flex items-start gap-3">
                    <div className="w-8 h-8 mt-0.5 rounded shadow-sm shrink-0 overflow-hidden relative border border-neutral-800 flex items-center justify-center">
                        <img src="/logo.jpg" alt="InBridge Logo" className="w-full h-full object-cover object-center" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xl font-bold font-serif tracking-tight text-neutral-100 leading-tight">InBridge</span>
                        <span className="text-[10px] text-neutral-500 font-medium tracking-wide leading-tight mt-0.5 max-w-[170px]">Public service at the speed of life</span>
                    </div>
                </div>

                {/* Navigation Lists */}
                <div className="flex-1 overflow-y-auto px-3 pb-4 flex flex-col gap-6 mt-2">

                    {/* SERVICES SECTION */}
                    <div>
                        <ul className="space-y-1">
                            <li>
                                <button onClick={onNewChat} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800 rounded-lg transition-colors font-medium">
                                    <svg className="text-neutral-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v8" /><path d="M8 12h8" /></svg>
                                    New Thread
                                </button>
                            </li>
                            {SERVICES.map((service) => (
                                <li key={service.label}>
                                    <button
                                        onClick={() => {
                                            onServiceClick(service.message);
                                            onClose();
                                        }}
                                        className="w-full flex items-center gap-3 px-3 py-2 text-[13px] text-neutral-400 hover:bg-neutral-800 rounded-lg transition-colors font-medium group"
                                    >
                                        <span className="text-[#737373] group-hover:text-neutral-400 transition-colors">{service.icon}</span>
                                        {service.label}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* RECENT SECTION */}
                    <div className="pt-4 border-t border-neutral-800">
                        <div className="flex items-center justify-between px-3 mb-2">
                            <h3 className="text-[11px] font-bold text-[#737373] uppercase tracking-wider">Library</h3>
                        </div>

                        <ul className="space-y-0.5">
                            {!user ? (
                                <li className="px-3 py-2 text-[13px] text-[#737373]">Log in to view history</li>
                            ) : history.length === 0 ? (
                                <li className="px-3 py-2 text-[13px] text-[#737373]">No recent threads</li>
                            ) : (
                                history.map((item) => (
                                    <li key={item.id} className="group relative">
                                        <button
                                            onClick={() => onSelectChat(item.id)}
                                            className={`w-full flex items-center gap-3 px-3 py-2 text-[13px] rounded-lg transition-colors overflow-hidden text-ellipsis whitespace-nowrap
                                                ${currentChatId === item.id
                                                    ? 'bg-neutral-800 text-neutral-100 font-semibold'
                                                    : 'text-neutral-400 hover:bg-neutral-800 font-medium'
                                                }`}
                                        >
                                            <svg className="text-[#737373] flex-shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
                                            <span className="truncate">{item.title}</span>
                                        </button>
                                    </li>
                                ))
                            )}
                        </ul>
                    </div>
                </div>

                {/* Footer info area */}
                {user ? (
                    <div className="p-4 mx-3 mb-4 rounded-xl border border-neutral-800 bg-[#0a0a0a] flex items-center gap-3 shadow-sm hover:border-neutral-700 transition-colors group relative">
                        <div className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center text-xs font-bold shrink-0">
                            {user.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <div className="text-[13px] font-semibold text-neutral-200 truncate leading-tight">{user}</div>
                            <div className="text-[11px] text-neutral-500 font-medium truncate mt-0.5">Pro Member</div>
                        </div>
                        <button onClick={onLogout} title="Sign Out" className="opacity-0 group-hover:opacity-100 absolute right-3 p-1.5 rounded-md hover:bg-neutral-800 text-neutral-500 transition-all">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>
                        </button>
                    </div>
                ) : (
                    <div className="px-3 mb-4">
                        <button
                            onClick={onOpenLogin}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-sm font-semibold text-neutral-200 transition-colors"
                        >
                            Sign Up
                        </button>
                    </div>
                )}

            </div>
        </>
    );
}
