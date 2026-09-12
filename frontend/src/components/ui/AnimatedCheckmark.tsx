import { motion } from 'motion/react';

interface AnimatedCheckmarkProps {
  size?: number;
  className?: string;
}

/**
 * AnimatedCheckmark — Success state animation.
 * Circle draws in → Checkmark strokes in → Subtle scale bounce.
 */
export function AnimatedCheckmark({ size = 56, className }: AnimatedCheckmarkProps) {
  const strokeWidth = 2;
  const center = size / 2;
  const radius = (size - strokeWidth * 2 - 4) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 20 }}
      className={className}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
        {/* Circle */}
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className="text-status-success"
          initial={{ 
            strokeDasharray: circumference, 
            strokeDashoffset: circumference,
            rotate: -90,
          }}
          animate={{ strokeDashoffset: 0 }}
          transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1], delay: 0.1 }}
          style={{ transformOrigin: 'center' }}
        />

        {/* Checkmark */}
        <motion.path
          d={`M${size * 0.3} ${size * 0.5} L${size * 0.45} ${size * 0.64} L${size * 0.7} ${size * 0.38}`}
          stroke="currentColor"
          strokeWidth={strokeWidth + 0.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-status-success"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ 
            pathLength: { duration: 0.35, ease: [0.32, 0.72, 0, 1], delay: 0.5 },
            opacity: { duration: 0.1, delay: 0.5 },
          }}
        />
      </svg>
    </motion.div>
  );
}
