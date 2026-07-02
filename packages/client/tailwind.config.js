/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: 'var(--color-bg)',
          elevated: 'var(--color-bg-elevated)',
        },
        card: {
          DEFAULT: 'var(--color-card)',
          hover: 'var(--color-card-hover)',
          border: 'var(--color-card-border)',
        },
        bull: 'var(--color-bull)',
        bear: 'var(--color-bear)',
        warn: 'var(--color-warn)',
        accent: 'var(--color-accent)',
        muted: 'var(--color-text-muted)',
        dim: 'var(--color-text-dim)',
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
      },
      fontFamily: {
        display: ['Inter', '-apple-system', 'system-ui', 'sans-serif'],
        body: ['Inter', '-apple-system', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        'xxs': '11px',
      },
    },
  },
  plugins: [],
}
