export function CourtGridBackground() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden select-none"
    >
      {/* Base static 32x32 court grid */}
      <div className="absolute inset-0 court-grid-base" />

      {/* Sweeping spotlight illuminating grid intersections dynamically */}
      <div className="absolute inset-0 court-grid-glow animate-grid-sweep" />

      {/* Soft highlighted 32x32 grid cells pulsing gently */}
      <div
        className="absolute w-8 h-8 rounded-[2px] bg-emerald-400/15 dark:bg-emerald-400/20 animate-cell-pulse"
        style={{ top: 128, left: 64, animationDelay: '0s' }}
      />
      <div
        className="absolute w-8 h-8 rounded-[2px] bg-amber-400/20 dark:bg-amber-400/20 animate-cell-pulse"
        style={{ top: 256, left: 224, animationDelay: '1.8s' }}
      />
      <div
        className="absolute w-8 h-8 rounded-[2px] bg-emerald-400/15 dark:bg-emerald-400/20 animate-cell-pulse hidden sm:block"
        style={{ top: 192, left: 544, animationDelay: '3.1s' }}
      />
      <div
        className="absolute w-8 h-8 rounded-[2px] bg-amber-400/20 dark:bg-amber-400/20 animate-cell-pulse"
        style={{ top: 448, left: 128, animationDelay: '2.4s' }}
      />

      {/* Horizontal light beams running right along 32px grid lines */}
      <div
        className="grid-beam-h grid-beam-emerald"
        style={{ top: 128, animationDuration: '6.5s', animationDelay: '0s' }}
      />
      <div
        className="grid-beam-h-rev grid-beam-amber"
        style={{ top: 288, animationDuration: '8s', animationDelay: '1.6s' }}
      />
      <div
        className="grid-beam-h grid-beam-emerald"
        style={{ top: 480, animationDuration: '7.2s', animationDelay: '3.2s' }}
      />
      <div
        className="grid-beam-h-rev grid-beam-amber"
        style={{ top: 640, animationDuration: '9s', animationDelay: '0.8s' }}
      />

      {/* Vertical light beams running along 32px grid columns */}
      <div
        className="grid-beam-v grid-beam-emerald"
        style={{ left: 64, animationDuration: '7.5s', animationDelay: '0.5s' }}
      />
      <div
        className="grid-beam-v-rev grid-beam-amber"
        style={{ left: 256, animationDuration: '8.5s', animationDelay: '2.2s' }}
      />
      <div
        className="grid-beam-v grid-beam-emerald hidden sm:block"
        style={{ left: 512, animationDuration: '6.8s', animationDelay: '1.3s' }}
      />
      <div
        className="grid-beam-v-rev grid-beam-amber hidden md:block"
        style={{ left: 800, animationDuration: '8.2s', animationDelay: '3.6s' }}
      />
    </div>
  );
}
