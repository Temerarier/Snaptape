// Showcase-Bühne für Login/Registrieren: eine schlanke, rein
// dekorative Variante der Viewer-Szene (lib/viewer/szene.ts). Zeigt das
// Hausmodell auf hellem Boden mit weichem Schlagschatten und dreht es
// langsam automatisch – ohne Orbit-Steuerung, ohne Raycasting, ohne
// Labels und ohne Interaktion. Der bestehende Projekt-Viewer bleibt
// unverändert; Farben und Polygon-Geometrie werden von dort importiert,
// damit beide Darstellungen identisch aussehen.
//
// Alle Modelldaten kommen in mm (Eiserne Regel 1); die Bühne rechnet
// nur für die Darstellung in Meter um (mm / 1000).
import * as THREE from "three";
import type { HausModell } from "./baukasten";
import {
  FLAECHEN_FARBEN,
  KANTEN_FARBE,
  OEFFNUNGS_FARBEN,
  polygonGeometrie,
} from "./szene";

export interface BuehnenOptionen {
  container: HTMLElement;
  modell: HausModell;
}

export interface BuehnenHandle {
  dispose(): void;
}

const MM = 1 / 1000;
// Eine volle Umdrehung in ca. 48 Sekunden – bewusst sehr langsam.
const DREHUNG_RAD_PRO_S = (2 * Math.PI) / 48;

export function erstelleBuehne(optionen: BuehnenOptionen): BuehnenHandle {
  const { container, modell } = optionen;

  const breite = modell.breiteMm * MM;
  const tiefe = modell.tiefeMm * MM;
  const traufe = modell.traufhoeheMm * MM;
  const first = modell.firsthoeheMm * MM;

  const szene = new THREE.Scene();
  // Kein Szenen-Hintergrund: Der Renderer bleibt transparent, die
  // helle Bühne kommt aus dem CSS des umgebenden Containers.

  const kamera = new THREE.PerspectiveCamera(
    38,
    container.clientWidth / Math.max(container.clientHeight, 1),
    0.2,
    200,
  );
  // Abstand aus der Umkugel des Hauses, damit das Modell samt Drehung
  // immer vollständig im Bild bleibt.
  const radius = 0.5 * Math.hypot(breite, tiefe, first);
  const abstand = (radius / Math.sin((kamera.fov * Math.PI) / 360)) * 1.12;
  const blickrichtung = new THREE.Vector3(1, 0.62, 1.15).normalize();
  const ziel = new THREE.Vector3(0, traufe * 0.55, 0);
  kamera.position.copy(ziel.clone().add(blickrichtung.multiplyScalar(abstand)));
  kamera.lookAt(ziel);

  // Wirft der Browser hier (kein WebGL), fängt die aufrufende
  // Komponente das ab und zeigt den stillen Platzhalter.
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.cssText = "position:absolute;inset:0;display:block;";
  container.appendChild(renderer.domElement);

  // Licht wie im Projekt-Viewer: Hemisphäre + Sonne mit weichem Schatten.
  szene.add(new THREE.HemisphereLight(0xffffff, 0x9c9890, 1.0));
  const sonne = new THREE.DirectionalLight(0xffffff, 1.4);
  sonne.position.set(14, 22, 18);
  sonne.castShadow = true;
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

  // Weißer Boden („Tisch"), der nur den Schatten trägt. Er dreht sich
  // nicht mit – nur das Haus rotiert.
  const boden = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }),
  );
  boden.rotation.x = -Math.PI / 2;
  boden.position.y = -0.005;
  boden.receiveShadow = true;
  szene.add(boden);

  // Haus-Gruppe: Das Modell wird um seinen Grundriss-Mittelpunkt
  // zentriert, damit die Drehung um die eigene Achse erfolgt.
  const haus = new THREE.Group();
  const inhalt = new THREE.Group();
  inhalt.position.set(-breite / 2, 0, -tiefe / 2);
  haus.add(inhalt);
  szene.add(haus);

  for (const flaeche of modell.flaechen) {
    const mesh = new THREE.Mesh(
      polygonGeometrie(flaeche.polygon),
      new THREE.MeshStandardMaterial({
        color: FLAECHEN_FARBEN[flaeche.faceClass] ?? 0xcccccc,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      }),
    );
    mesh.castShadow = true;
    inhalt.add(mesh);
  }

  for (const oeffnung of modell.oeffnungen) {
    inhalt.add(
      new THREE.Mesh(
        polygonGeometrie(oeffnung.polygon),
        new THREE.MeshStandardMaterial({
          color: OEFFNUNGS_FARBEN[oeffnung.typ] ?? 0xb0aba3,
          side: THREE.DoubleSide,
        }),
      ),
    );
  }

  const kantenMaterial = new THREE.LineBasicMaterial({ color: KANTEN_FARBE });
  for (const kante of modell.kanten) {
    const geometrie = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(kante.start[0] * MM, kante.start[1] * MM, kante.start[2] * MM),
      new THREE.Vector3(kante.ende[0] * MM, kante.ende[1] * MM, kante.ende[2] * MM),
    ]);
    inhalt.add(new THREE.Line(geometrie, kantenMaterial));
  }

  // Startwinkel wie im Mockup (leicht schräg), danach langsame Drehung.
  haus.rotation.y = -Math.PI / 7;

  // Barrierefreiheit: Bei reduzierter Bewegung steht das Haus still.
  const bewegungReduziert =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const beobachter = new ResizeObserver(() => {
    const w = container.clientWidth;
    const h = Math.max(container.clientHeight, 1);
    kamera.aspect = w / h;
    kamera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
  beobachter.observe(container);

  let rafId = 0;
  const uhr = new THREE.Clock();
  function rendern() {
    rafId = requestAnimationFrame(rendern);
    const delta = uhr.getDelta();
    if (!bewegungReduziert) {
      haus.rotation.y += DREHUNG_RAD_PRO_S * delta;
    }
    renderer.render(szene, kamera);
  }
  rendern();

  return {
    dispose() {
      cancelAnimationFrame(rafId);
      beobachter.disconnect();
      szene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line) {
          obj.geometry.dispose();
          const material = obj.material;
          if (Array.isArray(material)) material.forEach((m) => m.dispose());
          else material.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
