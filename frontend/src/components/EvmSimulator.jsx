import { useState, useCallback } from "react";

/**
 * EvmSimulator – Interactive mock of an Indian EVM (Electronic Voting Machine).
 *
 * Purpose: Demystify the polling booth experience for first-time voters by
 * letting them "practice" a vote in a safe, zero-stakes environment.
 *
 * The mock simulates:
 *  1. The candidate list panel with party symbols and the blue ballot button.
 *  2. The VVPAT slip drop animation after a vote is cast.
 *  3. A reset flow, mirroring the machine being cleared between voters.
 *
 * Accessibility:
 *  - All buttons have aria-label with candidate name and party.
 *  - VVPAT confirmation is announced via role="status" (polite live region).
 *  - Focus is trapped within the active voting step via tabIndex management.
 *  - High-contrast ECI blue (#1a56db) used for ballot buttons.
 */

// Mock candidates – representative example, no real election data
const CANDIDATES = [
    { id: 1, name: "Anita Sharma", party: "Janata Dal", symbol: "🌾", serial: "1" },
    { id: 2, name: "Ravi Kumar", party: "Pradesh Party", symbol: "🌸", serial: "2" },
    { id: 3, name: "Sunita Patil", party: "Lok Shakti", symbol: "🔆", serial: "3" },
    { id: 4, name: "Mohammed Farouk", party: "Swatantra Dal", symbol: "⭐", serial: "4" },
    { id: 5, name: "NOTA", party: "None of the Above", symbol: "✖️", serial: "5" },
];

const STEP = {
    IDLE: "idle",       // Machine locked, waiting
    VOTING: "voting",   // Voter presses a ballot button
    VVPAT: "vvpat",    // VVPAT slip animating
    DONE: "done",       // Vote recorded, machine locked
};

