import { motion } from 'motion/react';
import { useTheme } from '../ThemeProvider';

/**
 * MorphingThemeToggle — Animated sun/moon toggle for the floating dock.
 * Uses SVG path morphing and spring physics for a premium feel.
 */
export function MorphingThemeToggle() {
  const { resolvedTheme, setTheme, theme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const toggle = () => {
    setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'dark' : isDark ? 'light' : 'dark');
  };

  // SVG properties for morphing between sun and moon
  const sunRays = [0, 45, 90, 135, 180, 225, 270, 315];

  return (
    <button
      onClick={toggle}
      className="relative flex items-center justify-center w-9 h-9 rounded-[var(--radius-sm)] text-muted hover:text-primary hover:bg-surface-hover transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      <motion.svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Central circle — morphs between sun body and moon */}
        <motion.circle
          cx="12"
          cy="12"
          animate={{
            r: isDark ? 4 : 5,
          }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        />

        {/* Moon mask — clips the circle to create crescent */}
        <motion.circle
          cx="12"
          cy="12"
          r="4"
          className="fill-background"
          stroke="none"
          animate={{
            cx: isDark ? 16 : 12,
            cy: isDark ? 8 : 12,
            opacity: isDark ? 1 : 0,
          }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        />

        {/* Sun rays — fade out when moon */}
        {sunRays.map((angle, i) => {
          const outerR = 10;
          const innerR = 7;
          const rad = (angle * Math.PI) / 180;
          const x1 = 12 + innerR * Math.cos(rad);
          const y1 = 12 + innerR * Math.sin(rad);
          const x2 = 12 + outerR * Math.cos(rad);
          const y2 = 12 + outerR * Math.sin(rad);

          return (
            <motion.line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              animate={{
                opacity: isDark ? 0 : 1,
                scale: isDark ? 0 : 1,
              }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 25,
                delay: isDark ? 0 : i * 0.02,
              }}
              style={{ transformOrigin: `${x1}px ${y1}px` }}
            />
          );
        })}
      </motion.svg>
    </button>
  );
}
