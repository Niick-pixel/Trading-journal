import type { Transition } from 'framer-motion';

/**
 * Every animation in Signature is a spring. Nothing fades linearly, nothing
 * uses a duration. These are the only transitions the app should reach for.
 */

/** The baseline. When in doubt, use this. */
export const spring: Transition = { type: 'spring', stiffness: 400, damping: 30 };

/** Snappier — for presses, toggles and small state flips. */
export const springSnappy: Transition = { type: 'spring', stiffness: 600, damping: 34 };

/** Looser, with visible overshoot — entrances and the live grade badge. */
export const springBouncy: Transition = { type: 'spring', stiffness: 500, damping: 18 };

/** Heavier — panels, disclosures, anything with size. */
export const springSoft: Transition = { type: 'spring', stiffness: 260, damping: 30 };

/** Whiteboard nodes settling into a new layout, with a slight overshoot. */
export const springLayout: Transition = { type: 'spring', stiffness: 320, damping: 26 };

/** Buttons compress on press. */
export const press = { scale: 0.96 } as const;

/** Standard entrance: rise and scale in, never a linear fade. */
export const riseIn = {
  initial: { opacity: 0, y: 8, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -4, scale: 0.98 },
} as const;

/** Dropdown options stagger in behind the menu's own spring. */
export const stagger = (index: number): Transition => ({
  ...springSnappy,
  delay: index * 0.018,
});
