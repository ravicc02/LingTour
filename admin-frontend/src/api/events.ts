// ============================================
// 活动管理 API
// ============================================
import api from './index'
import type { ApiResponse, PaginatedResponse, PageParams } from '@/types/common'
import type { Event, EventFormData, EventStatus } from '@/types/event'

function toEventPayload(data: Partial<EventFormData>) {
  const { adcode: _adcode, ...payload } = data
  return payload
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

  createEvent(data: EventFormData) {
    return api.post<ApiResponse<Event>>('/events', toEventPayload(data))
  },

  updateEvent(id: string, data: Partial<EventFormData>) {
    return api.put<ApiResponse<Event>>(`/events/${id}`, toEventPayload(data))
  },

  deleteEvent(id: string) {
    return api.delete<ApiResponse<null>>(`/events/${id}`)
  },

  updateStatus(id: string, status: EventStatus) {
    return api.patch<ApiResponse<Event>>(`/events/${id}/status`, { status })
  },
}
