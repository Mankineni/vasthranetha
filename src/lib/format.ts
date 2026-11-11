const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })

/** Whole rupees with Indian digit grouping: 125000 → '₹1,25,000'. */
export function formatPrice(rupees: number): string {
  return `₹${inr.format(rupees)}`
}
