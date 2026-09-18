const colorMap: Record<string, string> = {
  // order/payment/generic statuses
  Draft: "bg-gray-100 text-gray-700",
  Confirmed: "bg-blue-100 text-blue-700",
  Processing: "bg-indigo-100 text-indigo-700",
  Ready: "bg-purple-100 text-purple-700",
  OutForDelivery: "bg-amber-100 text-amber-700",
  Delivered: "bg-green-100 text-green-700",
  Cancelled: "bg-red-100 text-red-700",
  Failed: "bg-red-100 text-red-700",
  Pending: "bg-gray-100 text-gray-700",
  Assigned: "bg-blue-100 text-blue-700",
  Unpaid: "bg-red-100 text-red-700",
  Partial: "bg-amber-100 text-amber-700",
  Paid: "bg-green-100 text-green-700",
  Active: "bg-green-100 text-green-700",
  Inactive: "bg-gray-100 text-gray-700",
};

export default function Badge({ value }: { value: string }) {
  const cls = colorMap[value] ?? "bg-gray-100 text-gray-700";
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{value}</span>;
}
