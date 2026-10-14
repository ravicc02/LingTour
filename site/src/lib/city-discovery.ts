export type PublishedCityChoice = { slug: string; name: string; adcode?: number; image?: string };

/** Search the supplied published catalogue only; never substitute another city. */
export function filterPublishedCities<T extends PublishedCityChoice>(cities: T[], query: string): T[] {
  const term = query.trim().toLocaleLowerCase("en");
  return cities.filter((city) => city.name.toLocaleLowerCase("en").includes(term) || city.slug.toLocaleLowerCase("en").includes(term));
}

export function cityDestinations(slug: string) {
  const encoded = encodeURIComponent(slug);
  return {
    culture: `/culture/${encoded}`,
    routes: `/routes?citySlug=${encoded}`,
    interpretation: `/interpreting?citySlug=${encoded}`,
  };
}
