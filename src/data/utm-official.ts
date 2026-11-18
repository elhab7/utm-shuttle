import { metres } from "@/lib/shuttle";

export type OfficialPoiSeed = {
  label: string;
  lat: number;
  lng: number;
  cat:
    | "faculty"
    | "study"
    | "residence"
    | "food"
    | "worship"
    | "sport"
    | "health"
    | "bank"
    | "shop"
    | "place";
  officialUrl: string;
  subtitle?: string;
};

export const UTM_CURATED_POIS: OfficialPoiSeed[] = [
  {
    label: "Faculty of Computing (FC) · N28 / N28A",
    lat: 1.5642,
    lng: 103.638,
    cat: "faculty",
    officialUrl: "https://comp.utm.my",
    subtitle: "Computing, Software Engineering & AI",
  },
  {
    label: "Faculty of Electrical Engineering (FKE) · P19a",
    lat: 1.5584,
    lng: 103.6412,
    cat: "faculty",
    officialUrl: "https://fke.utm.my",
    subtitle: "Electrical, Electronics & Mechatronics",
  },
  {
    label: "Faculty of Mechanical Engineering (FKM) · C22",
    lat: 1.5607,
    lng: 103.6407,
    cat: "faculty",
    officialUrl: "https://fkm.utm.my",
    subtitle: "Mechanical, Automotive & Aerospace",
  },
  {
    label: "Faculty of Civil Engineering (FKA) · D09 / M46",
    lat: 1.5612,
    lng: 103.6386,
    cat: "faculty",
    officialUrl: "https://civil.utm.my",
    subtitle: "Civil, Structural & Environmental Engineering",
  },
  {
    label: "Faculty of Chemical & Energy Engineering (FKT) · N29",
    lat: 1.5666,
    lng: 103.6407,
    cat: "faculty",
    officialUrl: "https://fkt.utm.my",
    subtitle: "Chemical, Petroleum & Bioprocess Engineering",
  },
  {
    label: "Faculty of Science (FS) · T05 / C17",
    lat: 1.5628,
    lng: 103.6525,
    cat: "faculty",
    officialUrl: "https://science.utm.my",
    subtitle: "Physics, Chemistry, Mathematics & Biosciences",
  },
  {
    label: "Faculty of Built Environment & Surveying (FABU) · B12",
    lat: 1.5589,
    lng: 103.6356,
    cat: "faculty",
    officialUrl: "https://fabu.utm.my",
    subtitle: "Architecture, Urban Planning & Geoinformatics",
  },
  {
    label: "Faculty of Management (FM) · T08",
    lat: 1.5596,
    lng: 103.6558,
    cat: "faculty",
    officialUrl: "https://management.utm.my",
    subtitle: "Management, Marketing & Technology",
  },
  {
    label: "Azman Hashim International Business School (AHIBS) · T08",
    lat: 1.5599,
    lng: 103.6562,
    cat: "faculty",
    officialUrl: "https://business.utm.my",
    subtitle: "Graduate Business & Accounting",
  },
  {
    label: "Faculty of Social Sciences & Humanities (FSSH) · T07",
    lat: 1.5602,
    lng: 103.6568,
    cat: "faculty",
    officialUrl: "https://humanities.utm.my",
    subtitle: "Education, Language & Islamic Civilization",
  },
  {
    label: "Perpustakaan Sultanah Zanariah (PSZ Main Library)",
    lat: 1.5595,
    lng: 103.637,
    cat: "study",
    officialUrl: "https://library.utm.my",
    subtitle: "Main University Library",
  },
  {
    label: "Perpustakaan Raja Zarith Sofiah (PRZS)",
    lat: 1.5635,
    lng: 103.6515,
    cat: "study",
    officialUrl: "https://library.utm.my",
    subtitle: "East Campus Research Library",
  },
  {
    label: "Bangunan Canseleri Sultan Ibrahim (Chancellery)",
    lat: 1.5586,
    lng: 103.6376,
    cat: "place",
    officialUrl: "https://www.utm.my",
    subtitle: "Administration & Governance",
  },
  {
    label: "Dewan Sultan Iskandar (DSI)",
    lat: 1.5592,
    lng: 103.6388,
    cat: "place",
    officialUrl: "https://www.utm.my",
    subtitle: "Convocation & Main Hall",
  },
  {
    label: "Masjid Sultan Ismail (MSI)",
    lat: 1.5592,
    lng: 103.6377,
    cat: "worship",
    officialUrl: "https://islamiccentre.utm.my",
    subtitle: "UTM Campus Mosque",
  },
  {
    label: "Pusat Kesihatan Universiti (PKU Health Centre)",
    lat: 1.5587,
    lng: 103.6277,
    cat: "health",
    officialUrl: "https://pku.utm.my",
    subtitle: "24/7 Campus Medical Clinic",
  },
  {
    label: "Azman Hashim Stadium & UTM Sports Complex",
    lat: 1.5561,
    lng: 103.6317,
    cat: "sport",
    officialUrl: "https://studentaffairs.utm.my",
    subtitle: "Stadium, Courts & Track",
  },
  {
    label: "Kolej Tun Dr. Ismail (KTDI)",
    lat: 1.5649,
    lng: 103.634,
    cat: "residence",
    officialUrl: "https://studentaffairs.utm.my",
    subtitle: "Residential College",
  },
  {
    label: "Kolej Tun Fatimah (KTF)",
    lat: 1.5588,
    lng: 103.6308,
    cat: "residence",
    officialUrl: "https://studentaffairs.utm.my",
    subtitle: "Residential College",
  },
  {
    label: "Kolej Rahman Putra (KRP)",
    lat: 1.5579,
    lng: 103.6295,
    cat: "residence",
    officialUrl: "https://studentaffairs.utm.my",
    subtitle: "Residential College",
  },
  {
    label: "Kolej Tun Hussein Onn (KTHO)",
    lat: 1.5639,
    lng: 103.6294,
    cat: "residence",
    officialUrl: "https://studentaffairs.utm.my",
    subtitle: "Residential College",
  },
  {
    label: "Kolej Tun Razak (KTR)",
    lat: 1.5618,
    lng: 103.6295,
    cat: "residence",
    officialUrl: "https://studentaffairs.utm.my",
    subtitle: "Residential College",
  },
  {
    label: "Kolej Tuanku Canselor (KTC)",
    lat: 1.5571,
    lng: 103.6446,
    cat: "residence",
    officialUrl: "https://studentaffairs.utm.my",
    subtitle: "Residential College",
  },
  {
    label: "Kolej Perdana (KP)",
    lat: 1.5587,
    lng: 103.6473,
    cat: "residence",
    officialUrl: "https://studentaffairs.utm.my",
    subtitle: "Residential College",
  },
  {
    label: "Kolej Datin Seri Endon (KDSE)",
    lat: 1.5673,
    lng: 103.6258,
    cat: "residence",
    officialUrl: "https://studentaffairs.utm.my",
    subtitle: "Residential College",
  },
  {
    label: "Kolej Dato' Onn Jaafar (KDOJ)",
    lat: 1.5758,
    lng: 103.6197,
    cat: "residence",
    officialUrl: "https://studentaffairs.utm.my",
    subtitle: "Residential College",
  },
  {
    label: "Kolej 9 & 10 (K9 / K10)",
    lat: 1.5604,
    lng: 103.6488,
    cat: "residence",
    officialUrl: "https://studentaffairs.utm.my",
    subtitle: "Residential College",
  },
];

