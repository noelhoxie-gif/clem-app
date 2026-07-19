import bootsSuede from "@/assets/shop-boots-suede.jpg";
import necklacePearl from "@/assets/shop-necklace-pearl.jpg";
import scarfCream from "@/assets/shop-scarf-cream.jpg";
import mulesBlack from "@/assets/shop-mules-black.jpg";
import bagCamel from "@/assets/shop-bag-camel.jpg";
import beltBlack from "@/assets/shop-belt-black.jpg";
import slingbacksWhite from "@/assets/shop-slingbacks-white.jpg";
import silkscarfPrint from "@/assets/shop-silkscarf-print.jpg";
import gapTrouser from "@/assets/item-trousers.jpg";
import gapKnit from "@/assets/item-sweater.jpg";
import gapJewelry from "@/assets/item-necklaces.jpg";
import type { Category, Item, Season } from "./store";

export interface ShopItem {
  id: string;
  name: string;
  brand: string;
  retailer: "Nordstrom" | "Net-a-Porter" | "Mytheresa" | "SSENSE";
  category: Category;
  price: string;
  url: string;
  image: string;
  palette: string[]; // colors it pairs well with (lowercased)
  season: Season;
}

export const SHOP_CATALOG: ShopItem[] = [
  {
    id: "s1",
    name: "Tall Suede Block-Heel Boot",
    brand: "Stuart Weitzman",
    retailer: "Nordstrom",
    category: "Shoes",
    price: "$695",
    url: "https://www.nordstrom.com/",
    image: bootsSuede,
    palette: ["camel", "tan", "cream", "ivory", "sage", "espresso", "chocolate"],
    season: "Cold",
  },
  {
    id: "s2",
    name: "Baroque Pearl Pendant",
    brand: "Sophie Buhai",
    retailer: "Net-a-Porter",
    category: "Accessories",
    price: "$420",
    url: "https://www.net-a-porter.com/",
    image: necklacePearl,
    palette: ["ivory", "cream", "champagne", "gold", "butter"],
    season: "Year-round",
  },
  {
    id: "s3",
    name: "Fringed Cashmere Wrap",
    brand: "Johnstons of Elgin",
    retailer: "Mytheresa",
    category: "Accessories",
    price: "$385",
    url: "https://www.mytheresa.com/",
    image: scarfCream,
    palette: ["cream", "ivory", "camel", "sage", "champagne"],
    season: "Cold",
  },
  {
    id: "s4",
    name: "Square-Toe Leather Mule",
    brand: "By Far",
    retailer: "SSENSE",
    category: "Shoes",
    price: "$510",
    url: "https://www.ssense.com/",
    image: mulesBlack,
    palette: ["black", "charcoal", "onyx", "indigo", "espresso"],
    season: "Year-round",
  },
  {
    id: "s5",
    name: "Camel Suede Chain Crossbody",
    brand: "Wandler",
    retailer: "Net-a-Porter",
    category: "Accessories",
    price: "$795",
    url: "https://www.net-a-porter.com/",
    image: bagCamel,
    palette: ["camel", "tan", "cream", "butter", "ivory", "chocolate"],
    season: "Year-round",
  },
  {
    id: "s6",
    name: "Slim Leather Waist Belt",
    brand: "Anderson's",
    retailer: "Nordstrom",
    category: "Accessories",
    price: "$185",
    url: "https://www.nordstrom.com/",
    image: beltBlack,
    palette: ["black", "indigo", "charcoal", "cream", "ivory"],
    season: "Year-round",
  },
  {
    id: "s7",
    name: "Pointed Slingback Flat",
    brand: "Khaite",
    retailer: "Mytheresa",
    category: "Shoes",
    price: "$740",
    url: "https://www.mytheresa.com/",
    image: slingbacksWhite,
    palette: ["ivory", "cream", "champagne", "butter", "sage"],
    season: "Year-round",
  },
  {
    id: "s8",
    name: "Printed Silk Twill Square",
    brand: "Toteme",
    retailer: "SSENSE",
    category: "Accessories",
    price: "$295",
    url: "https://www.ssense.com/",
    image: silkscarfPrint,
    palette: ["cream", "champagne", "gold", "camel", "butter"],
    season: "Year-round",
  },
  {
    id: "s9",
    name: "Cobalt Pleated Trouser",
    brand: "Tibi",
    retailer: "Net-a-Porter",
    category: "Bottoms",
    price: "$495",
    url: "https://www.net-a-porter.com/",
    image: gapTrouser,
    palette: ["cobalt", "navy", "royal"],
    season: "Year-round",
  },
  {
    id: "s10",
    name: "Burgundy Fine-Gauge Knit",
    brand: "Khaite",
    retailer: "Mytheresa",
    category: "Tops",
    price: "$620",
    url: "https://www.mytheresa.com/",
    image: gapKnit,
    palette: ["burgundy", "wine", "merlot"],
    season: "Cold",
  },
  {
    id: "s11",
    name: "Metallic Kitten-Heel Mule",
    brand: "Aeyde",
    retailer: "SSENSE",
    category: "Shoes",
    price: "$395",
    url: "https://www.ssense.com/",
    image: mulesBlack,
    palette: ["silver", "pewter", "bronze"],
    season: "Year-round",
  },
  {
    id: "s12",
    name: "Silver Chain Belt",
    brand: "Sophie Buhai",
    retailer: "Nordstrom",
    category: "Accessories",
    price: "$340",
    url: "https://www.nordstrom.com/",
    image: gapJewelry,
    palette: ["silver", "chrome", "pewter"],
    season: "Year-round",
  },
];

interface Look {
  outer?: Item;
  top?: Item;
  bottom?: Item;
  shoes?: Item;
  accessory?: Item;
}

export function pickPairings(look: Look, max = 2): ShopItem[] {
  const pieces = [look.outer, look.top, look.bottom, look.shoes, look.accessory].filter(
    Boolean,
  ) as Item[];
  if (pieces.length === 0) return [];

  const lookColors = pieces.map((p) => (p.color ?? "").toLowerCase()).filter(Boolean);
  const seasons = new Set(pieces.map((p) => p.season));
  const filledSlots = new Set(pieces.map((p) => p.category));

  const scored = SHOP_CATALOG.map((s) => {
    let score = 0;
    // Color affinity
    const matches = s.palette.filter((c) => lookColors.includes(c)).length;
    score += matches * 3;
    // Fills a missing slot in the outfit
    if (!filledSlots.has(s.category)) score += 4;
    // Season fit
    if (s.season === "Year-round" || seasons.has(s.season)) score += 1;
    // Shoes & Accessories are most natural retail add-ons
    if (s.category === "Shoes" || s.category === "Accessories") score += 1;
    return { item: s, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  // Diversify: avoid two of the same category back-to-back
  const out: ShopItem[] = [];
  const usedCats = new Set<Category>();
  for (const { item } of scored) {
    if (out.length >= max) break;
    if (usedCats.has(item.category)) continue;
    out.push(item);
    usedCats.add(item.category);
  }
  // If not enough variety, top up
  if (out.length < max) {
    for (const { item } of scored) {
      if (out.length >= max) break;
      if (!out.includes(item)) out.push(item);
    }
  }
  return out;
}
