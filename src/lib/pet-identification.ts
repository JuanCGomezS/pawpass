import qrcode from "qrcode-generator";
import { validCalendarDate } from "./pet-details";

type Identification = {
  name: string;
  species: string;
  breed: string;
  birthDate: string;
  guardian: string;
  photoUrl: string;
};

const ink = "#005158";
const coral = "#ff7863";

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = window.setTimeout(() => {
      image.onload = image.onerror = null;
      reject(new Error("La imagen tardó demasiado en cargar."));
    }, 15000);
    image.crossOrigin = "anonymous";
    image.referrerPolicy = "no-referrer";
    image.onload = () => {
      clearTimeout(timer);
      resolve(image);
    };
    image.onerror = () => {
      clearTimeout(timer);
      reject(new Error("No pudimos cargar una imagen para la identificación."));
    };
    image.src = url;
  });
}

function paw(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 100, size / 100);
  ctx.fillStyle = color;
  for (const [cx, cy, angle] of [
    [18, 36, -0.45],
    [39, 18, -0.15],
    [65, 18, 0.15],
    [86, 36, 0.45],
  ]) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, 10, 15, angle, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(23, 74);
  ctx.bezierCurveTo(23, 59, 40, 40, 52, 40);
  ctx.bezierCurveTo(64, 40, 81, 59, 81, 74);
  ctx.bezierCurveTo(81, 96, 64, 82, 52, 82);
  ctx.bezierCurveTo(40, 82, 23, 96, 23, 74);
  ctx.fill();
  ctx.restore();
}

function wrapped(
  ctx: CanvasRenderingContext2D,
  value: string,
  width: number,
): string[] {
  const lines: string[] = [];
  let line = "";
  for (const character of value.replace(/\s+/g, " ").trim()) {
    if (line && ctx.measureText(line + character).width > width) {
      const space = line.lastIndexOf(" ");
      if (space > 0) {
        lines.push(line.slice(0, space));
        line = line.slice(space + 1);
      } else {
        lines.push(line);
        line = "";
      }
    }
    line += character;
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

function fitText(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  width: number,
  height: number,
  size: number,
  family = "Manrope",
) {
  let lines: string[];
  do {
    ctx.font = `600 ${size}px "${family}"`;
    lines = wrapped(ctx, value, width);
    if (lines.length * size * 1.18 <= height || size <= 12) break;
    size -= 2;
  } while (true);
  const limit = Math.max(1, Math.floor(height / (size * 1.18)));
  if (lines.length > limit) {
    lines = lines.slice(0, limit);
    let last = lines[limit - 1];
    while (last && ctx.measureText(`${last}…`).width > width)
      last = last.slice(0, -1);
    lines[limit - 1] = `${last}…`;
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.clip();
  ctx.fillStyle = ink;
  ctx.textBaseline = "top";
  lines.forEach((line, index) =>
    ctx.fillText(line, x, y + index * size * 1.18),
  );
  ctx.restore();
}

async function createCard(data: Identification, url: string): Promise<Blob> {
  const [logo, photo] = await Promise.all([
    loadImage(`${import.meta.env.BASE_URL}logo_horizontal.png`),
    data.photoUrl.startsWith("https://")
      ? loadImage(data.photoUrl)
      : Promise.resolve(null),
    document.fonts.load('600 72px "Baloo 2"'),
    document.fonts.load('600 32px "Manrope"'),
  ]);
  const canvas = document.createElement("canvas");
  canvas.width = 1536;
  canvas.height = 960;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Este navegador no puede generar la imagen.");
  ctx.beginPath();
  ctx.roundRect(0, 0, 1536, 960, 48);
  ctx.clip();
  ctx.fillStyle = "#fcf7ee";
  ctx.fillRect(0, 0, 1536, 960);

  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.moveTo(0, 864);
  ctx.bezierCurveTo(260, 776, 425, 976, 820, 932);
  ctx.lineTo(1000, 960);
  ctx.lineTo(0, 960);
  ctx.fill();
  ctx.fillStyle = coral;
  ctx.beginPath();
  ctx.moveTo(530, 960);
  ctx.bezierCurveTo(900, 798, 1150, 942, 1340, 918);
  ctx.bezierCurveTo(1440, 908, 1500, 880, 1536, 844);
  ctx.lineTo(1536, 960);
  ctx.fill();
  paw(ctx, 70, 867, 80, "#a9c9c3");
  paw(ctx, 1270, 370, 200, "#e7eae2");

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(48, 48, 512, 776, 42);
  ctx.clip();
  ctx.fillStyle = "#e4ebe2";
  ctx.fillRect(48, 48, 512, 776);
  if (photo) {
    const scale = Math.max(512 / photo.naturalWidth, 776 / photo.naturalHeight);
    const width = photo.naturalWidth * scale;
    const height = photo.naturalHeight * scale;
    ctx.drawImage(
      photo,
      48 + (512 - width) / 2,
      48 + (776 - height) / 2,
      width,
      height,
    );
  } else {
    paw(ctx, 209, 308, 190, "#9bbdb5");
    fitText(ctx, "Sin foto", 225, 530, 200, 50, 32);
  }
  ctx.restore();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.roundRect(48, 48, 512, 776, 42);
  ctx.stroke();
  ctx.drawImage(logo, 620, 35, 780, 260);

  ctx.fillStyle = "#c5dcd4";
  ctx.beginPath();
  ctx.roundRect(620, 280, 850, 60, 30);
  ctx.fill();
  ctx.font = '600 30px "Manrope"';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = ink;
  ctx.fillText("IDENTIFICACIÓN DE MASCOTA", 1045, 310);
  ctx.textAlign = "left";

  ctx.fillStyle = coral;
  ctx.beginPath();
  ctx.arc(654, 412, 38, 0, Math.PI * 2);
  ctx.fill();
  paw(ctx, 631, 390, 46, "#fffaf2");
  fitText(ctx, "Nombre", 716, 370, 260, 36, 26);
  fitText(ctx, data.name, 710, 407, 750, 120, 80, "Baloo 2");

  const birthDate = validCalendarDate(data.birthDate)
    ? data.birthDate.split("-").reverse().join("/")
    : "";
  const rows = [
    ["Especie", data.species],
    ["Raza", data.breed],
    ["Nacimiento", birthDate],
    ["Responsable", data.guardian],
  ].filter(([, value]) => value);
  rows.forEach(([label, value], index) => {
    const y = 548 + index * 88;
    ctx.fillStyle = index % 2 ? "#ffe0cb" : "#c5dcd4";
    ctx.beginPath();
    ctx.arc(654, y + 26, 29, 0, Math.PI * 2);
    ctx.fill();
    paw(ctx, 638, y + 10, 32, index % 2 ? coral : ink);
    fitText(ctx, label, 710, y + 7, 205, 60, 30);
    fitText(ctx, value, 930, y, index === 0 ? 525 : 285, 78, 36, "Baloo 2");
  });

  ctx.fillStyle = "#fff";
  ctx.strokeStyle = ink;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(1243, 688, 224, 224, 18);
  ctx.fill();
  ctx.stroke();
  const qr = qrcode(0, "M");
  qr.addData(url);
  qr.make();
  const count = qr.getModuleCount();
  const cell = Math.floor(200 / (count + 8));
  if (cell < 1) throw new Error("El enlace es demasiado largo para el QR.");
  const side = (count + 8) * cell;
  const left = Math.round(1355 - side / 2);
  const top = Math.round(800 - side / 2);
  ctx.fillStyle = ink;
  for (let row = 0; row < count; row++)
    for (let column = 0; column < count; column++)
      if (qr.isDark(row, column))
        ctx.fillRect(
          left + (column + 4) * cell,
          top + (row + 4) * cell,
          cell,
          cell,
        );
  ctx.font = '600 20px "Manrope"';
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("Escanea mi ficha", 1355, 929);

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("No pudimos generar el PNG.")),
      "image/png",
    ),
  );
}

