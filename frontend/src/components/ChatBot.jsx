import { useState, useCallback, useRef, useEffect } from "react";
import { useVoiceInput } from "../hooks/useVoiceInput";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api/v1";

/**
 * Suggested starter questions shown below the input.
 * Clicking a chip auto-fills the input, lowering the barrier
 * for first-time users who don't know what to ask.
 */
const SUGGESTION_CHIPS = [
  "How do I register to vote for the first time?",
  "I moved to Pune. Which form do I need?",
  "How do I correct my name on my Voter ID?",
  "What happens at the polling booth?",
  "How does the EVM work?",
];

/**
 * ChatBot – Conversational AI Voter Helpdesk component.
 *
 * Key upgrades over v1:
 *  - Uses `useVoiceInput` custom hook (no inline STT logic).
 *  - Manages `session_id` state to maintain multi-turn Gemini ChatSession.
 *    On the first message, sessionId is null → backend creates a new session.
 *    Subsequent messages include the returned sessionId for conversation memory.
 *  - Suggestion chips for first-time discoverability (WCAG 3.3.5 – Help).
 *  - Voice output via SpeechSynthesis when `voiceOutput` prop is true.
 *
 * Accessibility features:
 *  - aria-live="polite" on the message log announces new messages to screen readers.
 *  - Focus shifts to the latest assistant message after each response.
 *  - All interactive elements have descriptive aria-label attributes.
 *  - High-contrast text and focus-visible rings throughout.
 *
 * @param {string}  language     Active language code (en|hi|mr|bho).
 * @param {boolean} voiceOutput  Whether to speak responses aloud via SpeechSynthesis.
 */
