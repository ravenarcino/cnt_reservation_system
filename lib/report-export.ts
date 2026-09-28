import { format } from "date-fns";

// Report exports (PDF, Excel, CSV) for the Reports page. The page builds one
// ReportExport object and every format is written from it, so the three
// files always carry the same numbers. The PDF and Excel libraries are loaded
// only when the user clicks export, keeping them out of the page bundle.

export type ReportTable = {
  // Sheet name in Excel (max 31 chars) and heading in the PDF / CSV.
  title: string;
  head: string[];
  body: (string | number)[][];
  // Short breakdown tables sit on the Summary sheet in Excel.
  breakdown?: boolean;
};

export type ReportExport = {
  rangeLabel: string;
  generatedBy?: string | null;
  // First column is the metric name, e.g. ["Metric", "Hall", "OB"].
  summaryHead: string[];
  summary: (string | number)[][];
  tables: ReportTable[];
};

const BRAND: [number, number, number] = [220, 38, 38]; // #DC2626

function fileName(ext: string) {
  return `cnt-report-${format(new Date(), "yyyy-MM-dd-HHmm")}.${ext}`;
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

// ------------------------------------------------------------------- PDF

export async function exportReportPdf(r: ReportExport) {
  const { jsPDF } = await import("jspdf");
  const { autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const left = 40;
  const right = pageW - 40;

  // Header
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, pageW, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("CNT Promo & Ads Specialists, Inc.", left, 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text("Reservation System", left, 66);
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("RESERVATION REPORT", right, 50, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(r.rangeLabel, right, 66, { align: "right" });
  doc.setDrawColor(229);
  doc.line(left, 80, right, 80);

  const head = {
    fillColor: BRAND,
    textColor: 255,
    fontStyle: "bold" as const,
    fontSize: 9,
  };
  const lastY = () =>
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  const heading = (text: string, y: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(text, left, y);
  };

  // Summary
  heading("Summary", 102);
  autoTable(doc, {
    startY: 110,
    margin: { left, right: 40 },
    head: [r.summaryHead],
    body: r.summary.map((row) => row.map(String)),
    headStyles: head,
    styles: { fontSize: 9, cellPadding: 5 },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
    alternateRowStyles: { fillColor: [250, 250, 250] },
  });

  // Breakdowns, two per row
  const breakdowns = r.tables.filter((t) => t.breakdown);
  const colW = (right - left - 16) / 2;
  let y = lastY() + 28;
  for (let i = 0; i < breakdowns.length; i += 2) {
    const pair = breakdowns.slice(i, i + 2);
    if (y > doc.internal.pageSize.getHeight() - 120) {
      doc.addPage();
      y = 50;
    }
    let bottom = y;
    pair.forEach((t, j) => {
      const x = left + j * (colW + 16);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(t.title, x, y);
      autoTable(doc, {
        startY: y + 6,
        margin: { left: x },
        tableWidth: colW,
        head: [t.head],
        body: t.body.length ? t.body.map((row) => row.map(String)) : [["No data", ""]],
        headStyles: { ...head, fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 4 },
        columnStyles: { 1: { halign: "right", cellWidth: 60 } },
        pageBreak: "avoid",
      });
      bottom = Math.max(bottom, lastY());
    });
    y = bottom + 26;
  }

  // Detail tables, each on its own page
  r.tables
    .filter((t) => !t.breakdown)
    .forEach((t) => {
      doc.addPage();
      heading(`${t.title} (${t.body.length})`, 50);
      autoTable(doc, {
        startY: 58,
        margin: { left, right: 40 },
        head: [t.head],
        body: t.body.length ? t.body.map((row) => row.map(String)) : [["No records in this range"]],
        headStyles: { ...head, fontSize: 7.5 },
        styles: { fontSize: 7.5, cellPadding: 3, overflow: "linebreak" },
        alternateRowStyles: { fillColor: [250, 250, 250] },
      });
    });

  // Footer on every page
  const pages = doc.getNumberOfPages();
  const pageH = doc.internal.pageSize.getHeight();
  const stamp = `Generated ${format(new Date(), "MMM d, yyyy h:mm a")}${r.generatedBy ? ` by ${r.generatedBy}` : ""}`;
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(stamp, left, pageH - 24);
    doc.text(`Page ${p} of ${pages}`, right, pageH - 24, { align: "right" });
    doc.setTextColor(0);
  }

  doc.save(fileName("pdf"));
}

// ----------------------------------------------------------------- Excel

export async function exportReportXlsx(r: ReportExport) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = r.generatedBy ?? "CNT Reservation";
  wb.created = new Date();

  const styleHead = (row: import("exceljs").Row) => {
    row.eachCell((c) => {
      c.font = { bold: true, color: { argb: "FFFFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDC2626" } };
      c.alignment = { vertical: "middle" };
    });
    row.height = 20;
  };

  // Summary sheet: title, the metric table, then each breakdown under it.
  const s = wb.addWorksheet("Summary");
  s.columns = [{ width: 34 }, { width: 14 }, { width: 14 }];
  s.addRow(["CNT Reservation — Report"]).font = { bold: true, size: 14 };
  s.addRow([r.rangeLabel]).font = { color: { argb: "FF737373" } };
  s.addRow([]);
  styleHead(s.addRow(r.summaryHead));
  r.summary.forEach((row) => s.addRow(row));
  r.tables
    .filter((t) => t.breakdown)
    .forEach((t) => {
      s.addRow([]);
      s.addRow([t.title]).font = { bold: true };
      styleHead(s.addRow(t.head));
      (t.body.length ? t.body : [["No data"]]).forEach((row) => s.addRow(row));
    });

  // One sheet per detail table, with frozen header and filters.
  r.tables
    .filter((t) => !t.breakdown)
    .forEach((t) => {
      const ws = wb.addWorksheet(t.title.slice(0, 31), {
        views: [{ state: "frozen", ySplit: 1 }],
      });
      styleHead(ws.addRow(t.head));
      t.body.forEach((row) => ws.addRow(row));
      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: t.head.length } };
      ws.columns.forEach((col, i) => {
        const longest = Math.max(
          t.head[i].length,
          ...t.body.slice(0, 500).map((row) => String(row[i] ?? "").length),
        );
        col.width = Math.min(50, Math.max(10, longest + 2));
      });
    });

  const buf = await wb.xlsx.writeBuffer();
  download(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    fileName("xlsx"),
  );
}

// ------------------------------------------------------------------- CSV

export function exportReportCsv(r: ReportExport) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines: string[] = [esc("CNT Reservation — Report"), esc(r.rangeLabel), ""];

  lines.push(esc("Summary"));
  lines.push(r.summaryHead.map(esc).join(","));
  r.summary.forEach((row) => lines.push(row.map(esc).join(",")));
  lines.push("");

  r.tables.forEach((t) => {
    lines.push(esc(t.title));
    lines.push(t.head.map(esc).join(","));
    t.body.forEach((row) => lines.push(row.map(esc).join(",")));
    lines.push("");
  });

  // BOM so Excel opens the file as UTF-8 (em dashes, ñ).
  download(new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" }), fileName("csv"));
}
