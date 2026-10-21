import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";
import { db, storage } from "./firebase";
import {
  type CareKind,
  type CareRecord,
  validateBirthDate,
  validateCareRecord,
} from "./pet-details";
export type { CareKind, CareRecord } from "./pet-details";

export type UserProfile = { uid: string; email: string; role: string };
export type Account = {
  id: string;
  adminUid: string;
  adminEmail: string;
  petLimit: number;
  status: "active";
};
export type Location = { label: string; latitude: number; longitude: number };
export type PetProfile = {
  id: string;
  accountId: string;
  slotId: string;
  publicId: string;
  name: string;
  species: string;
  breed: string;
  photoUrl?: string;
  photoPath?: string;
  photoPresentation?: "normal" | "zoom";
  location?: Location;
  birthDate?: string;
  sex?: "Macho" | "Hembra" | "No especificado";
  weightKg?: number;
  notes?: string;
  guardian?: string;
  phone?: string;
  allergies?: string;
  conditions?: string;
  visibility: {
    basics: boolean;
    location: boolean;
    contact?: boolean;
    health?: boolean;
  };
};
export type PetSummary = Pick<
  PetProfile,
  "id" | "name" | "species" | "breed" | "accountId" | "photoUrl"
>;

function database() {
  if (!db) throw new Error("Firebase no está configurado.");
  return db;
}
function storageInstance() {
  if (!storage) throw new Error("Firebase Storage no está configurado.");
  return storage;
}
function validLocation(location?: Location) {
  return (
    !location ||
    (Number.isFinite(location.latitude) &&
      Number.isFinite(location.longitude) &&
      Math.abs(location.latitude) <= 90 &&
      Math.abs(location.longitude) <= 180)
  );
}
function optionalText(value?: string) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
function validatePetDetails(pet: PetProfile) {
  validateBirthDate(pet.birthDate);
  if (
    pet.photoPresentation &&
    !["normal", "zoom"].includes(pet.photoPresentation)
  )
    throw new Error("La presentación de la foto no es válida.");
  if (pet.sex && !["Macho", "Hembra", "No especificado"].includes(pet.sex))
    throw new Error("El sexo no es válido.");
  if (
    pet.weightKg !== undefined &&
    (!Number.isFinite(pet.weightKg) || pet.weightKg <= 0 || pet.weightKg > 500)
  )
    throw new Error("El peso debe estar entre 0 y 500 kg.");
  for (const [label, value, max] of [
    ["Las notas", pet.notes, 1000],
    ["El responsable", pet.guardian, 120],
    ["El teléfono", pet.phone, 40],
    ["Las alergias", pet.allergies, 1000],
    ["Las condiciones", pet.conditions, 1000],
  ] as const) {
    if (
      value !== undefined &&
      (typeof value !== "string" || value.length > max)
    )
      throw new Error(`${label} admiten hasta ${max} caracteres.`);
  }
  if (
    !pet.visibility ||
    typeof pet.visibility.basics !== "boolean" ||
    typeof pet.visibility.location !== "boolean" ||
    (pet.visibility.contact !== undefined &&
      typeof pet.visibility.contact !== "boolean") ||
    (pet.visibility.health !== undefined &&
      typeof pet.visibility.health !== "boolean")
  )
    throw new Error("La configuración de privacidad no es válida.");
}
export function publicProjection(pet: PetProfile) {
  const profile: Record<string, unknown> = {
    petId: pet.id,
    accountId: pet.accountId,
    updatedAt: serverTimestamp(),
  };
  if (pet.visibility.basics) {
    profile.name = pet.name;
    profile.species = pet.species;
    profile.breed = pet.breed;
    for (const field of ["birthDate", "sex", "notes"] as const) {
      const value = optionalText(pet[field]);
      if (value) profile[field] = value;
    }
    if (pet.weightKg !== undefined) profile.weightKg = pet.weightKg;
  }
  if (pet.visibility.contact) {
    const guardian = optionalText(pet.guardian);
    const phone = optionalText(pet.phone);
    if (guardian || phone)
      profile.contact = {
        ...(guardian ? { guardian } : {}),
        ...(phone ? { phone } : {}),
      };
  }
  if (pet.visibility.health) {
    profile.healthEnabled = true;
    const allergies = optionalText(pet.allergies);
    const conditions = optionalText(pet.conditions);
    if (allergies || conditions)
      profile.health = {
        ...(allergies ? { allergies } : {}),
        ...(conditions ? { conditions } : {}),
      };
  }
  if (pet.visibility.basics && pet.photoUrl) {
    profile.photoUrl = pet.photoUrl;
    if (pet.photoPresentation)
      profile.photoPresentation = pet.photoPresentation;
  }
  if (pet.visibility.location && pet.location) profile.location = pet.location;
  return profile;
}

export async function accountForUser(uid: string): Promise<Account | null> {
  const snapshot = await getDocs(
    query(
      collection(database(), "accounts"),
      where("adminUid", "==", uid),
      limit(1),
    ),
  );
  const item = snapshot.docs[0];
  return item ? { id: item.id, ...(item.data() as Omit<Account, "id">) } : null;
}

