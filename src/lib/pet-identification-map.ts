import L from "leaflet";
import "../styles/pet-map-icon.css";

export async function captureIdentificationMap(
  container: HTMLElement,
  location: { latitude: number; longitude: number },
  photo: HTMLImageElement,
  signal: AbortSignal,
  zoom: number,
): Promise<HTMLCanvasElement> {
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
  const initialBounds = container.getBoundingClientRect();
  if (
    signal.aborted ||
    document.visibilityState !== "visible" ||
    !container.clientWidth ||
    initialBounds.height <= 0 ||
    initialBounds.top < 0 ||
    initialBounds.left < 0 ||
    initialBounds.bottom > innerHeight ||
    initialBounds.right > innerWidth
  )
    throw new Error(
      "Mantén la vista previa del mapa visible y vuelve a intentarlo.",
    );
  const map = L.map(container, {
    zoomControl: false,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    touchZoom: false,
    boxZoom: false,
    keyboard: false,
    fadeAnimation: false,
    zoomAnimation: false,
  }).setView([location.latitude, location.longitude], zoom);
  map.panBy([0, -20], { animate: false });
  const canvas = document.createElement("canvas");
  canvas.width = 740;
  canvas.height = 220;
  let completed = false;
  try {
    const tiles = L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        crossOrigin: true,
        referrerPolicy: "strict-origin-when-cross-origin",
        keepBuffer: 0,
        maxZoom: 19,
      },
    );
    const avatar = document.createElement("div");
    avatar.className = "pet-map-avatar";
    photo.alt = "Foto de la mascota";
    photo.hidden = false;
    avatar.append(photo);
    L.marker([location.latitude, location.longitude], {
      icon: L.divIcon({
        html: avatar,
        className: "pet-map-pin",
        iconSize: [54, 62],
        iconAnchor: [27, 62],
      }),
      keyboard: false,
      interactive: false,
    }).addTo(map);
    await new Promise<void>((resolve, reject) => {
      const finish = (error?: Error) => {
        clearTimeout(timer);
        signal.removeEventListener("abort", abort);
        tiles.off("load", loaded);
        tiles.off("tileerror", failed);
        if (error) reject(error);
        else resolve();
      };
      const loaded = () => finish();
      const failed = () =>
        finish(new Error("No pudimos cargar el mapa completo."));
      const abort = () => finish(new Error("Preparación cancelada."));
      const timer = window.setTimeout(
        () => finish(new Error("El mapa tardó demasiado en cargar.")),
        15000,
      );
      signal.addEventListener("abort", abort, { once: true });
      tiles.on("load", loaded);
      tiles.on("tileerror", failed);
      if (signal.aborted) {
        abort();
        return;
      }
      tiles.addTo(map);
    });
    if (signal.aborted) throw new Error("Preparación cancelada.");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No pudimos preparar el mapa.");
    const bounds = container.getBoundingClientRect();
    if (
      bounds.width !== initialBounds.width ||
      bounds.height !== initialBounds.height
    )
      throw new Error("El tamaño del mapa cambió. Vuelve a intentarlo.");
    const scale = canvas.width / bounds.width;
    const visibleTiles = [
      ...container.querySelectorAll<HTMLImageElement>("img.leaflet-tile"),
    ].filter((tile) => {
      const r = tile.getBoundingClientRect();
      return (
        r.right > bounds.left &&
        r.left < bounds.right &&
        r.bottom > bounds.top &&
        r.top < bounds.bottom
      );
    });
    if (
      !visibleTiles.length ||
      visibleTiles.some((tile) => !tile.complete || !tile.naturalWidth)
    )
      throw new Error("El mapa todavía no está completo.");
    for (const tile of visibleTiles) {
      const r = tile.getBoundingClientRect();
      const left = Math.round((r.left - bounds.left) * scale);
      const top = Math.round((r.top - bounds.top) * scale);
      const right = Math.round((r.right - bounds.left) * scale);
      const bottom = Math.round((r.bottom - bounds.top) * scale);
      ctx.drawImage(tile, left, top, right - left, bottom - top);
    }
    const coverage = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let i = 3; i < coverage.length; i += 4)
      if (coverage[i] !== 255)
        throw new Error(
          "El mapa no cubre toda la vista previa. Vuelve a intentarlo.",
        );
    const point = map.latLngToContainerPoint([
      location.latitude,
      location.longitude,
    ]);
    const x = point.x * scale;
    const y = point.y * scale;
    const radius = 25 * scale;
    const centerY = y - 35 * scale;
    ctx.fillStyle = "#fffaf0";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 13 * scale, y - 23 * scale);
    ctx.lineTo(x + 13 * scale, y - 23 * scale);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, centerY, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "#f5ebdb";
    ctx.fillRect(x - radius, centerY - radius, radius * 2, radius * 2);
    const photoScale = Math.max(
      (radius * 2) / photo.naturalWidth,
      (radius * 2) / photo.naturalHeight,
    );
    const width = photo.naturalWidth * photoScale;
    const height = photo.naturalHeight * photoScale;
    ctx.drawImage(photo, x - width / 2, centerY - height / 2, width, height);
    ctx.restore();
    ctx.strokeStyle = "#fffaf0";
    ctx.lineWidth = 4 * scale;
    ctx.beginPath();
    ctx.arc(x, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();
    const attribution = "© OpenStreetMap contributors";
    const copyright = "openstreetmap.org/copyright";
    ctx.font = '600 26px "Manrope"';
    const textWidth = Math.max(
      ctx.measureText(attribution).width,
      ctx.measureText(copyright).width,
    );
    ctx.fillStyle = "#fff";
    ctx.fillRect(
      canvas.width - textWidth - 20,
      canvas.height - 62,
      textWidth + 20,
      62,
    );
    ctx.fillStyle = "#005158";
    ctx.textBaseline = "top";
    ctx.fillText(
      attribution,
      canvas.width - textWidth - 10,
      canvas.height - 58,
    );
    ctx.fillText(copyright, canvas.width - textWidth - 10, canvas.height - 30);
    completed = true;
    return canvas;
  } finally {
    map.remove();
    container.replaceChildren();
    if (completed && !signal.aborted) container.append(canvas);
  }
}
