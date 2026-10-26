import L from "leaflet";
import "../styles/pet-map-icon.css";

export function petMapIcon(photoUrl?: string): L.DivIcon {
  const avatar = document.createElement("div");
  avatar.className = "pet-map-avatar";
  avatar.setAttribute("role", "img");
  avatar.setAttribute("aria-label", "Ubicación de la mascota");
  const fallback = document.createElement("span");
  fallback.className = "pet-map-paw";
  fallback.setAttribute("aria-hidden", "true");
  fallback.innerHTML = `<svg viewBox="0 0 100 100" focusable="false">
    <ellipse cx="20" cy="36" rx="11" ry="15" transform="rotate(-25 20 36)" />
    <ellipse cx="40" cy="20" rx="10" ry="15" transform="rotate(-8 40 20)" />
    <ellipse cx="63" cy="21" rx="10" ry="15" transform="rotate(12 63 21)" />
    <ellipse cx="82" cy="40" rx="10" ry="14" transform="rotate(30 82 40)" />
    <path d="M26 63c5-9 12-22 24-22s18 12 24 21c15 22-5 28-23 21-18 8-39 2-25-20Z" />
  </svg>`;
  avatar.append(fallback);
  if (
    photoUrl &&
    (photoUrl.startsWith("https://") || photoUrl.startsWith("blob:"))
  ) {
    const image = new Image();
    image.alt = "";
    image.hidden = true;
    image.decoding = "async";
    image.referrerPolicy = "no-referrer";
    image.onload = () => {
      fallback.hidden = true;
      image.hidden = false;
    };
    image.onerror = () => {
      image.remove();
      fallback.hidden = false;
    };
    avatar.append(image);
    image.src = photoUrl;
  }
  return L.divIcon({
    html: avatar,
    className: "pet-map-pin",
    iconSize: [54, 62],
    iconAnchor: [27, 62],
    tooltipAnchor: [0, -58],
  });
}
