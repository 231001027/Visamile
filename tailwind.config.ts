import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F7F7F3",
        ink: "#151A19",
        teal: {
          50: "#EAF3F1",
          100: "#CFE4DF",
          300: "#7EB3A8",
          500: "#0F4C42",
          600: "#0C3E36",
          700: "#092E28",
        },
        stamp: {
          400: "#E1A73B",
          500: "#C98F24",
          600: "#A6741A",
        },
        line: "#DDDFD8",
        danger: "#B3423B",
      },
      fontFamily: {
        display: ["Georgia", "Cambria", "Times New Roman", "serif"],
        body: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      borderRadius: {
        sm: "4px",
        md: "8px",
      },
    },
  },
  plugins: [],
};

export default config;
