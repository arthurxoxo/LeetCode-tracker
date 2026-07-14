import React, { useMemo, useState } from 'react';
import { useProblems } from '../context/ProblemContext';
import { useAuth } from '../context/AuthContext';

export default function Analytics() {
  const { user } = useAuth();
  const { problems, loading } = useProblems();
  const [hoveredCell, setHoveredCell] = useState(null);

  // Compute stats breakdown
  const stats = useMemo(() => {
    // If Leetcode is connected, we use LeetCode stats, otherwise local
    const hasLeetcode = user?.leetcodeStats && user.leetcodeStats.solvedAll > 0;
    
    const solvedProblems = problems.filter((p) => p.status === 'Solved');
    
    const totalSolved = hasLeetcode ? user.leetcodeStats.solvedAll : solvedProblems.length;
    const easy = hasLeetcode ? user.leetcodeStats.solvedEasy : solvedProblems.filter((p) => p.difficulty === 'Easy').length;
    const medium = hasLeetcode ? user.leetcodeStats.solvedMedium : solvedProblems.filter((p) => p.difficulty === 'Medium').length;
    const hard = hasLeetcode ? user.leetcodeStats.solvedHard : solvedProblems.filter((p) => p.difficulty === 'Hard').length;

    // Calculate tag frequencies
    const tagMap = {};
    solvedProblems.forEach((p) => {
      if (p.tags) {
        p.tags.forEach((tag) => {
          const t = tag.trim();
          if (t) tagMap[t] = (tagMap[t] || 0) + 1;
        });
      }
    });

    const topTags = Object.entries(tagMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    return { totalSolved, easy, medium, hard, topTags };
  }, [problems, user]);

  // Heatmap generation: 26 weeks (columns) x 7 days (rows) = 182 days
  const heatmapData = useMemo(() => {
    const columns = [];
    const solvedMap = {};

    // 1. Map local solved problems
    problems
      .filter((p) => p.status === 'Solved' && p.date)
      .forEach((p) => {
        const dateKey = p.date.slice(0, 10);
        solvedMap[dateKey] = (solvedMap[dateKey] || 0) + 1;
      });

    // 2. Map LeetCode calendar submissions
    if (user?.leetcodeCalendar && user.leetcodeCalendar !== '{}') {
      try {
        const calendar = JSON.parse(user.leetcodeCalendar);
        Object.entries(calendar).forEach(([timestamp, count]) => {
          if (count > 0) {
            const dateStr = new Date(parseInt(timestamp) * 1000).toISOString().slice(0, 10);
            // Sum local logs and LeetCode logs, or take maximum to avoid duplicate counts of auto-imported items
            solvedMap[dateStr] = Math.max(solvedMap[dateStr] || 0, count);
          }
        });
      } catch (err) {
        console.error('Error parsing leetcode calendar in Analytics heatmap:', err);
      }
    }

    // Start grid 26 weeks ago, aligning with the beginning of that week (Sunday)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 182);
    // Find the Sunday of that week
    const startDay = startDate.getDay();
    startDate.setDate(startDate.getDate() - startDay);

    // Build 26 columns of 7 days each
    for (let c = 0; c < 26; c++) {
      const colDays = [];
      for (let r = 0; r < 7; r++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + (c * 7 + r));
        const key = d.toISOString().slice(0, 10);
        const count = solvedMap[key] || 0;
        
        let level = 0;
        if (count > 0) {
          if (count === 1) level = 1;
          else if (count === 2) level = 2;
          else level = 3;
        }

        colDays.push({
          date: d,
          dateKey: key,
          count,
          level,
        });
      }
      columns.push(colDays);
    }

    return columns;
  }, [problems, user]);

  // Extract month labels for heatmap top row positioning
  const heatmapMonths = useMemo(() => {
    const labels = [];
    let lastMonth = '';

    heatmapData.forEach((col, index) => {
      const firstDayCol = col[0].date;
      const monthName = firstDayCol.toLocaleDateString('en-US', { month: 'short' });
      if (monthName !== lastMonth) {
        labels.push({ label: monthName, index });
        lastMonth = monthName;
      }
    });

    return labels.filter((_, idx) => idx % 2 === 0 || labels.length < 8);
  }, [heatmapData]);

  // SVG Area Chart: Cumulative solved problems over last 12 weeks
  const chartData = useMemo(() => {
    const weeks = [];
    const solvedDates = [];

    // Parse Leetcode calendar solves to populate weekly chart
    if (user?.leetcodeCalendar && user.leetcodeCalendar !== '{}') {
      try {
        const calendar = JSON.parse(user.leetcodeCalendar);
        Object.entries(calendar).forEach(([timestamp, count]) => {
          if (count > 0) {
            const dateObj = new Date(parseInt(timestamp) * 1000);
            for (let c = 0; c < count; c++) {
              solvedDates.push(dateObj);
            }
          }
        });
      } catch (err) {
        console.error('Error parsing calendar for chart:', err);
      }
    }

    // Parse local solves
    problems
      .filter((p) => p.status === 'Solved' && p.date)
      .forEach((p) => solvedDates.push(new Date(p.date)));

    // Generate intervals for last 12 weeks
    for (let i = 11; i >= 0; i--) {
      const boundaryDate = new Date();
      boundaryDate.setDate(boundaryDate.getDate() - i * 7);
      
      // Count problems solved UP TO this boundary date
      // Deduplicate by title slug or count unique occurrences to approximate curves
      const cumulativeCount = solvedDates.filter((date) => date <= boundaryDate).length;
      
      weeks.push({
        label: `Wk ${12 - i}`,
        val: cumulativeCount,
      });
    }

    // Map to coordinates inside a viewbox of 500x200
    const paddingLeft = 40;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 30;
    const chartWidth = 500;
    const chartHeight = 200;

    const graphWidth = chartWidth - paddingLeft - paddingRight;
    const graphHeight = chartHeight - paddingTop - paddingBottom;

    const maxVal = Math.max(...weeks.map((w) => w.val), 5);

    const points = weeks.map((w, index) => {
      const x = paddingLeft + (index / (weeks.length - 1)) * graphWidth;
      const y = paddingTop + graphHeight - (w.val / maxVal) * graphHeight;
      return { ...w, x, y };
    });

    let pathD = '';
    let areaD = '';

    if (points.length > 0) {
      pathD = `M ${points[0].x} ${points[0].y} `;
      for (let i = 1; i < points.length; i++) {
        pathD += `L ${points[i].x} ${points[i].y} `;
      }

      areaD =
        pathD +
        `L ${points[points.length - 1].x} ${paddingTop + graphHeight} ` +
        `L ${points[0].x} ${paddingTop + graphHeight} Z`;
    }

    return { points, pathD, areaD, chartWidth, chartHeight, paddingLeft, paddingTop, graphWidth, graphHeight, maxVal };
  }, [problems, user]);

  if (loading && problems.length === 0) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Crunching analytical models...</p>
      </div>
    );
  }

  return (
    <div className="analytics-container">
      {/* Overview Analytics Headers */}
      <section className="analytics-header-grid">
        <div className="card analytics-summary-card">
          <h3>LeetCode Accuracy Profile</h3>
          <p className="card-description">Overview of metrics and success ratios across solve difficulties.</p>
          <div className="analytics-summary-content">
            <div className="accuracy-main">
              <strong>{stats.totalSolved}</strong>
              <span>Conquered Problems</span>
            </div>
            <div className="accuracy-breakdown-bars">
              <div className="breakdown-bar-item">
                <span className="label text-easy">Easy</span>
                <div className="bar-wrapper">
                  <div className="bar-fill bg-easy" style={{ width: `${stats.totalSolved > 0 ? (stats.easy / stats.totalSolved) * 100 : 0}%` }}></div>
                </div>
                <span className="value">{stats.easy}</span>
              </div>
              <div className="breakdown-bar-item">
                <span className="label text-medium">Medium</span>
                <div className="bar-wrapper">
                  <div className="bar-fill bg-medium" style={{ width: `${stats.totalSolved > 0 ? (stats.medium / stats.totalSolved) * 100 : 0}%` }}></div>
                </div>
                <span className="value">{stats.medium}</span>
              </div>
              <div className="breakdown-bar-item">
                <span className="label text-hard">Hard</span>
                <div className="bar-wrapper">
                  <div className="bar-fill bg-hard" style={{ width: `${stats.totalSolved > 0 ? (stats.hard / stats.totalSolved) * 100 : 0}%` }}></div>
                </div>
                <span className="value">{stats.hard}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Top Topic Tag breakdown */}
        <div className="card topics-card">
          <h3>Top Tags Distribution</h3>
          <p className="card-description">Your most frequent problem categories solved.</p>
          {stats.topTags.length === 0 ? (
            <div className="empty-state-analytics">
              <p>Add tags to solved problems to generate topic summaries.</p>
            </div>
          ) : (
            <div className="top-tags-bar-chart">
              {stats.topTags.map((tag) => {
                const maxCount = Math.max(...stats.topTags.map((t) => t.count), 1);
                const pct = (tag.count / maxCount) * 100;
                return (
                  <div key={tag.name} className="tag-bar-row">
                    <span className="tag-bar-name">#{tag.name}</span>
                    <div className="tag-bar-track">
                      <div className="tag-bar-fill" style={{ width: `${pct}%` }}></div>
                    </div>
                    <strong className="tag-bar-count">{tag.count}</strong>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="analytics-grid-full">
        {/* Heatmap Card */}
        <div className="card heatmap-card">
          <div className="heatmap-header">
            <div>
              <h3>Activity Heatmap</h3>
              <p className="card-description">Submission frequency grid mapping solved problems over the past 6 months.</p>
            </div>
            {/* Heatmap Legend */}
            <div className="heatmap-legend">
              <span>Less</span>
              <div className="legend-cell level-0"></div>
              <div className="legend-cell level-1"></div>
              <div className="legend-cell level-2"></div>
              <div className="legend-cell level-3"></div>
              <span>More</span>
            </div>
          </div>

          <div className="heatmap-grid-scroll-wrapper">
            <div className="heatmap-grid-container">
              {/* Row Names (Mon, Wed, Fri) */}
              <div className="heatmap-row-labels">
                <span></span>
                <span>Mon</span>
                <span></span>
                <span>Wed</span>
                <span></span>
                <span>Fri</span>
                <span></span>
              </div>

              <div className="heatmap-grid-body">
                {/* Month headers row */}
                <div className="heatmap-month-header">
                  {heatmapMonths.map((m) => (
                    <span
                      key={m.index}
                      style={{ gridColumnStart: m.index + 1 }}
                      className="month-label"
                    >
                      {m.label}
                    </span>
                  ))}
                </div>

                {/* Heatmap Columns */}
                <div className="heatmap-columns-wrapper">
                  {heatmapData.map((col, cIdx) => (
                    <div key={cIdx} className="heatmap-column">
                      {col.map((day) => (
                        <div
                          key={day.dateKey}
                          className={`heatmap-cell level-${day.level}`}
                          title={`${day.count} solved on ${day.date.toLocaleDateString()}`}
                          onMouseEnter={() => setHoveredCell(day)}
                          onMouseLeave={() => setHoveredCell(null)}
                        ></div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Interactive detail label */}
          <div className="heatmap-detail-status">
            {hoveredCell ? (
              <p>
                <strong>{hoveredCell.count} {hoveredCell.count === 1 ? 'problem' : 'problems'}</strong> solved on{' '}
                {new Date(hoveredCell.date).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            ) : (
              <p className="hint">Hover over a grid cell to see solved counts.</p>
            )}
          </div>
        </div>

        {/* SVG Cumulative Chart Card */}
        <div className="card line-chart-card">
          <h3>Solved Curve (12 Weeks)</h3>
          <p className="card-description">Cumulative expansion profile showing solved records over time.</p>
          
          <div className="chart-svg-wrapper">
            <svg
              viewBox={`0 0 ${chartData.chartWidth} ${chartData.chartHeight}`}
              width="100%"
              height="100%"
            >
              <defs>
                <linearGradient id="chartAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line
                x1={chartData.paddingLeft}
                y1={chartData.paddingTop}
                x2={chartData.chartWidth - 20}
                y2={chartData.paddingTop}
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="1"
              />
              <line
                x1={chartData.paddingLeft}
                y1={chartData.paddingTop + chartData.graphHeight / 2}
                x2={chartData.chartWidth - 20}
                y2={chartData.paddingTop + chartData.graphHeight / 2}
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="1"
              />
              <line
                x1={chartData.paddingLeft}
                y1={chartData.paddingTop + chartData.graphHeight}
                x2={chartData.chartWidth - 20}
                y2={chartData.paddingTop + chartData.graphHeight}
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="1.5"
              />

              {/* Y Axis Labels */}
              <text
                x={chartData.paddingLeft - 10}
                y={chartData.paddingTop + 5}
                fill="rgba(255,255,255,0.4)"
                fontSize="10"
                textAnchor="end"
              >
                {chartData.maxVal}
              </text>
              <text
                x={chartData.paddingLeft - 10}
                y={chartData.paddingTop + chartData.graphHeight / 2 + 4}
                fill="rgba(255,255,255,0.4)"
                fontSize="10"
                textAnchor="end"
              >
                {Math.round(chartData.maxVal / 2)}
              </text>
              <text
                x={chartData.paddingLeft - 10}
                y={chartData.paddingTop + chartData.graphHeight + 3}
                fill="rgba(255,255,255,0.4)"
                fontSize="10"
                textAnchor="end"
              >
                0
              </text>

              {/* Area Under Curve */}
              {chartData.areaD && (
                <path d={chartData.areaD} fill="url(#chartAreaGradient)" />
              )}

              {/* Stroke Line */}
              {chartData.pathD && (
                <path
                  d={chartData.pathD}
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Dots & Labels */}
              {chartData.points.map((p, idx) => (
                <g key={idx}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="4"
                    fill="#0b0f19"
                    stroke="#818cf8"
                    strokeWidth="2"
                  />
                  
                  {/* Tooltip value display on hover */}
                  <text
                    x={p.x}
                    y={p.y - 10}
                    fill="#fff"
                    fontSize="9"
                    fontWeight="bold"
                    textAnchor="middle"
                    className="chart-dot-value"
                  >
                    {p.val}
                  </text>

                  {/* X Axis label */}
                  <text
                    x={p.x}
                    y={chartData.paddingTop + chartData.graphHeight + 18}
                    fill="rgba(255,255,255,0.4)"
                    fontSize="9"
                    textAnchor="middle"
                  >
                    {p.label}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </div>
      </section>
    </div>
  );
}
