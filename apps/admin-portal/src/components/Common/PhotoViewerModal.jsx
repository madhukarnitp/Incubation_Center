'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
} from '@/components/icons';

export default function PhotoViewerModal({
  isOpen,
  onClose,
  photos = [],
  initialIndex = 0,
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setIsDragging(false);
    }
  }, [isOpen, initialIndex]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
      if (e.key === 'ArrowRight' && photos.length > 1) {
        setCurrentIndex((prev) => (prev + 1) % photos.length);
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
      if (e.key === 'ArrowLeft' && photos.length > 1) {
        setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, photos.length, onClose]);

  if (!isOpen || photos.length === 0) return null;

  const activePhoto = photos[currentIndex] || photos[0];
  if (!activePhoto?.url) return null;

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handlePrev = (e) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
    resetView();
  };

  const handleNext = (e) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % photos.length);
    resetView();
  };

  const handleMouseDown = (e) => {
    e.stopPropagation();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPan({
      x: dragStartRef.current.panX + (e.clientX - dragStartRef.current.x),
      y: dragStartRef.current.panY + (e.clientY - dragStartRef.current.y),
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const handleTouchMove = (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    setPan({
      x: dragStartRef.current.panX + (e.touches[0].clientX - dragStartRef.current.x),
      y: dragStartRef.current.panY + (e.touches[0].clientY - dragStartRef.current.y),
    });
  };

  const handleWheel = (e) => {
    e.stopPropagation();
    const delta = e.deltaY < 0 ? 0.2 : -0.2;
    setZoom((z) => {
      const next = Math.min(3, Math.max(0.5, Number((z + delta).toFixed(2))));
      if (next <= 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    if (zoom > 1) {
      resetView();
    } else {
      setZoom(2);
    }
  };

  const handleDownload = async (e) => {
    e.stopPropagation();
    try {
      const response = await fetch(activePhoto.url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${(activePhoto.title || 'photo').replace(/[^a-zA-Z0-9_-]/g, '_')}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(activePhoto.url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      onClick={onClose}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className="fixed inset-0 z-[100] bg-black/92 backdrop-blur-sm flex flex-col justify-between p-4 animate-in fade-in duration-150 select-none"
    >
      {/* Top Controls */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex items-center justify-between gap-4 text-white z-10"
      >
        <div className="min-w-0">
          {activePhoto.title && (
            <h3 className="text-sm font-bold truncate">{activePhoto.title}</h3>
          )}
          <div className="flex items-center gap-2 text-[11px] text-slate-300">
            {activePhoto.category && <span>{activePhoto.category}</span>}
            {activePhoto.date && <span>· {activePhoto.date}</span>}
            {photos.length > 1 && (
              <span>
                · {currentIndex + 1} / {photos.length}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() =>
              setZoom((z) => {
                const next = Math.max(0.5, Number((z - 0.25).toFixed(2)));
                if (next <= 1) setPan({ x: 0, y: 0 });
                return next;
              })
            }
            title="Zoom Out"
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-semibold px-2 min-w-[48px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(3, Number((z + 0.25).toFixed(2))))}
            title="Zoom In"
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={resetView}
            title="Reset View"
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleDownload}
            title="Download Photo"
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close (Esc)"
            className="p-2 rounded-lg bg-white/15 hover:bg-rose-600 text-white transition-colors cursor-pointer ml-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Image Area */}
      <div
        onWheel={handleWheel}
        className="relative flex-1 flex items-center justify-center overflow-hidden my-2"
      >
        {photos.length > 1 && (
          <button
            type="button"
            onClick={handlePrev}
            title="Previous (Left Arrow)"
            className="absolute left-2 sm:left-4 z-10 p-2.5 rounded-full bg-black/50 hover:bg-white/20 text-white border border-white/15 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={activePhoto.url}
          alt={activePhoto.title || 'Photo preview'}
          draggable={false}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={handleDoubleClick}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleMouseUp}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
          className={`max-h-[82vh] max-w-[90vw] object-contain rounded-lg shadow-2xl ${
            isDragging ? 'cursor-grabbing transition-none' : 'cursor-grab transition-transform duration-150'
          }`}
        />

        {photos.length > 1 && (
          <button
            type="button"
            onClick={handleNext}
            title="Next (Right Arrow)"
            className="absolute right-2 sm:right-4 z-10 p-2.5 rounded-full bg-black/50 hover:bg-white/20 text-white border border-white/15 transition-colors cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}
