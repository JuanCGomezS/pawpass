import qrcode from "qrcode-generator";
import { validCalendarDate } from "./pet-details";
import type { IdentificationSettings } from "./identification-settings";

type Identification = {
  name: string;
  species: string;
  breed: string;
  birthDate: string;
  guardian: string;
  photoUrl: string;
  identification: IdentificationSettings;
  phone: string;
  weight: string;
  sex: string;
  location?: { latitude: number; longitude: number; label: string };
};

type Extras = {
  location: boolean;
  phone: boolean;
  weight: boolean;
  sex: boolean;
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
    if (lines.length * size * 1.18 <= height || size <= 48) break;
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

async function createCard(
  data: Identification,
  url: string,
  face: "front" | "back",
  logo: HTMLImageElement,
  photo: HTMLImageElement | null,
  extras: Extras,
  mapImage?: HTMLImageElement,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 1536;
  canvas.height = 960;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Este navegador no puede generar la imagen.");
  ctx.beginPath();
  ctx.roundRect(0, 0, 1536, 960, 48);
  ctx.clip();
  const paper = ctx.createLinearGradient(0, 0, 1536, 960);
  paper.addColorStop(0, "#f0dec1");
  paper.addColorStop(0.52, "#f7eddd");
  paper.addColorStop(1, "#e2e8d5");
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, 1536, 960);
  ctx.fillStyle = "rgba(255, 184, 153, 0.18)";
  ctx.beginPath();
  ctx.ellipse(1490, 70, 330, 215, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(146, 193, 174, 0.16)";
  ctx.beginPath();
  ctx.ellipse(1150, 930, 570, 190, -0.3, 0, Math.PI * 2);
  ctx.fill();
  const grain = document.createElement("canvas");
  grain.width = grain.height = 96;
  const pixels = ctx.createImageData(96, 96);
  let seed = 37;
  for (let i = 0; i < pixels.data.length; i += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    pixels.data.set([136, 107, 74, seed >>> 28], i);
  }
  grain.getContext("2d")!.putImageData(pixels, 0, 0);
  ctx.fillStyle = ctx.createPattern(grain, "repeat")!;
  ctx.fillRect(0, 0, 1536, 960);

  const heart = (x: number, y: number, size: number, color: string) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 100, size / 100);
    ctx.strokeStyle = color;
    ctx.lineWidth = 8;
    ctx.lineJoin = ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(48, 84);
    ctx.bezierCurveTo(-16, 42, 2, 4, 28, 20);
    ctx.bezierCurveTo(39, 26, 45, 39, 46, 42);
    ctx.bezierCurveTo(64, -20, 110, 12, 81, 48);
    ctx.bezierCurveTo(69, 64, 59, 74, 48, 84);
    ctx.stroke();
    ctx.restore();
  };
  const label = (
    text: string,
    x: number,
    y: number,
    width: number,
    tint: string,
    icon?: "paw" | "calendar" | "person",
  ) => {
    ctx.fillStyle = tint;
    ctx.beginPath();
    ctx.roundRect(x, y, width, 60, 30);
    ctx.fill();
    const accent = tint === "#ffe3d4" ? coral : "#439d98";
    if (icon === "paw") paw(ctx, x + 19, y + 8, 44, accent);
    if (icon === "calendar") {
      ctx.strokeStyle = accent;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(x + 23, y + 15, 37, 32, 5);
      ctx.moveTo(x + 23, y + 25);
      ctx.lineTo(x + 60, y + 25);
      ctx.moveTo(x + 32, y + 8);
      ctx.lineTo(x + 32, y + 20);
      ctx.moveTo(x + 51, y + 8);
      ctx.lineTo(x + 51, y + 20);
      ctx.stroke();
    }
    if (icon === "person") {
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(x + 42, y + 19, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(x + 23, y + 32, 38, 20, [18, 18, 5, 5]);
      ctx.fill();
    }
    ctx.font = '600 44px "Baloo 2"';
    ctx.fillStyle = ink;
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + (icon ? 80 : 24), y + 33);
  };

  if (face === "back") {
    const scale = Math.min(
      canvas.width / logo.naturalWidth,
      canvas.height / logo.naturalHeight,
    );
    const width = logo.naturalWidth * scale;
    const height = logo.naturalHeight * scale;
    ctx.save();
    ctx.globalAlpha = 0.09;
    ctx.drawImage(
      logo,
      (canvas.width - width) / 2,
      (canvas.height - height) / 2,
      width,
      height,
    );
    ctx.restore();
    ctx.fillStyle = "#cde3d9";
    ctx.beginPath();
    ctx.roundRect(724, 72, 764, 72, 36);
    ctx.fill();
    ctx.font = '600 40px "Baloo 2"';
    ctx.fillStyle = ink;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText("UNA HUELLA EN TU CORAZÓN", 1106, 110);
    ctx.textAlign = "left";
    ctx.font = '500 72px "Caveat"';
    ctx.fillStyle = "#945443";
    ctx.fillText("Mi lugar favorito", 96, 92);
    ctx.fillText("es junto a ti.", 148, 166);
    heart(590, 95, 56, coral);
    ctx.strokeStyle = "#ffb79e";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(148, 205);
    ctx.quadraticCurveTo(300, 219, 442, 200);
    ctx.stroke();
    fitText(
      ctx,
      data.name,
      80,
      238,
      740,
      mapImage ? 102 : 152,
      mapImage ? 84 : 128,
      "Baloo 2",
    );
    let y = mapImage ? 354 : 432;
    if (data.guardian) {
      if (mapImage) {
        fitText(ctx, "Responsable", 80, y + 8, 285, 68, 44);
        fitText(ctx, data.guardian, 375, y, 445, 82, 62, "Baloo 2");
        y += 92;
      } else {
        label("RESPONSABLE", 80, y, 420, "#e0eee5", "person");
        fitText(ctx, data.guardian, 88, y + 66, 730, 130, 84, "Baloo 2");
        y += 196;
      }
    }
    if (extras.phone && data.phone) {
      if (mapImage) {
        fitText(ctx, "Teléfono", 80, y + 8, 245, 68, 44);
        fitText(ctx, data.phone, 335, y, 485, 82, 60, "Baloo 2");
      } else {
        label("TELÉFONO", 80, y, 320, "#ffe3d4");
        fitText(ctx, data.phone, 88, y + 66, 730, 112, 76, "Baloo 2");
      }
    }
    if (mapImage && data.location) {
      fitText(ctx, data.location.label, 80, 548, 740, 64, 48, "Baloo 2");
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(80, 608, 740, 220, 24);
      ctx.clip();
      ctx.drawImage(mapImage, 80, 608, 740, 220);
      ctx.restore();
    }
    if (!data.guardian && !extras.phone && !mapImage) {
      fitText(
        ctx,
        "Consulta mi ficha pública para ver la información que mi familia comparte.",
        88,
        y,
        700,
        320,
        64,
        "Baloo 2",
      );
    }
    paw(ctx, 1400, 175, 72, "#ffb79e");
    heart(842, 204, 52, coral);
    heart(28, 465, 30, "#e6a38c");
    heart(848, 634, 38, "#78b8aa");
  } else {
    ctx.fillStyle = "rgba(207, 224, 207, 0.58)";
    ctx.beginPath();
    ctx.ellipse(20, 15, 105, 108, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 202, 174, 0.36)";
    ctx.beginPath();
    ctx.moveTo(0, 160);
    ctx.bezierCurveTo(170, 120, 148, 280, 65, 330);
    ctx.bezierCurveTo(-30, 420, 160, 570, 60, 680);
    ctx.bezierCurveTo(170, 820, 550, 720, 635, 960);
    ctx.lineTo(0, 960);
    ctx.fill();
    paw(ctx, 1300, 180, 190, "#eaf0e5");
    ctx.save();
    ctx.strokeStyle = "#a7d4cc";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.setLineDash([8, 17]);
    ctx.beginPath();
    ctx.moveTo(1005, 180);
    ctx.bezierCurveTo(1085, 270, 1170, 230, 1235, 320);
    ctx.bezierCurveTo(1310, 410, 1420, 340, 1470, 395);
    ctx.stroke();
    ctx.restore();
    paw(ctx, 1040, 187, 56, "#ffb79e");
    paw(ctx, 1160, 253, 56, "#ffb79e");
    paw(ctx, 1270, 327, 56, "#ffb79e");

    if (photo) {
      const scale = Math.min(
        860 / photo.naturalWidth,
        860 / photo.naturalHeight,
      );
      const width = photo.naturalWidth * scale;
      const height = photo.naturalHeight * scale;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 195, 610, 765);
      ctx.clip();
      ctx.drawImage(
        photo,
        (610 - width) / 2,
        180 + (760 - height) / 2,
        width,
        height,
      );
      ctx.restore();
    } else {
      paw(ctx, 160, 380, 270, "#9bbdb5");
      fitText(ctx, "Sin foto", 180, 680, 260, 80, 56, "Baloo 2");
    }
    ctx.drawImage(logo, 80, 24, 570, 190);
    ctx.strokeStyle = "#77bcb4";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(696, 65);
    ctx.lineTo(696, 155);
    ctx.stroke();
    ctx.fillStyle = "#cde3d9";
    ctx.beginPath();
    ctx.roundRect(724, 72, 764, 72, 36);
    ctx.fill();
    ctx.font = '600 40px "Baloo 2"';
    ctx.fillStyle = ink;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText("IDENTIFICACIÓN DE MASCOTA", 1106, 110);
    ctx.textAlign = "left";

    heart(58, 225, 78, coral);
    heart(550, 570, 64, coral);
    ctx.strokeStyle = "#6ab8ae";
    ctx.lineWidth = 9;
    ctx.lineCap = "round";
    for (const [x, y, dx, dy] of [
      [563, 260, 13, -34],
      [587, 281, 26, -20],
      [60, 360, -23, -25],
    ]) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + dx, y + dy);
      ctx.stroke();
    }
    ctx.fillStyle = "#f4ad35";
    for (const [x, y, size] of [
      [547, 207, 20],
      [580, 485, 20],
      [70, 535, 15],
    ]) {
      ctx.beginPath();
      ctx.moveTo(x, y - size);
      ctx.quadraticCurveTo(x + 3, y - 3, x + size, y);
      ctx.quadraticCurveTo(x + 3, y + 3, x, y + size);
      ctx.quadraticCurveTo(x - 3, y + 3, x - size, y);
      ctx.quadraticCurveTo(x - 3, y - 3, x, y - size);
      ctx.fill();
    }

    label("NOMBRE", 630, 236, 245, "#e0eee5");
    fitText(ctx, data.name, 630, 302, 870, 150, 126, "Baloo 2");
    ctx.strokeStyle = "#ffd2bf";
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(638, 458);
    ctx.bezierCurveTo(765, 477, 925, 437, 1050, 460);
    ctx.stroke();

    if (data.species) {
      label("ESPECIE", 630, 500, 285, "#ffe3d4", "paw");
      fitText(ctx, data.species, 638, 568, 300, 116, 80, "Baloo 2");
    }
    if (data.breed) {
      label("RAZA", 980, 500, 250, "#d7e9df", "paw");
      fitText(ctx, data.breed, 988, 568, 500, 116, 80, "Baloo 2");
    }
    if (validCalendarDate(data.birthDate)) {
      label("NACIMIENTO", 630, 704, 400, "#ffe3d4", "calendar");
      fitText(
        ctx,
        data.birthDate.split("-").reverse().join("/"),
        638,
        772,
        400,
        82,
        66,
        "Baloo 2",
      );
    }
    if (extras.sex && data.sex) {
      label("SEXO", 1060, 704, 180, "#d7e9df");
      fitText(ctx, data.sex, 1068, 772, 180, 82, 60, "Baloo 2");
    }
    if (extras.weight && data.weight) {
      label("PESO", 1270, 704, 218, "#ffe3d4");
      fitText(ctx, data.weight, 1278, 772, 210, 82, 60, "Baloo 2");
    }
  }

  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.moveTo(0, 866);
  ctx.bezierCurveTo(180, 750, 360, 970, 655, 923);
  ctx.bezierCurveTo(780, 903, 852, 927, 950, 960);
  ctx.lineTo(0, 960);
  ctx.fill();
  ctx.fillStyle = coral;
  ctx.beginPath();
  ctx.moveTo(665, 960);
  ctx.bezierCurveTo(930, 866, 1030, 971, 1230, 908);
  ctx.bezierCurveTo(1350, 870, 1440, 880, 1536, 820);
  ctx.lineTo(1536, 960);
  ctx.fill();
  ctx.save();
  ctx.strokeStyle = "#fffaf0";
  ctx.lineWidth = 4;
  ctx.setLineDash([10, 16]);
  ctx.beginPath();
  ctx.moveTo(18, 895);
  ctx.bezierCurveTo(160, 790, 355, 1000, 590, 948);
  ctx.moveTo(1430, 900);
  ctx.quadraticCurveTo(1490, 880, 1520, 852);
  ctx.stroke();
  ctx.restore();
  heart(66, 885, 45, "#fffaf0");

  if (face === "back") {
    const qr = qrcode(0, "M");
    qr.addData(url);
    qr.make();
    const count = qr.getModuleCount();
    const cell = Math.floor(528 / (count + 8));
    if (cell < 1) throw new Error("El enlace es demasiado largo para el QR.");
    const side = (count + 8) * cell;
    const left = Math.round(1190 - side / 2);
    const top = Math.round(500 - side / 2);
    ctx.save();
    ctx.strokeStyle = "#78b8aa";
    ctx.lineWidth = 4;
    ctx.setLineDash([7, 11]);
    ctx.beginPath();
    ctx.roundRect(left - 16, top - 16, side + 32, side + 32, 24);
    ctx.stroke();
    ctx.restore();
    heart(left + side + 22, top + side - 44, 42, coral);
    ctx.fillStyle = "#fff";
    ctx.fillRect(left, top, side, side);
    ctx.fillStyle = "#000";
    for (let row = 0; row < count; row++)
      for (let column = 0; column < count; column++)
        if (qr.isDark(row, column))
          ctx.fillRect(
            left + (column + 4) * cell,
            top + (row + 4) * cell,
            cell,
            cell,
          );
    ctx.font = '600 48px "Manrope"';
    ctx.fillStyle = ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("Escanea mi ficha", 1190, 790);
  }

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
  const front = section.querySelector<HTMLImageElement>("[data-id-image]")!;
  const back = section.querySelector<HTMLImageElement>("[data-id-back-image]")!;
  const flip = section.querySelector<HTMLButtonElement>("[data-id-flip]")!;
  const sideLabel = section.querySelector<HTMLElement>("[data-id-side]")!;
  const fullSize = section.querySelector<HTMLAnchorElement>("[data-id-full]")!;
  const download =
    section.querySelector<HTMLAnchorElement>("[data-id-download]")!;
  const backDownload = section.querySelector<HTMLAnchorElement>(
    "[data-id-back-download]",
  )!;
  const actions = section.querySelector<HTMLElement>("[data-id-actions]")!;
  const retry = section.querySelector<HTMLButtonElement>("[data-id-retry]")!;
  const status = section.querySelector<HTMLElement>("[data-id-status]")!;
  const settings = data.identification;
  const extras: Extras = {
    location: Boolean(
      settings.location &&
        data.location &&
        settings.mapImage &&
        settings.mapImage.latitude === data.location.latitude &&
        settings.mapImage.longitude === data.location.longitude &&
        settings.mapImage.photoUrl === data.photoUrl &&
        settings.mapImage.zoom === settings.mapZoom,
    ),
    phone: settings.phone && Boolean(data.phone),
    weight: settings.weight && Boolean(data.weight),
    sex: settings.sex && Boolean(data.sex),
  };
  let cachedMap: HTMLImageElement | undefined;
  let assets:
    | {
        logo: HTMLImageElement;
        photo: HTMLImageElement | null;
        squareLogo: HTMLImageElement;
      }
    | undefined;
  let objectUrls: string[] = [];
  let isBack = false;
  let preparing = false;
  let disposed = false;
  const release = () => {
    objectUrls.forEach((url) => URL.revokeObjectURL(url));
    objectUrls = [];
  };
  const showSide = () => {
    flip.dataset.side = isBack ? "back" : "front";
    front.parentElement!.setAttribute("aria-hidden", String(isBack));
    back.parentElement!.setAttribute("aria-hidden", String(!isBack));
    flip.setAttribute(
      "aria-label",
      `${isBack ? back.alt : front.alt} Mostrar ${isBack ? "frente" : "reverso"}.`,
    );
    sideLabel.textContent = `${isBack ? "Reverso" : "Frente"} · Toca la tarjeta para darle la vuelta`;
    fullSize.href = objectUrls[isBack ? 1 : 0];
    fullSize.textContent = `Ver ${isBack ? "reverso" : "frente"} en tamaño completo`;
  };
  flip.addEventListener("click", () => {
    if (objectUrls.length !== 2) return;
    isBack = !isBack;
    showSide();
  });
  const prepare = async () => {
    if (preparing || disposed) return;
    preparing = true;
    flip.hidden = actions.hidden = sideLabel.hidden = true;
    retry.hidden = true;
    release();
    status.textContent = "Preparando las dos caras de la identificación…";
    try {
      if (!assets) {
        const [logo, photo, squareLogo] = await Promise.all([
          loadImage(`${import.meta.env.BASE_URL}logo_horizontal.png`),
          data.photoUrl.startsWith("https://")
            ? loadImage(data.photoUrl)
            : Promise.resolve(null),
          loadImage(`${import.meta.env.BASE_URL}logo.png`),
          document.fonts.load('600 72px "Baloo 2"'),
          document.fonts.load('600 32px "Manrope"'),
          document.fonts.load('500 72px "Caveat"'),
        ]);
        assets = { logo, photo, squareLogo };
      }
      if (disposed) return;
      if (extras.location && !cachedMap && settings.mapImage) {
        cachedMap = await loadImage(settings.mapImage.url);
      }
      if (disposed) return;
      const blobs = await Promise.all([
        createCard(data, publicUrl, "front", assets.logo, assets.photo, extras),
        createCard(
          data,
          publicUrl,
          "back",
          assets.squareLogo,
          assets.photo,
          extras,
          extras.location ? cachedMap : undefined,
        ),
      ]);
      if (disposed) return;
      for (const blob of blobs) objectUrls.push(URL.createObjectURL(blob));
      front.src = objectUrls[0];
      back.src = objectUrls[1];
      front.alt = `Frente de la identificación de ${data.name}. ${[
        data.species,
        data.breed,
        validCalendarDate(data.birthDate)
          ? `Nacimiento: ${data.birthDate.split("-").reverse().join("/")}`
          : "",
        extras.weight ? `Peso: ${data.weight}` : "",
        extras.sex ? `Sexo: ${data.sex}` : "",
      ]
        .filter(Boolean)
        .join(". ")}.`;
      back.alt = `Reverso de la identificación de ${data.name}. ${[
        data.guardian ? `Responsable: ${data.guardian}` : "",
        extras.phone ? `Teléfono: ${data.phone}` : "",
        extras.location && data.location
          ? `Mapa de la ubicación compartida: ${data.location.label}`
          : "",
      ]
        .filter(Boolean)
        .join(". ")}. El QR abre su ficha pública.`;
      await Promise.all([front.decode(), back.decode()]);
      if (disposed) return;
      const filename = `pawpass-${data.name.replace(/[^\p{L}\p{N}-]+/gu, "-").slice(0, 60) || "identificacion"}`;
      download.href = objectUrls[0];
      backDownload.href = objectUrls[1];
      download.download = `${filename}-frente.png`;
      backDownload.download = `${filename}-reverso.png`;
      showSide();
      flip.hidden = actions.hidden = sideLabel.hidden = false;
      status.textContent = "";
    } catch {
      release();
      if (disposed) return;
      status.textContent =
        "No pudimos preparar la identificación. Comprueba la conexión e inténtalo de nuevo.";
      retry.hidden = false;
    } finally {
      preparing = false;
    }
  };
  retry.addEventListener("click", () => {
    void prepare();
  });
  window.addEventListener("pagehide", (event) => {
    if (!event.persisted) {
      disposed = true;
      release();
    }
  });
  section.hidden = false;
  void prepare();
}