export async function petsForAccount(accountId: string): Promise<PetSummary[]> {
  const snapshot = await getDocs(
    query(collection(database(), "pets"), where("accountId", "==", accountId)),
  );
  return snapshot.docs.map((item) => ({
    id: item.id,
    ...(item.data() as Omit<PetSummary, "id">),
  }));
}

export async function petById(petId: string): Promise<PetProfile | null> {
  const snapshot = await getDoc(doc(database(), "pets", petId));
  if (!snapshot.exists()) return null;
  const data = snapshot.data() as Omit<PetProfile, "id">;
  return {
    ...data,
    id: snapshot.id,
    photoPresentation: data.photoPresentation === "zoom" ? "zoom" : "normal",
    visibility: {
      basics: data.visibility?.basics === true,
      location: data.visibility?.location === true,
      contact: data.visibility?.contact === true,
      health: data.visibility?.health === true,
    },
  };
}

export async function availableSlots(accountId: string): Promise<number> {
  const snapshot = await getDocs(
    query(
      collection(database(), "accounts", accountId, "slots"),
      where("status", "==", "available"),
    ),
  );
  return snapshot.size;
}

export async function usersAndAccounts(): Promise<
  Array<{ user: UserProfile; account: Account | null; pets: number }>
> {
  const [users, accounts, pets] = await Promise.all([
    getDocs(collection(database(), "users")),
    getDocs(collection(database(), "accounts")),
    getDocs(collection(database(), "pets")),
  ]);
  const byUser = new Map(
    accounts.docs.map((item) => [
      item.data().adminUid as string,
      { id: item.id, ...(item.data() as Omit<Account, "id">) },
    ]),
  );
  const petsByAccount = new Map<string, number>();
  pets.forEach((item) =>
    petsByAccount.set(
      item.data().accountId as string,
      (petsByAccount.get(item.data().accountId as string) ?? 0) + 1,
    ),
  );
  return users.docs.map((item) => {
    const user = item.data() as UserProfile;
    const account = byUser.get(user.uid) ?? null;
    return {
      user,
      account,
      pets: account ? (petsByAccount.get(account.id) ?? 0) : 0,
    };
  });
}

