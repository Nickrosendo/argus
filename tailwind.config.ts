import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
		"./*.html",
		"./popup.html",
		"./blocked.html"
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			// The theme tokens from popup.css / blocked.css, so Tailwind classes
			// follow the Paper and Dusk themes
			colors: {
				border: 'var(--line)',
				input: 'var(--line)',
				ring: 'var(--accent)',
				background: 'var(--bg)',
				foreground: 'var(--text)',
				primary: {
					DEFAULT: 'var(--accent)',
					foreground: 'var(--on-accent)'
				},
				secondary: {
					DEFAULT: 'var(--surface)',
					foreground: 'var(--text)'
				},
				destructive: {
					DEFAULT: 'var(--error)',
					foreground: 'var(--surface)'
				},
				muted: {
					DEFAULT: 'var(--track)',
					foreground: 'var(--muted)'
				},
				accent: {
					DEFAULT: 'var(--accent-soft)',
					foreground: 'var(--accent-text)'
				},
				popover: {
					DEFAULT: 'var(--surface)',
					foreground: 'var(--text)'
				},
				card: {
					DEFAULT: 'var(--surface)',
					foreground: 'var(--text)'
				},
				purple: {
					50: '#faf5ff',
					100: '#f3e8ff',
					200: '#e9d5ff',
					300: '#d8b4fe',
					400: '#c084fc',
					500: '#a855f7',
					600: '#9333ea',
					700: '#7c3aed',
					800: '#6d28d9',
					900: '#581c87',
					950: '#3b0764'
				},
				violet: {
					50: '#f5f3ff',
					100: '#ede9fe',
					200: '#ddd6fe',
					300: '#c4b5fd',
					400: '#a78bfa',
					500: '#8b5cf6',
					600: '#7c3aed',
					700: '#6d28d9',
					800: '#5b21b6',
					900: '#4c1d95',
					950: '#2e1065'
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out'
			}
		}
	},
	plugins: [
		require("tailwindcss-animate")
	],
} satisfies Config;
