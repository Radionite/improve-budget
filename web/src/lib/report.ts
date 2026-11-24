/**
 * Maakt een PDF-rapport van losse secties (feitenlijstjes en tabellen).
 * De berekeningen gebeuren in de pagina; dit bestand zorgt alleen voor de opmaak.
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export type ReportTable = {
  title?: string;
  head: string[];
  body: string[][];
  foot?: string[];
  /** Kolommen die rechts uitgelijnd worden (bijv. bedragen). */
  right?: number[];
};

export type ReportSection = {
  title: string;
  note?: string;
  facts?: [string, string][];
  tables?: ReportTable[];
};

export type ReportInput = {
  title: string;
  subtitle: string;
  footer: string;
  sections: ReportSection[];
};

const ACCENT: [number, number, number] = [61, 107, 224];
const INK: [number, number, number] = [23, 32, 27];
const MUTED: [number, number, number] = [100, 110, 105];
const MARGIN = 16;

/** jsPDF-standaardletters kennen geen speciale min- of spatietekens. */
export const clean = (s: string) => s.replace(/−/g, '-').replace(/[  ]/g, ' ').replace(/[‘’]/g, "'").replace(/[“”]/g, '"');

export function renderReport(input: ReportInput): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageH = doc.internal.pageSize.getHeight();
  const pageW = doc.internal.pageSize.getWidth();
  let y = MARGIN;

  const lastY = () => (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
  const ensure = (needed: number) => {
    if (y + needed > pageH - 20) {
      doc.addPage();
      y = MARGIN;
    }
  };

  // Titel
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...INK);
  doc.text(clean(input.title), MARGIN, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(clean(input.subtitle), MARGIN, y + 13);
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(0.8);
  doc.line(MARGIN, y + 17, pageW - MARGIN, y + 17);
  y += 25;

  for (const section of input.sections) {
    ensure(30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...INK);
    doc.text(clean(section.title), MARGIN, y);
    y += 2;
    if (section.note) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...MUTED);
      const lines = doc.splitTextToSize(clean(section.note), pageW - 2 * MARGIN);
      doc.text(lines, MARGIN, y + 4);
      y += 2 + lines.length * 3.8;
    }
    y += 2;

    if (section.facts?.length) {
      autoTable(doc, {
        startY: y,
        margin: { left: MARGIN, right: MARGIN },
        theme: 'plain',
        styles: { fontSize: 9.5, cellPadding: { top: 1.4, bottom: 1.4, left: 0, right: 2 }, textColor: INK },
        columnStyles: { 0: { textColor: MUTED, cellWidth: 70 }, 1: { fontStyle: 'bold' } },
        body: section.facts.map(([k, v]) => [clean(k), clean(v)]),
      });
      y = lastY() + 5;
    }

    for (const t of section.tables ?? []) {
      // Titel, kop en minstens twee regels (of de hele kleine tabel) bij elkaar houden.
      ensure((t.title ? 6 : 0) + 9 + Math.min(t.body.length, 3) * 7 + (t.foot ? 7 : 0));
      if (t.title) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(...INK);
        doc.text(clean(t.title), MARGIN, y + 3);
        y += 5;
      }
      const columnStyles: Record<number, { halign: 'right' }> = {};
      (t.right ?? []).forEach((i) => { columnStyles[i] = { halign: 'right' }; });
      autoTable(doc, {
        startY: y,
        margin: { left: MARGIN, right: MARGIN, bottom: 18 },
        head: [t.head.map(clean)],
        body: t.body.map((r) => r.map(clean)),
        foot: t.foot ? [t.foot.map(clean)] : undefined,
        theme: 'striped',
        showFoot: 'lastPage',
        rowPageBreak: 'avoid',
        styles: { fontSize: 8.8, cellPadding: 1.8, textColor: INK, overflow: 'linebreak' },
        headStyles: { fillColor: ACCENT, textColor: 255, fontStyle: 'bold' },
        footStyles: { fillColor: [232, 237, 250], textColor: INK, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [244, 246, 249] },
        columnStyles,
        didParseCell: (data) => {
          if ((data.section === 'head' || data.section === 'foot') && t.right?.includes(data.column.index)) data.cell.styles.halign = 'right';
        },
      });
      y = lastY() + 7;
    }
    y += 3;
  }

  // Voettekst met paginanummers
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(clean(input.footer), MARGIN, pageH - 8);
    doc.text(`Pagina ${i} van ${pages}`, pageW - MARGIN, pageH - 8, { align: 'right' });
  }
  return doc;
}
