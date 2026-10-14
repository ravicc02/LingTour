// ============================================
// 活动管理 API
// ============================================
import api from './index'
import type { ApiResponse, PaginatedResponse, PageParams } from '@/types/common'
import type { Event, EventFormData, EventStatus } from '@/types/event'

import type { MediaAsset } from '@/types/media'

export type CalendarEventForm = EventFormData & {
  media: MediaAsset[]; slogan: string; extraInfo: string; displayOrder: number
}
export type EventPublication = {
  id: string; eventId: string; version: number; startDate: string; endDate: string;
  publishedAt: string; publishedBy: string; stopFrom: string | null; withdrawnAt: string | null;
  displayOrder: number; snapshot: Record<string, unknown>
}
export type PublicationAction = {
  id: string; publicationId: string; actorId: string; action: string; reason: string; createdAt: string
}

function toEventPayload(data: Partial<CalendarEventForm>) {
  const { adcode: _adcode, endDate, ...payload } = data
  return { ...payload, ...('endDate' in data ? { endDate: endDate || null } : {}) }
}

export const eventsApi = {
  getEvents(params: PageParams & { status?: string; city?: string; startDate?: string; endDate?: string }) {
    const { pageSize, keyword, ...filters } = params
    return api.get<ApiResponse<PaginatedResponse<Event>>>('/events', {
      params: {
        ...filters,
        limit: pageSize,
        ...(keyword ? { q: keyword } : {}),
      },
    })
  },

  getEvent(id: string) {
    return api.get<ApiResponse<Event>>(`/events/${id}`)
  },

  createEvent(data: EventFormData | CalendarEventForm) {
    return api.post<ApiResponse<Event>>('/events', toEventPayload(data))
  },

  updateEvent(id: string, data: Partial<CalendarEventForm>) {
    return api.put<ApiResponse<Event>>(`/events/${id}`, toEventPayload(data))
  },

  getPublications(id: string) {
    return api.get<ApiResponse<{ publications: EventPublication[]; actions: PublicationAction[] }>>(`/events/${id}/publications`)
  },

  publish(id: string, data: { startDate: string; endDate: string; reason?: string }) {
    return api.post<ApiResponse<EventPublication>>(`/events/${id}/publications`, data)
  },

  stopFuture(id: string, publicationId: string, reason: string) {
    return api.post<ApiResponse<EventPublication>>(`/events/${id}/publications/${publicationId}/stop-future`, { reason })
  },

  withdrawHistory(id: string, publicationId: string, reason: string) {
    return api.post<ApiResponse<EventPublication>>(`/events/${id}/publications/${publicationId}/withdraw`, { reason })
  },

  deleteEvent(id: string) {
    return api.delete<ApiResponse<null>>(`/events/${id}`)
  },

  updateStatus(id: string, status: EventStatus) {
    return api.patch<ApiResponse<Event>>(`/events/${id}/status`, { status })
  },
}