export function showIdentification(
  section: HTMLElement,
  data: Identification,
  publicUrl: string,
): void {
  const preview = section.querySelector<HTMLImageElement>("[data-id-image]")!;
  const fullSize = section.querySelector<HTMLAnchorElement>("[data-id-full]")!;
  const download =
    section.querySelector<HTMLAnchorElement>("[data-id-download]")!;
  const retry = section.querySelector<HTMLButtonElement>("[data-id-retry]")!;
  const status = section.querySelector<HTMLElement>("[data-id-status]")!;
  let objectUrl: string | undefined;
  const prepare = async () => {
    retry.hidden = true;
    status.textContent = "Preparando la identificación…";
    try {
      const blob = await createCard(data, publicUrl);
      objectUrl = URL.createObjectURL(blob);
      preview.src = objectUrl;
      preview.alt = `Identificación de ${data.name}. ${[
        data.species,
        data.breed,
        validCalendarDate(data.birthDate)
          ? `Nacimiento: ${data.birthDate.split("-").reverse().join("/")}`
          : "",
        data.guardian ? `Responsable: ${data.guardian}` : "",
      ]
        .filter(Boolean)
        .join(". ")}. El QR abre esta ficha pública.`;
      fullSize.href = download.href = objectUrl;
      download.download = `pawpass-${data.name.replace(/[^\p{L}\p{N}-]+/gu, "-").slice(0, 60) || "identificacion"}.png`;
      fullSize.hidden = download.hidden = false;
      status.textContent = "";
    } catch {
      status.textContent =
        "No pudimos preparar la identificación. Comprueba la conexión e inténtalo de nuevo.";
      retry.hidden = false;
    }
  };
  retry.addEventListener("click", () => {
    void prepare();
  });
  window.addEventListener("pagehide", (event) => {
    if (!event.persisted && objectUrl) URL.revokeObjectURL(objectUrl);
  });
  section.hidden = false;
  void prepare();
}
