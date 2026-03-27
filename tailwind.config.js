/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        plasma: {
          bg: '#020617',
          workspace: '#0B1220',
          surface: '#0F172A',
          panel: '#111827',
          panelSecondary: '#1F2937',
          panelElevated: '#243041',
          border: '#334155',
          borderStrong: '#475569',
          divider: '#263244',
          text: '#F8FAFC',
          textSecondary: '#CBD5E1',
          textMuted: '#94A3B8',
          textDisabled: '#64748B',
          blue: '#3B82F6',
          blueHover: '#2563EB',
          green: '#22C55E',
          greenDark: '#16A34A',
          amber: '#F59E0B',
          red: '#EF4444',
          externalConnected: '#38BDF8',
          externalListening: '#818CF8',
          externalDisconnected: '#64748B',
          progressTrack: '#1E293B',
          progressFill: '#3B82F6',
          progressRemaining: '#0F172A',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'app-heading': ['28px', { lineHeight: '1.15', fontWeight: '700' }],
        'section-title': ['18px', { lineHeight: '1.3', fontWeight: '700' }],
        'item-title': ['15px', { lineHeight: '1.35', fontWeight: '600' }],
        'secondary-info': ['13px', { lineHeight: '1.4', fontWeight: '500' }],
        'micro-label': ['11px', { lineHeight: '1.2', fontWeight: '600' }],
      },
      spacing: {
        4.5: '1.125rem',
        18: '4.5rem',
        22: '5.5rem',
        26: '6.5rem',
      },
      borderRadius: {
        panel: '14px',
        button: '10px',
        control: '8px',
        slot: '12px',
      },
      boxShadow: {
        panel: '0 8px 24px rgba(0,0,0,0.22)',
        elevated: '0 10px 30px rgba(0,0,0,0.28)',
      },
    },
  },
  corePlugins: {
    preflight: false,
  },
  plugins: [],
}
