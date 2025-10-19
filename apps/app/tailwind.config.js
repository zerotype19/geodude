import { type Config } from 'tailwindcss';

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  plugins: [
    require('@tailwindcss/typography'),
  ],
} satisfies Config;

