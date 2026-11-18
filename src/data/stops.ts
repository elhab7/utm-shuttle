// Bus stop coordinates from the uploaded stop list (FKT (N29) located via Google Places).
export type Stop = { id: string; name: string; lat: number; lng: number };

export const STOPS: Stop[] = [
  { id: "cp", name: "Centre Point (CP)", lat: 1.559817071903544, lng: 103.63490409827418 },
  { id: "amal", name: "Jalan Amal (FKE)", lat: 1.5580162032146048, lng: 103.64022229437279 },
  { id: "kp", name: "Kolej Perdana (KP)", lat: 1.5587190616209474, lng: 103.64732342800342 },
  { id: "k9", name: "K9/K10", lat: 1.5603939213123625, lng: 103.6487973360301 },
  { id: "kdoj", name: "KDOJ", lat: 1.57576000650592, lng: 103.61973156794734 },
  { id: "kdse_m", name: "KDSE (Male)", lat: 1.567996, lng: 103.624463 },
  { id: "kdse_f", name: "KDSE (Female)", lat: 1.566614, lng: 103.627049 },
  { id: "pku", name: "PKU", lat: 1.558681, lng: 103.627746 },
  { id: "krp_g21", name: "KRP G21", lat: 1.55783, lng: 103.629291 },
  { id: "ktf", name: "KTF", lat: 1.558773, lng: 103.630847 },
  { id: "krp_g11", name: "KRP G11", lat: 1.559277, lng: 103.632853 },
  { id: "arked_cengal", name: "Arked Cengal", lat: 1.561154, lng: 103.632553 },
  { id: "p19", name: "P19", lat: 1.560628, lng: 103.641506 },
  { id: "d01", name: "D01", lat: 1.561223, lng: 103.636576 },
  { id: "d05", name: "D05", lat: 1.561518, lng: 103.637912 },
  { id: "d06", name: "D06", lat: 1.561047, lng: 103.639414 },
  { id: "e01", name: "E01", lat: 1.559776, lng: 103.640213 },
  { id: "s47", name: "S47", lat: 1.55457, lng: 103.648678 },
  { id: "t05", name: "T05", lat: 1.563457, lng: 103.652809 },
  { id: "t06", name: "T06", lat: 1.562613, lng: 103.655716 },
  { id: "t08", name: "T08", lat: 1.560001, lng: 103.655834 },
  { id: "arked_lestari", name: "Arked Lestari", lat: 1.55867, lng: 103.649311 },
  { id: "ktr", name: "KTR", lat: 1.5617635671730536, lng: 103.62948406283648 },
  { id: "ktho", name: "KTHO", lat: 1.5638867153251204, lng: 103.62941156100541 },
  { id: "ktdi", name: "KTDI", lat: 1.5649807909152897, lng: 103.63401870951887 },
  { id: "v01", name: "V01 (Taman U)", lat: 1.5443633952454752, lng: 103.63182161599055 },
  { id: "cluster", name: "Cluster (T02/T08)", lat: 1.564399505961806, lng: 103.6534892244123 },
  { id: "ktc", name: "KTC", lat: 1.5571323017762062, lng: 103.64461344851348 },
  { id: "dewan_ktc", name: "Dewan KTC", lat: 1.5551492, lng: 103.6447433 },
  { id: "n24", name: "N24", lat: 1.5626728449354932, lng: 103.63915207783187 },
  { id: "krp_ktf", name: "KRP/KTF", lat: 1.5581213922662231, lng: 103.62982766946291 },
  { id: "fkt", name: "FKT (N29)", lat: 1.5669048, lng: 103.6407801 },
];

export const STOP_BY_ID: Record<string, Stop> = Object.fromEntries(STOPS.map((s) => [s.id, s]));
