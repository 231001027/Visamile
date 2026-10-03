/** ISO-3166 alpha-3 → alpha-2 for flags / media keys */
export const ISO3_TO_ISO2: Record<string, string> = {
  ARE: "ae",
  OMN: "om",
  SAU: "sa",
  RUS: "ru",
  SGP: "sg",
  VNM: "vn",
  KHM: "kh",
  IDN: "id",
  UZB: "uz",
  ARM: "am",
  GEO: "ge",
  TJK: "tj",
  QAT: "qa",
  BHR: "bh",
  THA: "th",
  AUS: "au",
  USA: "us",
  GBR: "gb",
  FRA: "fr",
  AUT: "at",
  IND: "in",
};

export type CountryVisual = {
  gradient: string;
  accent: string;
  /** Local destination atmosphere photo under /public/images/destinations */
  image: string;
};

function destImage(iso2: string): string {
  return `/images/destinations/${iso2}.jpg`;
}

/** Per-country hero / card atmosphere — unique colour + local landmark photo */
export const COUNTRY_VISUALS: Record<string, Omit<CountryVisual, "image">> = {
  ARE: {
    gradient: "linear-gradient(135deg, #0a1628 0%, #1a3a5c 45%, #c4a35a 100%)",
    accent: "#c4a35a",
  },
  OMN: {
    gradient: "linear-gradient(135deg, #1c1410 0%, #8b4513 50%, #d4a574 100%)",
    accent: "#d4a574",
  },
  SAU: {
    gradient: "linear-gradient(135deg, #0d2818 0%, #1a5c3a 50%, #2d8a5e 100%)",
    accent: "#2d8a5e",
  },
  RUS: {
    gradient: "linear-gradient(135deg, #1a1a2e 0%, #3d5a80 50%, #98c1d9 100%)",
    accent: "#98c1d9",
  },
  SGP: {
    gradient: "linear-gradient(135deg, #0a1628 0%, #1b4965 45%, #e63946 100%)",
    accent: "#e63946",
  },
  VNM: {
    gradient: "linear-gradient(135deg, #1a2f1a 0%, #2d6a4f 45%, #95d5b2 100%)",
    accent: "#95d5b2",
  },
  KHM: {
    gradient: "linear-gradient(135deg, #2b1d0e 0%, #8b5e34 50%, #e9c46a 100%)",
    accent: "#e9c46a",
  },
  IDN: {
    gradient: "linear-gradient(135deg, #0d1b2a 0%, #1b4332 45%, #52b788 100%)",
    accent: "#52b788",
  },
  UZB: {
    gradient: "linear-gradient(135deg, #1a0a2e 0%, #5e2bff 40%, #ff6b35 100%)",
    accent: "#ff6b35",
  },
  ARM: {
    gradient: "linear-gradient(135deg, #1a0a0a 0%, #9b2226 50%, #ee9b00 100%)",
    accent: "#ee9b00",
  },
  GEO: {
    gradient: "linear-gradient(135deg, #0d1b2a 0%, #1d3557 45%, #e63946 100%)",
    accent: "#e63946",
  },
  TJK: {
    gradient: "linear-gradient(135deg, #1b263b 0%, #415a77 50%, #778da9 100%)",
    accent: "#778da9",
  },
  QAT: {
    gradient: "linear-gradient(135deg, #1a0a14 0%, #6b2737 45%, #d4a373 100%)",
    accent: "#d4a373",
  },
  BHR: {
    gradient: "linear-gradient(135deg, #1a0a0a 0%, #9d0208 50%, #f48c06 100%)",
    accent: "#f48c06",
  },
  THA: {
    gradient: "linear-gradient(135deg, #1a0a2e 0%, #5a189a 40%, #ff9e00 100%)",
    accent: "#ff9e00",
  },
  AUS: {
    gradient: "linear-gradient(135deg, #0a1628 0%, #0077b6 45%, #ffb703 100%)",
    accent: "#ffb703",
  },
  USA: {
    gradient: "linear-gradient(135deg, #0d1b2a 0%, #1d3557 50%, #e63946 100%)",
    accent: "#e63946",
  },
  GBR: {
    gradient: "linear-gradient(135deg, #0a0a12 0%, #1d3557 45%, #c1121f 100%)",
    accent: "#c1121f",
  },
  FRA: {
    gradient: "linear-gradient(135deg, #0a1628 0%, #1d3557 40%, #457b9d 100%)",
    accent: "#457b9d",
  },
  AUT: {
    gradient: "linear-gradient(135deg, #1a1a2e 0%, #4a4e69 50%, #9a8c98 100%)",
    accent: "#9a8c98",
  },
};

