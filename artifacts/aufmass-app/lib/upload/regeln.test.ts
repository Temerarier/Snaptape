import { describe, expect, it } from "vitest";
import {
  MAX_DATEI_BYTES,
  MAX_DATEIEN_PRO_PROJEKT,
  dateiArt,
  mimeFuerName,
  pruefeNeueDateien,
} from "./regeln";

const MB = 1024 * 1024;

describe("dateiArt", () => {
  it("erkennt Fotos und PDFs an der Endung (auch Großschreibung)", () => {
    expect(dateiArt("haus.jpg")).toBe("photo");
    expect(dateiArt("haus.JPEG")).toBe("photo");
    expect(dateiArt("haus.png")).toBe("photo");
    expect(dateiArt("haus.HEIC")).toBe("photo");
    expect(dateiArt("plan.pdf")).toBe("pdf");
  });

  it("lehnt andere Endungen ab", () => {
    expect(dateiArt("notizen.txt")).toBeNull();
    expect(dateiArt("bild.gif")).toBeNull();
    expect(dateiArt("ohne-endung")).toBeNull();
  });
});

describe("mimeFuerName", () => {
  it("leitet den MIME-Typ aus der Endung ab", () => {
    expect(mimeFuerName("a.jpg")).toBe("image/jpeg");
    expect(mimeFuerName("a.jpeg")).toBe("image/jpeg");
    expect(mimeFuerName("a.png")).toBe("image/png");
    expect(mimeFuerName("a.heic")).toBe("image/heic");
    expect(mimeFuerName("a.pdf")).toBe("application/pdf");
  });
});

describe("pruefeNeueDateien", () => {
  it("akzeptiert 6 Fotos + 1 mehrseitiges Plan-PDF (Happy Path)", () => {
    const dateien = [
      ...Array.from({ length: 6 }, (_, i) => ({
        name: `foto-${i + 1}.jpg`,
        sizeBytes: 4 * MB,
      })),
      { name: "grundriss.pdf", sizeBytes: 12 * MB },
    ];
    const ergebnis = pruefeNeueDateien(0, dateien);
    expect(ergebnis.akzeptiert).toHaveLength(7);
    expect(ergebnis.abgelehnt).toHaveLength(0);
    expect(ergebnis.akzeptiert[6].art).toBe("pdf");
  });

  it("lehnt die 11. Datei ab (Anzahl-Limit)", () => {
    const dateien = Array.from({ length: 11 }, (_, i) => ({
      name: `foto-${i + 1}.jpg`,
      sizeBytes: 1 * MB,
    }));
    const ergebnis = pruefeNeueDateien(0, dateien);
    expect(ergebnis.akzeptiert).toHaveLength(MAX_DATEIEN_PRO_PROJEKT);
    expect(ergebnis.abgelehnt).toEqual([
      { name: "foto-11.jpg", grund: "zu_viele" },
    ]);
  });

  it("zählt bereits vorhandene Dateien mit", () => {
    const ergebnis = pruefeNeueDateien(9, [
      { name: "a.jpg", sizeBytes: MB },
      { name: "b.jpg", sizeBytes: MB },
    ]);
    expect(ergebnis.akzeptiert).toHaveLength(1);
    expect(ergebnis.abgelehnt).toEqual([{ name: "b.jpg", grund: "zu_viele" }]);
  });

  it("lehnt eine 30-MB-Datei ab (Größen-Limit, Grenze exakt 25 MB)", () => {
    const ergebnis = pruefeNeueDateien(0, [
      { name: "riesig.jpg", sizeBytes: 30 * MB },
      { name: "genau.pdf", sizeBytes: MAX_DATEI_BYTES },
      { name: "knapp-drueber.pdf", sizeBytes: MAX_DATEI_BYTES + 1 },
    ]);
    expect(ergebnis.akzeptiert.map((d) => d.name)).toEqual(["genau.pdf"]);
    expect(ergebnis.abgelehnt).toEqual([
      { name: "riesig.jpg", grund: "zu_gross" },
      { name: "knapp-drueber.pdf", grund: "zu_gross" },
    ]);
  });

  it("lehnt eine .txt-Datei ab (Typ-Prüfung)", () => {
    const ergebnis = pruefeNeueDateien(0, [
      { name: "notizen.txt", sizeBytes: MB },
    ]);
    expect(ergebnis.akzeptiert).toHaveLength(0);
    expect(ergebnis.abgelehnt).toEqual([{ name: "notizen.txt", grund: "typ" }]);
  });

  it("meldet bei voller Belegung nur 'zu_viele' für ansonsten gültige Dateien", () => {
    const ergebnis = pruefeNeueDateien(MAX_DATEIEN_PRO_PROJEKT, [
      { name: "ok.jpg", sizeBytes: MB },
      { name: "falsch.txt", sizeBytes: MB },
    ]);
    expect(ergebnis.abgelehnt).toEqual([
      { name: "ok.jpg", grund: "zu_viele" },
      { name: "falsch.txt", grund: "typ" },
    ]);
  });
});
