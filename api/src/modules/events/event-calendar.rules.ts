import { BadRequestException } from '@nestjs/common';
import type { EventEntity } from './entities/event.entity';
import type { MediaAsset } from '../../common/types/media';
import { isMediaLibraryPath } from '../../common/validators/media-library.validator';

export function shanghaiToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

export function assertCalendarDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ||
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
    throw new BadRequestException('Date must be a valid YYYY-MM-DD value');
  }
}

export function assertDateRange(start: string, end: string): void {
  assertCalendarDate(start);
  assertCalendarDate(end);
  if (end < start) throw new BadRequestException('End date cannot precede start date');
}

export function validateEventContent(event: Pick<EventEntity, 'date' | 'endDate' | 'media' | 'image'>): void {
  assertDateRange(event.date, event.endDate || event.date);
  if (!Array.isArray(event.media) || event.media.length > 12) {
    throw new BadRequestException('At most 12 media assets are allowed');
  }
  const imagePath = /\.(avif|gif|jpe?g|png|webp|heic|heif)$/i;
  const videoPath = /\.(mp4|webm|mov|m4v)$/i;
  for (const asset of event.media) {
    if (!asset || !['image', 'video'].includes(asset.type) || !isMediaLibraryPath(asset.url) ||
        !(asset.type === 'video' ? videoPath : imagePath).test(asset.url)) {
      throw new BadRequestException('Media type must match a supported media library file');
    }
    if (asset.type === 'video') {
      const poster = asset.poster || event.image;
      if (!poster || !isMediaLibraryPath(poster) || !imagePath.test(poster)) {
        throw new BadRequestException('Video requires an image poster or legacy image fallback');
      }
    }
  }
}

export type EventSnapshot = Pick<EventEntity,
  'slug' | 'title' | 'summary' | 'description' | 'city' | 'citySlug' | 'tags' |
  'image' | 'media' | 'slogan' | 'extraInfo' | 'relatedRouteSlugs' | 'status'> & {
    eventDate: string; eventEndDate: string | null;
  };

export function snapshotEvent(event: EventEntity): EventSnapshot {
  const media: MediaAsset[] = event.media.map(asset => ({
    ...asset,
    ...(asset.type === 'video' ? { poster: asset.poster || event.image || undefined } : {}),
  }));
  return JSON.parse(JSON.stringify({
    slug: event.slug, title: event.title, summary: event.summary,
    description: event.description, city: event.city, citySlug: event.citySlug,
    tags: event.tags, image: event.image, media, slogan: event.slogan,
    extraInfo: event.extraInfo, relatedRouteSlugs: event.relatedRouteSlugs,
    status: event.status === 'draft' ? 'upcoming' : event.status,
    eventDate: event.date, eventEndDate: event.endDate,
  })) as EventSnapshot;
}
