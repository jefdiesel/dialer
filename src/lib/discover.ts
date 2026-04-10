// Lead discovery via Google Places API (New).
// Docs: https://developers.google.com/maps/documentation/places/web-service/text-search
//
// We use Text Search ("dental clinics in Austin TX") which returns up to 20
// results per page and supports pageToken for the next 20. We cap at 60 per
// run to keep cost predictable.

import { prisma } from "./db";
import { env } from "./env";

const PLACES_URL = "https://places.googleapis.com/v1/places:searchText";

const FIELDS = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.primaryType",
  "places.types",
].join(",");

type PlacesPlace = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  primaryType?: string;
  types?: string[];
};

type PlacesResponse = {
  places?: PlacesPlace[];
  nextPageToken?: string;
};

async function searchTextOnce(
  query: string,
  pageToken?: string,
): Promise<PlacesResponse> {
  const res = await fetch(PLACES_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Goog-Api-Key": env.GOOGLE_PLACES_API_KEY,
      "X-Goog-FieldMask": FIELDS,
    },
    body: JSON.stringify({
      textQuery: query,
      pageSize: 20,
      ...(pageToken ? { pageToken } : {}),
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Places API ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json();
}

export async function discoverLeads(campaignId: string): Promise<number> {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error(`campaign ${campaignId} not found`);

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "discovering" },
  });

  const query = `${campaign.niche} in ${campaign.location}`;
  let inserted = 0;
  let pageToken: string | undefined;
  const MAX_PAGES = 3; // 60 results

  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await searchTextOnce(query, pageToken);
    for (const p of data.places ?? []) {
      // Skip if we already have this place in any campaign — placeId is unique.
      try {
        await prisma.lead.create({
          data: {
            campaignId,
            placeId: p.id,
            businessName: p.displayName?.text ?? "(unknown)",
            website: p.websiteUri ?? null,
            phone: p.nationalPhoneNumber ?? p.internationalPhoneNumber ?? null,
            address: p.formattedAddress ?? null,
            category: p.primaryType ?? p.types?.[0] ?? null,
          },
        });
        inserted++;
      } catch (e) {
        // unique violation = already imported elsewhere; ignore
        if (!(e instanceof Error && e.message.includes("Unique"))) throw e;
      }
    }
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
    // Google requires a short delay before nextPageToken becomes valid.
    await new Promise((r) => setTimeout(r, 2000));
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "ready" },
  });
  return inserted;
}
