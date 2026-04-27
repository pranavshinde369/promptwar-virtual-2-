/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,jsx,ts,tsx}",
    ],
    darkMode: "media", // respects system preference; switch to "class" for manual toggle
    theme: {
        extend: {
            fontFamily: {
                sans: ["Inter", "Noto Sans Devanagari", "system-ui", "sans-serif"],
            },
            keyframes: {
                // One-shot gentle bounce for the VVPAT slip appearing
                "bounce-once": {
                    "0%, 100%": { transform: "translateY(0)" },
                    "40%": { transform: "translateY(-8px)" },
                    "60%": { transform: "translateY(-4px)" },
                },
            },
            animation: {
                "bounce-once": "bounce-once 0.6s ease-out forwards",
            },
        },
    },
    plugins: [],
};
