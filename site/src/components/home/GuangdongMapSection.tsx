"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { getMapFeatures, buildProjection, featureToPath } from "@/lib/map-projection";
import type { EventData } from "@/lib/api-data";
import type { Region } from "@/types/content";
import { Reveal } from "@/components/ui/Reveal";
import { useLocale } from "@/lib/locale-context";
import { gsap, motionDuration, motionEase, motionMedia, useGSAP } from "@/lib/motion";
import { cityDestinations, filterPublishedCities } from "@/lib/city-discovery";

const features = getMapFeatures();
type MapCity = Pick<Region, "slug" | "name" | "adcode" | "label" | "summary" | "image" | "tags" | "gallery">;
interface Props { cities?: MapCity[]; events?: EventData[] }

export function GuangdongMapSection({ cities = [], events = [] }: Props) {
  const { t } = useLocale();
  const [query, setQuery] = useState("");
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const scope = useRef<HTMLElement>(null);
  const filtered = useMemo(() => filterPublishedCities(cities, query), [cities, query]);
  const activeCity = filtered.find((city) => city.slug === activeSlug) ?? filtered[0];
  const byCode = useMemo(() => new Map(filtered.map((city) => [city.adcode, city])), [filtered]);
  const eventCities = useMemo(() => new Set(events.map((event) => event.citySlug)), [events]);
  const activeGallery = activeCity ? [...new Set([activeCity.image, ...activeCity.gallery].filter(Boolean))] : [];
  const activeImage = activeGallery[slideIndex % Math.max(1, activeGallery.length)];
  const links = activeCity ? cityDestinations(activeCity.slug) : null;
  const map = useMemo(() => {
    if (!features.length) return null;
    const projection = buildProjection(features, 700, 490, 18);
    return features.map((feature) => ({
      code: feature.properties.adcode,
      path: featureToPath(feature, projection.point),
      point: feature.properties.centroid ? projection.point(feature.properties.centroid) : null,
    }));
  }, []);

  const activate = (slug: string) => { setActiveSlug(slug); setSlideIndex(0); };
  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add(motionMedia.allowMotion, () => {
      gsap.fromTo("[data-map-panel]", { autoAlpha: 0, y: 16 }, {
        autoAlpha: 1, y: 0, duration: motionDuration.medium, ease: motionEase.enter,
        clearProps: "opacity,transform,visibility",
      });
    });
    return () => media.revert();
  }, { scope });

  return (
    <section ref={scope} id="home-map" className="site-container py-beat home-city-map">
      <Reveal><h2>{t("home.map.heading")}</h2></Reveal>
      <div className="home-map-filters">
        <label>Country<select aria-label="Country" defaultValue="china"><option value="china">China</option></select></label>
        <label>Province<select aria-label="Province" defaultValue="guangdong"><option value="guangdong">Guangdong</option></select></label>
        <label className="home-map-search">Search cities<input type="search" value={query} maxLength={80} onChange={(event) => { setQuery(event.target.value); setSlideIndex(0); }} /></label>
      </div>
      <div className="home-map-layout">
        <div data-map-panel className="home-map-panel">
          {activeCity && links ? (
            <>
              {activeImage ? <Link href={links.culture} className="home-map-photo"><img src={activeImage} alt={activeCity.name} loading="lazy" decoding="async" /></Link> : <p className="home-map-no-photo">No city photograph available.</p>}
              {activeGallery.length > 1 ? <div className="home-map-photo-controls">
                <button type="button" aria-label="Previous city photograph" onClick={() => setSlideIndex((index) => (index + activeGallery.length - 1) % activeGallery.length)}>←</button>
                <span>{slideIndex % activeGallery.length + 1} / {activeGallery.length}</span>
                <button type="button" aria-label="Next city photograph" onClick={() => setSlideIndex((index) => index + 1)}>→</button>
              </div> : null}
              <h3>{activeCity.name}</h3>
              <p className="home-map-summary">{activeCity.summary.replace(/^#{1,3}\s+/gm, "").replace(/\*{1,3}(.+?)\*{1,3}/g, "$1")}</p>
              <div className="home-map-actions">
                <Link href={links.culture}>Know more <span aria-hidden="true">↗</span></Link>
                <Link href={links.routes}>{t("common.nav.routes")} <span aria-hidden="true">→</span></Link>
                <Link href={links.interpretation}>{t("common.nav.interpreting")} <span aria-hidden="true">→</span></Link>
              </div>
            </>
          ) : <div className="home-map-empty" role="status"><h3>{cities.length ? "No matching cities" : "City content unavailable"}</h3><p>{cities.length ? "Try another city name or clear your search." : "No published cities are available right now."}</p>{query ? <button type="button" onClick={() => setQuery("")}>Clear search</button> : null}</div>}
        </div>
        <div className="home-map-graphic">
          {map ? <svg viewBox="0 0 700 490" role="img" aria-label="Guangdong in China. Select a published city using the city buttons below.">
            <title>Guangdong cities</title>
            {map.map((area) => {
              const city = byCode.get(area.code);
              const active = city?.slug === activeCity?.slug && Boolean(city);
              return <g key={area.code} onMouseEnter={() => { if (city) activate(city.slug); }} onClick={() => { if (city) activate(city.slug); }} className={city ? "home-map-selectable" : undefined}>
                <path d={area.path} fill={active ? "var(--river-deep)" : city ? "var(--jade)" : "rgba(124,155,134,0.22)"} stroke="var(--paper-deep)" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
                {city && area.point ? <><circle cx={area.point[0]} cy={area.point[1]} r={active ? 6 : 4} fill={eventCities.has(city.slug) ? "var(--cinnabar)" : "var(--river-deep)"}/>{active ? <text x={area.point[0] + 10} y={area.point[1] - 12} fill="var(--river-deep)" fontSize="17">{city.name}</text> : null}</> : null}
              </g>;
            })}
          </svg> : <p>Map unavailable. Choose a city below.</p>}
          <div className="home-map-city-list" aria-label="Published cities">
            {filtered.map((city) => <button type="button" key={city.slug} aria-pressed={city.slug === activeCity?.slug} onClick={() => activate(city.slug)}>{city.name}</button>)}
          </div>
        </div>
      </div>
    </section>
  );
}
