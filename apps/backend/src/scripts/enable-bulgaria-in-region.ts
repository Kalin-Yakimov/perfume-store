import { MedusaContainer } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { updateRegionsWorkflow } from "@medusajs/medusa/core-flows";

/** Add Bulgaria to the existing EUR region without removing any active countries. */
export default async function enableBulgariaInRegion({
  container,
}: {
  container: MedusaContainer;
}) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { data } = await query.graph({
    entity: "region",
    fields: ["id", "name", "currency_code", "countries.iso_2"],
  });

  const regions = data as {
    id: string;
    name: string;
    currency_code: string;
    countries?: { iso_2: string }[];
  }[];

  if (
    regions.some((region) =>
      region.countries?.some((country) => country.iso_2 === "bg"),
    )
  ) {
    console.log("Bulgaria is already enabled in a region.");
    return;
  }

  const euroRegions = regions.filter(
    (region) => region.currency_code === "eur",
  );
  if (euroRegions.length !== 1) {
    throw new Error(
      "Expected exactly one EUR region. Select the target region manually before running this script.",
    );
  }

  const region = euroRegions[0];
  const countries = [
    ...new Set([
      ...(region.countries || []).map((country) => country.iso_2),
      "bg",
    ]),
  ];

  await updateRegionsWorkflow(container).run({
    input: { selector: { id: region.id }, update: { countries } },
  });

  console.log(`Enabled Bulgaria in the ${region.name} region.`);
}
