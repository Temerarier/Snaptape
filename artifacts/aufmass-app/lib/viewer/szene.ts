// three.js-Szene des 3D-Viewers (Etappe 2). Kapselt alles Imperative:
// Renderer, Kamera, Orbit-Steuerung, Raycasting-Auswahl, Maß-Labels und
// das Messlinien-Werkzeug. Die React-Komponente hält den Zustand und
// ruft ausschließlich die Methoden des SzenenHandle auf.
//
// Alle Modelldaten kommen in mm (Eiserne Regel 1); die Szene rechnet
// nur für die Darstellung in Meter um (mm / 1000).
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  CSS2DObject,
  CSS2DRenderer,
} from "three/addons/renderers/CSS2DRenderer.js";
import type { HausModell, Punkt3 } from "./baukasten";

export interface MessLinie {
  id: string;
  a: Punkt3; // mm
  b: Punkt3; // mm
  laengeMm: number;
}

export interface SzenenOptionen {
  container: HTMLElement;
  modell: HausModell;
  formatLaenge: (mm: number) => string;
  onBauteilKlick: (id: string | null) => void;
  onMessLinie: (a: Punkt3, b: Punkt3, laengeMm: number) => void;
}

export interface SzenenHandle {
  setAuswahl(ids: ReadonlySet<string>): void;
  setMasseSichtbar(sichtbar: boolean): void;
  setMessModus(aktiv: boolean): void;
  setMessLinien(linien: readonly MessLinie[]): void;
  zoomAufBauteil(id: string): void;
  dispose(): void;
}

const MM = 1 / 1000;
const AUSWAHL_FARBE = 0x2563eb;
const MESS_FARBE = 0xdc2626;
const SNAP_ABSTAND_M = 0.15;
const KLICK_TOLERANZ_PX = 6;

const FLAECHEN_FARBEN: Record<string, number> = {
  wand: 0xdedad2,
  dachflaeche: 0xa4553f,
};

const OEFFNUNGS_FARBEN: Record<string, number> = {
  fenster: 0x93b8d8,
  tuer: 0x8a6248,
  garagentor: 0x9aa0a6,
  sonstige: 0xb0aba3,
};

const KANTEN_FARBE = 0x57534e;

function zuMeter(p: Punkt3): THREE.Vector3 {
  return new THREE.Vector3(p[0] * MM, p[1] * MM, p[2] * MM);
}

// Text eines Kanten-Maßlabels: Bauteil-ID + Länge, z. B. „K-9 · 5,50 m"
// (Eiserne Regel 3: dieselbe ID überall). Reine Funktion, damit sie ohne
// WebGL testbar ist.
export function massLabelText(
  id: string,
  laengeMm: number,
  formatLaenge: (mm: number) => string,
): string {
  return `${id} · ${formatLaenge(laengeMm)}`;
}

// Ausdünnung bei kleinem Zoom: Ein Label bleibt nur sichtbar, wenn seine
// Kante aus der aktuellen Kameradistanz groß genug erscheint. Längere
// Kanten haben dadurch automatisch Vorrang; beim Herauszoomen
// verschwinden kurze Labels zuerst, beim Hineinzoomen kehren sie zurück.
// Reine Funktion, damit sie ohne WebGL testbar ist.
export const LABEL_SICHT_FAKTOR = 0.15;
export function istMassLabelSichtbar(
  laengeM: number,
  kameraAbstandM: number,
): boolean {
  return laengeM / Math.max(kameraAbstandM, 0.001) >= LABEL_SICHT_FAKTOR;
}

// Baut aus einem planaren 3D-Polygon (mm) eine BufferGeometry in Metern.
function polygonGeometrie(polygonMm: Punkt3[]): THREE.BufferGeometry {
  const punkte = polygonMm.map(zuMeter);
  const ursprung = punkte[0]!.clone();
  const u = punkte[1]!.clone().sub(ursprung).normalize();
  // Newell-Normale (robust für beliebige planare Polygone)
  const n = new THREE.Vector3();
  for (let i = 0; i < punkte.length; i += 1) {
    const a = punkte[i]!;
    const b = punkte[(i + 1) % punkte.length]!;
    n.x += (a.y - b.y) * (a.z + b.z);
    n.y += (a.z - b.z) * (a.x + b.x);
    n.z += (a.x - b.x) * (a.y + b.y);
  }
  n.normalize();
  const v = new THREE.Vector3().crossVectors(n, u);
  const shape = new THREE.Shape(
    punkte.map((p) => {
      const d = p.clone().sub(ursprung);
      return new THREE.Vector2(d.dot(u), d.dot(v));
    }),
  );
  const geometrie = new THREE.ShapeGeometry(shape);
  const matrix = new THREE.Matrix4().makeBasis(u, v, n).setPosition(ursprung);
  geometrie.applyMatrix4(matrix);
  geometrie.computeVertexNormals();
  return geometrie;
}

