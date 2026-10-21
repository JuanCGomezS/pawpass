import assert from "node:assert/strict";
import { test } from "node:test";
import {
  petAge,
  validCalendarDate,
  validateBirthDate,
  validateCareRecord,
} from "../src/lib/pet-details";
import { publicProjection, type PetProfile } from "../src/lib/repository";

const today = new Date(2026, 4, 14);
const pet: PetProfile = {
  id: "pet-1",
  accountId: "account-1",
  slotId: "pet-1",
  publicId: "public-1",
  name: "Luna",
  species: "Perra",
  breed: "Mestiza",
  birthDate: "2020-02-29",
  sex: "Hembra",
  weightKg: 18,
  notes: "Temerosa",
  guardian: "Ana",
  phone: "3001234567",
  allergies: "Polen",
  conditions: "",
  location: { label: "Ubicación de prueba", latitude: 6.24, longitude: -75.58 },
  visibility: { basics: true, location: false },
};

test("la proyección excluye contacto y salud salvo consentimiento explícito", () => {
  const hidden = publicProjection(pet);
  assert.equal(hidden.birthDate, pet.birthDate);
  assert.equal(hidden.notes, pet.notes);
  assert.equal(hidden.contact, undefined);
  assert.equal(hidden.location, undefined);
  assert.equal(hidden.health, undefined);
  assert.equal(hidden.healthEnabled, undefined);
  const published = publicProjection({
    ...pet,
    visibility: { basics: false, location: false, contact: true, health: true },
  });
  assert.equal(published.name, undefined);
  assert.equal(published.birthDate, undefined);
  assert.deepEqual(published.contact, { guardian: "Ana", phone: "3001234567" });
  assert.deepEqual(published.health, { allergies: "Polen" });
  assert.equal(published.healthEnabled, true);
});

test("las coordenadas sólo se proyectan con autorización de ubicación", () => {
  assert.equal(publicProjection(pet).location, undefined);
  assert.deepEqual(
    publicProjection({ ...pet, visibility: { basics: false, location: true } })
      .location,
    pet.location,
  );
});

test("la foto y su presentación sólo se publican con la identidad básica", () => {
  const withPhoto: PetProfile = {
    ...pet,
    photoUrl: "https://example.test/pet.png",
    photoPresentation: "zoom",
  };
  assert.equal(publicProjection(withPhoto).photoPresentation, "zoom");
  assert.equal(
    publicProjection({ ...withPhoto, photoPresentation: "normal" })
      .photoPresentation,
    "normal",
  );
  const hidden = publicProjection({
    ...withPhoto,
    visibility: { basics: false, location: false },
  });
  assert.equal(hidden.photoUrl, undefined);
  assert.equal(hidden.photoPresentation, undefined);
  const revoked = publicProjection({
    ...pet,
    visibility: {
      basics: true,
      location: false,
      contact: false,
      health: false,
    },
  });
  assert.equal(revoked.contact, undefined);
  assert.equal(revoked.health, undefined);
  assert.equal(revoked.healthEnabled, undefined);
});

test("fechas calendario y edad respetan años bisiestos y cumpleaños", () => {
  assert.equal(validCalendarDate("2024-02-29"), true);
  for (const date of [
    "2025-02-29",
    "2024-02-30",
    "2024-13-01",
    "2024-1-01",
    "2024-00-01",
  ])
    assert.equal(validCalendarDate(date), false);
  assert.throws(() => validateBirthDate("2026-05-15", today), /futuro/);
  assert.equal(petAge("2025-05-15", today), "11 meses");
  assert.equal(petAge("2025-05-14", today), "1 año");
  assert.equal(petAge("2020-02-29", today), "6 años");
});

test("vacunas y consultas no aceptan fechas futuras; medicamentos sí", () => {
  const record = { title: "Control", date: "2026-05-15", isPublic: false };
  assert.throws(() => validateCareRecord("vaccines", record, today), /futura/);
  assert.throws(
    () => validateCareRecord("vet-visits", record, today),
    /futura/,
  );
  assert.doesNotThrow(() => validateCareRecord("medications", record, today));
  assert.throws(
    () =>
      validateCareRecord("vaccines", { ...record, date: "2026-02-30" }, today),
    /fecha/,
  );
  assert.throws(
    () =>
      validateCareRecord(
        "vaccines",
        { ...record, date: "2026-05-14", notes: "x".repeat(1001) },
        today,
      ),
    /1000/,
  );
});
