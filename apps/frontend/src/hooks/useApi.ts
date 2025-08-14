import { useState, useEffect, useCallback } from 'react';
import apiService from '../services/api';

export const useModels = () => {
  const [models, setModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchModels = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getModels();
      setModels(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch models');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  return { models, loading, error, refetch: fetchModels };
};

export const useLiveRequests = (autoRefresh: boolean = true) => {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLiveRequests = useCallback(async () => {
    try {
      setError(null);
      const data = await apiService.getLiveRequests();
      setRequests(prev => {
        // Create a Map to track unique requests by ID
        const existingIds = new Set(prev.map((req: any) => req.id));
        
        // Only add new requests that don't already exist
        const newRequests = data.filter((req: any) => !existingIds.has(req.id));
        
        // Prepend new requests and keep last 100
        return [...newRequests, ...prev].slice(0, 100);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch live requests');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLiveRequests();
  }, [fetchLiveRequests]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchLiveRequests();
    }, 2000); // Refresh every 2 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, fetchLiveRequests]);

  return { requests, loading, error, refetch: fetchLiveRequests };
};

export const useDashboardStats = (autoRefresh: boolean = true) => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getDashboardStats();
      setStats(data);
    } catch (err) {
      console.error('Dashboard stats error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboard stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchStats();
    }, 5000); // Refresh every 5 seconds for dashboard stats

    return () => clearInterval(interval);
  }, [autoRefresh, fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
};