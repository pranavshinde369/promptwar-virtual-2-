/**
 * useVoiceInput.js – Custom React hook for Web Speech API voice input.
 *
 * Extracts all microphone/speech-recognition logic out of components so
 * any component can add voice input with a single hook call.
 *
 * Features:
 *  - Starts / stops the browser's SpeechRecognition engine.
 *  - Maps BCP-47 language codes to the correct recognition locale.
 *  - Degrades gracefully on unsupported browsers (returns error state).
 *  - Exposes `listening` boolean so UI can show a pulsing indicator.
 *
 * Usage:
 *  const { listening, transcript, startListening, error } = useVoiceInput("hi");
 *
 * @param {string} language  BCP-47-ish code: "en" | "hi" | "mr" | "bho"
 * @returns {{ listening: boolean, transcript: string, startListening: function, error: string|null }}
 */

import { useState, useRef, useCallback } from "react";

/** Maps our app's language codes to Web Speech API locale strings */
const LOCALE_MAP = {
    en: "en-IN",
    hi: "hi-IN",
    mr: "mr-IN",
    bho: "hi-IN",  // Bhojpuri falls back to Hindi locale (closest available)
};

export function useVoiceInput(language = "en") {
    const [listening, setListening] = useState(false);
    const [transcript, setTranscript] = useState("");
    const [error, setError] = useState(null);
    const recognitionRef = useRef(null);

    /**
     * Start the SpeechRecognition engine.
     *
     * On success, `transcript` is updated with the recognised text.
     * On failure, `error` is set with a human-readable message.
     * In both cases `listening` returns to false when audio processing ends.
     */
    const startListening = useCallback(() => {
        // Detect browser support (Chrome, Edge, Safari 14.1+)
        const SpeechRecognition =
            window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            setError(
                "Voice input is not supported in this browser. Please use Chrome or Edge."
            );
            return;
        }

        // Stop any in-progress recognition before starting a new one
        if (recognitionRef.current) {
            recognitionRef.current.abort();
        }

        const recognition = new SpeechRecognition();
        recognition.lang = LOCALE_MAP[language] || "en-IN";
        recognition.interimResults = false;  // only return final transcripts
        recognition.maxAlternatives = 1;

        recognition.onstart = () => { setListening(true); setError(null); };
        recognition.onend = () => setListening(false);
        recognition.onerror = (e) => {
            setListening(false);
            if (e.error === "not-allowed") {
                setError("Microphone permission denied. Please allow access in your browser settings.");
            } else if (e.error === "no-speech") {
                setError("No speech detected. Please speak clearly and try again.");
            } else {
                setError(`Voice error: ${e.error}. Please type your question instead.`);
            }
        };
        recognition.onresult = (event) => {
            const text = event.results[0][0].transcript;
            setTranscript(text);
            setListening(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
    }, [language]);

    /** Manually stop listening (e.g. user presses the button a second time). */
    const stopListening = useCallback(() => {
        recognitionRef.current?.stop();
        setListening(false);
    }, []);

    /** Clear the current transcript (e.g. after the user sends the message). */
    const clearTranscript = useCallback(() => setTranscript(""), []);

    return { listening, transcript, startListening, stopListening, clearTranscript, error };
}
