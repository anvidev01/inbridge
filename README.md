# InBridge — Integrated Government Digital Services Platform 🇮🇳

> **Public service at the speed of life.** A GIGW 3.0 & WCAG 2.2 AA compliant
> government digital services platform built with Next.js 16 (App Router) and
> Tailwind CSS v4 — serving 1.4 billion citizens.

[![Build](https://img.shields.io/badge/build-passing-2E7D32?style=flat-square)](https://github.com/anvidev01/InBridge-)
[![WCAG](https://img.shields.io/badge/WCAG-2.2%20AA-1A237E?style=flat-square)](https://www.w3.org/WAI/WCAG22/quickref/)
[![GIGW](https://img.shields.io/badge/GIGW-3.0-1A237E?style=flat-square)](https://guidelines.india.gov.in/)
[![DPDP](https://img.shields.io/badge/DPDP%20Act-2023-C62828?style=flat-square)](https://www.meity.gov.in/data-protection-framework)
[![License](https://img.shields.io/badge/license-MIT-616161?style=flat-square)](./LICENSE)

---

## ✨ What is InBridge?

InBridge (InBridge — *information bridge*) is a full-stack government digital services platform commissioned by **MeitY (Ministry of Electronics & Information Technology)**. It consolidates 100+ citizen services — Aadhaar, PAN, Passport, Ration Card, ITR, PM-KISAN, RTI and more — behind a single, accessible portal.

It is designed specifically for **ALL** Indian citizens including:
- 🧓 Elderly users with larger touch targets and clear fonts
- 📵 Rural users with voice input (Web Speech API) and offline-friendly design
- ♿ Differently-abled users with full screen-reader and keyboard support
- 🔤 Low-literacy users with bilingual UI (Hindi + English + 9 regional languages)

---

## 🖼️ Screenshots

| Dashboard | Apply Form | Status Tracker |
|-----------|-----------|---------------|
| Quick Action tiles grouped by category | 4-step form with auto-save & progress | ARN search with visual timeline |

---

## 🚀 Features

### 🏛️ Government Compliance
- **GIGW 3.0** — State Emblem, Ministry branding, all mandatory footer links, Last Updated date, NIC/STQC certification badges
- **WCAG 2.2 Level AA** — Skip links, `aria-live` regions, `aria-current="step"`, keyboard navigation, 44×44px touch targets
- **DPDP Act 2023** — Explicit opt-in cookie consent banner, data minimisation
- **Rights of Persons with Disabilities Act 2016** — Full screen-reader support, voice input, high-contrast colours

### 🎨 UI / UX
- **Hub Dashboard** — 16 Quick Action tiles (Personal · Family · Financial · Grievance) with ARIA tab-panel navigation
- **Bilingual Search** — Hindi/English placeholder, voice-to-text input
- **Language Toggle** — 11 Indian languages via Bhashini API (EN, HI, BN, TE, MR, TA, GU, KN, ML, PA, OR)
- **Voice Mic** — Pulsing mic button using Web Speech API with `aria-pressed` state
- **Notification Panel** — Pending applications, renewal reminders, success alerts

### 📝 Multi-Step Application Form
- 4 steps: Personal Info → Address → Documents → Review & Submit
- **Auto-save every 60 seconds** → toast notification _"Progress saved ✓"_
- **"Save & Continue Later"** → generates unique 8-character alphanumeric resume code
- **Aadhaar Input** — Auto-hyphenated `XXXX-XXXX-XXXX`, `inputMode="numeric"`, digit progress indicator
- **Review Step** — Pre-submit `dl/dt/dd` summary with per-section Edit links
- **On Submit** — Application Reference Number (ARN) + processing timeline + SMS/email confirmation stub

### 🤖 AI Answer Engine (New UI)
- **Perplexity-Style Interface** — Modern, minimalist Search-First entry state rendering queries as prominent headers.
- **Dark Mode Native** — Deep `#0a0a0a` backgrounds with sleek neutral accents (`bg-neutral-900`) for an immersive, high-contrast experience.
- **Mock Authentication** — Beautiful modal-based login flow with dynamic sidebar user profile badges.
- **Sources Deck** — Transparent, horizontally-scrolling citation cards leading the response flow immediately above the text.
- **Groq Cloud** (Llama-3.3-70b-versatile) for blazing-fast LLM inference.
- **Agentic RAG** — Faiss-Node vector store + Tavily web search.
- **PII Guardrails** — Strict content filtering before LLM context.
- **Doc Analysis** — OCR via Tesseract.js for uploaded scheme PDFs.

---

## 🗂️ Project Structure

```
inbridge-chatbot/
├── src/
│   ├── app/
│   │   ├── globals.css              # Tailwind v4 design tokens + a11y utilities
│   │   ├── layout.tsx               # Root layout (GIGW header + footer + DPDP banner)
│   │   ├── page.tsx                 # Hub Dashboard — Quick Actions + Notifications
│   │   ├── services/[slug]/         # Service detail pages (eligibility, docs, CTA)
│   │   ├── apply/[service]/         # 4-step application form
│   │   ├── status/                  # Application status tracker (ARN search)
│   │   └── api/chat/                # AI chatbot API route (Groq + RAG)
│   ├── components/
│   │   ├── layout/
│   │   │   ├── SkipToMain.tsx       # WCAG 2.4.1 skip navigation link
│   │   │   ├── GovHeader.tsx        # Emblem · Ministry · Language · Voice · Nav
│   │   │   └── GovFooter.tsx        # All GIGW-mandated footer links
│   │   ├── dashboard/
│   │   │   ├── SearchBar.tsx        # role="search", bilingual placeholder
│   │   │   ├── QuickActionCard.tsx  # 44px tile, per-category colour, hover fx
│   │   │   ├── QuickActionGrid.tsx  # ARIA tablist, arrow-key nav, 16 tiles
│   │   │   └── NotificationPanel.tsx# aria-live, unread badge, 4 status types
│   │   ├── form/
│   │   │   ├── Stepper.tsx          # aria-current="step", ✓ completed, mobile bar
│   │   │   ├── FormField.tsx        # label↔input, aria-describedby, tooltip
│   │   │   ├── AadhaarInput.tsx     # Masked XXXX-XXXX-XXXX, autocomplete="off"
│   │   │   └── ReviewSummary.tsx    # dl/dt/dd, Edit links, WCAG 3.3.4
│   │   └── ui/
│   │       ├── LanguageToggle.tsx   # 11-language ARIA listbox
│   │       ├── VoiceMicButton.tsx   # Web Speech API, aria-pressed
│   │       ├── Toast.tsx            # aria-live="polite" auto-save notify
│   │       └── CookieBanner.tsx     # DPDP Act 2023 opt-in dialog
│   └── lib/
│       ├── rag-engine.ts            # RAG pipeline (Groq + Faiss + Tavily)
│       └── guardrails.ts            # PII content filtering
├── scripts/                         # Scraper + vector store generation
├── vector_store/                    # Faiss index (committed for Vercel deploy)
├── public/                          # Static assets
│   ├── emblem-dark.png              # ← ADD: State Emblem (dark bg variant)
│   └── emblem-white.png             # ← ADD: State Emblem (white bg variant)
├── next.config.ts
├── tsconfig.json
└── package.json
```

---

## 🎨 Design Tokens

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-navy` | `#1A237E` | Headers, primary buttons, nav links |
| `--color-green` | `#2E7D32` | Submit buttons, success states, CTAs |
| `--color-red` | `#C62828` | Errors, critical alerts |
| `--color-bg` | `#F5F5F5` | Page background |
| `--color-white` | `#FFFFFF` | Cards, form backgrounds |
| `--color-muted` | `#616161` | Body text, borders |

All colour combinations meet **WCAG 4.5:1 contrast ratio** for text.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router, Turbopack) |
| **Styling** | Tailwind CSS v4 (`@theme` inline tokens) |
| **Language** | TypeScript 5 |
| **LLM** | Groq Cloud — Llama-3.3-70b-versatile |
| **Search** | Tavily AI (live government data) |
| **Vector DB** | Faiss-Node (serverless-compatible) |
| **OCR** | Tesseract.js |
| **Fonts** | Inter (Google Fonts) |
| **Icons** | Inline SVG (no external dependency) |
| **Voice** | Web Speech API (browser-native) |
| **Deploy** | Vercel |

---

## ⚡ Quick Start

### Prerequisites
- Node.js 20+
- npm 9+
- Groq API key ([get one free](https://console.groq.com))
- Tavily API key ([get one free](https://tavily.com))

### 1. Clone & Install

```bash
git clone https://github.com/anvidev01/InBridge-.git
cd InBridge-
npm install
```

### 2. Environment Variables

Create a `.env.local` file:

```env
# Required — LLM provider
GROQ_API_KEY=your_groq_api_key_here

# Required — Web search
TAVILY_API_KEY=your_tavily_api_key_here
```

### 3. Run Development Server

```bash
npm run dev
# → http://localhost:3000
```

### 4. Build for Production

```bash
npm run build
npm start
```

---

## 📑 Available Routes

| Route | Description |
|-------|-------------|
| `/` | Hub Dashboard — Quick Actions + Notifications |
| `/services/aadhaar` | Aadhaar Card service detail |
| `/services/pan` | PAN card update service detail |
| `/services/pm-kisan` | PM-KISAN status service detail |
| `/apply/[service]` | 4-step application form for any service |
| `/status` | Application Reference Number (ARN) tracker |
| `/api/chat` | AI chatbot API endpoint (POST) |

> **Demo:** Go to `/status` and enter `ARN-TEST-001` to see the status tracker.

---

## ♿ Accessibility

This platform is built to **WCAG 2.2 Level AA** — mandatory for all Indian Government websites under GIGW 3.0.

| Criterion | Implementation |
|-----------|---------------|
| **2.4.1** Skip Navigation | `SkipToMain` — first focusable element on every page |
| **2.5.8** Target Size | All buttons/tiles ≥ 44×44px |
| **1.3.1** Info & Relationships | `htmlFor/id` on every form control, `dl/dt/dd` for data |
| **4.1.3** Status Messages | `aria-live="polite"` on toasts and notification panel |
| **1.4.3** Contrast | All text meets 4.5:1 ratio; UI components meet 3:1 |
| **2.1.1** Keyboard | Full tab + arrow-key navigation on tabs, dropdowns |
| **3.3.1** Error Identification | Text error messages with error icon, `role="alert"` |
| **3.3.4** Error Prevention | Review step before all submissions |
| **3.1.2** Language of Parts | `lang` attribute on every language option button |

---

## 🌐 Deployment (Vercel)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel Dashboard:
# GROQ_API_KEY, TAVILY_API_KEY
```

The `vector_store/` directory is committed to the repo so Faiss works on
Vercel's serverless environment without a separate database.

---

## 🔄 Scripts

```bash
npm run dev          # Start development server (Turbopack)
npm run build        # Production build + TypeScript check
npm run lint         # ESLint check
npm run db:generate  # Regenerate Faiss vector store from scraped data
npm run scrape       # Run Python scraper for government scheme data
```

---

## 📋 Roadmap

- [ ] Digilocker integration for document auto-fill
- [ ] Real API integration for ARN status (replacing demo data)
- [ ] reCAPTCHA / hCaptcha on form submit step
- [ ] MSG91 SMS + email confirmation on application submit
- [ ] Bhashini API live translation (replace static language toggle)
- [ ] PWA / offline support for rural connectivity
- [ ] DigiLocker OAuth for pre-filled Aadhaar/PAN data
- [ ] Admin dashboard for grievance management

---

## 🤝 Contributing

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before submitting pull requests.

---

## 📄 License

MIT © 2026 [anvidev01](https://github.com/anvidev01) — Built for MeitY / Government of India

---

*InBridge — InBridge — सरकारी सेवाएं, एक जगह।*  
*Information bridge — Government services, all in one place.*
