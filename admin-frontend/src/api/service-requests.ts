import api from './index'
import type { ApiResponse } from '@/types/common'

export type ServiceType = 'free_route' | 'custom_route' | 'interpretation'
export type ProcessStatus = 'received' | 'assigned' | 'in_progress' | 'quoted' | 'confirmed' | 'completed' | 'cancelled'
export interface RequestQuote { id: string; revision: number; amountCents: number; currency: 'USD'; scope: string; status: 'offered' | 'accepted' | 'superseded'; createdAt: string; acceptedAt: string | null }
export interface RequestMessage { id: string; body: string; senderType: 'owner' | 'staff'; createdAt: string }
export interface ServiceRequest {
  id: string; serviceType: ServiceType; citySlug: string; routeId: string | null; linkedRequestId: string | null
  date: string; groupSize: number; name: string; contact: string; preferredInterpreterId: string | null
  assignedPlannerId: string | null; assignedInterpreterId: string | null; assignedInterpreterName: string | null
  requirements: { languagePair?: string; preferences: { days?: number; interests?: string[]; foodPreferences?: string; accommodation?: string; budget?: string; budgetAmount?: string; budgetCurrency?: string; serviceContext?: string; notes?: string } }
  packageSnapshot: { id: string; hours: number; routeType: 'fixed' | 'custom'; currency: 'USD'; amountCents: number; paymentPolicy: 'not_configured'; depositCents: null } | null
  priceSnapshot: { currency: 'USD'; amountCents: number | null; source: string }
  processStatus: ProcessStatus; paymentStatus: 'not_required' | 'quote_required' | 'confirmation_required'
  quote: RequestQuote | null; unreadCount: number; canReadConversation: boolean; checkoutEnabled: false
  createdAt: string; updatedAt: string
  assignmentLog?: Array<{ id: string; assignedBy: string; plannerId: string; previousPlannerId: string | null; interpreterId: string | null; reason: string; createdAt: string }>
}
export const serviceTypeLabels: Record<ServiceType, string> = { free_route: '免费固定路线', custom_route: '定制路线规划', interpretation: '口译服务' }
export const processLabels: Record<ProcessStatus, string> = { received: '已接收', assigned: '已分配', in_progress: '处理中', quoted: '待确认报价', confirmed: '已确认', completed: '已完成', cancelled: '已取消' }
export const usdCents = (value: number | null | undefined) => value == null ? '等待独立规划报价' : `USD ${(value / 100).toFixed(2)}`
export const serviceRequestsApi = {
  list(params: { page: number; size: number; serviceType?: string; processStatus?: string; citySlug?: string; q?: string }) { return api.get<ApiResponse<{ data: ServiceRequest[]; total: number; page: number; size: number }>>('/service-requests', { params: { page: params.page, size: params.size, serviceType: params.serviceType || undefined, processStatus: params.processStatus || undefined, citySlug: params.citySlug || undefined, q: params.q || undefined } }) },
  detail(id: string) { return api.get<ApiResponse<ServiceRequest>>(`/service-requests/${id}`) },
  staff() { return api.get<ApiResponse<{ data: Array<{ id: string; name: string; role: string }> }>>('/service-requests/staff') },
  assign(id: string, payload: { plannerId: string; interpreterId?: string; reason?: string }) { return api.patch<ApiResponse<ServiceRequest>>(`/service-requests/${id}/assignment`, payload) },
  process(id: string, processStatus: ProcessStatus) { return api.patch<ApiResponse<ServiceRequest>>(`/service-requests/${id}/process`, { processStatus }) },
  quote(id: string, payload: { amountCents: number; scope: string; expectedRevision: number }) { return api.post<ApiResponse<ServiceRequest>>(`/service-requests/${id}/quote`, payload) },
  messages(id: string, after?: string) { return api.get<ApiResponse<{ data: RequestMessage[]; unreadCount: number; hasMore: boolean; nextCursor: string | null }>>(`/service-requests/${id}/messages`, { params: { after, size: 50 } }) },
  send(id: string, body: string, key: string) { return api.post<ApiResponse<RequestMessage>>(`/service-requests/${id}/messages`, { body }, { headers: { 'Idempotency-Key': key } }) },
  read(id: string, messageId: string) { return api.put(`/service-requests/${id}/messages/read`, { messageId }) },
}
