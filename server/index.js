const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://leet-code-tracker-indol.vercel.app"
  ],
  credentials: true
}));

app.use(express.json());

let dbConnected = false;

// ── Persistent JSON file fallback (used when MongoDB is unavailable) ──────────
const DB_FILE = path.join(__dirname, 'db.json');

function loadLocalDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Could not read db.json, starting fresh:', e.message);
  }
  return { users: [], problems: [] };
}

function saveLocalDB() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: memoryUsers, problems: memoryProblems }, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save db.json:', e.message);
  }
}

const localDB = loadLocalDB();
let memoryUsers = localDB.users;
let memoryProblems = localDB.problems;

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/leetcode-tracker')
  .then(() => {
    dbConnected = true;
    console.log('MongoDB connected');
  })
  .catch((err) => {
    console.warn('MongoDB unavailable, using in-memory storage:', err.message);
  });

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  leetcodeUsername: { type: String, default: '' },
  leetcodeCalendar: { type: String, default: '{}' },
  leetcodeStats: {
    solvedAll: { type: Number, default: 0 },
    solvedEasy: { type: Number, default: 0 },
    solvedMedium: { type: Number, default: 0 },
    solvedHard: { type: Number, default: 0 },
    streak: { type: Number, default: 0 },
    totalActiveDays: { type: Number, default: 0 }
  }
});

const problemSchema = new mongoose.Schema({
  title: String,
  difficulty: String,
  status: String,
  tags: [String],
  notes: String,
  date: { type: Date, default: Date.now },
  userId: String,
});

const User = mongoose.model('User', userSchema);
const Problem = mongoose.model('Problem', problemSchema);

const authMiddleware = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

const findUserByEmail = async (email) => {
  if (dbConnected) return User.findOne({ email });
  return memoryUsers.find((user) => user.email === email) || null;
};

const findUserById = async (id) => {
  if (dbConnected) return User.findById(id);
  return memoryUsers.find((user) => user._id === id) || null;
};

const createUserRecord = async (userData) => {
  if (dbConnected) return User.create(userData);
  const user = { _id: String(Date.now()), ...userData };
  memoryUsers.push(user);
  saveLocalDB();
  return user;
};

const updateUserRecord = async (id, updates) => {
  if (dbConnected) return User.findByIdAndUpdate(id, updates, { new: true });
  const index = memoryUsers.findIndex((user) => user._id === id);
  if (index === -1) return null;
  memoryUsers[index] = { ...memoryUsers[index], ...updates };
  saveLocalDB();
  return memoryUsers[index];
};

const getProblemsForUser = async (userId) => {
  if (dbConnected) return Problem.find({ userId }).sort({ date: -1 });
  return memoryProblems.filter((problem) => problem.userId === userId).sort((a, b) => new Date(b.date) - new Date(a.date));
};

const createProblemRecord = async (problemData) => {
  if (dbConnected) return Problem.create(problemData);
  const problem = { _id: String(Date.now()) + Math.random().toString(36).slice(2), ...problemData };
  memoryProblems.unshift(problem);
  saveLocalDB();
  return problem;
};

const updateProblemRecord = async (id, updates) => {
  if (dbConnected) return Problem.findByIdAndUpdate(id, updates, { new: true });
  const index = memoryProblems.findIndex((problem) => problem._id === id);
  if (index === -1) return null;
  memoryProblems[index] = { ...memoryProblems[index], ...updates };
  saveLocalDB();
  return memoryProblems[index];
};

