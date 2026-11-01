import { api } from './api';
import type { MatchDetailResponse, MatchesResponse, MatchFilters } from '../types';

export const matchingService = {
  async getMatches(filters: MatchFilters = {}, signal?: AbortSignal): Promise<MatchesResponse> {
    const params: Record<string, string | number> = {};
    if (filters.city) params.city = filters.city;
    if (filters.minScore !== undefined && filters.minScore > 0) params.minScore = filters.minScore;
    if (filters.accommodationType && filters.accommodationType !== 'all') params.accommodationType = filters.accommodationType;
    if (filters.minBudget !== undefined && filters.minBudget > 0) params.minBudget = filters.minBudget;
    if (filters.maxBudget !== undefined && filters.maxBudget > 0) params.maxBudget = filters.maxBudget;
    if (filters.page) params.page = filters.page;
    if (filters.limit) params.limit = filters.limit;

    const response = await api.get<MatchesResponse>('/matches', { params, signal });
    return response.data;
  },

  async getMatchDetails(userId: string, signal?: AbortSignal): Promise<MatchDetailResponse> {
    const response = await api.get<MatchDetailResponse>(`/matches/${userId}`, { signal });
    return response.data;
  },
};

