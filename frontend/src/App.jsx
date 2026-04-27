import { useState } from "react";
import ChatBot from "./components/ChatBot";
import EvmSimulator from "./components/EvmSimulator";
import FormNavigator from "./components/FormNavigator";

/**
 * App.jsx – Root application component for LokMate.
 *
 * Responsibilities:
 *  - 3-tab navigation: Voter Helpdesk | EVM Simulator | Form Guide.
 *  - Global accessibility controls: language selector and voice-output toggle.
 *  - Passes language + voiceOutput state down as props.
 *
 * WCAG considerations:
 *  - Skip-navigation link (WCAG 2.4.1 Bypass Blocks).
 *  - Tab list: role="tablist", aria-selected, aria-controls (WCAG 4.1.2).
 *  - High-contrast focus-visible rings ensure keyboard navigation is visible.
 *  - Language selector labelled via <label> + aria-label for screen readers.
 *  - Voice toggle uses role="switch" + aria-checked (WCAG 4.1.2 Name, Role, Value).
 */

const LANGUAGES = [
    { code: "en", label: "English" },
    { code: "hi", label: "हिन्दी" },
    { code: "mr", label: "मराठी" },
    { code: "bho", label: "भोजपुरी" },
];

const TABS = [
    { id: "helpdesk", label: "🗳️ Voter Helpdesk", shortLabel: "Helpdesk" },
    { id: "evm", label: "📟 EVM Simulator", shortLabel: "EVM" },
    { id: "formguide", label: "📋 Form Guide", shortLabel: "Forms" },
];

export default function App() {
    const [activeTab, setActiveTab] = useState("helpdesk");
    const [language, setLanguage] = useState("en");
    const [voiceOutput, setVoiceOutput] = useState(false);

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-green-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 font-sans">
            {/* ================================================================== */}
            {/* Skip navigation – WCAG 2.4.1                                        */}
            {/* ================================================================== */}
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 bg-orange-500 text-white px-4 py-2 rounded-lg z-50 font-semibold"
            >
                Skip to main content
            </a>

            {/* ================================================================== */}
            {/* Sticky header                                                        */}
            {/* ================================================================== */}
            <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">

                    {/* Brand */}
                    <div className="flex items-center gap-2">
                        <span className="text-2xl" aria-hidden="true">🇮🇳</span>
                        <div>
                            <h1 className="text-xl font-extrabold tracking-tight text-orange-600 dark:text-orange-400 leading-none">
                                LokMate
                            </h1>
                            <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight">
                                Your Voice. Your Vote.
                            </p>
                        </div>
                    </div>

                    {/* Accessibility controls */}
                    <div className="flex items-center gap-3 flex-wrap">

                        {/* Language selector */}
                        <label htmlFor="lang-select" className="sr-only">Select response language</label>
                        <select
                            id="lang-select"
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                            aria-label="Select response language"
                            className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
                        >
                            {LANGUAGES.map((l) => (
                                <option key={l.code} value={l.code}>{l.label}</option>
                            ))}
                        </select>

                        {/* Voice output toggle – role="switch" per WCAG */}
                        <button
                            type="button"
                            role="switch"
                            aria-checked={voiceOutput}
                            aria-label={`Voice output is ${voiceOutput ? "on" : "off"}. Click to toggle.`}
                            onClick={() => setVoiceOutput((v) => !v)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500 ${voiceOutput
                                    ? "bg-green-500 border-green-500 text-white"
                                    : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400"
                                }`}
                        >
                            <span aria-hidden="true">{voiceOutput ? "🔊" : "🔇"}</span>
                            <span className="hidden sm:inline">{voiceOutput ? "Voice On" : "Voice Off"}</span>
                        </button>
                    </div>
                </div>

                {/* Tab navigation */}
                <nav
                    role="tablist"
                    aria-label="LokMate sections"
                    className="max-w-5xl mx-auto px-4 flex gap-0"
                >
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            id={`tab-${tab.id}`}
                            aria-selected={activeTab === tab.id}
                            aria-controls={`panel-${tab.id}`}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500 ${activeTab === tab.id
                                    ? "border-orange-500 text-orange-600 dark:text-orange-400"
                                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                                }`}
                        >
                            {/* Show full label on sm+, short label on mobile */}
                            <span className="hidden sm:inline">{tab.label}</span>
                            <span className="sm:hidden">{tab.shortLabel}</span>
                        </button>
                    ))}
                </nav>
            </header>

            {/* ================================================================== */}
            {/* Main content                                                         */}
            {/* ================================================================== */}
            <main id="main-content" className="max-w-5xl mx-auto px-4 py-6">

                {/* Helpdesk panel */}
                <div
                    role="tabpanel"
                    id="panel-helpdesk"
                    aria-labelledby="tab-helpdesk"
                    hidden={activeTab !== "helpdesk"}
                    className="h-[calc(100vh-180px)]"
                >
                    {activeTab === "helpdesk" && (
                        <ChatBot language={language} voiceOutput={voiceOutput} />
                    )}
                </div>

                {/* EVM Simulator panel */}
                <div
                    role="tabpanel"
                    id="panel-evm"
                    aria-labelledby="tab-evm"
                    hidden={activeTab !== "evm"}
                    className="pb-6"
                >
                    {activeTab === "evm" && <EvmSimulator />}
                </div>

                {/* Form Guide panel */}
                <div
                    role="tabpanel"
                    id="panel-formguide"
                    aria-labelledby="tab-formguide"
                    hidden={activeTab !== "formguide"}
                    className="pb-6"
                >
                    {activeTab === "formguide" && <FormNavigator />}
                </div>
            </main>

            {/* Footer */}
            <footer className="text-center text-xs text-gray-400 dark:text-gray-600 py-4 px-4">
                LokMate · Built for Indian voters · Not affiliated with ECI · For educational purposes only ·{" "}
                <a
                    href="https://voters.eci.gov.in"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-orange-500"
                    aria-label="Official ECI voter portal (opens in new tab)"
                >
                    voters.eci.gov.in
                </a>
            </footer>
        </div>
    );
}
