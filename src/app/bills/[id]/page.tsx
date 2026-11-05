import { BillDetailView } from "@/components/bills/bill-detail-view";

export default async function BillDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string | string[] }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const saved = query.saved;
  const justSaved = saved === "1" || (Array.isArray(saved) && saved.includes("1"));
  return <BillDetailView id={id} justSaved={justSaved} />;
}