const KEYWORD_URLS: Array<[RegExp, string]> = [
  [/computing|\bn28|\bfsksm|\bfc\b/i, "https://comp.utm.my"],
  [/electrical|\bfke\b|p19/i, "https://fke.utm.my"],
  [/mechanical|\bfkm\b|\bc22/i, "https://fkm.utm.my"],
  [/civil|\bfka\b|\bm46|\bd09/i, "https://civil.utm.my"],
  [/chemical|energy|\bfkt\b|\bn29/i, "https://fkt.utm.my"],
  [/\bscience|\bfaculty of science|bioscience|\bt02|\bt05/i, "https://science.utm.my"],
  [/built environment|alam bina|fabu/i, "https://fabu.utm.my"],
  [/management|\bfm\b/i, "https://management.utm.my"],
  [/azman hashim|ahibs|business/i, "https://business.utm.my"],
  [/humanities|tamadun|fssh|\bt07/i, "https://humanities.utm.my"],
  [/library|perpustakaan|\bpsz\b|\bprzs\b/i, "https://library.utm.my"],
  [/kesihatan|\bpku\b|health centre/i, "https://pku.utm.my"],
  [/masjid|mosque|islamic/i, "https://islamiccentre.utm.my"],
  [
    /kolej|kediaman|ktdi|ktf|krp|ktho|ktr|ktc|kdse|kdoj|k9|k10|perdana|ark[ae]d/i,
    "https://studentaffairs.utm.my",
  ],
];

const OFF_CAMPUS_PATTERN =
  /\b(taman sri pulai|taman pulai|taman universiti|taman teknologi|taman teratai|taman desa skudai|taman sri skudai|taman scientex|taman harmoni|taman jaya|taman sri puteri|skudai parade|aeon mall|plaza tol|mcdonald|burger king|petronas|shell|7-?eleven|speedmart|utmspace)\b/i;

export function isCampusCoordinate(lat: number, lng: number, label = ""): boolean {
  if (label && OFF_CAMPUS_PATTERN.test(label)) return false;
  // Main UTM Johor Bahru campus footprint (bounded by Jalan Pontian/Skudai & perimeter gates)
  const inMain =
    lat >= 1.552 &&
    lat <= 1.5708 &&
    lng >= 103.623 &&
    lng <= 103.6588 &&
    !(lat > 1.5685 && lng > 103.646);
  // Northwest KLG / KTGB / KDOJ campus residential enclave
  const inKdoj = lat >= 1.571 && lat <= 1.5775 && lng >= 103.6158 && lng <= 103.624;
  return inMain || inKdoj;
}

export function findOfficialUtmForPlace(
  label: string,
  lat: number,
  lng: number,
): string | undefined {
  for (const seed of UTM_CURATED_POIS) {
    if (metres([lat, lng], [seed.lat, seed.lng]) < 140) {
      return seed.officialUrl;
    }
  }
  for (const [pattern, url] of KEYWORD_URLS) {
    if (pattern.test(label)) return url;
  }
  if (isCampusCoordinate(lat, lng, label)) {
    return "https://www.utm.my";
  }
  return undefined;
}
