import L from "leaflet";
import { petMapIcon } from "./pet-map-icon";
import "leaflet/dist/leaflet.css";
import { observeSession } from "./session";
import {
  petById,
  savePetProfile,
  uploadPetPhoto,
  careRecordsForPet,
  saveCareRecord,
  deleteCareRecord,
  type PetProfile,
  type Location,
} from "./repository";
import type { CareKind, CareRecord } from "./pet-details";

const element = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
const input = (id: string) => element<HTMLInputElement>(`#${id}`);
const form = element<HTMLFormElement>("[data-pet-editor]");
const fields = element<HTMLFieldSetElement>("[data-profile-fields]");
const fileInput = input("pet-photo");
const status = element("[data-editor-status]");
const message = element("[data-save-message]");
const photoStatus = element("[data-photo-status]");
const content = element("[data-editor-content]");
const petId = new URLSearchParams(location.search).get("id");
const kinds: CareKind[] = ["vaccines", "vet-visits", "medications"];
let pet: PetProfile | null = null;
let records: Record<CareKind, CareRecord[]> = {
  vaccines: [],
  medications: [],
  "vet-visits": [],
};
let selectedPhoto: File | undefined;
let previewUrl: string | undefined;
let selectedLocation: Location | undefined;
let map: L.Map | undefined;
let marker: L.Marker | undefined;
let mapPhotoUrl: string | undefined;
let activeUid: string | undefined;
let loading = false;
const localToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
input("pet-birth-date").max = localToday();

const searchLocation = element<HTMLButtonElement>("[data-search-location]");
const locateMe = element<HTMLButtonElement>("[data-locate-me]");
const locationStatus = element("[data-location-status]");
let locationOperation = 0;
let locationSearchController: AbortController | undefined;

function cancelLocationAction() {
  locationOperation++;
  locationSearchController?.abort();
  locationSearchController = undefined;
  searchLocation.disabled = locateMe.disabled = false;
  locationStatus.textContent = "";
}

function placeLocation(latitude: number, longitude: number, center = true) {
  if (
    !map ||
    !activeUid ||
    fields.disabled ||
    !Number.isFinite(latitude) ||
    Math.abs(latitude) > 90 ||
    !Number.isFinite(longitude) ||
    Math.abs(longitude) > 180
  )
    return false;
  const label = input("pet-location-label");
  if (!label.value.trim()) label.value = "Ubicación aproximada";
  selectedLocation = { label: label.value.trim(), latitude, longitude };
  const point = L.latLng(latitude, longitude);
  if (marker) marker.setLatLng(point);
  else
    marker = L.marker(point, {
      icon: petMapIcon(mapPhotoUrl),
      interactive: false,
      keyboard: false,
    }).addTo(map);
  if (center) map.setView(point, 16);
  return true;
}

