import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#17211f",
        cloud: "#f5f7f2",
        paper: "#fffdf8",
        mist: "#dfe8e2",
        pine: "#24483f",
        coral: "#e9755f",
        skywash: "#d8e9ee",
        sun: "#f6c35f"
      },
      boxShadow: {
        soft: "0 18px 45px rgba(23, 33, 31, 0.12)"
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "ui-sans-serif", "system-ui"]
      }
    }
  },
  plugins: []
};

export default config;
