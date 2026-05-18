import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        accord: { teal: "#19C6C8" },
      },
    },
  },
  plugins: [],
};

export default config;
