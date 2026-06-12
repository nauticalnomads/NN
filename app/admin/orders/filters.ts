// Saved filters (status presets) shared by the orders list and its CSV export.
// "Needs action" is the daily-driver view: everything awaiting an admin decision.
export const FILTERS: { key: string; label: string; statuses: string[] | null }[] = [
  { key: "", label: "All", statuses: null },
  {
    key: "needs_action",
    label: "Needs action",
    statuses: ["awaiting_fulfilment", "fulfilment_failed"],
  },
  { key: "pending", label: "Open carts", statuses: ["pending"] },
  { key: "paid", label: "Paid", statuses: ["paid"] },
  { key: "fulfilling", label: "Fulfilling", statuses: ["fulfilling"] },
  { key: "shipped", label: "Shipped", statuses: ["shipped"] },
  { key: "delivered", label: "Delivered", statuses: ["delivered"] },
  { key: "closed", label: "Cancelled / refunded", statuses: ["cancelled", "refunded"] },
];
