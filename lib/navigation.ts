// Primary navigation structure (redesign §2.3). Single source of truth for the
// header, mega menu, and mobile drawer. Each subcategory `slug` resolves to a
// /collections/<slug> page — those collections are populated by the Shopify
// collection re-migration (Phase 0). `image` keys map to CMS mega-menu slots
// (§6.5) and are filled from cms_homepage_content at runtime.

export type SubLink = { label: string; slug: string };
export type MegaColumn = {
  heading: string;
  slug: string; // parent collection slug
  imageKey: string; // CMS key for the column image (§6.5)
  links: SubLink[];
};
export type NavItem = {
  label: string;
  slug: string; // /collections/<slug> landing for the whole gender
  columns: MegaColumn[];
};

export const NAV: NavItem[] = [
  {
    label: "MEN",
    slug: "men",
    columns: [
      {
        heading: "Mens Swimwear",
        slug: "mens-swimwear",
        imageKey: "mega.men.swimwear",
        links: [
          { label: "Boardshorts", slug: "boardshorts" },
          { label: "Rashvest", slug: "rashvest" },
        ],
      },
      {
        heading: "Mens Tops",
        slug: "mens-tops",
        imageKey: "mega.men.tops",
        links: [
          { label: "Mens Hoodies", slug: "mens-hoodies" },
          { label: "Mens Jackets", slug: "mens-jackets" },
          { label: "Mens Jumpers", slug: "mens-jumpers" },
          { label: "Mens Polos", slug: "mens-polos" },
          { label: "Mens Tee's & Tanks", slug: "mens-tees-tanks" },
        ],
      },
      {
        heading: "Mens Bottoms",
        slug: "mens-bottoms",
        imageKey: "mega.men.bottoms",
        links: [
          { label: "Mens Shorts", slug: "mens-shorts" },
          { label: "Mens Sweatpants", slug: "mens-sweatpants" },
          { label: "Mens Underwear", slug: "mens-underwear" },
        ],
      },
      {
        heading: "Footwear",
        slug: "mens-footwear",
        imageKey: "mega.men.footwear",
        links: [
          { label: "Flip Flops", slug: "mens-flip-flops" },
          { label: "Sliders", slug: "mens-sliders" },
          { label: "Socks", slug: "mens-socks" },
          { label: "Shoes", slug: "mens-shoes" },
        ],
      },
    ],
  },
  {
    label: "WOMEN",
    slug: "women",
    columns: [
      {
        heading: "Women's Swimwear",
        slug: "womens-swimwear",
        imageKey: "mega.women.swimwear",
        links: [
          { label: "Bikini Bottoms", slug: "bikini-bottoms" },
          { label: "Bikini Sets", slug: "bikini-sets" },
          { label: "Bikini Tops", slug: "bikini-tops" },
          { label: "One-Piece Swimsuit", slug: "one-piece-swimsuit" },
        ],
      },
      {
        heading: "Women's Tops",
        slug: "womens-tops",
        imageKey: "mega.women.tops",
        links: [
          { label: "Women's Tees & Tanks", slug: "womens-tees-tanks" },
          { label: "Women's Jackets", slug: "womens-jackets" },
          { label: "Womens Jumper", slug: "womens-jumpers" },
          { label: "Womens Hoodies", slug: "womens-hoodies" },
          { label: "Dresses", slug: "dresses" },
        ],
      },
      {
        heading: "Womens Bottoms",
        slug: "womens-bottoms",
        imageKey: "mega.women.bottoms",
        links: [
          { label: "Womens Athletic Shorts", slug: "womens-athletic-shorts" },
          { label: "Womens Sweatpants", slug: "womens-sweatpants" },
          { label: "Womens Leggings", slug: "womens-leggings" },
        ],
      },
      {
        heading: "Footwear",
        slug: "womens-footwear",
        imageKey: "mega.women.footwear",
        links: [
          { label: "Flip Flops", slug: "womens-flip-flops" },
          { label: "Socks", slug: "womens-socks" },
          { label: "Shoes", slug: "womens-shoes" },
        ],
      },
    ],
  },
  {
    label: "ACCESSORIES",
    slug: "accessories",
    columns: [
      {
        heading: "Bags & Luggage",
        slug: "bags-luggage",
        imageKey: "mega.accessories.bags",
        links: [],
      },
      {
        heading: "Towels",
        slug: "towels",
        imageKey: "mega.accessories.towels",
        links: [],
      },
      {
        heading: "Hats & Beanies",
        slug: "hats-beanies",
        imageKey: "mega.accessories.hats",
        links: [],
      },
      {
        heading: "Footwear",
        slug: "accessories-footwear",
        imageKey: "mega.accessories.footwear",
        links: [
          { label: "Flip Flops", slug: "flip-flops" },
          { label: "Socks", slug: "socks" },
          { label: "Shoes", slug: "shoes" },
        ],
      },
    ],
  },
];

// Utility-bar links (§2.1) and footer columns reuse these.
export const UTILITY_LINKS = [
  { label: "My Account", href: "/account" },
  { label: "Help & Contact", href: "/help" },
  { label: "Gift Cards", href: "/gift-cards" },
];
