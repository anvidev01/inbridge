/** Placement for a fixed-position popover anchored to a chip. */

export interface AnchorRect {
    top: number;
    bottom: number;
    left: number;
}

export interface PopoverPosition {
    left: number;
    width: number;
    top?: number;
    bottom?: number;
}

const MARGIN = 8;
const GAP = 6;
/** Space needed below the chip before the popover flips above it. */
const MIN_SPACE_BELOW = 160;

/** Clamped to the viewport so the popover never causes horizontal scroll at 320px. */
export function popoverPosition(rect: AnchorRect, viewportWidth: number, viewportHeight: number, maxWidth: number): PopoverPosition {
    const width = Math.max(0, Math.min(maxWidth, viewportWidth - 2 * MARGIN));
    const left = Math.max(MARGIN, Math.min(rect.left, viewportWidth - width - MARGIN));
    return viewportHeight - rect.bottom > MIN_SPACE_BELOW
        ? { left, width, top: rect.bottom + GAP }
        : { left, width, bottom: viewportHeight - rect.top + GAP };
}

/** True once the anchor has scrolled completely out of the viewport. */
export function anchorOffscreen(rect: AnchorRect, viewportHeight: number): boolean {
    return rect.bottom < 0 || rect.top > viewportHeight;
}
