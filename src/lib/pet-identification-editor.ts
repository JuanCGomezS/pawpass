import { captureIdentificationMap } from "./pet-identification-map";
import {
  readIdentificationSettings,
  type IdentificationSettings,
} from "./identification-settings";
import { uploadPetPhoto, type PetProfile } from "./repository";

type Draft = Pick<
  PetProfile,
  "visibility" | "location" | "photoUrl" | "phone" | "weightKg" | "sex"
>;
type Extra = "location" | "phone" | "weight" | "sex";
const keys: Extra[] = ["location", "phone", "weight", "sex"];

export function identificationEditor(
  form: HTMLFormElement,
  draft: () => Draft | null,
) {
  const root = form.querySelector<HTMLElement>("[data-identification-editor]")!;
  const inputs = Object.fromEntries(
    keys.map((key) => [
      key,
      root.querySelector<HTMLInputElement>(`[data-print-extra="${key}"]`)!,
    ]),
  ) as Record<Extra, HTMLInputElement>;
  const preview = root.querySelector<HTMLElement>("[data-print-map-preview]")!;
  const container = root.querySelector<HTMLElement>("[data-print-map]")!;
  const status = root.querySelector<HTMLElement>("[data-print-map-status]")!;
  const zoomLabel = root.querySelector<HTMLOutputElement>("[data-print-zoom]")!;
  const closer = root.querySelector<HTMLButtonElement>("[data-print-closer]")!;
  const farther = root.querySelector<HTMLButtonElement>(
    "[data-print-farther]",
  )!;
  let zoom = 16;
  let version = 0;
  let controller: AbortController | undefined;
  let pending: Promise<void> = Promise.resolve();
  let snapshot:
    | { key: string; blob?: Blob; saved?: IdentificationSettings["mapImage"] }
    | undefined;
  let requestedKey: string | undefined;

  const fingerprint = (data: Draft) =>
    JSON.stringify([
      data.location?.latitude,
      data.location?.longitude,
      data.photoUrl,
      zoom,
    ]);
  const enabled = (data: Draft | null): Record<Extra, boolean> => ({
    location: !!(
      data?.visibility.basics &&
      data.visibility.location &&
      data.location &&
      Math.abs(data.location.latitude) <= 85 &&
      data.photoUrl
    ),
    phone: !!(
      data?.visibility.basics &&
      data.visibility.contact &&
      data.phone?.trim()
    ),
    weight: !!(
      data?.visibility.basics &&
      Number.isFinite(data.weightKg) &&
      data.weightKg! > 0
    ),
    sex: !!(
      data?.visibility.basics &&
      data.sex &&
      data.sex !== "No especificado"
    ),
  });
  function invalidate() {
    version++;
    controller?.abort();
    snapshot = undefined;
    requestedKey = undefined;
  }
  function refresh() {
    const data = draft();
    const availability = enabled(data);
    for (const key of keys) {
      inputs[key].disabled = !availability[key];
      if (!availability[key]) inputs[key].checked = false;
    }
    preview.hidden = !inputs.location.checked;
    zoomLabel.value = `Zoom ${zoom}`;
    closer.disabled = zoom >= 19;
    farther.disabled = zoom <= 12;
    if (
      !data ||
      !inputs.location.checked ||
      (snapshot && snapshot.key !== fingerprint(data)) ||
      (requestedKey && requestedKey !== fingerprint(data))
    ) {
      invalidate();
      status.textContent = inputs.location.checked
        ? "El mapa cambió. Pulsa Actualizar mapa antes de guardar."
        : "";
      // Leaflet owns the container until the cancelled capture finishes.
      const current = version;
      void pending.finally(() => {
        if (current === version) container.replaceChildren();
      });
    }
  }
  async function prepare() {
    refresh();
    const data = draft();
    if (!data?.location || !data.photoUrl || !inputs.location.checked) return;
    invalidate();
    const current = version;
    const abort = new AbortController();
    controller = abort;
    const key = fingerprint(data);
    requestedKey = key;
    status.textContent = "Preparando el encuadre…";
    pending = pending.then(async () => {
      if (current !== version) return;
      try {
        container.replaceChildren();
        const photo = await new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image();
          const finish = (error?: Error) => {
            clearTimeout(timer);
            abort.signal.removeEventListener("abort", cancel);
            image.onload = image.onerror = null;
            if (error) {
              image.src = "";
              reject(error);
            } else resolve(image);
          };
          const cancel = () => finish(new Error("Preparación cancelada."));
          const timer = window.setTimeout(
            () => finish(new Error("No pudimos cargar la foto.")),
            15000,
          );
          image.crossOrigin = "anonymous";
          image.referrerPolicy = "no-referrer";
          image.onload = () => finish();
          image.onerror = () => finish(new Error("No pudimos cargar la foto."));
          abort.signal.addEventListener("abort", cancel, { once: true });
          if (abort.signal.aborted) {
            cancel();
            return;
          }
          image.src = data.photoUrl!;
        });
        if (current !== version) return;
        await document.fonts.load('600 26px "Manrope"');
        if (current !== version) return;
        preview.scrollIntoView({ block: "nearest", behavior: "instant" });
        const canvas = await captureIdentificationMap(
          container,
          data.location!,
          photo,
          abort.signal,
          zoom,
        );
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (value) =>
              value
                ? resolve(value)
                : reject(new Error("No pudimos preparar el mapa.")),
            "image/png",
          ),
        );
        if (current !== version || !draft() || key !== fingerprint(draft()!))
          return;
        snapshot = { key, blob };
        requestedKey = undefined;
        status.textContent =
          "Encuadre listo. Guarda el perfil para aplicarlo a la identificación pública.";
      } catch (error) {
        if (current !== version) return;
        requestedKey = undefined;
        status.textContent =
          error instanceof Error
            ? error.message
            : "No pudimos preparar el mapa. Vuelve a intentarlo.";
      }
    });
    await pending;
  }
  for (const key of keys)
    inputs[key].addEventListener("change", () => {
      refresh();
      if (key === "location" && inputs.location.checked) void prepare();
    });
  closer.addEventListener("click", () => {
    if (zoom < 19) {
      zoom++;
      void prepare();
    }
  });
  farther.addEventListener("click", () => {
    if (zoom > 12) {
      zoom--;
      void prepare();
    }
  });
  root
    .querySelector<HTMLButtonElement>("[data-print-map-refresh]")!
    .addEventListener("click", () => void prepare());
  form.addEventListener("input", (event) => {
    if (!root.contains(event.target as Node)) refresh();
  });

  return {
    refresh,
    ensureReady() {
      refresh();
      const data = draft();
      if (
        inputs.location.checked &&
        (!data || !snapshot || snapshot.key !== fingerprint(data))
      )
        throw new Error(
          "Actualiza el mapa de la identificación antes de guardar el perfil.",
        );
    },
    reset() {
      invalidate();
      const current = version;
      void pending.then(() => {
        if (current === version) container.replaceChildren();
      });
      preview.hidden = true;
    },
    load(value: unknown) {
      invalidate();
      const settings = readIdentificationSettings(value);
      zoom = settings.mapZoom;
      for (const key of keys) inputs[key].checked = settings[key];
      const data = draft();
      const saved = settings.mapImage;
      if (
        data &&
        saved &&
        saved.latitude === data.location?.latitude &&
        saved.longitude === data.location?.longitude &&
        saved.photoUrl === data.photoUrl &&
        saved.zoom === zoom
      ) {
        snapshot = { key: fingerprint(data), saved };
        const image = new Image();
        image.alt = "Encuadre guardado del mapa de la identificación";
        image.src = saved.url;
        const current = version;
        void pending.then(() => {
          if (current === version) container.replaceChildren(image);
        });
        status.textContent =
          "Este es el encuadre guardado. Puedes acercarlo o alejarlo sin mover la ubicación.";
      }
      refresh();
    },
    async forSave(updated: PetProfile): Promise<IdentificationSettings> {
      refresh();
      const result: IdentificationSettings = {
        location: inputs.location.checked,
        phone: inputs.phone.checked,
        weight: inputs.weight.checked,
        sex: inputs.sex.checked,
        mapZoom: zoom,
      };
      if (!result.location) return result;
      const data = draft();
      const ready = snapshot;
      if (
        !data ||
        !ready ||
        ready.key !== fingerprint(data) ||
        !updated.location ||
        !updated.photoUrl
      )
        throw new Error(
          "Actualiza el mapa de la identificación antes de guardar el perfil.",
        );
      const current = version;
      if (ready.saved) result.mapImage = ready.saved;
      else if (ready.blob) {
        const uploaded = await uploadPetPhoto(
          updated.id,
          new File([ready.blob], "identification-map.png", {
            type: "image/png",
          }),
        );
        if (
          current !== version ||
          !draft() ||
          ready.key !== fingerprint(draft()!)
        )
          throw new Error(
            "La configuración cambió. Vuelve a guardar el perfil.",
          );
        result.mapImage = {
          url: uploaded.photoUrl,
          latitude: updated.location.latitude,
          longitude: updated.location.longitude,
          photoUrl: updated.photoUrl,
          zoom,
        };
      }
      return result;
    },
  };
}