export default function ChatBot({ language, voiceOutput }) {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "नमस्ते! 🙏 I'm LokMate, your Election Guide.\n\nAsk me anything about voter registration, election forms (Form 6, 8), EVM usage, or polling booth procedures — in English, हिन्दी, मराठी, or भोजपुरी.",
      id: "welcome",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  /** session_id returned by the first Gemini response; drives multi-turn context */
  const [sessionId, setSessionId] = useState(null);

  const lastAssistantRef = useRef(null);

  // ---------------------------------------------------------------------------
  // Voice Input – delegated to custom hook
  // ---------------------------------------------------------------------------
  const {
    listening,
    transcript,
    startListening,
    clearTranscript,
    error: voiceError,
  } = useVoiceInput(language);

  /**
   * Sync the voice transcript into the text input whenever a new
   * transcript arrives from the hook. Automatically clears the transcript
   * after consuming it so the hook is ready for the next recording.
   */
  useEffect(() => {
    if (transcript) {
      setInput(transcript);
      clearTranscript();
    }
  }, [transcript, clearTranscript]);

  // Voice input errors surface through the main error state
  useEffect(() => {
    if (voiceError) setError(voiceError);
  }, [voiceError]);

  // ---------------------------------------------------------------------------
  // Voice Output (Web Speech Synthesis)
  // ---------------------------------------------------------------------------
  const speakText = useCallback(
    (text) => {
      if (!voiceOutput || !window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = { en: "en-IN", hi: "hi-IN", mr: "mr-IN", bho: "hi-IN" }[language] || "en-IN";
      utter.rate = 0.9;
      utter.pitch = 1.0;
      window.speechSynthesis.speak(utter);
    },
    [voiceOutput, language]
  );

  // ---------------------------------------------------------------------------
  // Send message to backend
  // ---------------------------------------------------------------------------
  const sendMessage = useCallback(async (queryOverride) => {
    const trimmed = (queryOverride ?? input).trim();
    if (!trimmed || loading) return;

    const userMsg = { role: "user", text: trimmed, id: `u-${Date.now()}` };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setError(null);
    setLoading(true);

    try {
      const body = { query: trimmed, language };
      // Include session_id only if we already have one (null → backend creates new session)
      if (sessionId) body.session_id = sessionId;

      const res = await fetch(`${API_BASE}/helpdesk/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Server error ${res.status}`);
      }

      const data = await res.json();

      // Store session_id from the first successful response
      if (data.session_id && !sessionId) {
        setSessionId(data.session_id);
      }

      const assistantMsg = {
        role: "assistant",
        text: data.answer,
        forms: data.form_references,
        id: `a-${Date.now()}`,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      speakText(data.answer);

      // Move focus to the latest assistant message for screen readers
      setTimeout(() => lastAssistantRef.current?.focus(), 80);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [input, loading, language, sessionId, speakText]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <section
      aria-labelledby="chatbot-heading"
      className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-2xl shadow-xl overflow-hidden border border-gray-200 dark:border-gray-700"
    >
      {/* Header */}
      <header className="bg-gradient-to-r from-orange-500 to-green-600 px-5 py-4 flex-shrink-0">
        <h2 id="chatbot-heading" className="text-white text-xl font-bold tracking-wide">
          🗳️ AI Voter Helpdesk
        </h2>
        <p className="text-orange-100 text-sm mt-0.5">
          Ask in any language — English · हिन्दी · मराठी · भोजपुरी
        </p>
      </header>

      {/* Message log */}
      <div
        role="log"
        aria-label="Conversation history"
        aria-live="polite"
        aria-atomic="false"
        className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-800"
      >
        {messages.map((msg, idx) => {
          const isAssistant = msg.role === "assistant";
          const isLast = idx === messages.length - 1;
          return (
            <article
              key={msg.id}
              ref={isAssistant && isLast ? lastAssistantRef : null}
              tabIndex={-1}
              aria-label={`${isAssistant ? "LokMate" : "You"}: ${msg.text}`}
              className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}
            >
              <div
                className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${isAssistant
                    ? "bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-tl-none"
                    : "bg-orange-500 text-white rounded-tr-none"
                  }`}
              >
                {isAssistant && (
                  <span className="text-xs font-semibold text-green-600 dark:text-green-400 block mb-1">
                    LokMate
                  </span>
                )}
                <p className="whitespace-pre-wrap">{msg.text}</p>
                {/* Form reference badge pills */}
                {isAssistant && msg.forms?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2" aria-label="Related forms">
                    {msg.forms.map((f) => (
                      <span
                        key={f}
                        className="inline-block bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs font-medium px-2 py-0.5 rounded-full"
                      >
                        📄 {f}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </article>
          );
        })}

        {/* Typing indicator */}
        {loading && (
          <div role="status" aria-label="LokMate is thinking" className="flex justify-start">
            <div className="bg-white dark:bg-gray-700 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm flex gap-1.5 items-center">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-2 h-2 bg-orange-400 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div role="alert" className="text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded-lg px-4 py-2 text-sm border border-red-200 dark:border-red-700">
            ⚠️ {error}
          </div>
        )}
      </div>

      {/* Suggestion chips – shown only before any user message */}
      {messages.filter((m) => m.role === "user").length === 0 && (
        <div
          className="px-4 pb-2 pt-1 flex flex-wrap gap-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700"
          role="group"
          aria-label="Suggested questions"
        >
          {SUGGESTION_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => sendMessage(chip)}
              aria-label={`Ask: ${chip}`}
              className="text-xs bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-full hover:border-orange-400 hover:text-orange-600 dark:hover:text-orange-400 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500"
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-end gap-2">
          {/* Voice input button */}
          <button
            type="button"
            onClick={listening ? undefined : startListening}
            disabled={loading}
            aria-label={listening ? "Listening… speak now" : "Start voice input"}
            aria-pressed={listening}
            className={`flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500 ${listening
                ? "bg-red-500 text-white animate-pulse cursor-not-allowed"
                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-orange-100 dark:hover:bg-orange-900 cursor-pointer"
              }`}
          >
            🎤
          </button>

          {/* Text input */}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            rows={1}
            placeholder="Type or speak your question…"
            aria-label="Your question for the voter helpdesk"
            className="flex-1 resize-none rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder-gray-400 min-h-[44px] max-h-32"
          />

          {/* Send button */}
          <button
            type="button"
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            aria-label="Send message"
            className="flex-shrink-0 w-11 h-11 rounded-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white flex items-center justify-center transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500"
          >
            ➤
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1.5 pl-1">
          Enter to send · Shift+Enter for new line
          {sessionId && (
            <span className="ml-3 text-green-500" title={`Session: ${sessionId}`}>● Connected</span>
          )}
        </p>
      </div>
    </section>
  );
}
