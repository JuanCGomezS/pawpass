export type CareKind = "vaccines" | "medications" | "vet-visits";

export type CareRecord = {
  id: string;
  title: string;
  date: string;
  nextDate?: string;
  professional?: string;
  notes?: string;
  isPublic: boolean;
};

export function validCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    year >= 1900 &&
    year <= 9999 &&
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() + 1 === month &&
    parsed.getUTCDate() === day
  );
}

function localDate(today: Date): string {
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

export function validateBirthDate(value?: string, today = new Date()): void {
  if (value && (!validCalendarDate(value) || value > localDate(today)))
    throw new Error(
      "La fecha de nacimiento debe ser una fecha válida y no puede estar en el futuro.",
    );
}

export function petAge(birthDate?: string, today = new Date()): string {
  if (
    !birthDate ||
    !validCalendarDate(birthDate) ||
    birthDate > localDate(today)
  )
    return "";
  const [year, month, day] = birthDate.split("-").map(Number);
  let months = (today.getFullYear() - year) * 12 + today.getMonth() + 1 - month;
  if (today.getDate() < day) months -= 1;
  if (months < 12) return `${months} ${months === 1 ? "mes" : "meses"}`;
  const years = Math.floor(months / 12);
  return `${years} ${years === 1 ? "año" : "años"}`;
}

export function validateCareRecord(
  kind: CareKind,
  record: Omit<CareRecord, "id"> & { id?: string },
  today = new Date(),
): void {
  if (!["vaccines", "medications", "vet-visits"].includes(kind))
    throw new Error("El tipo de historial no es válido.");
  if (record.id !== undefined && (!record.id || record.id.includes("/")))
    throw new Error("El identificador del registro no es válido.");
  if (
    typeof record.title !== "string" ||
    !record.title.trim() ||
    record.title.length > 120
  )
    throw new Error("El título es obligatorio y admite hasta 120 caracteres.");
  if (
    typeof record.date !== "string" ||
    !validCalendarDate(record.date) ||
    (kind !== "medications" && record.date > localDate(today))
  )
    throw new Error(
      "La fecha debe ser válida y no puede ser futura para vacunas o consultas.",
    );
  if (record.nextDate && !validCalendarDate(record.nextDate))
    throw new Error("La próxima fecha debe ser una fecha válida.");
  if (record.professional && record.professional.length > 120)
    throw new Error("El profesional admite hasta 120 caracteres.");
  if (record.notes && record.notes.length > 1000)
    throw new Error("Las notas admiten hasta 1000 caracteres.");
  if (record.isPublic !== undefined && typeof record.isPublic !== "boolean")
    throw new Error("La privacidad del registro no es válida.");
}