searchLocation.addEventListener("click", async () => {
  if (!map || !activeUid || fields.disabled) return;
  cancelLocationAction();
  const query = input("pet-location-label").value.trim();
  if (!query) {
    locationStatus.textContent =
      "Escribe una dirección o barrio y su ciudad para buscar.";
    input("pet-location-label").focus();
    return;
  }
  const operation = locationOperation;
  const controller = new AbortController();
  locationSearchController = controller;
  searchLocation.disabled = locateMe.disabled = true;
  locationStatus.textContent = "Buscando la dirección…";
  const timeout = window.setTimeout(() => controller.abort(), 12000);
  try {
    const url = new URL("https://photon.komoot.io/api/");
    url.searchParams.set("q", query);
    url.searchParams.set("limit", "1");
    const response = await fetch(url, {
      signal: controller.signal,
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
    if (!response.ok) throw new Error("Geocoding unavailable");
    const result = await response.json();
    if (operation !== locationOperation) return;
    const feature = result.features?.[0];
    const coordinates = feature?.geometry?.coordinates;
    if (
      feature?.geometry?.type !== "Point" ||
      !Array.isArray(coordinates) ||
      typeof coordinates[0] !== "number" ||
      typeof coordinates[1] !== "number" ||
      !placeLocation(coordinates[1], coordinates[0])
    ) {
      locationStatus.textContent =
        "No encontramos esa dirección. Añade la ciudad o selecciona el punto en el mapa.";
      return;
    }
    const properties = feature.properties ?? {};
    const description = [
      ...new Set(
        [
          properties.name,
          properties.street,
          properties.housenumber,
          properties.district,
          properties.city,
          properties.state,
          properties.country,
        ].filter(
          (value): value is string =>
            typeof value === "string" && !!value.trim(),
        ),
      ),
    ].join(", ");
    locationStatus.textContent = `${description ? `Resultado: ${description}. ` : "Lugar encontrado. "}Revisa el punto antes de guardar el perfil.`;
  } catch {
    if (operation === locationOperation)
      locationStatus.textContent = controller.signal.aborted
        ? "La búsqueda tardó demasiado. Intenta de nuevo o selecciona el punto en el mapa."
        : "No pudimos buscar la dirección. Intenta de nuevo o selecciona el punto en el mapa.";
  } finally {
    window.clearTimeout(timeout);
    if (operation === locationOperation) {
      locationSearchController = undefined;
      searchLocation.disabled = locateMe.disabled = false;
    }
  }
});

input("pet-location-label").addEventListener("input", () => {
  cancelLocationAction();
  const label = input("pet-location-label").value.trim();
  if (label && label !== selectedLocation?.label)
    locationStatus.textContent =
      "La dirección cambió. Pulsa Buscar o toca el mapa para confirmar el punto.";
});
input("pet-location-label").addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.isComposing) {
    event.preventDefault();
    if (!searchLocation.disabled) searchLocation.click();
  }
});

locateMe.addEventListener("click", () => {
  if (!map || !activeUid || fields.disabled) return;
  cancelLocationAction();
  if (!window.isSecureContext || !navigator.geolocation) {
    locationStatus.textContent =
      "Tu navegador necesita una conexión HTTPS y acceso a la ubicación. Puedes buscar la dirección o tocar el mapa.";
    return;
  }
  const operation = locationOperation;
  searchLocation.disabled = locateMe.disabled = true;
  locationStatus.textContent =
    "Buscando tu ubicación… Permite el acceso si el navegador lo solicita.";
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      if (operation !== locationOperation) return;
      searchLocation.disabled = locateMe.disabled = false;
      locationStatus.textContent = placeLocation(
        coords.latitude,
        coords.longitude,
      )
        ? "Ubicación obtenida. Revisa la dirección y ajusta el punto antes de guardar si no quieres compartir una ubicación precisa."
        : "No pudimos obtener un punto válido. Puedes seleccionarlo en el mapa.";
    },
    (error) => {
      if (operation !== locationOperation) return;
      searchLocation.disabled = locateMe.disabled = false;
      locationStatus.textContent =
        error.code === 1
          ? "No diste permiso de ubicación. Puedes habilitarlo en tu navegador, buscar la dirección o tocar el mapa."
          : error.code === 3
            ? "Tu ubicación tardó demasiado. Intenta de nuevo o busca la dirección."
            : "No pudimos obtener tu ubicación. Busca la dirección o selecciona un punto en el mapa.";
    },
    { enableHighAccuracy: false, timeout: 12000, maximumAge: 0 },
  );
});

