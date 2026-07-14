import React, { useState, useMemo } from 'react';
import { useProblems } from '../context/ProblemContext';

const defaultForm = { title: '', difficulty: 'Easy', status: 'Solved', tags: '', notes: '' };

export default function Tracker() {
  const { problems, addProblem, updateProblem, deleteProblem, error } = useProblems();
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortOrder, setSortOrder] = useState('newest'); // newest, oldest, diff-desc, diff-asc

  // Interactive notes expansion state
  const [expandedId, setExpandedId] = useState(null);
  // Deletion danger-check
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Difficulty ordering value helper for sorting
  const getDiffValue = (diff) => {
    if (diff === 'Easy') return 1;
    if (diff === 'Medium') return 2;
    return 3;
  };

  const handleEditClick = (problem) => {
    setEditingId(problem._id);
    setForm({
      title: problem.title || '',
      difficulty: problem.difficulty || 'Easy',
      status: problem.status || 'Solved',
      tags: problem.tags?.join(', ') || '',
      notes: problem.notes || '',
    });
    // Scroll to form on mobile
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm(defaultForm);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    setIsSubmitting(true);
    let success = false;
    if (editingId) {
      success = await updateProblem(editingId, form);
    } else {
      success = await addProblem(form);
    }
    setIsSubmitting(false);

    if (success) {
      setForm(defaultForm);
      setEditingId(null);
    }
  };

  const handleDeleteClick = (id) => {
    if (deleteConfirmId === id) {
      deleteProblem(id);
      setDeleteConfirmId(null);
    } else {
      setDeleteConfirmId(id);
      // Automatically reset confirmation after 3 seconds
      setTimeout(() => {
        setDeleteConfirmId((prev) => (prev === id ? null : prev));
      }, 3000);
    }
  };

  // Filtered & Sorted problems
  const filteredProblems = useMemo(() => {
    return problems
      .filter((p) => {
        const matchesSearch =
          p.title?.toLowerCase().includes(search.toLowerCase()) ||
          p.notes?.toLowerCase().includes(search.toLowerCase()) ||
          p.tags?.some((t) => t.toLowerCase().includes(search.toLowerCase()));
        
        const matchesDiff = difficultyFilter === 'All' || p.difficulty === difficultyFilter;
        const matchesStatus = statusFilter === 'All' || p.status === statusFilter;

        return matchesSearch && matchesDiff && matchesStatus;
      })
      .sort((a, b) => {
        if (sortOrder === 'newest') {
          return new Date(b.date || 0) - new Date(a.date || 0);
        }
        if (sortOrder === 'oldest') {
          return new Date(a.date || 0) - new Date(b.date || 0);
        }
        if (sortOrder === 'diff-desc') {
          return getDiffValue(b.difficulty) - getDiffValue(a.difficulty);
        }
        if (sortOrder === 'diff-asc') {
          return getDiffValue(a.difficulty) - getDiffValue(b.difficulty);
        }
        return 0;
      });
  }, [problems, search, difficultyFilter, statusFilter, sortOrder]);

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="tracker-container">
      <div className="tracker-layout">
        
        {/* Form Card for Log / Edit */}
        <aside className="tracker-sidebar">
          <div className="card form-card">
            <h3>{editingId ? 'Modify Record' : 'Log Solved Problem'}</h3>
            <p className="card-description">
              {editingId ? 'Modify the attributes or revision notes of this problem.' : 'Add your latest submission metrics here.'}
            </p>

            <form onSubmit={handleSubmit} className="problem-form">
              <div className="form-group">
                <label htmlFor="title-input">Problem Title</label>
                <input
                  id="title-input"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. 1. Two Sum"
                  required
                />
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label htmlFor="difficulty-input">Difficulty</label>
                  <select
                    id="difficulty-input"
                    value={form.difficulty}
                    onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                  >
                    <option>Easy</option>
                    <option>Medium</option>
                    <option>Hard</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="status-input">Status</label>
                  <select
                    id="status-input"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                  >
                    <option>Solved</option>
                    <option>Review</option>
                    <option>Attempted</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="tags-input">Tags / Topics</label>
                <input
                  id="tags-input"
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  placeholder="Array, Hash Table, Two Pointers"
                />
                <span className="input-hint">Comma separated values.</span>
              </div>

              <div className="form-group">
                <label htmlFor="notes-input">Notes & Strategy</label>
                <textarea
                  id="notes-input"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Write details about complexity, edge cases or approach..."
                  rows="5"
                />
              </div>

              {error && <p className="form-error-msg">{error}</p>}

              <div className="form-actions">
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : editingId ? 'Update Problem' : 'Save Problem'}
                </button>
                {editingId && (
                  <button type="button" className="btn-secondary" onClick={handleCancelEdit}>
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        </aside>

        {/* List Card for Search / Browse */}
        <section className="tracker-main">
          {/* Search, Filter and Sort Toolbar */}
          <div className="card toolbar-card">
            <div className="search-bar-wrapper">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" className="search-icon">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search problems by title, note details, or tags..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            <div className="filters-row">
              <div className="filter-group">
                <label htmlFor="filter-difficulty">Difficulty</label>
                <select
                  id="filter-difficulty"
                  value={difficultyFilter}
                  onChange={(e) => setDifficultyFilter(e.target.value)}
                >
                  <option value="All">All</option>
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              </div>

              <div className="filter-group">
                <label htmlFor="filter-status">Status</label>
                <select
                  id="filter-status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="All">All</option>
                  <option value="Solved">Solved</option>
                  <option value="Review">Review</option>
                  <option value="Attempted">Attempted</option>
                </select>
              </div>

              <div className="filter-group">
                <label htmlFor="filter-sort">Sort By</label>
                <select
                  id="filter-sort"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="diff-desc">Difficulty: Hard to Easy</option>
                  <option value="diff-asc">Difficulty: Easy to Hard</option>
                </select>
              </div>
            </div>
          </div>

          {/* List display */}
          <div className="problems-list-container">
            {filteredProblems.length === 0 ? (
              <div className="card empty-problems-card">
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                <h4>No problems found</h4>
                <p>Adjust your search query or filters to find logged problems, or create a new entry.</p>
              </div>
            ) : (
              filteredProblems.map((prob) => {
                const isExpanded = expandedId === prob._id;
                const isConfirmingDelete = deleteConfirmId === prob._id;
                
                return (
                  <article key={prob._id} className={`card problem-card-item ${prob.difficulty.toLowerCase()}`}>
                    <div className="problem-card-header" onClick={() => toggleExpand(prob._id)}>
                      <div className="problem-title-section">
                        <span className={`difficulty-indicator-dot ${prob.difficulty.toLowerCase()}`}></span>
                        <h4>{prob.title}</h4>
                      </div>
                      
                      <div className="problem-meta-pills">
                        <span className={`difficulty-badge ${prob.difficulty.toLowerCase()}`}>
                          {prob.difficulty}
                        </span>
                        <span className={`status-badge ${prob.status.toLowerCase()}`}>
                          {prob.status}
                        </span>
                        
                        <svg className={`expand-arrow ${isExpanded ? 'active' : ''}`} viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </div>
                    </div>

                    <div className="problem-card-brief">
                      <div className="problem-tags-row">
                        {prob.tags && prob.tags.map((tag) => (
                          <span key={tag} className="tag-pill">#{tag}</span>
                        ))}
                      </div>
                      <span className="problem-date-label">
                        {prob.date
                          ? new Date(prob.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : 'No Date'}
                      </span>
                    </div>

                    {isExpanded && (
                      <div className="problem-card-details">
                        <div className="problem-notes-box">
                          <h5>Revision Strategy & Notes:</h5>
                          {prob.notes ? (
                            <p className="notes-text">{prob.notes}</p>
                          ) : (
                            <p className="notes-text empty">No notes provided for this problem.</p>
                          )}
                        </div>
                        
                        <div className="problem-card-actions">
                          <button
                            type="button"
                            className="btn-action-edit"
                            onClick={() => handleEditClick(prob)}
                          >
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                            </svg>
                            Edit
                          </button>
                          
                          <button
                            type="button"
                            className={`btn-action-delete ${isConfirmingDelete ? 'confirming' : ''}`}
                            onClick={() => handleDeleteClick(prob._id)}
                          >
                            {isConfirmingDelete ? (
                              <>
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" />
                                </svg>
                                Confirm Delete
                              </>
                            ) : (
                              <>
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
                                </svg>
                                Delete
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
