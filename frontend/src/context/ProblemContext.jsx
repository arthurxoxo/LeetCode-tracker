import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const ProblemContext = createContext(null);

export function ProblemProvider({ children }) {
  const { user, authFetch, updateUser } = useAuth();
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);

  const fetchProblems = async () => {
    if (!user) {
      setProblems([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch('/problems');
      if (res.ok) {
        const data = await res.json();
        setProblems(data);
        // Backup to local storage for user resilience
        localStorage.setItem(`problems_${user.id}`, JSON.stringify(data));
      } else {
        setError('Failed to fetch problems from server.');
      }
    } catch (err) {
      console.error('Error fetching problems:', err);
      setError('Server offline. Loading local cache.');
      // Attempt local storage fallback
      const cached = localStorage.getItem(`problems_${user.id}`);
      if (cached) {
        setProblems(JSON.parse(cached));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProblems();
  }, [user]);

  const addProblem = async (problemData) => {
    setError(null);
    try {
      const payload = {
        ...problemData,
        tags: problemData.tags
          ? problemData.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
          : [],
      };
      const res = await authFetch('/problems', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const newProblem = await res.json();
        setProblems((prev) => [newProblem, ...prev]);
        return true;
      }
      setError('Failed to save problem.');
      return false;
    } catch (err) {
      console.error(err);
      setError('Connection failed. Problem not saved.');
      return false;
    }
  };

  const updateProblem = async (id, problemData) => {
    setError(null);
    try {
      const payload = {
        ...problemData,
        tags: typeof problemData.tags === 'string'
          ? problemData.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
          : problemData.tags,
      };
      const res = await authFetch(`/problems/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const updated = await res.json();
        setProblems((prev) =>
          prev.map((prob) => (prob._id === id ? updated : prob))
        );
        return true;
      }
      setError('Failed to update problem.');
      return false;
    } catch (err) {
      console.error(err);
      setError('Connection failed. Update aborted.');
      return false;
    }
  };

  const deleteProblem = async (id) => {
    setError(null);
    try {
      const res = await authFetch(`/problems/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setProblems((prev) => prev.filter((prob) => prob._id !== id));
        return true;
      }
      setError('Failed to delete problem.');
      return false;
    } catch (err) {
      console.error(err);
      setError('Connection failed. Delete aborted.');
      return false;
    }
  };

  const syncLeetCode = async () => {
    if (!user || !user.leetcodeUsername) {
      setError('Please configure a LeetCode username first.');
      return { success: false, message: 'Configure a LeetCode username first.' };
    }
    
    setSyncing(true);
    setError(null);
    try {
      const res = await authFetch('/leetcode/sync', {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        // 1. Update user profile statistics and calendar globally
        updateUser(data.user);
        // 2. Fetch fresh problems list (including any auto-imported recent solves)
        await fetchProblems();
        setSyncing(false);
        return { success: true, message: data.message };
      } else {
        setError(data.message || 'Synchronization failed.');
        setSyncing(false);
        return { success: false, message: data.message || 'Sync failed' };
      }
    } catch (err) {
      console.error(err);
      setError('Connection to sync endpoint failed.');
      setSyncing(false);
      return { success: false, message: 'Server offline' };
    }
  };

  return (
    <ProblemContext.Provider
      value={{
        problems,
        loading,
        syncing,
        error,
        fetchProblems,
        addProblem,
        updateProblem,
        deleteProblem,
        syncLeetCode,
      }}
    >
      {children}
    </ProblemContext.Provider>
  );
}

export function useProblems() {
  const context = useContext(ProblemContext);
  if (!context) {
    throw new Error('useProblems must be used within a ProblemProvider');
  }
  return context;
}
