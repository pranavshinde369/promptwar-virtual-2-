import { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api/v1";

/**
 * FormNavigator – Decision-tree UI that guides voters to the correct ECI form.
 *
 * Flow:
 *  1. User selects their situation from a set of scenario cards.
 *  2. Component fetches the corresponding form's step-by-step data
 *     from GET /api/v1/forms/{form_id} (offline-capable / cached).
 *  3. Steps are displayed with completion checkboxes (local state).
 *     User can tick off steps as they complete them.
 *
 * This component is entirely independent of Gemini — works offline.
 *
 * Accessibility:
 *  - Situation cards are <button> elements with descriptive aria-labels.
 *  - Steps use an ordered list (<ol>) for natural screen reader ordinal reading.
 *  - Each checkbox has an associated <label> for full keyboard operation.
 *  - Loading and error states use role="status" / role="alert".
 */

/** Maps user scenarios to the corresponding knowledge-base form_id */
const SCENARIOS = [
    { id: "new-voter", icon: "🆕", label: "I'm registering to vote for the first time", form_id: "form-6" },
    { id: "moved-const", icon: "🏠", label: "I moved to a NEW constituency / city", form_id: "form-8" },
    { id: "moved-local", icon: "📍", label: "I moved within the SAME constituency", form_id: "form-8a" },
    { id: "error-fix", icon: "✏️", label: "I need to correct an error in my Voter ID", form_id: "form-8" },
    { id: "overseas", icon: "✈️", label: "I'm an Indian citizen living abroad (NRI)", form_id: "form-6a" },
    { id: "delete-entry", icon: "🗑️", label: "I want to report a wrong/duplicate voter entry", form_id: "form-7" },
];

export default function FormNavigator() {
    const [selectedScenario, setSelectedScenario] = useState(null);
    const [formData, setFormData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    /**
     * completedSteps: Set of step_numbers the user has checked off.
     * Using a Set gives O(1) lookup and clean React state updates.
     */
    const [completedSteps, setCompletedSteps] = useState(new Set());

    // ---------------------------------------------------------------------------
    // Fetch form data when a scenario is selected
    // ---------------------------------------------------------------------------
    useEffect(() => {
        if (!selectedScenario) return;

        const controller = new AbortController();

        async function fetchForm() {
            setLoading(true);
            setError(null);
            setFormData(null);
            setCompletedSteps(new Set());

            try {
                const res = await fetch(`${API_BASE}/forms/${selectedScenario.form_id}`, {
                    signal: controller.signal,
                });

                if (!res.ok) throw new Error(`Could not load form data (status ${res.status}).`);
                const data = await res.json();
                setFormData(data);
            } catch (err) {
                if (err.name !== "AbortError") {
                    setError(err.message || "Failed to load form steps. Please try again.");
                }
            } finally {
                setLoading(false);
            }
        }

        fetchForm();

        // Cleanup: abort the fetch if the user switches scenarios before it completes
        return () => controller.abort();
    }, [selectedScenario]);

    /** Toggle completion state for a step */
    const toggleStep = (stepNumber) => {
        setCompletedSteps((prev) => {
            const next = new Set(prev);
            next.has(stepNumber) ? next.delete(stepNumber) : next.add(stepNumber);
            return next;
        });
    };

    const completedCount = completedSteps.size;
    const totalSteps = formData?.steps?.length ?? 0;
    const allDone = totalSteps > 0 && completedCount === totalSteps;

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------
    return (
        <section aria-labelledby="form-nav-heading" className="space-y-6 pb-8">
            <header>
                <h2 id="form-nav-heading" className="text-xl font-bold text-gray-800 dark:text-gray-100">
                    📋 Form Guide — Find Your Form
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Tell us your situation and we'll show you exactly which form to fill and how.
                </p>
            </header>

            {/* Scenario selection grid */}
            <fieldset>
                <legend className="sr-only">Select your voting situation</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {SCENARIOS.map((scenario) => {
                        const isSelected = selectedScenario?.id === scenario.id;
                        return (
                            <button
                                key={scenario.id}
                                type="button"
                                onClick={() => setSelectedScenario(scenario)}
                                aria-label={`Select: ${scenario.label}`}
                                aria-pressed={isSelected}
                                className={`flex items-start gap-3 text-left p-4 rounded-xl border-2 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500 ${isSelected
                                        ? "border-orange-500 bg-orange-50 dark:bg-orange-950/40 shadow-md"
                                        : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-orange-300 dark:hover:border-orange-700"
                                    }`}
                            >
                                <span className="text-2xl flex-shrink-0 mt-0.5" aria-hidden="true">
                                    {scenario.icon}
                                </span>
                                <span className="text-sm font-medium text-gray-800 dark:text-gray-200 leading-snug">
                                    {scenario.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </fieldset>

            {/* Loading */}
            {loading && (
                <div role="status" aria-label="Loading form steps" className="flex justify-center py-8">
                    <div className="flex gap-2 items-center text-gray-500 dark:text-gray-400">
                        <span className="animate-spin text-xl">⏳</span>
                        <span className="text-sm">Loading form steps…</span>
                    </div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div role="alert" className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-xl p-4 text-sm text-red-700 dark:text-red-300">
                    ⚠️ {error}
                </div>
            )}

            {/* Form steps */}
            {formData && !loading && (
                <article
                    aria-label={`Steps for ${formData.form_number}`}
                    className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden"
                >
                    {/* Form header */}
                    <header className="bg-gradient-to-r from-blue-700 to-indigo-700 px-5 py-4">
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                            <div>
                                <span className="text-blue-200 text-xs font-bold uppercase tracking-widest">
                                    {formData.form_number}
                                </span>
                                <h3 className="text-white text-lg font-bold mt-0.5">{formData.title}</h3>
                                <p className="text-blue-100 text-sm mt-1">{formData.who_should_fill}</p>
                            </div>
                            {/* Progress ring */}
                            <div
                                aria-label={`${completedCount} of ${totalSteps} steps completed`}
                                className="flex-shrink-0 text-center"
                            >
                                <div
                                    className={`text-2xl font-extrabold ${allDone ? "text-green-300" : "text-white"}`}
                                >
                                    {completedCount}/{totalSteps}
                                </div>
                                <div className="text-blue-200 text-xs">steps done</div>
                            </div>
                        </div>
                    </header>

                    {/* Deadline note */}
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-700 px-5 py-2.5 flex gap-2 items-start">
                        <span aria-hidden="true">⏰</span>
                        <p className="text-xs text-yellow-800 dark:text-yellow-300">{formData.deadline_note}</p>
                    </div>

                    {/* Steps */}
                    <ol className="divide-y divide-gray-100 dark:divide-gray-700" aria-label="Form completion steps">
                        {formData.steps.map((step) => {
                            const done = completedSteps.has(step.step_number);
                            return (
                                <li
                                    key={step.step_number}
                                    className={`px-5 py-4 transition-colors ${done ? "bg-green-50 dark:bg-green-900/20" : ""}`}
                                >
                                    <label
                                        className="flex gap-4 cursor-pointer group"
                                        htmlFor={`step-${step.step_number}`}
                                    >
                                        {/* Checkbox */}
                                        <input
                                            id={`step-${step.step_number}`}
                                            type="checkbox"
                                            checked={done}
                                            onChange={() => toggleStep(step.step_number)}
                                            aria-label={`Mark step ${step.step_number} as complete: ${step.title}`}
                                            className="mt-1 h-5 w-5 rounded border-gray-300 text-green-500 focus:ring-green-400 flex-shrink-0 cursor-pointer"
                                        />
                                        <div className="flex-1 min-w-0">
                                            {/* Step number + title */}
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className={`text-xs font-bold px-1.5 py-0.5 rounded ${done
                                                            ? "bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200"
                                                            : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                                                        }`}
                                                >
                                                    Step {step.step_number}
                                                </span>
                                                <h4
                                                    className={`text-sm font-semibold ${done ? "line-through text-gray-400" : "text-gray-800 dark:text-gray-100"
                                                        }`}
                                                >
                                                    {step.title}
                                                </h4>
                                            </div>
                                            {/* Description */}
                                            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                                                {step.description}
                                            </p>
                                            {/* Tip callout */}
                                            {step.tip && (
                                                <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 rounded-lg px-3 py-1.5">
                                                    💡 <strong>Tip:</strong> {step.tip}
                                                </p>
                                            )}
                                        </div>
                                    </label>
                                </li>
                            );
                        })}
                    </ol>

                    {/* Footer: official link */}
                    <footer className="px-5 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between gap-4 flex-wrap">
                        <a
                            href={formData.official_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Fill ${formData.form_number} on the official ECI portal (opens in new tab)`}
                            className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-4 py-2 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400"
                        >
                            🔗 Fill on ECI Portal
                        </a>
                        {allDone && (
                            <p role="status" className="text-green-600 dark:text-green-400 text-sm font-semibold animate-pulse">
                                ✅ All steps checked — you're ready to submit!
                            </p>
                        )}
                    </footer>
                </article>
            )}
        </section>
    );
}
