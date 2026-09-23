import { format } from "date-fns";

// Transaction receipt PDF for a finished (DONE) reservation - hall or OB.
// Built in the browser with jsPDF, loaded only when the user clicks Download
// so it stays out of the page bundle.

export type ReceiptRow = [label: string, value: string];

export type ReceiptInput = {
  kind: "Hall Reservation" | "OB Trip";
  id: string;
  requester: { name?: string | null; email?: string | null };
  details: ReceiptRow[];
  filedAt?: string | Date | null;
  completedAt?: string | Date | null;
};

const fmt = (d?: string | Date | null) =>
  d ? format(new Date(d), "MMM d, yyyy h:mm a") : "—";

export async function downloadReceipt(input: ReceiptInput) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const left = 48;
  const right = doc.internal.pageSize.getWidth() - 48;
  const labelW = 150;
  let y = 56;

  // Header
  doc.setFillColor(220, 38, 38); // brand red #DC2626
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("CNT Promo & Ads Specialists, Inc.", left, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text("Reservation System", left, y);
  doc.setTextColor(0);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("TRANSACTION RECEIPT", right, 56, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(input.kind, right, 74, { align: "right" });

  y += 20;
  doc.setDrawColor(210);
  doc.line(left, y, right, y);
  y += 24;

  const section = (title: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(title, left, y);
    y += 16;
  };

  const rows = (list: ReceiptRow[]) => {
    doc.setFontSize(10);
    for (const [label, value] of list) {
      const lines = doc.splitTextToSize(value || "—", right - left - labelW);
      if (y + lines.length * 13 > doc.internal.pageSize.getHeight() - 60) {
        doc.addPage();
        y = 56;
      }
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text(label, left, y);
      doc.setTextColor(0);
      doc.text(lines, left + labelW, y);
      y += lines.length * 13 + 5;
    }
    y += 10;
  };

  section("Reference");
  rows([
    ["Reference No.", input.id],
    ["Status", "Done"],
  ]);

  section("Requester");
  rows([
    ["Name", input.requester.name ?? "—"],
    ["Email", input.requester.email ?? "—"],
  ]);

  section("Details");
  rows(input.details);

  section("Status Timeline");
  rows([
    ["Filed", fmt(input.filedAt)],
    ["Marked as Done", fmt(input.completedAt)],
  ]);

  // Footer
  const h = doc.internal.pageSize.getHeight();
  doc.setDrawColor(210);
  doc.line(left, h - 56, right, h - 56);
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(`Generated ${fmt(new Date())}`, left, h - 42);
  doc.text("System-generated receipt. No signature required.", right, h - 42, {
    align: "right",
  });

  doc.save(`${input.id}-receipt.pdf`);
}
