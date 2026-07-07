// Entwicklungs-Seed: legt einen Testnutzer mit Beispielprojekten an
// (verschiedene Status, Adressen, Daten, ein archiviertes Projekt).
// Aufruf: pnpm --filter @workspace/aufmass-app exec tsx scripts/seed-testdaten.ts
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, projectsTable, usersTable } from "@workspace/db";

const EMAIL = "test@snaptape.de";
const PASSWORT = "snaptape-test-1234";
const BCRYPT_COST = 12;

const TAG = 24 * 60 * 60 * 1000;

async function main() {
  // Sicherheits-Guard: Seed nur in der Entwicklung ausführen.
  if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT) {
    console.error("Seed-Skript ist nur für die Entwicklung gedacht – Abbruch.");
    process.exit(1);
  }

  const vorhandene = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, EMAIL))
    .limit(1);

  let userId: string;
  if (vorhandene[0]) {
    userId = vorhandene[0].id;
  } else {
    const passwordHash = await bcrypt.hash(PASSWORT, BCRYPT_COST);
    const [nutzer] = await db
      .insert(usersTable)
      .values({ email: EMAIL, passwordHash })
      .returning();
    userId = nutzer!.id;
  }

  await db.delete(projectsTable).where(eq(projectsTable.userId, userId));

  const jetzt = Date.now();
  await db.insert(projectsTable).values([
    {
      userId,
      name: "EFH Hendricks",
      adresse: "Ahornweg 12, 51063 Köln",
      status: "fertig",
      createdAt: new Date(jetzt - 2 * TAG),
    },
    {
      userId,
      name: "Doppelhaus Alvarez",
      adresse: "Palmstraße 227, 22767 Hamburg",
      status: "in_pruefung",
      createdAt: new Date(jetzt - 4 * TAG),
    },
    {
      userId,
      name: "Bauernhaus Whitfield",
      adresse: "Landstraße 12, 79539 Lörrach",
      status: "fertig",
      createdAt: new Date(jetzt - 5 * TAG),
    },
    {
      userId,
      name: "Bungalow Nguyen",
      adresse: "Zedernhof 512, 14163 Berlin",
      status: "entwurf",
      createdAt: new Date(jetzt - 7 * TAG),
    },
    {
      userId,
      name: "Reihenhaus O'Connor",
      adresse: "Birkenweg 94, 30659 Hannover",
      status: "fehler",
      createdAt: new Date(jetzt - 10 * TAG),
    },
    {
      userId,
      name: "Hofanlage Ramos",
      adresse: "Grüner Weg 33, 86152 Augsburg",
      status: "fertig",
      createdAt: new Date(jetzt - 13 * TAG),
    },
    {
      userId,
      name: "Stadtvilla Petersen",
      adresse: "Elbchaussee 8, 22763 Hamburg",
      status: "in_pruefung",
      createdAt: new Date(jetzt - 15 * TAG),
    },
    {
      userId,
      name: "Altbau Krüger (alt)",
      adresse: "Ringstraße 4, 04109 Leipzig",
      status: "entwurf",
      createdAt: new Date(jetzt - 30 * TAG),
      archivedAt: new Date(jetzt - 20 * TAG),
    },
  ]);

  console.log(`Seed fertig: Nutzer ${EMAIL} mit 8 Projekten (1 archiviert).`);
  process.exit(0);
}

main().catch((fehler) => {
  console.error(fehler);
  process.exit(1);
});