export async function setPetLimit(
  user: UserProfile,
  petLimit: number,
): Promise<void> {
  const databaseInstance = database();
  const accountRef = doc(databaseInstance, "accounts", user.uid);
  const existing = await getDoc(accountRef);
  const slots = existing.exists()
    ? await getDocs(collection(databaseInstance, "accounts", user.uid, "slots"))
    : null;
  const totalSlots = slots?.size ?? 0;
  if (!Number.isInteger(petLimit) || petLimit < totalSlots)
    throw new Error("El cupo no puede ser menor que los cupos ya asignados.");
  const batch = writeBatch(databaseInstance);
  batch.set(
    accountRef,
    {
      adminUid: user.uid,
      adminEmail: user.email,
      petLimit,
      status: "active",
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  batch.set(
    doc(databaseInstance, "users", user.uid),
    {
      role: user.role === "superadmin" ? "superadmin" : "admin",
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  for (let index = totalSlots; index < petLimit; index += 1)
    batch.set(
      doc(collection(databaseInstance, "accounts", user.uid, "slots")),
      { status: "available", createdAt: serverTimestamp() },
    );
  await batch.commit();
}

export async function createPet(input: {
  accountId: string;
  name: string;
  species: string;
  breed: string;
}): Promise<void> {
  const databaseInstance = database();
  const slots = await getDocs(
    query(
      collection(databaseInstance, "accounts", input.accountId, "slots"),
      where("status", "==", "available"),
      limit(1),
    ),
  );
  const slot = slots.docs[0];
  if (!slot)
    throw new Error("No tienes cupos disponibles para crear otra mascota.");
  const publicId = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  const pet: PetProfile = {
    id: slot.id,
    accountId: input.accountId,
    slotId: slot.id,
    publicId,
    name: input.name,
    species: input.species,
    breed: input.breed,
    visibility: { basics: true, location: false },
  };
  const batch = writeBatch(databaseInstance);
  batch.set(doc(databaseInstance, "pets", slot.id), {
    ...pet,
    createdAt: serverTimestamp(),
  });
  batch.set(
    doc(databaseInstance, "publicProfiles", publicId),
    publicProjection(pet),
  );
  batch.update(slot.ref, {
    status: "claimed",
    petId: slot.id,
    claimedAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function uploadPetPhoto(
  petId: string,
  file: File,
): Promise<{ photoPath: string; photoUrl: string }> {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 5 * 1024 * 1024
  )
    throw new Error("Usa una imagen JPG, PNG o WebP de hasta 5 MB.");
  const photoPath = `pets/${petId}/profile/${crypto.randomUUID()}`;
  const storageRef = ref(storageInstance(), photoPath);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return { photoPath, photoUrl: await getDownloadURL(storageRef) };
}

export async function savePetProfile(pet: PetProfile): Promise<void> {
  if (!validLocation(pet.location))
    throw new Error("La ubicación no es válida.");
  validatePetDetails(pet);
  if (!pet.publicId)
    throw new Error("La mascota no tiene identificador público persistido.");
  const batch = writeBatch(database());
  batch.update(doc(database(), "pets", pet.id), {
    name: pet.name,
    species: pet.species,
    breed: pet.breed,
    photoUrl: pet.photoUrl ?? null,
    photoPath: pet.photoPath ?? null,
    photoPresentation: pet.photoPresentation ?? "normal",
    location: pet.location ?? null,
    birthDate: optionalText(pet.birthDate) ?? null,
    sex: optionalText(pet.sex) ?? null,
    weightKg: pet.weightKg ?? null,
    notes: optionalText(pet.notes) ?? null,
    guardian: optionalText(pet.guardian) ?? null,
    phone: optionalText(pet.phone) ?? null,
    allergies: optionalText(pet.allergies) ?? null,
    conditions: optionalText(pet.conditions) ?? null,
    visibility: {
      basics: pet.visibility.basics,
      location: pet.visibility.location,
      contact: pet.visibility.contact === true,
      health: pet.visibility.health === true,
    },
    updatedAt: serverTimestamp(),
  });
  batch.set(
    doc(database(), "publicProfiles", pet.publicId),
    publicProjection(pet),
  );
  await batch.commit();
}

const careKinds: CareKind[] = ["vaccines", "medications", "vet-visits"];

export async function careRecordsForPet(
  petId: string,
): Promise<Record<CareKind, CareRecord[]>> {
  const entries = await Promise.all(
    careKinds.map(async (kind) => {
      const snapshot = await getDocs(
        collection(database(), "pets", petId, kind),
      );
      return [
        kind,
        snapshot.docs.map((item) => ({
          id: item.id,
          title: item.data().title as string,
          date: item.data().date as string,
          ...(item.data().nextDate
            ? { nextDate: item.data().nextDate as string }
            : {}),
          ...(item.data().professional
            ? { professional: item.data().professional as string }
            : {}),
          ...(item.data().notes ? { notes: item.data().notes as string } : {}),
          isPublic: item.data().isPublic === true,
        })),
      ] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<CareKind, CareRecord[]>;
}

function careProjection(record: Omit<CareRecord, "id">) {
  return {
    title: record.title.trim(),
    date: record.date,
    ...(optionalText(record.nextDate) ? { nextDate: record.nextDate } : {}),
    ...(optionalText(record.professional)
      ? { professional: record.professional!.trim() }
      : {}),
    ...(optionalText(record.notes) ? { notes: record.notes!.trim() } : {}),
  };
}

async function currentPet(pet: PetProfile): Promise<PetProfile> {
  const latest = await petById(pet.id);
  if (
    !latest ||
    !latest.publicId ||
    latest.publicId !== pet.publicId ||
    latest.accountId !== pet.accountId
  )
    throw new Error("La identidad de la mascota cambió. Recarga la página.");
  return latest;
}

export async function saveCareRecord(
  pet: PetProfile,
  kind: CareKind,
  record: Omit<CareRecord, "id"> & { id?: string },
): Promise<void> {
  validateCareRecord(kind, record);
  const latest = await currentPet(pet);
  const databaseInstance = database();
  const privateRef = record.id
    ? doc(databaseInstance, "pets", pet.id, kind, record.id)
    : doc(collection(databaseInstance, "pets", pet.id, kind));
  const publicRef = doc(
    databaseInstance,
    "publicProfiles",
    latest.publicId,
    kind,
    privateRef.id,
  );
  const shouldPublish = record.isPublic === true;
  const existingPublic = shouldPublish ? null : await getDoc(publicRef);
  const projection = careProjection(record);
  const batch = writeBatch(databaseInstance);
  batch.set(privateRef, {
    ...projection,
    isPublic: record.isPublic === true,
    updatedAt: serverTimestamp(),
  });
  if (shouldPublish) batch.set(publicRef, projection);
  else if (existingPublic?.exists()) batch.delete(publicRef);
  await batch.commit();
}

export async function deleteCareRecord(
  pet: PetProfile,
  kind: CareKind,
  recordId: string,
): Promise<void> {
  if (!careKinds.includes(kind) || !recordId || recordId.includes("/"))
    throw new Error("El registro no es válido.");
  const latest = await currentPet(pet);
  const databaseInstance = database();
  const privateRef = doc(databaseInstance, "pets", pet.id, kind, recordId);
  const publicRef = doc(
    databaseInstance,
    "publicProfiles",
    latest.publicId,
    kind,
    recordId,
  );
  const publicSnapshot = await getDoc(publicRef);
  const batch = writeBatch(databaseInstance);
  batch.delete(privateRef);
  if (publicSnapshot.exists()) batch.delete(publicRef);
  await batch.commit();
}

export async function removePetPhoto(pet: PetProfile): Promise<void> {
  await savePetProfile({ ...pet, photoPath: undefined, photoUrl: undefined });
  if (pet.photoPath) await deleteObject(ref(storageInstance(), pet.photoPath));
}
