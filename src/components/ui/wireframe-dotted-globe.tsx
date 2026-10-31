import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

// Rotating dotted globe from 21st.dev (wireframe-dotted-globe). The land outline is fetched once from Natural Earth.

interface RotatingEarthProps {
  width?: number;
  height?: number;
  className?: string;
}

const LAND_URL = "https://raw.githubusercontent.com/martynafford/natural-earth-geojson/refs/heads/master/110m/physical/ne_110m_land.json";

export default function RotatingEarth({ width = 800, height = 600, className = "" }: RotatingEarthProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    if (!context) return;
    let stopped = false;

    const containerWidth = Math.min(width, window.innerWidth - 40);
    const containerHeight = Math.min(height, window.innerHeight - 100);
    const radius = Math.min(containerWidth, containerHeight) / 2.5;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = containerWidth * dpr;
    canvas.height = containerHeight * dpr;
    canvas.style.width = `${containerWidth}px`;
    canvas.style.height = `${containerHeight}px`;
    context.scale(dpr, dpr);

    const projection = d3.geoOrthographic().scale(radius).translate([containerWidth / 2, containerHeight / 2]).clipAngle(90);
    const path = d3.geoPath().projection(projection).context(context);

    const pointInPolygon = (point: [number, number], polygon: number[][]): boolean => {
      const [x, y] = point;
      let inside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [xi, yi] = polygon[i]!;
        const [xj, yj] = polygon[j]!;
        if (yi! > y !== yj! > y && x < ((xj! - xi!) * (y - yi!)) / (yj! - yi!) + xi!) inside = !inside;
      }
      return inside;
    };

    const pointInFeature = (point: [number, number], feature: any): boolean => {
      const geometry = feature.geometry;
      if (geometry.type === "Polygon") {
        const coordinates = geometry.coordinates;
        if (!pointInPolygon(point, coordinates[0])) return false;
        for (let i = 1; i < coordinates.length; i++) if (pointInPolygon(point, coordinates[i])) return false;
        return true;
      } else if (geometry.type === "MultiPolygon") {
        for (const polygon of geometry.coordinates) {
          if (pointInPolygon(point, polygon[0])) {
            let inHole = false;
            for (let i = 1; i < polygon.length; i++) {
              if (pointInPolygon(point, polygon[i])) {
                inHole = true;
                break;
              }
            }
            if (!inHole) return true;
          }
        }
        return false;
      }
      return false;
    };

    const generateDotsInPolygon = (feature: any, dotSpacing = 16) => {
      const dots: [number, number][] = [];
      const [[minLng, minLat], [maxLng, maxLat]] = d3.geoBounds(feature);
      const stepSize = dotSpacing * 0.08;
      for (let lng = minLng; lng <= maxLng; lng += stepSize) {
        for (let lat = minLat; lat <= maxLat; lat += stepSize) {
          const point: [number, number] = [lng, lat];
          if (pointInFeature(point, feature)) dots.push(point);
        }
      }
      return dots;
    };

    const allDots: { lng: number; lat: number }[] = [];
    let landFeatures: any;

    const render = () => {
      context.clearRect(0, 0, containerWidth, containerHeight);
      const currentScale = projection.scale();
      const scaleFactor = currentScale / radius;

      context.beginPath();
      context.arc(containerWidth / 2, containerHeight / 2, currentScale, 0, 2 * Math.PI);
      context.fillStyle = "#0b0f17";
      context.fill();
      context.strokeStyle = "#89e219";
      context.lineWidth = 2 * scaleFactor;
      context.stroke();

      if (landFeatures) {
        context.beginPath();
        path(d3.geoGraticule()());
        context.strokeStyle = "#89e219";
        context.lineWidth = 1 * scaleFactor;
        context.globalAlpha = 0.2;
        context.stroke();
        context.globalAlpha = 1;

        context.beginPath();
        landFeatures.features.forEach((feature: any) => path(feature));
        context.strokeStyle = "#c9d8ff";
        context.lineWidth = 1 * scaleFactor;
        context.stroke();

        allDots.forEach((dot) => {
          const projected = projection([dot.lng, dot.lat]);
          if (projected && projected[0] >= 0 && projected[0] <= containerWidth && projected[1] >= 0 && projected[1] <= containerHeight) {
            context.beginPath();
            context.arc(projected[0], projected[1], 1.2 * scaleFactor, 0, 2 * Math.PI);
            context.fillStyle = "#4f7cf0";
            context.fill();
          }
        });
      }
    };

    const loadWorldData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(LAND_URL);
        if (!response.ok) throw new Error("Failed to load land data");
        landFeatures = await response.json();
        if (stopped) return;
        landFeatures.features.forEach((feature: any) => {
          generateDotsInPolygon(feature, 16).forEach(([lng, lat]) => allDots.push({ lng, lat }));
        });
        render();
        setIsLoading(false);
      } catch {
        if (stopped) return;
        setError("Не удалось загрузить карту");
        setIsLoading(false);
      }
    };

    const rotation = [0, 0];
    let autoRotate = true;
    const rotationSpeed = 0.5;

    const rotationTimer = d3.timer(() => {
      if (autoRotate) {
        rotation[0]! += rotationSpeed;
        projection.rotate(rotation as [number, number]);
        render();
      }
    });

    const handleMouseDown = (event: MouseEvent) => {
      autoRotate = false;
      const startX = event.clientX;
      const startY = event.clientY;
      const startRotation = [...rotation];

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const sensitivity = 0.5;
        rotation[0] = startRotation[0]! + (moveEvent.clientX - startX) * sensitivity;
        rotation[1] = Math.max(-90, Math.min(90, startRotation[1]! - (moveEvent.clientY - startY) * sensitivity));
        projection.rotate(rotation as [number, number]);
        render();
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        setTimeout(() => {
          autoRotate = true;
        }, 10);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    };

    // Zoom only with the wheel while the pointer is over the globe; the page still scrolls otherwise.
    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const k = event.deltaY > 0 ? 0.9 : 1.1;
      projection.scale(Math.max(radius * 0.5, Math.min(radius * 3, projection.scale() * k)));
      render();
    };

    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    void loadWorldData();

    return () => {
      stopped = true;
      rotationTimer.stop();
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("wheel", handleWheel);
    };
  }, [width, height]);

  if (error) {
    return (
      <div className={`flex items-center justify-center rounded-3xl bg-card p-8 ${className}`}>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <canvas ref={canvasRef} className="mx-auto block h-auto w-full rounded-3xl" style={{ maxWidth: "100%", height: "auto" }} aria-label="Вращающийся глобус" />
      {isLoading && <div className="absolute inset-0 grid place-items-center text-sm text-white/60">Загружаю карту…</div>}
      <div className="absolute bottom-3 left-3 rounded-md bg-black/50 px-2 py-1 text-xs text-white/70">Потяни, чтобы вращать · Ctrl + колесо — масштаб</div>
    </div>
  );
}
