/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./**/*.{ts,tsx}', '!./node_modules/**'],
  presets: [require('nativewind/preset')],
  theme: { extend: {} },
};
