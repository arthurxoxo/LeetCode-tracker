import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProblems } from '../context/ProblemContext';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user, updateProfile } = useAuth();
  const { problems, loading, syncing, syncLeetCode } = useProblems();
  const navigate = useNavigate();

  // Connection form state
  const [usernameInput, setUsernameInput] = useState(user?.leetcodeUsername || '');
  const [syncStatus, setSyncStatus] = useState('');
  const [syncError, setSyncError] = useState('');

  // Get current time-based greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  // Compute local statistics
  const localStats = useMemo(() => {
    const total = problems.length;
    const solved = problems.filter((p) => p.status === 'Solved').length;
    const review = problems.filter((p) => p.status === 'Review').length;
    const attempted = problems.filter((p) => p.status === 'Attempted').length;

    const easy = problems.filter((p) => p.difficulty === 'Easy').length;
    const easySolved = problems.filter((p) => p.difficulty === 'Easy' && p.status === 'Solved').length;
    
    const medium = problems.filter((p) => p.difficulty === 'Medium').length;
    const mediumSolved = problems.filter((p) => p.difficulty === 'Medium' && p.status === 'Solved').length;

    const hard = problems.filter((p) => p.difficulty === 'Hard').length;
    const hardSolved = problems.filter((p) => p.difficulty === 'Hard' && p.status === 'Solved').length;

    return {
      total,
      solved,
      review,
      attempted,
      easy: { total: easy, solved: easySolved },
      medium: { total: medium, solved: mediumSolved },
      hard: { total: hard, solved: hardSolved },
    };
  }, [problems]);

  // Combined stats (merge LeetCode stats if connected, otherwise use local)
  const stats = useMemo(() => {
    const hasLeetcode = user?.leetcodeStats && user.leetcodeStats.solvedAll > 0;
    
    if (hasLeetcode) {
      const ls = user.leetcodeStats;
      const totalSolved = ls.solvedAll;
      return {
        total: localStats.total,
        solved: totalSolved,
        review: localStats.review,
        attempted: localStats.attempted,
        easy: {
          solved: ls.solvedEasy,
          pct: totalSolved > 0 ? Math.round((ls.solvedEasy / totalSolved) * 100) : 0
        },
        medium: {
          solved: ls.solvedMedium,
          pct: totalSolved > 0 ? Math.round((ls.solvedMedium / totalSolved) * 100) : 0
        },
        hard: {
          solved: ls.solvedHard,
          pct: totalSolved > 0 ? Math.round((ls.solvedHard / totalSolved) * 100) : 0
        }
      };
    } else {
      const totalSolved = localStats.solved;
      return {
        total: localStats.total,
        solved: totalSolved,
        review: localStats.review,
        attempted: localStats.attempted,
        easy: {
          solved: localStats.easy.solved,
          pct: totalSolved > 0 ? Math.round((localStats.easy.solved / totalSolved) * 100) : 0
        },
        medium: {
          solved: localStats.medium.solved,
          pct: totalSolved > 0 ? Math.round((localStats.medium.solved / totalSolved) * 100) : 0
        },
        hard: {
          solved: localStats.hard.solved,
          pct: totalSolved > 0 ? Math.round((localStats.hard.solved / totalSolved) * 100) : 0
        }
      };
    }
  }, [localStats, user]);

  // Helper: "YYYY-MM-DD" in LOCAL timezone (avoids UTC off-by-one for IST)
  const toLocalKey = (date) => {
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Calculate Streaks — always compute from real data (LeetCode calendar + local problems)
  const streakInfo = useMemo(() => {
    const activeDatesSet = new Set();

    // 1. Collect dates from LeetCode submissionCalendar (if available)
    if (user?.leetcodeCalendar && user.leetcodeCalendar !== '{}') {
      try {
        const calendar = JSON.parse(user.leetcodeCalendar);
        Object.entries(calendar).forEach(([timestamp, count]) => {
          if (count > 0) {
            activeDatesSet.add(toLocalKey(new Date(parseInt(timestamp) * 1000)));
          }
        });
      } catch (err) {
        console.error('Error parsing leetcode calendar for streak:', err);
      }
    }

    // 2. Collect dates from locally solved problems
    problems
      .filter((p) => p.status === 'Solved' && p.date)
      .forEach((p) => activeDatesSet.add(toLocalKey(p.date)));

    const uniqueDates = [...activeDatesSet];
    const hasLeetcode = user?.leetcodeStats && user.leetcodeStats.solvedAll > 0;

    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    const todayStr = toLocalKey(new Date());
    const yesterdayD = new Date();
    yesterdayD.setDate(yesterdayD.getDate() - 1);
    const yesterdayStr = toLocalKey(yesterdayD);

    // Calculate Current Streak (walk backwards from today or yesterday)
    if (uniqueDates.includes(todayStr) || uniqueDates.includes(yesterdayStr)) {
      const checkDate = new Date();
      checkDate.setHours(0, 0, 0, 0);
      // If nothing today but solved yesterday, start from yesterday
      if (!uniqueDates.includes(todayStr) && uniqueDates.includes(yesterdayStr)) {
        checkDate.setDate(checkDate.getDate() - 1);
      }
      while (true) {
        const dateKey = toLocalKey(checkDate);
        if (uniqueDates.includes(dateKey)) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    // Calculate Longest Streak
    if (uniqueDates.length > 0) {
      let prevDate = null;
      const sortedAsc = [...uniqueDates].sort((a, b) => new Date(a) - new Date(b));
      for (const dateStr of sortedAsc) {
        const currentDate = new Date(dateStr);
        if (prevDate === null) {
          tempStreak = 1;
        } else {
          const diffDays = Math.round((currentDate - prevDate) / (1000 * 60 * 60 * 24));
          if (diffDays === 1) {
            tempStreak++;
          } else if (diffDays > 1) {
            longestStreak = Math.max(longestStreak, tempStreak);
            tempStreak = 1;
          }
        }
        prevDate = currentDate;
      }
      longestStreak = Math.max(longestStreak, tempStreak);
    }

    return { current: currentStreak, longest: longestStreak, isLeetcode: hasLeetcode };
  }, [problems, user]);

  // Generate last 7 days visual data — all dates in LOCAL timezone
  const last7Days = useMemo(() => {
    const days = [];
    const solvedDates = new Set();

    // If Leetcode calendar is available, merge it using LOCAL date keys
    if (user?.leetcodeCalendar && user.leetcodeCalendar !== '{}') {
      try {
        const calendar = JSON.parse(user.leetcodeCalendar);
        Object.entries(calendar).forEach(([timestamp, count]) => {
          if (count > 0) {
            solvedDates.add(toLocalKey(new Date(parseInt(timestamp) * 1000)));
          }
        });
      } catch (err) {
        console.error('Error parsing leetcode calendar:', err);
      }
    }

    // Also merge local problems using LOCAL date keys
    problems
      .filter((p) => p.status === 'Solved' && p.date)
      .forEach((p) => solvedDates.add(toLocalKey(p.date)));

    const todayKey = toLocalKey(new Date());

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = toLocalKey(d);
      days.push({
        name: d.toLocaleDateString('en-US', { weekday: 'narrow' }),
        date: dateKey,
        isToday: dateKey === todayKey,
        solved: solvedDates.has(dateKey),
      });
    }
    return days;
  }, [problems, user]);

  // Gamified Achievements
  const achievements = useMemo(() => {
    const tagsCount = new Set(problems.flatMap((p) => p.tags || [])).size;
    return [
      {
        id: 'first_solve',
        title: 'First Step',
        desc: 'Solve your first problem.',
        unlocked: stats.solved >= 1,
        progress: `${Math.min(stats.solved, 1)}/1`,
      },
      {
        id: 'consistency',
        title: 'Consistency',
        desc: 'Reach a 3-day active streak.',
        unlocked: streakInfo.current >= 3 || streakInfo.longest >= 3,
        progress: `${Math.min(Math.max(streakInfo.current, streakInfo.longest), 3)}/3`,
      },
      {
        id: 'power_solver',
        title: 'Power Solver',
        desc: 'Solve 10 Leetcode problems.',
        unlocked: stats.solved >= 10,
        progress: `${Math.min(stats.solved, 10)}/10`,
      },
      {
        id: 'grandmaster',
        title: 'Algorithmic Master',
        desc: 'Solve 25 Leetcode problems.',
        unlocked: stats.solved >= 25,
        progress: `${Math.min(stats.solved, 25)}/25`,
      },
      {
        id: 'polyglot',
        title: 'Diverse Solver',
        desc: 'Solve problems across 5+ topics.',
        unlocked: tagsCount >= 5,
        progress: `${Math.min(tagsCount, 5)}/5`,
      },
    ];
  }, [stats.solved, streakInfo, problems]);

  // Get urgent review problems (max 4)
  const urgentReviews = useMemo(() => {
    return problems
      .filter((p) => p.status === 'Review')
      .slice(0, 4);
  }, [problems]);

  // Profile link submission
  const handleLinkProfile = async (e) => {
    e.preventDefault();
    if (!usernameInput.trim()) return;

    setSyncStatus('Linking account...');
    setSyncError('');
    
    const success = await updateProfile(usernameInput.trim());
    if (success) {
      setSyncStatus('Account linked! Syncing LeetCode statistics...');
      // Immediately trigger synchronization
      const res = await syncLeetCode();
      if (res.success) {
        setSyncStatus('LeetCode account linked and synced successfully!');
      } else {
        setSyncStatus('');
        setSyncError(res.message || 'Linked successfully, but failed to sync.');
      }
    } else {
      setSyncStatus('');
      setSyncError('Failed to save profile changes.');
    }
  };

  // Manual synchronization
  const handleSyncNow = async () => {
    setSyncStatus('Syncing with LeetCode API...');
    setSyncError('');
    const res = await syncLeetCode();
    if (res.success) {
      setSyncStatus(res.message);
      // clear status after 4 seconds
      setTimeout(() => setSyncStatus(''), 4000);
    } else {
      setSyncStatus('');
      setSyncError(res.message);
    }
  };

  // Circular progress stroke offset helper
  const getCircleStrokeOffset = (pct, radius = 30) => {
    const circumference = 2 * Math.PI * radius;
    return circumference - (pct / 100) * circumference;
  };

  if (loading && problems.length === 0) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Analyzing metrics...</p>
      </div>
    );
  }

  const isConnected = user?.leetcodeUsername && user?.leetcodeStats?.solvedAll > 0;

  return (
    <div className="dashboard-container">
      
      {/* Welcome Banner */}
      <section className="welcome-banner card">
        <div className="welcome-content">
          <p className="banner-date">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h1>{greeting}, {user?.name}!</h1>
          <p>
            {isConnected
              ? `Your LeetCode profile "${user.leetcodeUsername}" is synced. Conquered ${stats.solved} problems!`
              : "Ready to start tracking? Link your LeetCode profile to auto-sync your submission statistics!"}
          </p>
        </div>
        <div className="welcome-cta">
          <button className="btn-primary" onClick={() => navigate('/tracker')}>
            + Log Problem
          </button>
        </div>
      </section>

      {/* Leetcode Integration Settings Banner */}
      <section className="card sync-control-card">
        <div className="sync-control-header">
          <div className="sync-connection-info">
            <div className="leetcode-icon-badge">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                <path d="M13.483 0a1.374 1.374 0 0 0-.961.414l-9.777 9.778a1.375 1.375 0 0 0 0 1.943l1.03 1.032a1.37 1.37 0 0 0 1.933 0L15.34 3.52a1.376 1.376 0 0 0 0-1.943L14.428.414A1.375 1.375 0 0 0 13.483 0zm.456 6.03a1.377 1.377 0 0 0-.96.414L3.13 16.292a1.378 1.378 0 0 0 0 1.944l1.017 1.016a1.376 1.376 0 0 0 1.943 0l9.847-9.847a1.375 1.375 0 0 0 0-1.943l-1.029-1.03a1.37 1.37 0 0 0-.97-.403zM18.06 9.14a1.375 1.375 0 0 0-.947.403L14.7 11.96a1.377 1.377 0 0 0 0 1.943l1.03 1.03a1.375 1.375 0 0 0 1.942 0l2.413-2.412a1.377 1.377 0 0 0 0-1.943l-1.03-1.03a1.37 1.37 0 0 0-.995-.407zM22.5 13.562a1.376 1.376 0 0 0-.947.416l-3.37 3.37a1.376 1.376 0 0 0 0 1.942l1.03 1.03a1.376 1.376 0 0 0 1.942 0l3.37-3.37a1.377 1.377 0 0 0 0-1.942l-1.03-1.03a1.372 1.372 0 0 0-.995-.416z" />
              </svg>
            </div>
            <div>
              <h3>LeetCode Connection Settings</h3>
              <p className="card-description">
                {user?.leetcodeUsername 
                  ? `Connected to profile "${user.leetcodeUsername}". Sync to import recent submits.` 
                  : "Connect with your LeetCode username to automatically populate your metrics."}
              </p>
            </div>
          </div>
          
          <form onSubmit={handleLinkProfile} className="sync-setup-form">
            <input
              type="text"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              placeholder="LeetCode Username"
              required
            />
            <button type="submit" className="btn-secondary" disabled={syncing}>
              Link Account
            </button>
          </form>
        </div>

        {user?.leetcodeUsername && (
          <div className="sync-action-bar">
            <button className="btn-primary" onClick={handleSyncNow} disabled={syncing}>
              {syncing ? (
                <>
                  <span className="spinner"></span>
                  Synchronizing...
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                  </svg>
                  Sync LeetCode Account
                </>
              )}
            </button>
            <span className="sync-source-label">
              Last synced: {user?.leetcodeStats?.solvedAll > 0 ? 'Recently Solved Synced' : 'Never'}
            </span>
          </div>
        )}

        {syncStatus && <p className="sync-status-msg success">{syncStatus}</p>}
        {syncError && <p className="sync-status-msg error">{syncError}</p>}
      </section>

      {/* Grid of Key Statistics */}
      <section className="stats-row">
        <div className="card stat-card total">
          <div className="stat-icon-wrapper">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-label">Local Workspace Logs</span>
            <strong className="stat-value">{stats.total}</strong>
          </div>
        </div>
        
        <div className="card stat-card solved">
          <div className="stat-icon-wrapper">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-label">LeetCode Solved</span>
            <strong className="stat-value">{stats.solved}</strong>
          </div>
        </div>

        <div className="card stat-card review">
          <div className="stat-icon-wrapper">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-label font-amber">Review Queue</span>
            <strong className="stat-value font-amber">{stats.review}</strong>
          </div>
        </div>

        <div className="card stat-card streak">
          <div className="stat-icon-wrapper">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3z" />
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-label font-orange">
              {streakInfo.isLeetcode ? 'LeetCode Streak' : 'Local Streak'}
            </span>
            <strong className="stat-value font-orange">
              {streakInfo.current} {streakInfo.current === 1 ? 'Day' : 'Days'}
            </strong>
          </div>
        </div>
      </section>

      {/* Row with Streak Details & Difficulty Breakdown */}
      <section className="dashboard-grid">
        {/* Streak Details Card */}
        <div className="card streak-card">
          <div className="card-header">
            <h3>Consistency Map</h3>
            <span className="streak-longest-badge">
              {streakInfo.isLeetcode ? 'Leetcode Cal' : `Longest: ${streakInfo.longest}d`}
            </span>
          </div>
          <p className="card-description">Solve at least one problem daily to sustain your momentum.</p>
          
          <div className="streak-days-row">
            {last7Days.map((day) => (
              <div key={day.date} className={`streak-day-cell ${day.solved ? 'completed' : ''} ${day.isToday ? 'today' : ''}`}>
                <span className="streak-day-name">{day.name}</span>
                <div className="streak-indicator">
                  {day.solved ? (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                      <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />
                    </svg>
                  ) : (
                    <span className="dot"></span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Difficulty breakdown radial bars */}
        <div className="card difficulty-breakdown-card">
          <h3>Difficulty Breakdown</h3>
          <p className="card-description">Ratio of solved problems grouped by Leetcode difficulty.</p>
          
          <div className="difficulty-radial-container">
            {/* Easy Circle */}
            <div className="difficulty-meter easy">
              <div className="svg-ring-wrapper">
                <svg width="80" height="80" viewBox="0 0 80 80">
                  <circle className="ring-bg" cx="40" cy="40" r="30" strokeWidth="6" />
                  <circle
                    className="ring-progress"
                    cx="40"
                    cy="40"
                    r="30"
                    strokeWidth="6"
                    strokeDasharray={2 * Math.PI * 30}
                    strokeDashoffset={getCircleStrokeOffset(stats.easy.pct)}
                    transform="rotate(-90 40 40)"
                  />
                </svg>
                <div className="ring-percentage-label">{stats.easy.pct}%</div>
              </div>
              <div className="meter-info">
                <span className="meter-title text-easy">Easy</span>
                <span className="meter-count">{stats.easy.solved}</span>
              </div>
            </div>

            {/* Medium Circle */}
            <div className="difficulty-meter medium">
              <div className="svg-ring-wrapper">
                <svg width="80" height="80" viewBox="0 0 80 80">
                  <circle className="ring-bg" cx="40" cy="40" r="30" strokeWidth="6" />
                  <circle
                    className="ring-progress"
                    cx="40"
                    cy="40"
                    r="30"
                    strokeWidth="6"
                    strokeDasharray={2 * Math.PI * 30}
                    strokeDashoffset={getCircleStrokeOffset(stats.medium.pct)}
                    transform="rotate(-90 40 40)"
                  />
                </svg>
                <div className="ring-percentage-label">{stats.medium.pct}%</div>
              </div>
              <div className="meter-info">
                <span className="meter-title text-medium">Medium</span>
                <span className="meter-count">{stats.medium.solved}</span>
              </div>
            </div>

            {/* Hard Circle */}
            <div className="difficulty-meter hard">
              <div className="svg-ring-wrapper">
                <svg width="80" height="80" viewBox="0 0 80 80">
                  <circle className="ring-bg" cx="40" cy="40" r="30" strokeWidth="6" />
                  <circle
                    className="ring-progress"
                    cx="40"
                    cy="40"
                    r="30"
                    strokeWidth="6"
                    strokeDasharray={2 * Math.PI * 30}
                    strokeDashoffset={getCircleStrokeOffset(stats.hard.pct)}
                    transform="rotate(-90 40 40)"
                  />
                </svg>
                <div className="ring-percentage-label">{stats.hard.pct}%</div>
              </div>
              <div className="meter-info">
                <span className="meter-title text-hard">Hard</span>
                <span className="meter-count">{stats.hard.solved}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Row for Achievements and Reviews */}
      <section className="dashboard-grid">
        {/* Achievements list */}
        <div className="card achievements-card">
          <h3>Achievements</h3>
          <p className="card-description">Earn badges by hitting milestones and tracking consistency.</p>
          <div className="achievements-list-grid">
            {achievements.map((a) => (
              <div key={a.id} className={`achievement-badge-card ${a.unlocked ? 'unlocked' : 'locked'}`}>
                <div className="achievement-icon">
                  {a.unlocked ? (
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  )}
                </div>
                <div className="achievement-details">
                  <h4>{a.title}</h4>
                  <p>{a.desc}</p>
                  <span className="achievement-progress-label">{a.progress} completed</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Review list */}
        <div className="card urgent-reviews-card">
          <h3>Focus Checkup</h3>
          <p className="card-description">Problems flagged for revision. Re-verify notes before resolving.</p>
          {urgentReviews.length === 0 ? (
            <div className="empty-reviews-state">
              <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 12.5l3 3 5-6" />
              </svg>
              <p>Hooray! No pending problems in your review queue.</p>
            </div>
          ) : (
            <div className="reviews-list">
              {urgentReviews.map((prob) => (
                <div key={prob._id} className="review-item-row" onClick={() => navigate('/tracker')}>
                  <div className="review-info">
                    <span className="review-title">{prob.title}</span>
                    <div className="review-meta">
                      <span className={`difficulty-pill ${prob.difficulty.toLowerCase()}`}>
                        {prob.difficulty}
                      </span>
                      {prob.tags && prob.tags.slice(0, 2).map((t) => (
                        <span key={t} className="tag-pill-micro">{t}</span>
                      ))}
                    </div>
                  </div>
                  <div className="review-arrow">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
