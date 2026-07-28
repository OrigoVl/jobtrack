import { useEffect, useRef, useState } from "react";
import { Btn } from "../../../shared/ui";

const CROP_VIEWPORT = 260;
const CROP_OUTPUT = 400;

export function PhotoCropper({ src, onCancel, onDone }: { src: string; onCancel: () => void; onDone: (dataUrl: string) => void }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  useEffect(() => {
    const image = new Image();
    image.onload = () => setImg(image);
    image.src = src;
  }, [src]);
  const baseScale = img ? CROP_VIEWPORT / Math.min(img.width, img.height) : 1;
  const dispScale = baseScale * zoom;
  const dispW = img ? img.width * dispScale : 0;
  const dispH = img ? img.height * dispScale : 0;
  const clamp = (o: { x: number; y: number }) => {
    const maxX = Math.max(0, (dispW - CROP_VIEWPORT) / 2);
    const maxY = Math.max(0, (dispH - CROP_VIEWPORT) / 2);
    return { x: Math.min(maxX, Math.max(-maxX, o.x)), y: Math.min(maxY, Math.max(-maxY, o.y)) };
  };
  useEffect(() => {
    setOffset((o) => ({
      x: Math.min(Math.max(0, (dispW - CROP_VIEWPORT) / 2), Math.max(-Math.max(0, (dispW - CROP_VIEWPORT) / 2), o.x)),
      y: Math.min(Math.max(0, (dispH - CROP_VIEWPORT) / 2), Math.max(-Math.max(0, (dispH - CROP_VIEWPORT) / 2), o.y)),
    }));
  }, [zoom, img, dispW, dispH]);
  const left = CROP_VIEWPORT / 2 - dispW / 2 + offset.x;
  const top = CROP_VIEWPORT / 2 - dispH / 2 + offset.y;
  const confirm = () => {
    if (!img) return;
    const k = CROP_OUTPUT / CROP_VIEWPORT;
    const canvas = document.createElement("canvas");
    canvas.width = CROP_OUTPUT;
    canvas.height = CROP_OUTPUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, left * k, top * k, dispW * k, dispH * k);
    onDone(canvas.toDataURL("image/jpeg", 0.9));
  };
  const nudge = (dx: number, dy: number) => setOffset(clamp({ x: offset.x + dx, y: offset.y + dy }));
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <button type="button" aria-label="Close" onClick={onCancel} className="fixed inset-0 bg-slate-900/50 cursor-default" />
      <div className="relative bg-white rounded-2xl p-5 shadow-xl w-[320px] space-y-3">
        <div className="text-sm font-semibold text-slate-800">Crop photo</div>
        <div
          role="button"
          tabIndex={0}
          aria-label="Drag or use arrow keys to position the photo"
          className="relative mx-auto rounded-full overflow-hidden bg-slate-100 border border-slate-200 touch-none cursor-grab active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          style={{ width: CROP_VIEWPORT, height: CROP_VIEWPORT }}
          onPointerDown={(e) => {
            drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            setOffset(clamp({ x: drag.current.ox + (e.clientX - drag.current.x), y: drag.current.oy + (e.clientY - drag.current.y) }));
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
          onKeyDown={(e) => {
            const step = 8;
            if (e.key === "ArrowLeft") nudge(step, 0);
            else if (e.key === "ArrowRight") nudge(-step, 0);
            else if (e.key === "ArrowUp") nudge(0, step);
            else if (e.key === "ArrowDown") nudge(0, -step);
            else return;
            e.preventDefault();
          }}
        >
          {img && (
            <img
              src={src}
              draggable={false}
              alt=""
              style={{ position: "absolute", left, top, width: dispW, height: dispH, maxWidth: "none", userSelect: "none" }}
            />
          )}
        </div>
        <label className="block text-sm text-slate-600">
          <div className="flex justify-between">
            <span>Zoom</span>
            <span className="text-slate-400">{Math.round(zoom * 100)}%</span>
          </div>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label="Photo zoom"
            className="w-full mt-1 accent-indigo-600"
          />
        </label>
        <div className="text-[11px] text-slate-400 text-center">Drag to position</div>
        <div className="flex gap-2 justify-end">
          <Btn size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Btn>
          <Btn size="sm" onClick={confirm} disabled={!img}>
            Done
          </Btn>
        </div>
      </div>
    </div>
  );
}
