"use client";

import { memo, useMemo } from "react";
import { useOthers } from "@/lib/liveblocks";

interface CursorsProps {
  containerRef?: React.RefObject<HTMLDivElement>;
}

interface CursorProps {
  x: number;
  y: number;
  color: string;
  name: string;
}

/**
 * Individual cursor component with smooth animation
 */
const Cursor = memo(function Cursor({ x, y, color, name }: CursorProps) {
  return (
    <div
      className="pointer-events-none absolute left-0 top-0 z-50"
      style={{
        transform: `translate(${x}px, ${y}px)`,
        transition: "transform 0.05s linear",
      }}
    >
      {/* Cursor SVG */}
      <svg
        width="24"
        height="36"
        viewBox="0 0 24 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))" }}
      >
        <path
          d="M5.65376 12.4557L5.65376 27.1113C5.65376 28.4567 7.26431 29.2121 8.31539 28.3389L12.0461 25.1668L14.6668 31.8892C14.8957 32.4653 15.5174 32.7885 16.1184 32.6265L18.7063 31.9278C19.3462 31.7553 19.7248 31.0944 19.5379 30.4584L16.8206 23.4965L21.5014 22.4818C22.7919 22.1816 23.1783 20.536 22.1695 19.6126L8.76553 7.17752C7.70562 6.20747 5.65376 6.95531 5.65376 8.41941L5.65376 12.4557Z"
          fill={color}
          stroke="white"
          strokeWidth="1.5"
        />
      </svg>

      {/* Name label */}
      <div
        className="absolute left-5 top-5 whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium text-white"
        style={{ backgroundColor: color }}
      >
        {name}
      </div>
    </div>
  );
});

/**
 * Component to display all other users' cursors on the canvas
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Cursors(_props: CursorsProps) {
  const others = useOthers();

  // Filter and map other users with cursor positions
  const cursors = useMemo(() => {
    return others
      .filter((user) => user.presence?.cursor !== null)
      .map((user) => ({
        connectionId: user.connectionId,
        x: user.presence?.cursor?.x ?? 0,
        y: user.presence?.cursor?.y ?? 0,
        name: user.info?.name || "Anonymous",
        color: user.info?.color || "#6366f1",
      }));
  }, [others]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {cursors.map((cursor) => (
        <Cursor
          key={cursor.connectionId}
          x={cursor.x}
          y={cursor.y}
          color={cursor.color}
          name={cursor.name}
        />
      ))}
    </div>
  );
}

/**
 * Hook to track and update cursor position
 */
export function useCursorTracking(
  containerRef: React.RefObject<HTMLDivElement>,
  updatePresence: (presence: { cursor: { x: number; y: number } | null }) => void
) {
  const handleMouseMove = (e: React.MouseEvent) => {
    const container = containerRef.current;
    if (!container) return;

    const bounds = container.getBoundingClientRect();
    const x = e.clientX - bounds.left;
    const y = e.clientY - bounds.top;

    // Only update if cursor is within bounds
    if (x >= 0 && y >= 0 && x <= bounds.width && y <= bounds.height) {
      updatePresence({ cursor: { x, y } });
    }
  };

  const handleMouseLeave = () => {
    updatePresence({ cursor: null });
  };

  return {
    onMouseMove: handleMouseMove,
    onMouseLeave: handleMouseLeave,
  };
}

/**
 * Wrapper component that combines cursor display and tracking
 */
export function CollaborativeCursors({
  containerRef,
  children,
}: {
  containerRef: React.RefObject<HTMLDivElement>;
  children?: React.ReactNode;
}) {
  return (
    <>
      <Cursors containerRef={containerRef} />
      {children}
    </>
  );
}
