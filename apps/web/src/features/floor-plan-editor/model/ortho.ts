import type { Point } from './geometry';

/**
 * Constrains `end` to be exactly horizontal or vertical with respect to
 * `start`. Chooses the dominant axis (larger |delta|) so the UX feels
 * predictable: the wall snaps to the direction the user is clearly
 * dragging towards.
 *
 * This is the MVP "ортогональная геометрия" requirement — no diagonals.
 * When free angles are supported later, this helper stays (as an
 * explicit tool modifier, e.g. Shift-to-constrain) rather than being
 * removed.
 */
export const constrainOrtho = (start: Point, end: Point): Point => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return { x: end.x, y: start.y };
  }
  return { x: start.x, y: end.y };
};