function labelElement(text: string): HTMLDivElement {
  const el = document.createElement("div");
  el.textContent = text;
  el.style.cssText =
    "background:rgba(255,255,255,0.92);border:1px solid #d6d3d1;" +
    "border-radius:6px;padding:1px 6px;font-size:11px;color:#1c1917;" +
    "font-family:ui-sans-serif,system-ui,sans-serif;white-space:nowrap;" +
    "pointer-events:none;user-select:none;";
  return el;
}

export function erstelleSzene(optionen: SzenenOptionen): SzenenHandle {
  const { container, modell, formatLaenge, onBauteilKlick, onMessLinie } =
    optionen;

  const breite = modell.breiteMm * MM;
  const tiefe = modell.tiefeMm * MM;
  const first = modell.firsthoeheMm * MM;

  const szene = new THREE.Scene();
  szene.background = new THREE.Color(0xf5f5f4);

  const kamera = new THREE.PerspectiveCamera(
    50,
    container.clientWidth / Math.max(container.clientHeight, 1),
    0.2,
    200,
  );
  kamera.position.set(breite * 1.5, first * 1.6, tiefe + Math.max(breite, tiefe) * 1.3);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  // Weiche Schatten für den „Modell auf hellem Tisch"-Look.
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.cssText = "position:absolute;inset:0;display:block;";
  container.appendChild(renderer.domElement);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(container.clientWidth, container.clientHeight);
  labelRenderer.domElement.style.cssText =
    "position:absolute;inset:0;pointer-events:none;overflow:hidden;";
  container.appendChild(labelRenderer.domElement);

  const steuerung = new OrbitControls(kamera, renderer.domElement);
  steuerung.target.set(breite / 2, (modell.traufhoeheMm * MM) / 2, tiefe / 2);
  steuerung.enableDamping = true;
  steuerung.dampingFactor = 0.08;
  steuerung.minDistance = 1.5;
  steuerung.maxDistance = 90;
  steuerung.update();

  // Licht
  szene.add(new THREE.HemisphereLight(0xffffff, 0x9c9890, 1.0));
  const sonne = new THREE.DirectionalLight(0xffffff, 1.4);
  sonne.position.set(14, 22, 18);
  // Die Sonne wirft den weichen Schlagschatten des Hauses auf den Boden.
  sonne.castShadow = true;
  sonne.target.position.set(breite / 2, 0, tiefe / 2);
  const schattenRadius = Math.max(breite, tiefe) * 1.8;
  sonne.shadow.camera.left = -schattenRadius;
  sonne.shadow.camera.right = schattenRadius;
  sonne.shadow.camera.top = schattenRadius;
  sonne.shadow.camera.bottom = -schattenRadius;
  sonne.shadow.camera.near = 1;
  sonne.shadow.camera.far = 80;
  sonne.shadow.mapSize.set(2048, 2048);
  sonne.shadow.bias = -0.0003;
  sonne.shadow.normalBias = 0.03;
  szene.add(sonne, sonne.target);
  const gegenlicht = new THREE.DirectionalLight(0xffffff, 0.45);
  gegenlicht.position.set(-12, 8, -14);
  szene.add(gegenlicht);

  // Heller Boden („Tisch"): weiße Fläche, die nur den Schatten trägt –
  // bewusst ohne Raster, damit das Modell ruhig aufliegt.
  const boden = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }),
  );
  boden.rotation.x = -Math.PI / 2;
  boden.position.set(breite / 2, -0.005, tiefe / 2);
  boden.receiveShadow = true;
  szene.add(boden);

  // Bauteile
  const gruppeFlaechen = new THREE.Group();
  const gruppeOeffnungen = new THREE.Group();
  const gruppeKanten = new THREE.Group();
  const gruppeMassLabels = new THREE.Group();
  const gruppeMessLinien = new THREE.Group();
  szene.add(
    gruppeFlaechen,
    gruppeOeffnungen,
    gruppeKanten,
    gruppeMassLabels,
    gruppeMessLinien,
  );

  const teile = new Map<string, THREE.Object3D>();
  // Maß-Labels der Kanten inkl. Länge (in m) für die Zoom-Ausdünnung.
  const massLabels: { label: CSS2DObject; laengeM: number }[] = [];

  for (const flaeche of modell.flaechen) {
    const basisFarbe = FLAECHEN_FARBEN[flaeche.faceClass] ?? 0xcccccc;
    const material = new THREE.MeshStandardMaterial({
      color: basisFarbe,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    const mesh = new THREE.Mesh(polygonGeometrie(flaeche.polygon), material);
    mesh.castShadow = true;
    mesh.userData = { bauteilId: flaeche.id, basisFarbe };
    gruppeFlaechen.add(mesh);
    teile.set(flaeche.id, mesh);
  }

  for (const oeffnung of modell.oeffnungen) {
    const basisFarbe = OEFFNUNGS_FARBEN[oeffnung.typ] ?? 0xb0aba3;
    const material = new THREE.MeshStandardMaterial({
      color: basisFarbe,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(polygonGeometrie(oeffnung.polygon), material);
    mesh.userData = { bauteilId: oeffnung.id, basisFarbe };
    gruppeOeffnungen.add(mesh);
    teile.set(oeffnung.id, mesh);
  }

  for (const kante of modell.kanten) {
    const geometrie = new THREE.BufferGeometry().setFromPoints([
      zuMeter(kante.start),
      zuMeter(kante.ende),
    ]);
    const material = new THREE.LineBasicMaterial({ color: KANTEN_FARBE });
    const linie = new THREE.Line(geometrie, material);
    linie.userData = { bauteilId: kante.id, basisFarbe: KANTEN_FARBE };
    gruppeKanten.add(linie);
    teile.set(kante.id, linie);

    // Maß-Label am Kantenmittelpunkt (per Schalter einblendbar):
    // Bauteil-ID + Länge, z. B. „K-9 · 5,50 m" (Eiserne Regel 3).
    const mitte = zuMeter(kante.start).add(zuMeter(kante.ende)).multiplyScalar(0.5);
    const el = labelElement(massLabelText(kante.id, kante.laengeMm, formatLaenge));
    const label = new CSS2DObject(el);
    label.position.copy(mitte);
    gruppeMassLabels.add(label);
    massLabels.push({ label, laengeM: kante.laengeMm * MM });
  }
  gruppeMassLabels.visible = false;

  // Sichtbarkeit der Maß-Labels: Schalter „Maße anzeigen" UND Ausdünnung
  // (istMassLabelSichtbar) müssen beide zustimmen. CSS2D-Labels sind
  // DOM-Overlays und damit immer zur Kamera gerichtet.
  let masseAn = false;
  function aktualisiereMassLabels() {
    for (const { label, laengeM } of massLabels) {
      const abstand = kamera.position.distanceTo(label.position);
      const sichtbar = masseAn && istMassLabelSichtbar(laengeM, abstand);
      label.visible = sichtbar;
      label.element.style.display = sichtbar ? "" : "none";
    }
  }

  // Messlinien-Werkzeug
  let messModus = false;
  let messStart: THREE.Vector3 | null = null;
  const messMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 16, 16),
    new THREE.MeshBasicMaterial({ color: MESS_FARBE }),
  );
  messMarker.visible = false;
  szene.add(messMarker);

  const kantenSegmente = modell.kanten.map(
    (k) => new THREE.Line3(zuMeter(k.start), zuMeter(k.ende)),
  );

  function rasteAnKanteEin(punkt: THREE.Vector3): THREE.Vector3 {
    let bester = punkt;
    let bestAbstand = SNAP_ABSTAND_M;
    const kandidat = new THREE.Vector3();
    for (const segment of kantenSegmente) {
      segment.closestPointToPoint(punkt, true, kandidat);
      const abstand = kandidat.distanceTo(punkt);
      if (abstand < bestAbstand) {
        bestAbstand = abstand;
        bester = kandidat.clone();
      }
    }
    return bester;
  }

  // Raycasting
  const raycaster = new THREE.Raycaster();
  raycaster.params.Line.threshold = 0.12;
  const zeiger = new THREE.Vector2();

  function setzeZeiger(ereignis: PointerEvent | MouseEvent) {
    const rechteck = renderer.domElement.getBoundingClientRect();
    zeiger.x = ((ereignis.clientX - rechteck.left) / rechteck.width) * 2 - 1;
    zeiger.y = -((ereignis.clientY - rechteck.top) / rechteck.height) * 2 + 1;
  }

  function findeBauteil(): string | null {
    raycaster.setFromCamera(zeiger, kamera);
    const treffer = [
      ...raycaster.intersectObjects(gruppeOeffnungen.children, false),
      ...raycaster.intersectObjects(gruppeKanten.children, false),
      ...raycaster.intersectObjects(gruppeFlaechen.children, false),
    ];
    if (treffer.length === 0) return null;
    // Priorität bei fast gleicher Distanz: Öffnung > Kante > Fläche
    let bester: { id: string; wertung: number } | null = null;
    for (const t of treffer) {
      const id = t.object.userData.bauteilId as string | undefined;
      if (!id) continue;
      const bonus = id.startsWith("K-") ? 0.08 : gruppeOeffnungen.children.includes(t.object) ? 0.05 : 0;
      const wertung = t.distance - bonus;
      if (!bester || wertung < bester.wertung) bester = { id, wertung };
    }
    return bester?.id ?? null;
  }

  function findeOberflaechenPunkt(): THREE.Vector3 | null {
    raycaster.setFromCamera(zeiger, kamera);
    const treffer = raycaster.intersectObjects(
      [...gruppeFlaechen.children, ...gruppeOeffnungen.children],
      false,
    );
    return treffer[0]?.point.clone() ?? null;
  }

  // Klick vs. Orbit-Drag unterscheiden; Einzelklick leicht verzögern,
  // damit ein Doppelklick ihn abbrechen kann.
  let zeigerStart: { x: number; y: number } | null = null;
  let klickTimer: ReturnType<typeof setTimeout> | null = null;

  function beiPointerDown(e: PointerEvent) {
    zeigerStart = { x: e.clientX, y: e.clientY };
  }

  function beiPointerUp(e: PointerEvent) {
    if (!zeigerStart) return;
    const bewegt = Math.hypot(e.clientX - zeigerStart.x, e.clientY - zeigerStart.y);
    zeigerStart = null;
    if (bewegt > KLICK_TOLERANZ_PX || e.button !== 0) return;
    setzeZeiger(e);

    if (messModus) {
      const punkt = findeOberflaechenPunkt();
      if (!punkt) return;
      const eingerastet = rasteAnKanteEin(punkt);
      if (!messStart) {
        messStart = eingerastet;
        messMarker.position.copy(eingerastet);
        messMarker.visible = true;
      } else {
        const a = messStart;
        const b = eingerastet;
        messStart = null;
        messMarker.visible = false;
        const aMm: Punkt3 = [a.x / MM, a.y / MM, a.z / MM];
        const bMm: Punkt3 = [b.x / MM, b.y / MM, b.z / MM];
        onMessLinie(aMm, bMm, a.distanceTo(b) / MM);
      }
      return;
    }

    const id = findeBauteil();
    if (klickTimer) clearTimeout(klickTimer);
    klickTimer = setTimeout(() => {
      klickTimer = null;
      onBauteilKlick(id);
    }, 220);
  }

  function beiDoppelklick(e: MouseEvent) {
    if (klickTimer) {
      clearTimeout(klickTimer);
      klickTimer = null;
    }
    if (messModus) return;
    setzeZeiger(e);
    const id = findeBauteil();
    if (id) zoomAufBauteil(id);
  }

  renderer.domElement.addEventListener("pointerdown", beiPointerDown);
  renderer.domElement.addEventListener("pointerup", beiPointerUp);
  renderer.domElement.addEventListener("dblclick", beiDoppelklick);

  function zoomAufBauteil(id: string) {
    const objekt = teile.get(id);
    if (!objekt) return;
    const box = new THREE.Box3().setFromObject(objekt);
    const kugel = box.getBoundingSphere(new THREE.Sphere());
    const richtung = kamera.position.clone().sub(steuerung.target).normalize();
    const distanz = Math.max(kugel.radius * 3, 1.8);
    steuerung.target.copy(kugel.center);
    kamera.position.copy(kugel.center.clone().add(richtung.multiplyScalar(distanz)));
    steuerung.update();
  }

  // Größe an den Container koppeln
  const beobachter = new ResizeObserver(() => {
    const w = container.clientWidth;
    const h = Math.max(container.clientHeight, 1);
    kamera.aspect = w / h;
    kamera.updateProjectionMatrix();
    renderer.setSize(w, h);
    labelRenderer.setSize(w, h);
  });
  beobachter.observe(container);

  // Render-Schleife
  let rafId = 0;
  const letzteLabelKameraPos = new THREE.Vector3(Infinity, Infinity, Infinity);
  function rendern() {
    rafId = requestAnimationFrame(rendern);
    steuerung.update();
    // Ausdünnung nur neu berechnen, wenn die Kamera sich bewegt hat.
    if (
      masseAn &&
      kamera.position.distanceToSquared(letzteLabelKameraPos) > 1e-4
    ) {
      letzteLabelKameraPos.copy(kamera.position);
      aktualisiereMassLabels();
    }
    renderer.render(szene, kamera);
    labelRenderer.render(szene, kamera);
  }
  rendern();

  function entferneUndDisposeKinder(gruppe: THREE.Object3D) {
    for (const kind of [...gruppe.children]) {
      kind.traverse((obj) => {
        if (obj instanceof CSS2DObject) obj.element.remove();
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line) {
          obj.geometry.dispose();
          const material = obj.material;
          if (Array.isArray(material)) material.forEach((m) => m.dispose());
          else material.dispose();
        }
      });
      gruppe.remove(kind);
    }
  }

  const handle: SzenenHandle = {
    setAuswahl(ids) {
      for (const [id, objekt] of teile) {
        const ausgewaehlt = ids.has(id);
        const material = (objekt as THREE.Mesh | THREE.Line)
          .material as THREE.MeshStandardMaterial | THREE.LineBasicMaterial;
        const basisFarbe = objekt.userData.basisFarbe as number;
        material.color.setHex(ausgewaehlt ? AUSWAHL_FARBE : basisFarbe);
        if (material instanceof THREE.MeshStandardMaterial) {
          material.emissive.setHex(ausgewaehlt ? AUSWAHL_FARBE : 0x000000);
          material.emissiveIntensity = ausgewaehlt ? 0.25 : 0;
        }
      }
    },
    setMasseSichtbar(sichtbar) {
      masseAn = sichtbar;
      gruppeMassLabels.visible = sichtbar;
      aktualisiereMassLabels();
    },
    setMessModus(aktiv) {
      messModus = aktiv;
      if (!aktiv) {
        messStart = null;
        messMarker.visible = false;
      }
      renderer.domElement.style.cursor = aktiv ? "crosshair" : "";
    },
    setMessLinien(linien) {
      entferneUndDisposeKinder(gruppeMessLinien);
      for (const linie of linien) {
        const a = zuMeter(linie.a);
        const b = zuMeter(linie.b);
        const geometrie = new THREE.BufferGeometry().setFromPoints([a, b]);
        const material = new THREE.LineBasicMaterial({
          color: MESS_FARBE,
          depthTest: false,
        });
        const objekt = new THREE.Line(geometrie, material);
        objekt.renderOrder = 999;

        const endpunkte = new THREE.Mesh(
          new THREE.SphereGeometry(0.05, 12, 12),
          new THREE.MeshBasicMaterial({ color: MESS_FARBE, depthTest: false }),
        );
        endpunkte.renderOrder = 999;
        endpunkte.position.copy(a);
        const endpunktB = endpunkte.clone();
        endpunktB.position.copy(b);
        objekt.add(endpunkte, endpunktB);

        const el = labelElement(formatLaenge(linie.laengeMm));
        el.style.borderColor = "#fca5a5";
        el.style.color = "#b91c1c";
        const label = new CSS2DObject(el);
        label.position.copy(a.clone().add(b).multiplyScalar(0.5));
        objekt.add(label);

        gruppeMessLinien.add(objekt);
      }
    },
    zoomAufBauteil,
    dispose() {
      cancelAnimationFrame(rafId);
      if (klickTimer) clearTimeout(klickTimer);
      beobachter.disconnect();
      renderer.domElement.removeEventListener("pointerdown", beiPointerDown);
      renderer.domElement.removeEventListener("pointerup", beiPointerUp);
      renderer.domElement.removeEventListener("dblclick", beiDoppelklick);
      steuerung.dispose();
      szene.traverse((obj) => {
        if (obj instanceof CSS2DObject) obj.element.remove();
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line) {
          obj.geometry.dispose();
          const material = obj.material;
          if (Array.isArray(material)) material.forEach((m) => m.dispose());
          else material.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      labelRenderer.domElement.remove();
    },
  };

  return handle;
}
