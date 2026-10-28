/** Client-safe catalog for Quick Visual: rooms, installable items, quick tags and reskin targets. */

export interface CatalogItem {
  id: string;
  label: string;
  /** English description sent to the image model. */
  prompt: string;
}

export interface RoomCategory {
  id: string;
  label: string;
  items: CatalogItem[];
  tags: string[];
}

export const ROOMS: RoomCategory[] = [
  {
    id: "KITCHEN",
    label: "🍳 Dapur & Makan",
    items: [
      {
        id: "KITCHEN_SET",
        label: "Kitchen set",
        prompt: "kitchen set (base cabinets, wall cabinets, countertop and backsplash panel)",
      },
      { id: "BAR_TABLE", label: "Meja bar / island", prompt: "kitchen bar table / island" },
      { id: "DINING_TABLE", label: "Meja makan", prompt: "dining table with chairs" },
    ],
    tags: [
      "Bentuk letter L",
      "Model lurus",
      "Bentuk letter U",
      "Kabinet atas & bawah",
      "Kabinet bawah saja",
      "Kabinet atas sampai plafon",
      "Lampu LED strip bawah kabinet",
      "Backsplash marmer",
      "Pintu kaca + frame",
      "Ada cooker hood",
      "Sisakan space kulkas",
    ],
  },
  {
    id: "BEDROOM",
    label: "🛏️ Kamar Tidur",
    items: [
      { id: "WARDROBE", label: "Lemari pakaian", prompt: "built-in wardrobe" },
      { id: "BED_DIVAN", label: "Divan / tempat tidur", prompt: "bed divan with headboard" },
      { id: "STUDY_DESK", label: "Meja belajar / kerja", prompt: "study / work desk" },
      { id: "VANITY", label: "Meja rias", prompt: "vanity dressing table with mirror" },
      { id: "HEADBOARD", label: "Backdrop headboard", prompt: "headboard wall backdrop panel" },
    ],
    tags: [
      "Lemari full sampai plafon",
      "Pintu geser (sliding)",
      "Pintu kaca ribbed / tinted",
      "Lampu LED dalam lemari",
      "Headboard panel kayu slat",
      "Headboard busa / jok",
      "Divan pakai laci bawah",
      "Nakas melayang kiri-kanan",
      "Meja belajar melayang (floating)",
      "Meja rias + cermin LED",
      "Rak buku gantung",
    ],
  },
  {
    id: "LIVING",
    label: "🛋️ Ruang Tamu / Keluarga",
    items: [
      { id: "TV_BACKDROP", label: "Backdrop TV / wall panel", prompt: "TV backdrop wall panel" },
      { id: "TV_CABINET", label: "Buffet / meja TV", prompt: "TV cabinet / buffet console" },
      { id: "PARTITION", label: "Partisi kisi-kisi", prompt: "slatted room partition" },
      { id: "DISPLAY", label: "Lemari pajangan", prompt: "glass display cabinet" },
    ],
    tags: [
      "Backdrop kisi-kisi wood slat",
      "Panel aksen marmer / HPL semen",
      "Lampu LED cove kuning hangat",
      "Buffet TV melayang (floating)",
      "Buffet TV dengan kaki",
      "Lemari pajangan kaca display",
    ],
  },
  {
    id: "OFFICE",
    label: "💼 Ruang Kerja / Kantor",
    items: [
      { id: "OFFICE_DESK", label: "Meja kantor", prompt: "office desk" },
      { id: "BOOKSHELF", label: "Rak buku / file cabinet", prompt: "bookshelf / file cabinet" },
      { id: "OFFICE_PANEL", label: "Wall panel kantor", prompt: "office wall panel backdrop" },
    ],
    tags: ["Meja L-shape", "Rak buku sampai plafon", "Panel kisi-kisi", "Laci kunci"],
  },
];

/** Architectural extras available in every room. */
export const EXTRAS: CatalogItem[] = [
  { id: "DOOR_SWING", label: "Pintu HPL senada", prompt: "swing door finished in matching HPL" },
  { id: "DOOR_SLIDING", label: "Pintu sliding", prompt: "sliding door" },
  {
    id: "DOOR_HIDDEN",
    label: "Pintu kamuflase (hidden door)",
    prompt: "hidden flush door blending into the wall panel",
  },
  {
    id: "CEILING",
    label: "Upgrade plafon",
    prompt:
      "new flat gypsum drop ceiling with recessed downlights and indirect warm LED cove lighting",
  },
];

export const ALL_ITEMS: CatalogItem[] = [...ROOMS.flatMap((r) => r.items), ...EXTRAS];
export const CEILING_ITEM_ID = "CEILING";

export type ReskinTarget = "ALL" | "UPPER" | "LOWER" | "TOP";

export const RESKIN_TARGETS: { value: ReskinTarget; label: string; prompt: string }[] = [
  {
    value: "ALL",
    label: "Semua kabinet",
    prompt: "all cabinet door fronts and cabinet carcass surfaces (not the countertop)",
  },
  { value: "UPPER", label: "Kabinet atas", prompt: "only the UPPER / wall cabinet doors and body" },
  { value: "LOWER", label: "Kabinet bawah", prompt: "only the LOWER / base cabinet doors and body" },
  { value: "TOP", label: "Top table", prompt: "only the countertop / top table surface" },
];