const deleteProblemRecord = async (id) => {
  if (dbConnected) return Problem.findByIdAndDelete(id);
  memoryProblems = memoryProblems.filter((problem) => problem._id !== id);
  localDB.problems = memoryProblems;
  saveLocalDB();
  return true;
};

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  const existingUser = await findUserByEmail(email);
  if (existingUser) return res.status(400).json({ message: 'User already exists' });

  const hashedPassword = await bcrypt.hash(password, 10);
  const defaultUsername = email.split('@')[0];
  
  const user = await createUserRecord({
    name,
    email,
    password: hashedPassword,
    leetcodeUsername: defaultUsername,
    leetcodeCalendar: '{}',
    leetcodeStats: { solvedAll: 0, solvedEasy: 0, solvedMedium: 0, solvedHard: 0 }
  });

  const token = jwt.sign({ id: user._id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
  res.json({
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      leetcodeUsername: user.leetcodeUsername,
      leetcodeCalendar: user.leetcodeCalendar,
      leetcodeStats: user.leetcodeStats
    }
  });
});

app.post('/api/auth/login', async (req, res) => {
  const user = await findUserByEmail(req.body.email);
  if (!user) return res.status(400).json({ message: 'Invalid credentials' });

  const valid = await bcrypt.compare(req.body.password, user.password);
  if (!valid) return res.status(400).json({ message: 'Invalid credentials' });

  const token = jwt.sign({ id: user._id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
  res.json({
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      leetcodeUsername: user.leetcodeUsername || '',
      leetcodeCalendar: user.leetcodeCalendar || '{}',
      leetcodeStats: user.leetcodeStats || { solvedAll: 0, solvedEasy: 0, solvedMedium: 0, solvedHard: 0 }
    }
  });
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  const user = await findUserById(req.user.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  
  res.json({
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      leetcodeUsername: user.leetcodeUsername || '',
      leetcodeCalendar: user.leetcodeCalendar || '{}',
      leetcodeStats: user.leetcodeStats || { solvedAll: 0, solvedEasy: 0, solvedMedium: 0, solvedHard: 0 }
    }
  });
});

app.post('/api/auth/profile', authMiddleware, async (req, res) => {
  const { leetcodeUsername } = req.body;
  const user = await updateUserRecord(req.user.id, { leetcodeUsername });
  if (!user) return res.status(400).json({ message: 'Failed to update profile' });
  
  res.json({
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      leetcodeUsername: user.leetcodeUsername,
      leetcodeCalendar: user.leetcodeCalendar,
      leetcodeStats: user.leetcodeStats
    }
  });
});

app.get('/api/problems', authMiddleware, async (req, res) => {
  const problems = await getProblemsForUser(req.user.id);
  res.json(problems);
});

app.post('/api/problems', authMiddleware, async (req, res) => {
  const problem = await createProblemRecord({ ...req.body, userId: req.user.id, date: new Date() });
  res.status(201).json(problem);
});

app.put('/api/problems/:id', authMiddleware, async (req, res) => {
  const problem = await updateProblemRecord(req.params.id, req.body);
  res.json(problem);
});

app.delete('/api/problems/:id', authMiddleware, async (req, res) => {
  await deleteProblemRecord(req.params.id);
  res.json({ success: true });
});