export const DEFAULT_VISUAL: CountryVisual = {
  gradient: "linear-gradient(135deg, #0f4c42 0%, #0c3e36 50%, #c98f24 100%)",
  accent: "#c98f24",
  image: destImage("default"),
};

export function visualForIso(iso3: string): CountryVisual {
  const base = COUNTRY_VISUALS[iso3];
  const iso2 = ISO3_TO_ISO2[iso3] ?? "default";
  if (!base) {
    return { ...DEFAULT_VISUAL, image: destImage(iso2 === "in" ? "default" : iso2) };
  }
  return {
    ...base,
    image: destImage(iso2),
  };
}

export type CountryPlace = {
  label: string;
  image: string;
};

/** Popular tourist places per destination — hero rotates these when that country is selected */
const COUNTRY_PLACES: Record<string, { label: string; file: string }[]> = {
  AUS: [
    { label: "Sydney Opera House", file: "au-1.jpg" },
    { label: "Great Barrier Reef", file: "au-2.jpg" },
    { label: "Uluru & Outback", file: "au-3.jpg" },
  ],
  ARE: [
    { label: "Dubai skyline", file: "ae-1.jpg" },
    { label: "Burj Khalifa views", file: "ae-2.jpg" },
    { label: "Desert safari dunes", file: "ae-3.jpg" },
  ],
  THA: [
    { label: "Bangkok temples", file: "th-1.jpg" },
    { label: "Phi Phi islands", file: "th-2.jpg" },
    { label: "Chiang Mai heritage", file: "th-3.jpg" },
  ],
  SGP: [
    { label: "Marina Bay Sands", file: "sg-1.jpg" },
    { label: "Gardens by the Bay", file: "sg-2.jpg" },
    { label: "Singapore city lights", file: "sg-3.jpg" },
  ],
  VNM: [
    { label: "Ha Long Bay", file: "vn-1.jpg" },
    { label: "Hoi An lanterns", file: "vn-2.jpg" },
    { label: "Hanoi Old Quarter", file: "vn-3.jpg" },
  ],
  SAU: [
    { label: "Riyadh landmarks", file: "sa-1.jpg" },
    { label: "Red Sea coast", file: "sa-2.jpg" },
    { label: "Desert heritage", file: "sa-3.jpg" },
  ],
  IDN: [
    { label: "Bali temples", file: "id-1.jpg" },
    { label: "Ubud rice terraces", file: "id-2.jpg" },
    { label: "Island beaches", file: "id-3.jpg" },
  ],
  GBR: [
    { label: "London & Big Ben", file: "gb-1.jpg" },
    { label: "Tower Bridge", file: "gb-2.jpg" },
    { label: "British landmarks", file: "gb-3.jpg" },
  ],
  USA: [
    { label: "New York City", file: "us-1.jpg" },
    { label: "Golden Gate Bridge", file: "us-2.jpg" },
    { label: "City skyline", file: "us-3.jpg" },
  ],
  FRA: [
    { label: "Eiffel Tower, Paris", file: "fr-1.jpg" },
    { label: "Paris streets", file: "fr-2.jpg" },
    { label: "French landmarks", file: "fr-3.jpg" },
  ],
  OMN: [
    { label: "Muscat coast", file: "om-1.jpg" },
    { label: "Omani forts", file: "om-2.jpg" },
    { label: "Mountain wadis", file: "om-3.jpg" },
  ],
  QAT: [
    { label: "Doha skyline", file: "qa-1.jpg" },
    { label: "Museum of Islamic Art", file: "qa-2.jpg" },
    { label: "Corniche nights", file: "qa-3.jpg" },
  ],
  BHR: [
    { label: "Manama skyline", file: "bh-1.jpg" },
    { label: "Bahrain forts", file: "bh-2.jpg" },
    { label: "Gulf waterfront", file: "bh-3.jpg" },
  ],
  KHM: [
    { label: "Angkor Wat", file: "kh-1.jpg" },
    { label: "Siem Reap temples", file: "kh-2.jpg" },
    { label: "Cambodian heritage", file: "kh-3.jpg" },
  ],
  GEO: [
    { label: "Tbilisi old town", file: "ge-1.jpg" },
    { label: "Caucasus mountains", file: "ge-2.jpg" },
    { label: "Georgian landscapes", file: "ge-3.jpg" },
  ],
  RUS: [
    { label: "Moscow Red Square", file: "ru-1.jpg" },
    { label: "Saint Petersburg", file: "ru-2.jpg" },
    { label: "Russian landmarks", file: "ru-3.jpg" },
  ],
  AUT: [
    { label: "Vienna palace", file: "at-1.jpg" },
    { label: "Alpine lakes", file: "at-2.jpg" },
    { label: "Austrian towns", file: "at-3.jpg" },
  ],
  ARM: [
    { label: "Yerevan views", file: "am-1.jpg" },
    { label: "Armenian monasteries", file: "am-2.jpg" },
    { label: "Highland landscapes", file: "am-3.jpg" },
  ],
  UZB: [
    { label: "Samarkand Registan", file: "uz-1.jpg" },
    { label: "Silk Road cities", file: "uz-2.jpg" },
    { label: "Uzbek architecture", file: "uz-3.jpg" },
  ],
  TJK: [
    { label: "Pamir Highway", file: "tj-1.jpg" },
    { label: "Mountain lakes", file: "tj-2.jpg" },
    { label: "Tajik landscapes", file: "tj-3.jpg" },
  ],
};

