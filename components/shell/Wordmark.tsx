'use client';

/**
 * The brand lockup in the title bar.
 *
 * The strip that carries the window buttons was otherwise empty, which read as
 * dead space rather than restraint. The mark is the same stroke as the app icon
 * — drift, sweep the low, invert through the gap, leave — at a size where it
 * still reads.
 */
export function Wordmark() {
  return (
    <div className="flex select-none items-center gap-2">
      <svg width="18" height="18" viewBox="0 0 1024 1024" aria-hidden className="shrink-0">
        <rect width="1024" height="1024" rx="232" fill="var(--mark-ground)" />
        <rect x="150" y="452" width="724" height="120" rx="18" fill="var(--mark-ink)" fillOpacity="0.22" />
        <path
          d="M 148 566 C 214 560, 232 500, 292 502 C 356 504, 344 628, 402 700
             C 438 744, 496 748, 528 690 C 566 620, 548 452, 606 396
             C 660 344, 700 372, 744 330 C 786 290, 836 268, 876 258"
          fill="none" stroke="var(--mark-ink)" strokeWidth="86"
          strokeLinecap="round" strokeLinejoin="round"
        />
      </svg>
      <span
        className="text-[12px] font-semibold"
        style={{ color: 'var(--text)', letterSpacing: '-0.01em' }}
      >
        Signature
      </span>
    </div>
  );
}