// Leetcode GraphQL Proxy & Sync Route
app.post('/api/leetcode/sync', authMiddleware, async (req, res) => {
  const user = await findUserById(req.user.id);
  if (!user || !user.leetcodeUsername) {
    return res.status(400).json({ message: 'No LeetCode username connected to profile.' });
  }

  const username = user.leetcodeUsername;
  const query = `
    query userProfile($username: String!) {
      matchedUser(username: $username) {
        submitStats {
          acSubmissionNum {
            difficulty
            count
          }
        }
        userCalendar {
          submissionCalendar
        }
      }
      recentSubmissionList(username: $username, limit: 20) {
        title
        titleSlug
        timestamp
        statusDisplay
      }
    }
  `;

  try {
    const leetcodeRes = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Referer': 'https://leetcode.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      body: JSON.stringify({ query, variables: { username } }),
    });

    if (!leetcodeRes.ok) {
      throw new Error('LeetCode GraphQL request failed');
    }

    const result = await leetcodeRes.json();
    const matchedUser = result.data?.matchedUser;

    if (!matchedUser) {
      return res.status(404).json({ message: `LeetCode profile for "${username}" not found.` });
    }

    // 1. Process Solved Count statistics
    const statsList = matchedUser.submitStats?.acSubmissionNum || [];
    const calendarData = matchedUser.userCalendar || {};
    const stats = {
      solvedAll: 0,
      solvedEasy: 0,
      solvedMedium: 0,
      solvedHard: 0,
      streak: calendarData.streak || 0,
      totalActiveDays: calendarData.totalActiveDays || 0
    };
    statsList.forEach((item) => {
      if (item.difficulty === 'All') stats.solvedAll = item.count;
      else if (item.difficulty === 'Easy') stats.solvedEasy = item.count;
      else if (item.difficulty === 'Medium') stats.solvedMedium = item.count;
      else if (item.difficulty === 'Hard') stats.solvedHard = item.count;
    });

    // 2. Process Submission Calendar
    const calendarStr = matchedUser.userCalendar?.submissionCalendar || '{}';

    // Helper: fetch real difficulty for a titleSlug from LeetCode GraphQL
    const fetchDifficulty = async (titleSlug) => {
      try {
        const diffQuery = `query getQ($titleSlug: String!) { question(titleSlug: $titleSlug) { difficulty } }`;
        const diffRes = await fetch('https://leetcode.com/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Referer': 'https://leetcode.com',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
          },
          body: JSON.stringify({ query: diffQuery, variables: { titleSlug } }),
        });
        const diffData = await diffRes.json();
        return diffData?.data?.question?.difficulty || 'Medium';
      } catch (_) {
        return 'Medium';
      }
    };

    // 3. Process Recent submissions (create local problem logs if they do not exist)
    const recentSubmissions = result.data?.recentSubmissionList || [];
    const acceptedSubmissions = recentSubmissions.filter((sub) => sub.statusDisplay === 'Accepted');
    
    const userProblems = await getProblemsForUser(req.user.id);
    const existingTitles = new Set(userProblems.map((p) => p.title.toLowerCase().trim()));

    // Build a map of title -> problem for patching existing wrong-difficulty records
    const existingByTitle = {};
    userProblems.forEach((p) => { existingByTitle[p.title.toLowerCase().trim()] = p; });

    let importCount = 0;

    for (const sub of acceptedSubmissions) {
      const cleanTitle = sub.title.trim();
      const titleKey = cleanTitle.toLowerCase();

      // Fetch actual difficulty from LeetCode
      const difficulty = await fetchDifficulty(sub.titleSlug);

      if (!existingTitles.has(titleKey)) {
        // New problem — import with correct difficulty
        await createProblemRecord({
          title: cleanTitle,
          difficulty,
          status: 'Solved',
          tags: ['LeetCode', 'Synced'],
          notes: 'Auto-imported from LeetCode submissions.',
          date: new Date(sub.timestamp * 1000),
          userId: req.user.id
        });
        existingTitles.add(titleKey);
        importCount++;
      } else {
        // Problem already exists — patch difficulty if it's stuck at 'Medium' (old default)
        const existing = existingByTitle[titleKey];
        if (existing && existing.difficulty === 'Medium' && difficulty !== 'Medium') {
          await updateProblemRecord(existing._id, { difficulty });
        }
      }
    }

    // 4. Update the user document
    const updatedUser = await updateUserRecord(req.user.id, {
      leetcodeStats: stats,
      leetcodeCalendar: calendarStr,
    });

    res.json({
      message: `Synchronized successfully! Imported ${importCount} recent problems.`,
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        leetcodeUsername: updatedUser.leetcodeUsername,
        leetcodeCalendar: updatedUser.leetcodeCalendar,
        leetcodeStats: updatedUser.leetcodeStats
      }
    });

  } catch (error) {
    console.error('LeetCode sync error:', error);
    res.status(500).json({ message: 'Error syncing with LeetCode API: ' + error.message });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