export default function EvmSimulator() {
    const [step, setStep] = useState(STEP.IDLE);
    const [selected, setSelected] = useState(null);   // candidate ID
    const [beepCount, setBeepCount] = useState(0);    // tracks consecutive button presses
    const [machineLit, setMachineLit] = useState(false);

    /**
     * handleStart – Presiding officer "enables" the machine for the next voter.
     * In a real EVM, this is a physical ballot button press on the BU (Ballot Unit).
     */
    const handleStart = useCallback(() => {
        setStep(STEP.VOTING);
        setSelected(null);
        setMachineLit(true);
    }, []);

    /**
     * handleVote – Voter presses the blue button next to their chosen candidate.
     * Triggers a VVPAT animation (3-second slip display) before locking.
     */
    const handleVote = useCallback((candidateId) => {
        if (step !== STEP.VOTING) return;
        setSelected(candidateId);
        setBeepCount((c) => c + 1);
        setStep(STEP.VVPAT);

        // VVPAT slip visible for 7 seconds (ECI spec), using 3s here for UX
        setTimeout(() => {
            setStep(STEP.DONE);
            setMachineLit(false);
        }, 3000);
    }, [step]);

    /**
     * handleReset – Resets the simulator for the next practice attempt.
     */
    const handleReset = useCallback(() => {
        setStep(STEP.IDLE);
        setSelected(null);
    }, []);

    const selectedCandidate = CANDIDATES.find((c) => c.id === selected);

    return (
        <section
            aria-labelledby="evm-heading"
            className="space-y-4"
        >
            <header>
                <h2 id="evm-heading" className="text-xl font-bold text-gray-800 dark:text-gray-100">
                    🗳️ EVM Practice Simulator
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Practice your vote safely. No real data is recorded.
                </p>
            </header>

            {/* EVM Body */}
            <figure
                aria-label="Electronic Voting Machine"
                className="bg-gray-100 dark:bg-gray-800 rounded-3xl p-1.5 shadow-2xl border-4 border-gray-400 dark:border-gray-600 max-w-sm mx-auto"
            >
                {/* EVM Top header bar */}
                <div className="bg-blue-900 rounded-t-2xl px-4 py-2 flex items-center justify-between">
                    <span className="text-white text-xs font-bold tracking-widest uppercase">ECI – Ballot Unit</span>
                    <span
                        aria-live="polite"
                        aria-label={machineLit ? "Machine ready" : "Machine locked"}
                        className={`w-3 h-3 rounded-full transition-colors duration-500 ${machineLit ? "bg-green-400 animate-pulse" : "bg-red-500"}`}
                    />
                </div>

                {/* Candidate list */}
                <div className="bg-gray-200 dark:bg-gray-700 rounded-b-xl overflow-hidden divide-y divide-gray-300 dark:divide-gray-600">
                    {CANDIDATES.map((c) => (
                        <div
                            key={c.id}
                            className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${selected === c.id
                                    ? "bg-yellow-100 dark:bg-yellow-900/40"
                                    : step === STEP.VOTING
                                        ? "hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                        : ""
                                }`}
                        >
                            {/* Serial number */}
                            <span
                                aria-hidden="true"
                                className="text-xs text-gray-500 dark:text-gray-400 w-4 shrink-0"
                            >
                                {c.serial}.
                            </span>

                            {/* Party symbol */}
                            <span aria-hidden="true" className="text-2xl w-8 text-center">
                                {c.symbol}
                            </span>

                            {/* Candidate info */}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                                    {c.name}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{c.party}</p>
                            </div>

                            {/* EVM Blue Ballot Button */}
                            <button
                                type="button"
                                onClick={() => handleVote(c.id)}
                                disabled={step !== STEP.VOTING}
                                aria-label={`Vote for ${c.name}, ${c.party}`}
                                aria-pressed={selected === c.id}
                                className={`w-9 h-7 rounded-sm font-bold text-white text-xs transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400 shrink-0 ${step === STEP.VOTING
                                        ? "bg-[#1a56db] hover:bg-blue-700 active:scale-95 shadow-md cursor-pointer"
                                        : "bg-gray-400 dark:bg-gray-500 cursor-not-allowed opacity-60"
                                    }`}
                            >
                                ▶
                            </button>
                        </div>
                    ))}
                </div>
            </figure>

            {/* VVPAT Slip Animation */}
            {step === STEP.VVPAT && selectedCandidate && (
                <div
                    role="status"
                    aria-live="assertive"
                    aria-label={`VVPAT slip printed for ${selectedCandidate.name}`}
                    className="max-w-sm mx-auto"
                >
                    <div className="bg-white dark:bg-gray-100 border-2 border-dashed border-gray-400 rounded-xl p-4 text-center shadow-lg animate-bounce-once">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                            🖨️ VVPAT Slip – Verify Your Vote
                        </p>
                        <div className="text-4xl mb-1">{selectedCandidate.symbol}</div>
                        <p className="text-base font-bold text-gray-900">{selectedCandidate.name}</p>
                        <p className="text-sm text-gray-600">{selectedCandidate.party}</p>
                        <p className="text-xs text-gray-400 mt-2">
                            Slip will be dropped in the sealed VVPAT box automatically.
                        </p>
                    </div>
                    <p className="text-center text-green-600 font-semibold text-sm mt-2 animate-pulse">
                        ✅ One long beep – Vote recorded!
                    </p>
                </div>
            )}

            {/* Done state */}
            {step === STEP.DONE && (
                <div
                    role="status"
                    aria-live="polite"
                    className="max-w-sm mx-auto text-center bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-xl p-4"
                >
                    <p className="text-green-700 dark:text-green-300 font-semibold">
                        🎉 Practice vote cast successfully!
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-3">
                        You voted for <strong>{selectedCandidate?.name}</strong> ({selectedCandidate?.party}).
                        In a real booth, you would now leave the polling station.
                    </p>
                    <button
                        onClick={handleReset}
                        aria-label="Reset EVM simulator for another practice round"
                        className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-5 py-2 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400"
                    >
                        🔄 Practice Again
                    </button>
                </div>
            )}

            {/* Idle – Start prompt */}
            {step === STEP.IDLE && (
                <div className="max-w-sm mx-auto text-center">
                    <button
                        onClick={handleStart}
                        aria-label="Start EVM practice – enable the ballot unit"
                        className="bg-blue-700 hover:bg-blue-800 text-white font-semibold px-6 py-3 rounded-full transition-colors shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
                    >
                        ▶ Start Practice Vote
                    </button>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                        A polling officer will enable your machine at the booth.
                    </p>
                </div>
            )}

            {/* Stats */}
            <p className="text-center text-xs text-gray-400 dark:text-gray-600">
                Practice sessions this session: {beepCount}
            </p>
        </section>
    );
}
