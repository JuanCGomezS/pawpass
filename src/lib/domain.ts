export type Visibility = { basics: boolean; contact: boolean; health: boolean };
export type Pet = {
  id: string;
  publicId: string;
  name: string;
  species: string;
  breed: string;
  sex: string;
  birthDate: string;
  color: string;
  size: string;
  city: string;
  country: string;
  guardian: string;
  whatsapp: string;
  notes: string;
  visibility: Visibility;
  vaccines: string[];
  allergies: string[];
};

export const demoPet: Pet = {
  id: "luna",
  publicId: "luna-7k2",
  name: "Luna",
  species: "Perra",
  breed: "Mestiza",
  sex: "Hembra",
  birthDate: "2021-05-14",
  color: "Canela con blanco",
  size: "18 kg",
  city: "Medellín",
  country: "Colombia",
  guardian: "Valentina Restrepo",
  whatsapp: "+57 300 555 0198",
  notes: "Es amigable, pero puede asustarse con los ruidos fuertes.",
  visibility: { basics: true, contact: true, health: false },
  vaccines: ["Antirrábica · vigente hasta ago. 2026"],
  allergies: ["Ninguna registrada"],
};

export const age = (birthDate: string) => {
  const months = Math.max(
    0,
    (new Date().getFullYear() - new Date(birthDate).getFullYear()) * 12 +
      new Date().getMonth() -
      new Date(birthDate).getMonth(),
  );
  return months < 24 ? `${months} meses` : `${Math.floor(months / 12)} años`;
};

export const publicUrl = (publicId: string) =>
  `${import.meta.env.BASE_URL}p/?id=${encodeURIComponent(publicId)}`;
