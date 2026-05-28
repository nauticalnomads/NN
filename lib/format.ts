export function formatPrice(amount: number | null | undefined, currency = "GBP") {
  const value = typeof amount === "number" ? amount : 0;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

// True when the product is on sale (current price below the regular price).
export function isOnSale(price: number, compareAt: number | null | undefined) {
  return typeof compareAt === "number" && compareAt > price;
}
