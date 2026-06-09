import { useState, useRef, useEffect, useCallback } from "react";
import { X, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface ImageViewerProps {
  src: string;
  alt?: string;
  className?: string;
}

export default function ImageViewer({ src, alt = "", className = "" }: ImageViewerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  
  // Use refs for drag calculations to avoid stale closures
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const positionRef = useRef({ x: 0, y: 0 });

  const handleOpen = () => {
    setIsOpen(true);
    setScale(1);
    setPosition({ x: 0, y: 0 });
    positionRef.current = { x: 0, y: 0 };
  };

  const handleClose = () => {
    setIsOpen(false);
    setScale(1);
    setPosition({ x: 0, y: 0 });
    positionRef.current = { x: 0, y: 0 };
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev * 1.5, 5));
  };

  const handleZoomOut = () => {
    setScale((prev) => {
      const newScale = Math.max(prev / 1.5, 0.1);
      if (newScale <= 1) {
        setPosition({ x: 0, y: 0 });
        positionRef.current = { x: 0, y: 0 };
      }
      return newScale;
    });
  };

  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    positionRef.current = { x: 0, y: 0 };
  };

  // Start drag on mouse down
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      isDraggingRef.current = true;
      dragStartRef.current = {
        x: e.clientX - positionRef.current.x,
        y: e.clientY - positionRef.current.y,
      };
    },
    []
  );

  // End drag on mouse up
  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  // Move during drag
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDraggingRef.current) {
        const newX = e.clientX - dragStartRef.current.x;
        const newY = e.clientY - dragStartRef.current.y;
        positionRef.current = { x: newX, y: newY };
        setPosition({ x: newX, y: newY });
      }
    },
    []
  );

  // Touch support
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        isDraggingRef.current = true;
        dragStartRef.current = {
          x: touch.clientX - positionRef.current.x,
          y: touch.clientY - positionRef.current.y,
        };
      }
    },
    []
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (isDraggingRef.current && e.touches.length === 1) {
        e.preventDefault();
        const touch = e.touches[0];
        const newX = touch.clientX - dragStartRef.current.x;
        const newY = touch.clientY - dragStartRef.current.y;
        positionRef.current = { x: newX, y: newY };
        setPosition({ x: newX, y: newY });
      }
    },
    []
  );

  const handleTouchEnd = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.deltaY < 0) {
      setScale((prev) => Math.min(prev * 1.2, 5));
    } else {
      setScale((prev) => {
        const newScale = Math.max(prev / 1.2, 0.1);
        return newScale;
      });
    }
  }, []);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <>
      {/* Thumbnail */}
      <img
        src={src}
        alt={alt}
        className={`${className} cursor-zoom-in hover:opacity-90 transition-opacity`}
        onClick={handleOpen}
      />

      {/* Fullscreen Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex flex-col"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onMouseMove={handleMouseMove}
        >
          {/* Controls */}
          <div className="flex items-center justify-between px-4 py-3 bg-black/50 shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={handleZoomOut}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
                title="Zoom out"
              >
                <ZoomOut className="w-5 h-5" />
              </button>
              <span className="text-white text-sm min-w-[60px] text-center">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
                title="Zoom in"
              >
                <ZoomIn className="w-5 h-5" />
              </button>
              <button
                onClick={handleReset}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors ml-2"
                title="Reset zoom"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            </div>
            <button
              onClick={handleClose}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Image Container - Full Area Draggable */}
          <div
            className="flex-1 overflow-hidden flex items-center justify-center"
            onMouseDown={handleMouseDown}
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{
              cursor: isDraggingRef.current ? "grabbing" : "grab"
            }}
          >
            <img
              src={src}
              alt={alt}
              className="max-w-none select-none pointer-events-none"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                transition: isDraggingRef.current ? "none" : "transform 0.1s ease-out"
              }}
              draggable={false}
            />
          </div>

          {/* Instructions */}
          <div className="px-4 py-2 bg-black/50 text-center shrink-0">
            <p className="text-white/60 text-xs">
              Scroll to zoom • Drag to pan when zoomed • Press Esc to close
            </p>
          </div>
        </div>
      )}
    </>
  );
}