function showPreview(url?: string) {
  mapPhotoUrl = url;
  marker?.setIcon(petMapIcon(url));
  const target = element("[data-preview-image]");
  target.replaceChildren();
  element("[data-preview-name]").textContent = input("pet-name").value;
  element("[data-photo-preview]").dataset.presentation = input(
    "pet-photo-presentation",
  ).value;
  element("[data-photo-empty]").hidden = !!url;
  if (!url) return;
  const image = new Image();
  image.alt = "Vista previa de la foto de tu mascota";
  image.src = url;
  image.onerror = () => {
    photoStatus.textContent =
      "No pudimos cargar la vista previa. Puedes elegir otra foto.";
  };
  target.append(image);
}
input("pet-photo-presentation").addEventListener("change", () => {
  element("[data-photo-preview]").dataset.presentation = input(
    "pet-photo-presentation",
  ).value;
});
input("pet-name").addEventListener("input", () => {
  element("[data-preview-name]").textContent = input("pet-name").value;
});
fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = undefined;
  }
  selectedPhoto = undefined;
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > 5 * 1024 * 1024
  ) {
    fileInput.value = "";
    showPreview(pet?.photoUrl);
    photoStatus.textContent =
      "Elige un PNG, JPG o WebP de hasta 5 MB. Se conservará la foto guardada.";
    return;
  }
  selectedPhoto = file;
  previewUrl = URL.createObjectURL(file);
  showPreview(previewUrl);
  photoStatus.textContent = "Foto lista. Guarda el perfil para subirla.";
});

function renderRecords(kind: CareKind) {
  const list = element(`[data-record-list="${kind}"]`);
  list.replaceChildren();
  element(`[data-record-count="${kind}"]`).textContent =
    `${records[kind].length} registros`;
  if (!records[kind].length) {
    const empty = document.createElement("p");
    empty.className = "care-empty";
    empty.textContent =
      "Todavía no hay registros. Añade el primero cuando tengas la información.";
    list.append(empty);
    return;
  }
  for (const record of [...records[kind]].sort((a, b) =>
    b.date.localeCompare(a.date),
  )) {
    const row = document.createElement("article");
    row.className = "care-record";
    const date = document.createElement("time");
    date.dateTime = record.date;
    date.textContent = formatDate(record.date);
    const body = document.createElement("div");
    const heading = document.createElement("h4");
    heading.textContent = record.title;
    body.append(heading);
    for (const text of [
      record.professional,
      record.notes,
      record.nextDate ? `Próxima fecha: ${formatDate(record.nextDate)}` : "",
      record.isPublic
        ? "Marcado para compartir · requiere salud pública activada"
        : "Privado",
    ]) {
      if (!text) continue;
      const paragraph = document.createElement("p");
      paragraph.textContent = text;
      body.append(paragraph);
    }
    const actions = document.createElement("div");
    actions.className = "record-actions";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "Editar";
    edit.className = "text-button";
    edit.addEventListener("click", () => {
      const recordForm = element<HTMLFormElement>(
        `[data-record-form="${kind}"]`,
      );
      for (const key of [
        "title",
        "date",
        "nextDate",
        "professional",
        "notes",
      ] as const) {
        (recordForm.elements.namedItem(key) as HTMLInputElement).value =
          record[key] ?? "";
      }
      (recordForm.elements.namedItem("recordId") as HTMLInputElement).value =
        record.id;
      (recordForm.elements.namedItem("isPublic") as HTMLInputElement).checked =
        record.isPublic;
      recordForm.querySelector("[data-record-message]")!.textContent = "";
      element<HTMLDetailsElement>(`[data-record-details="${kind}"]`).open =
        true;
      (recordForm.elements.namedItem("title") as HTMLInputElement).focus();
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Eliminar";
    remove.className = "text-button";
    remove.addEventListener("click", async () => {
      if (
        !pet ||
        !confirm(
          `¿Eliminar el registro «${record.title}»? Esta acción no se puede deshacer.`,
        )
      )
        return;
      remove.disabled = edit.disabled = true;
      try {
        await deleteCareRecord(pet, kind, record.id);
        records[kind] = records[kind].filter((item) => item.id !== record.id);
        renderRecords(kind);
        element("[data-records-status]").textContent = "Registro eliminado.";
      } catch {
        element("[data-records-status]").textContent =
          "No se pudo eliminar. Comprueba tu conexión y permisos.";
      } finally {
        remove.disabled = edit.disabled = false;
      }
    });
    actions.append(edit, remove);
    row.append(date, body, actions);
    list.append(row);
  }
}
function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("es", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}
for (const kind of kinds) {
  const recordForm = element<HTMLFormElement>(`[data-record-form="${kind}"]`);
  if (kind !== "medications")
    (recordForm.elements.namedItem("date") as HTMLInputElement).max =
      localToday();
  recordForm
    .querySelector("[data-record-cancel]")!
    .addEventListener("click", () => {
      recordForm.reset();
      (recordForm.elements.namedItem("recordId") as HTMLInputElement).value =
        "";
      element<HTMLDetailsElement>(`[data-record-details="${kind}"]`).open =
        false;
    });
  recordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!pet || !activeUid) return;
    const values = new FormData(recordForm);
    const fieldset = recordForm.querySelector("fieldset")!;
    const feedback = recordForm.querySelector("[data-record-message]")!;
    fieldset.disabled = true;
    feedback.textContent = "Guardando registro…";
    try {
      await saveCareRecord(pet, kind, {
        ...(values.get("recordId")
          ? { id: String(values.get("recordId")) }
          : {}),
        title: String(values.get("title") ?? "").trim(),
        date: String(values.get("date") ?? ""),
        nextDate: String(values.get("nextDate") ?? "") || undefined,
        professional:
          String(values.get("professional") ?? "").trim() || undefined,
        notes: String(values.get("notes") ?? "").trim() || undefined,
        isPublic: values.get("isPublic") === "on",
      });
      recordForm.reset();
      (recordForm.elements.namedItem("recordId") as HTMLInputElement).value =
        "";
      feedback.textContent = "Registro guardado.";
      try {
        records = await careRecordsForPet(pet.id);
        for (const item of kinds) renderRecords(item);
      } catch {
        feedback.textContent =
          "Guardado. No se pudo actualizar la lista; recarga la página antes de volver a guardar.";
      }
    } catch (error) {
      feedback.textContent =
        error instanceof Error
          ? error.message
          : "No se pudo guardar el registro.";
    } finally {
      fieldset.disabled = false;
    }
  });
}

