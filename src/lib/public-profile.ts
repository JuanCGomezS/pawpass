import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { showIdentification } from "./pet-identification";
import L from "leaflet";
import { petAge, validCalendarDate, type CareKind } from "./pet-details";

const element = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";
const publicId = new URLSearchParams(location.search).get("id");
const kinds: Array<{ key: CareKind; label: string }> = [
  { key: "vaccines", label: "Vacunas" },
  { key: "vet-visits", label: "Consultas veterinarias" },
  { key: "medications", label: "Medicamentos y tratamientos" },
];
const dateLabel = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("es", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
};
let locationMap: L.Map | undefined;
function showMap(latitude: number, longitude: number) {
  const container = element("[data-public-map]");
  const status = element("[data-map-status]");
  container.hidden = false;
  try {
    locationMap = L.map(container, { scrollWheelZoom: false }).setView(
      [latitude, longitude],
      13,
    );
    const tiles = L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      },
    );
    tiles.on("tileerror", () => {
      status.textContent =
        "No pudimos cargar parte del mapa. Puedes abrir la ubicación con el enlace de abajo.";
    });
    tiles.on("tileload", () => {
      status.textContent = "";
    });
    tiles.addTo(locationMap);
    L.circleMarker([latitude, longitude], {
      radius: 10,
      color: "#795638",
      fillColor: "#c98b63",
      fillOpacity: 0.85,
    })
      .addTo(locationMap)
      .bindTooltip("Ubicación aproximada compartida");
  } catch {
    container.hidden = true;
    status.textContent =
      "No pudimos abrir el mapa. Usa el enlace para ver la ubicación.";
  }
}
window.addEventListener("pagehide", () => locationMap?.remove());
function showError(title: string, detail: string) {
  element("[data-state-title]").textContent = title;
  element("[data-state-detail]").textContent = detail;
}
function fact(label: string, value: string) {
  if (!value) return;
  const group = document.createElement("div");
  const term = document.createElement("dt");
  term.textContent = label;
  const description = document.createElement("dd");
  description.textContent = value;
  group.append(term, description);
  element("[data-public-facts]").append(group);
}
async function loadHealth() {
  if (!db || !publicId) return;
  const status = element("[data-health-status]");
  status.textContent = "Cargando los cuidados compartidos…";
  try {
    const results = await Promise.all(
      kinds.map(async (kind) => ({
        ...kind,
        snapshot: await getDocs(
          collection(db!, "publicProfiles", publicId, kind.key),
        ),
      })),
    );
    let count = 0;
    for (const { label, snapshot } of results) {
      const entries = snapshot.docs
        .map((item) => item.data())
        .filter(
          (item) => text(item.title) && validCalendarDate(text(item.date)),
        )
        .sort((a, b) => text(b.date).localeCompare(text(a.date)));
      if (!entries.length) continue;
      count += entries.length;
      const section = document.createElement("section");
      section.className = "public-care-category";
      const heading = document.createElement("h3");
      heading.textContent = label;
      section.append(heading);
      for (const entry of entries) {
        const row = document.createElement("article");
        row.className = "public-care-record";
        const date = document.createElement("time");
        date.dateTime = text(entry.date);
        date.textContent = dateLabel(text(entry.date));
        const body = document.createElement("div");
        const title = document.createElement("h4");
        title.textContent = text(entry.title);
        body.append(title);
        for (const value of [
          text(entry.professional),
          text(entry.notes),
          validCalendarDate(text(entry.nextDate))
            ? `Próxima fecha: ${dateLabel(text(entry.nextDate))}`
            : "",
        ]) {
          if (!value) continue;
          const paragraph = document.createElement("p");
          paragraph.textContent = value;
          body.append(paragraph);
        }
        row.append(date, body);
        section.append(row);
      }
      element("[data-public-records]").append(section);
    }
    status.textContent = "";
    if (!count && !element("[data-health-notes]").childElementCount)
      element("[data-health-section]").hidden = true;
  } catch {
    status.textContent =
      "No pudimos cargar el historial compartido. Inténtalo de nuevo más tarde.";
  }
}
async function load() {
  if (!publicId || publicId.includes("/")) {
    showError(
      "Esta historia aún no aparece.",
      "Comprueba el enlace o vuelve a escanear el QR.",
    );
    return;
  }
  if (!db) {
    showError(
      "No pudimos abrir la ficha.",
      "El servicio no está configurado. Inténtalo más tarde.",
    );
    return;
  }
  try {
    const snapshot = await getDoc(doc(db, "publicProfiles", publicId));
    if (!snapshot.exists()) {
      showError(
        "Esta historia aún no aparece.",
        "Puede que la ficha no esté publicada. Comprueba el enlace.",
      );
      return;
    }
    const data = snapshot.data();
    const name = text(data.name) || "Mi mascota";
    element("[data-cover]").dataset.photoPresentation =
      data.photoPresentation === "zoom" ? "zoom" : "normal";
    const heading = element("[data-public-name]");
    heading.textContent = name;
    if (name.length > 9) heading.classList.add("pet-name-long");
    if (name.length > 20) heading.classList.add("pet-name-very-long");
    document.title = `${name} — PawPass`;
    element("[data-public-species]").textContent = [
      text(data.species),
      text(data.breed),
    ]
      .filter(Boolean)
      .join(" · ");
    element("[data-public-age]").textContent = petAge(text(data.birthDate));
    for (const link of document.querySelectorAll<HTMLAnchorElement>(
      "[data-section-link]",
    ))
      link.href = `${location.pathname}${location.search}#${link.dataset.sectionLink}`;
    if (text(data.photoUrl).startsWith("https://")) {
      const image = new Image();
      image.alt = `Foto de ${name}`;
      image.decoding = "async";
      image.onload = () => {
        element("[data-public-photo]").hidden = false;
        element("[data-cover]").dataset.hasPhoto = "true";
      };
      image.onerror = () => {
        element("[data-cover]").dataset.hasPhoto = "false";
      };
      image.src = text(data.photoUrl);
      element("[data-public-photo]").append(image);
    }
    fact("Edad", petAge(text(data.birthDate)));
    fact("Especie", text(data.species));
    fact("Raza o mezcla", text(data.breed));
    fact("Sexo", text(data.sex) === "No especificado" ? "" : text(data.sex));
    fact(
      "Peso",
      typeof data.weightKg === "number" && data.weightKg > 0
        ? `${new Intl.NumberFormat("es").format(data.weightKg)} kg`
        : "",
    );
    const notes = text(data.notes);
    if (notes) {
      element("[data-public-notes]").textContent = notes;
      element("[data-public-notes]").hidden = false;
    }
    element("[data-about-section]").hidden =
      !notes && !element("[data-public-facts]").childElementCount;
    const contact = data.contact;
    if (contact && (text(contact.guardian) || text(contact.phone))) {
      element("[data-public-contact]").hidden = false;
      element("[data-contact-section]").hidden = false;
      element("[data-guardian]").textContent =
        text(contact.guardian) || "Persona responsable";
      const phone = text(contact.phone);
      if (phone) {
        const phoneLink = element<HTMLAnchorElement>("[data-phone]");
        phoneLink.textContent = phone;
        phoneLink.hidden = false;
        const number = phone.replace(/[\s()-]/g, "");
        if (/^\+?\d{7,15}$/.test(number)) phoneLink.href = `tel:${number}`;
        if (/^\+[1-9]\d{6,14}$/.test(number)) {
          const hero = element<HTMLAnchorElement>("[data-hero-contact]");
          hero.href = `https://wa.me/${number.slice(1)}`;
          hero.hidden = false;
        }
      }
    }
    const place = data.location;
    let coordinates: { latitude: number; longitude: number } | undefined;
    if (place && text(place.label)) {
      element("[data-public-location]").hidden = false;
      element("[data-contact-section]").hidden = false;
      element("[data-location-label]").textContent = text(place.label);
      if (
        Number.isFinite(place.latitude) &&
        Math.abs(place.latitude) <= 90 &&
        Number.isFinite(place.longitude) &&
        Math.abs(place.longitude) <= 180
      ) {
        coordinates = { latitude: place.latitude, longitude: place.longitude };
        const link = element<HTMLAnchorElement>("[data-map-link]");
        link.href = `https://www.google.com/maps/search/?api=1&query=${place.latitude}%2C${place.longitude}`;
        link.hidden = false;
      }
    }
    if (data.healthEnabled === true) {
      element("[data-health-section]").hidden = false;
      for (const [label, value] of [
        ["Alergias conocidas", text(data.health?.allergies)],
        ["Cuidados especiales", text(data.health?.conditions)],
      ]) {
        if (!value) continue;
        const item = document.createElement("div");
        const title = document.createElement("h3");
        title.textContent = label;
        const paragraph = document.createElement("p");
        paragraph.textContent = value;
        item.append(title, paragraph);
        element("[data-health-notes]").append(item);
      }
      void loadHealth();
    }
    element("[data-public-profile]").hidden = false;
    element("[data-public-empty]").hidden = true;
    if (text(data.name) && import.meta.env.SITE) {
      const profileUrl = new URL(
        "p/",
        `${import.meta.env.SITE.replace(/\/$/, "")}/`,
      );
      profileUrl.searchParams.set("id", publicId);
      showIdentification(
        element("[data-identification]"),
        {
          name: text(data.name),
          species: text(data.species),
          breed: text(data.breed),
          birthDate: text(data.birthDate),
          guardian: text(data.contact?.guardian),
          photoUrl: text(data.photoUrl),
        },
        profileUrl.href,
      );
    } else if (text(data.name)) {
      element("[data-identification]").hidden = false;
      element("[data-id-status]").textContent =
        "Configura SITE_URL para generar la identificación con el enlace público.";
    }
    if (coordinates) showMap(coordinates.latitude, coordinates.longitude);
  } catch {
    showError(
      "No pudimos abrir esta historia.",
      "Comprueba la conexión y vuelve a cargar la página.",
    );
  }
}
void load();
