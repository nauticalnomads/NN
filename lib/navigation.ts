// Primary navigation structure (redesign v2 §2.3). Single source of truth for
// the header, mega menu, and mobile drawer. Each subcategory `slug` resolves to
// a /collections/<slug> page. Collections are seeded as drafts and only appear
// in nav once published with >=1 product (handled at render time). `imageKey`
// maps to a CMS mega-menu image slot (§7.7).

export type SubLink = { label: string; slug: string };
export type MegaColumn = {
  heading: string;
  slug: string; // parent collection slug
  imageKey: string; // CMS key for the column image (§7.7)
  links: SubLink[];
};
export type NavItem = {
  label: string; // sentence case (Billabong style)
  slug: string; // gender landing: /collections/<slug>
  columns: MegaColumn[];
};

export const NAV: NavItem[] = [
  {
    label: "Men",
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
          { label: "Hoodies", slug: "mens-hoodies" },
          { label: "Jackets", slug: "mens-jackets" },
          { label: "Jumpers", slug: "mens-jumpers" },
          { label: "Polos", slug: "mens-polos" },
          { label: "Tee's & Tanks", slug: "mens-tees-tanks" },
        ],
      },
      {
        heading: "Mens Bottoms",
        slug: "mens-bottoms",
        imageKey: "mega.men.bottoms",
        links: [
          { label: "Shorts", slug: "mens-shorts" },
          { label: "Sweatpants", slug: "mens-sweatpants" },
          { label: "Underwear", slug: "mens-underwear" },
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
    label: "Women",
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
          { label: "Tees & Tanks", slug: "womens-tees-tanks" },
          { label: "Jackets", slug: "womens-jackets" },
          { label: "Jumper", slug: "womens-jumpers" },
          { label: "Hoodies", slug: "womens-hoodies" },
          { label: "Dresses", slug: "dresses" },
        ],
      },
      {
        heading: "Womens Bottoms",
        slug: "womens-bottoms",
        imageKey: "mega.women.bottoms",
        links: [
          { label: "Athletic Shorts", slug: "womens-athletic-shorts" },
          { label: "Sweatpants", slug: "womens-sweatpants" },
          { label: "Leggings", slug: "womens-leggings" },
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
    label: "Accessories",
    slug: "accessories",
    columns: [
      {
        heading: "Bags & Luggage",
        slug: "bags-luggage",
        imageKey: "mega.accessories.bags",
        links: [],
      },
      { heading: "Towels", slug: "towels", imageKey: "mega.accessories.towels", links: [] },
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

// Top-bar utility links (§2.1).
export const UTILITY_LINKS = [
  { label: "Sign In / Join", href: "/account" },
  { label: "Help", href: "/help" },
  { label: "Gift Cards", href: "/gift-cards" },
];