observeSession(async (state) => {
  if (state.status === "loading") return;
  if (state.status === "configured-error") {
    cancelLocationAction();
    status.textContent = state.message;
    return;
  }
  if (state.status !== "signed-in") {
    cancelLocationAction();
    activeUid = undefined;
    content.hidden = true;
    location.assign(`${import.meta.env.BASE_URL}login/`);
    return;
  }
  if (activeUid && activeUid !== state.session.uid) {
    cancelLocationAction();
    content.hidden = true;
    activeUid = undefined;
    pet = null;
    location.reload();
    return;
  }
  activeUid = state.session.uid;
  if (loading || pet) return;
  if (!petId || petId.includes("/")) {
    status.textContent = "El enlace no identifica una mascota.";
    return;
  }
  const uid = activeUid;
  loading = true;
  try {
    const loaded = await petById(petId);
    if (uid !== activeUid) return;
    if (!loaded) {
      status.textContent = "No encontramos esta mascota.";
      return;
    }
    pet = loaded;
    const mapping = {
      "pet-name": pet.name,
      "pet-species": pet.species,
      "pet-breed": pet.breed,
      "pet-birth-date": pet.birthDate,
      "pet-sex": pet.sex ?? "No especificado",
      "pet-weight": pet.weightKg?.toString(),
      "pet-notes": pet.notes,
      "pet-guardian": pet.guardian,
      "pet-phone": pet.phone,
      "pet-allergies": pet.allergies,
      "pet-conditions": pet.conditions,
      "pet-location-label": pet.location?.label,
    };
    for (const [id, value] of Object.entries(mapping))
      input(id).value = value ?? "";
    for (const key of ["basics", "location", "contact", "health"] as const)
      input(`show-${key}`).checked = pet.visibility?.[key] ?? key === "basics";
    selectedLocation = pet.location;
    input("pet-photo-presentation").value = pet.photoPresentation ?? "normal";
    showPreview(pet.photoUrl);
    content.hidden = false;
    if (pet.publicId) {
      const link = element<HTMLAnchorElement>("[data-public-link]");
      link.href = `${import.meta.env.BASE_URL}p/?id=${encodeURIComponent(pet.publicId)}`;
      link.hidden = false;
    }
    const initial: L.LatLngExpression = pet.location
      ? [pet.location.latitude, pet.location.longitude]
      : [6.2442, -75.5812];
    map = L.map(element("[data-location-map]")).setView(
      initial,
      pet.location ? 14 : 11,
    );
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    if (pet.location)
      marker = L.marker(initial, {
        icon: petMapIcon(mapPhotoUrl),
        interactive: false,
        keyboard: false,
      }).addTo(map);
    map.on("click", (event) => {
      if (fields.disabled) return;
      cancelLocationAction();
      if (placeLocation(event.latlng.lat, event.latlng.lng, false))
        locationStatus.textContent =
          "Punto seleccionado. Revisa la dirección y guarda el perfil para conservarlo.";
    });
    status.textContent = "Un perfil completo. Una historia que crece contigo.";
    try {
      records = await careRecordsForPet(pet.id);
      for (const kind of kinds) renderRecords(kind);
    } catch {
      element("[data-records-status]").textContent =
        "No pudimos cargar el historial. Recarga la página para volver a intentarlo.";
    }
  } catch {
    status.textContent =
      "No pudimos abrir la ficha. Comprueba tu conexión y permisos.";
  } finally {
    loading = false;
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!pet || !activeUid) return;
  cancelLocationAction();
  const locationLabel = input("pet-location-label").value.trim();
  if (locationLabel && locationLabel !== selectedLocation?.label) {
    message.textContent =
      "Confirma la ubicación antes de guardar: busca la dirección o selecciona su punto en el mapa.";
    input("pet-location-label").focus();
    return;
  }
  if (!pet.publicId) {
    message.textContent =
      "Esta mascota necesita un identificador público antes de poder guardar. Contacta con la administración.";
    return;
  }
  fields.disabled = true;
  message.textContent = "Guardando perfil…";
  try {
    const updated: PetProfile = {
      ...pet,
      name: input("pet-name").value.trim(),
      species: input("pet-species").value,
      breed: input("pet-breed").value.trim(),
      photoPresentation: input("pet-photo-presentation")
        .value as PetProfile["photoPresentation"],
      birthDate: input("pet-birth-date").value || undefined,
      sex: input("pet-sex").value as PetProfile["sex"],
      weightKg: input("pet-weight").value
        ? Number(input("pet-weight").value)
        : undefined,
      notes: input("pet-notes").value.trim(),
      guardian: input("pet-guardian").value.trim(),
      phone: input("pet-phone").value.trim(),
      allergies: input("pet-allergies").value.trim(),
      conditions: input("pet-conditions").value.trim(),
      location:
        selectedLocation && input("pet-location-label").value.trim()
          ? {
              ...selectedLocation,
              label: input("pet-location-label").value.trim(),
            }
          : undefined,
      visibility: {
        basics: input("show-basics").checked,
        location: input("show-location").checked,
        contact: input("show-contact").checked,
        health: input("show-health").checked,
      },
    };
    if (selectedPhoto)
      Object.assign(updated, await uploadPetPhoto(pet.id, selectedPhoto));
    await savePetProfile(updated);
    pet = updated;
    selectedPhoto = undefined;
    fileInput.value = "";
    message.textContent =
      "Perfil guardado. La ficha pública muestra únicamente lo que elegiste compartir.";
  } catch (error) {
    message.textContent =
      error instanceof Error
        ? error.message
        : "No pudimos guardar. Revisa tu conexión.";
  } finally {
    fields.disabled = false;
  }
});
window.addEventListener("pagehide", () => {
  cancelLocationAction();
  map?.remove();
  map = undefined;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
});