/** Tourist-place slides for a destination (falls back to the country hero still). */
export function placesForIso(iso3: string): CountryPlace[] {
  const places = COUNTRY_PLACES[iso3];
  const v = visualForIso(iso3);
  if (!places?.length) {
    return [{ label: "Popular destinations", image: v.image }];
  }
  return places.map((p) => ({
    label: p.label,
    image: `/images/destinations/${p.file}`,
  }));
}

export function flagUrl(iso3: string, width = 80): string {
  const iso2 = ISO3_TO_ISO2[iso3] ?? iso3.slice(0, 2).toLowerCase();
  return `https://flagcdn.com/w${width}/${iso2}.png`;
}

export function formatValidity(days: number): string {
  if (days >= 365) {
    const y = Math.round(days / 365);
    return y === 1 ? "1 YEAR" : `${y} YEARS`;
  }
  if (days >= 30 && days % 30 === 0) {
    const m = days / 30;
    return m === 1 ? "30 DAYS" : `${days} DAYS`;
  }
  return `${days} DAYS`;
}

export function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function expectedByDate(processingDays: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + Math.max(1, processingDays));
  return d;
}

export function formatExpected(d: Date): string {
  return d.toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export type MarketingPackage = {
  countryId: string;
  countryName: string;
  isoCode: string;
  visaTypeId: string;
  visaName: string;
  visaCategory: string;
  validityDays: number;
  processingDays: number;
  feeInr: number;
};

export type MarketingCountry = {
  id: string;
  name: string;
  isoCode: string;
  packages: MarketingPackage[];
};

/** Offline / empty-DB fallback so the landing still shows the B2B catalog */
export const FALLBACK_CATALOG: MarketingCountry[] = [
  {
    id: "fb-are",
    name: "United Arab Emirates",
    isoCode: "ARE",
    packages: [
      {
        countryId: "fb-are",
        countryName: "United Arab Emirates",
        isoCode: "ARE",
        visaTypeId: "fb-uae",
        visaName: "eVisa — Tourist",
        visaCategory: "E_VISA",
        validityDays: 30,
        processingDays: 3,
        feeInr: 8000,
      },
    ],
  },
  {
    id: "fb-omn",
    name: "Oman",
    isoCode: "OMN",
    packages: [
      {
        countryId: "fb-omn",
        countryName: "Oman",
        isoCode: "OMN",
        visaTypeId: "fb-omn",
        visaName: "eVisa",
        visaCategory: "E_VISA",
        validityDays: 30,
        processingDays: 5,
        feeInr: 2600,
      },
    ],
  },
  {
    id: "fb-sau",
    name: "Saudi Arabia",
    isoCode: "SAU",
    packages: [
      {
        countryId: "fb-sau",
        countryName: "Saudi Arabia",
        isoCode: "SAU",
        visaTypeId: "fb-sau",
        visaName: "eVisa",
        visaCategory: "E_VISA",
        validityDays: 365,
        processingDays: 5,
        feeInr: 13000,
      },
    ],
  },
  {
    id: "fb-sgp",
    name: "Singapore",
    isoCode: "SGP",
    packages: [
      {
        countryId: "fb-sgp",
        countryName: "Singapore",
        isoCode: "SGP",
        visaTypeId: "fb-sgp",
        visaName: "eVisa (+ courier)",
        visaCategory: "E_VISA",
        validityDays: 90,
        processingDays: 5,
        feeInr: 5000,
      },
    ],
  },
  {
    id: "fb-vnm",
    name: "Vietnam",
    isoCode: "VNM",
    packages: [
      {
        countryId: "fb-vnm",
        countryName: "Vietnam",
        isoCode: "VNM",
        visaTypeId: "fb-vnm",
        visaName: "eVisa",
        visaCategory: "E_VISA",
        validityDays: 90,
        processingDays: 5,
        feeInr: 4000,
      },
    ],
  },
  {
    id: "fb-tha",
    name: "Thailand",
    isoCode: "THA",
    packages: [
      {
        countryId: "fb-tha",
        countryName: "Thailand",
        isoCode: "THA",
        visaTypeId: "fb-tha",
        visaName: "Tourist eVisa",
        visaCategory: "E_VISA",
        validityDays: 60,
        processingDays: 5,
        feeInr: 3500,
      },
    ],
  },
  {
    id: "fb-idn",
    name: "Indonesia",
    isoCode: "IDN",
    packages: [
      {
        countryId: "fb-idn",
        countryName: "Indonesia",
        isoCode: "IDN",
        visaTypeId: "fb-idn",
        visaName: "eVisa",
        visaCategory: "E_VISA",
        validityDays: 90,
        processingDays: 5,
        feeInr: 4000,
      },
    ],
  },
  {
    id: "fb-khm",
    name: "Cambodia",
    isoCode: "KHM",
    packages: [
      {
        countryId: "fb-khm",
        countryName: "Cambodia",
        isoCode: "KHM",
        visaTypeId: "fb-khm",
        visaName: "eVisa",
        visaCategory: "E_VISA",
        validityDays: 90,
        processingDays: 5,
        feeInr: 4000,
      },
    ],
  },
  {
    id: "fb-qat",
    name: "Qatar",
    isoCode: "QAT",
    packages: [
      {
        countryId: "fb-qat",
        countryName: "Qatar",
        isoCode: "QAT",
        visaTypeId: "fb-qat",
        visaName: "eVisa",
        visaCategory: "E_VISA",
        validityDays: 30,
        processingDays: 3,
        feeInr: 3200,
      },
    ],
  },
  {
    id: "fb-bhr",
    name: "Bahrain",
    isoCode: "BHR",
    packages: [
      {
        countryId: "fb-bhr",
        countryName: "Bahrain",
        isoCode: "BHR",
        visaTypeId: "fb-bhr",
        visaName: "eVisa — Single entry (14 days)",
        visaCategory: "E_VISA",
        validityDays: 14,
        processingDays: 3,
        feeInr: 3900,
      },
    ],
  },
  {
    id: "fb-geo",
    name: "Georgia",
    isoCode: "GEO",
    packages: [
      {
        countryId: "fb-geo",
        countryName: "Georgia",
        isoCode: "GEO",
        visaTypeId: "fb-geo",
        visaName: "eVisa",
        visaCategory: "E_VISA",
        validityDays: 90,
        processingDays: 5,
        feeInr: 8000,
      },
    ],
  },
  {
    id: "fb-rus",
    name: "Russia",
    isoCode: "RUS",
    packages: [
      {
        countryId: "fb-rus",
        countryName: "Russia",
        isoCode: "RUS",
        visaTypeId: "fb-rus",
        visaName: "eVisa",
        visaCategory: "E_VISA",
        validityDays: 60,
        processingDays: 7,
        feeInr: 6800,
      },
    ],
  },
];
