// controllers/adminController.js
// Admin-toiminnot — joinaa Users ja Person kokoelmat

const User = require('../models/User');
const Person = require('../models/Person');
const Log = require('../models/Log');
const Score = require('../models/Score');
const { createLog } = require('../utils/logUtils');

// ---- LISTAA KAIKKI KÄYTTÄJÄT ----
exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', role = '' } = req.query;

    const userQuery = { isActive: true };
    if (role && ['player', 'admin'].includes(role)) userQuery.role = role;

    // Jos hakusana, hae ensin matchaavat Person-dokumentit
    let userIdFilter = null;
    if (search) {
      const matchingPersons = await Person.find({
        $or: [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName:  { $regex: search, $options: 'i' } },
          { email:     { $regex: search, $options: 'i' } },
        ],
      }).select('userId');

      const personUserIds = matchingPersons.map(p => p.userId);

      // Hae myös käyttäjätunnuksella
      userQuery.$or = [
        { username: { $regex: search, $options: 'i' } },
        { _id: { $in: personUserIds } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [users, total] = await Promise.all([
      User.find(userQuery).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      User.countDocuments(userQuery),
    ]);

    // Hae henkilötiedot kaikille käyttäjille kerralla
    const userIds = users.map(u => u._id);
    const persons = await Person.find({ userId: { $in: userIds } });
    const personMap = {};
    persons.forEach(p => { personMap[p.userId.toString()] = p; });

    // Yhdistä
    const combined = users.map(u => {
      const p = personMap[u._id.toString()];
      return {
        _id: u._id,
        username: u.username,
        role: u.role,
        createdAt: u.createdAt,
        firstName: p?.firstName || '',
        lastName: p?.lastName || '',
        email: p?.email || '',
      };
    });

    await createLog({ userId: req.user._id, username: req.user.username, event: 'admin_viewed_users', req });

    res.json({
      success: true,
      users: combined,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
        limit: Number(limit),
      },
    });
  } catch (error) {
    console.error('Käyttäjien haku:', error);
    res.status(500).json({ success: false, message: 'Palvelinvirhe' });
  }
};

// ---- HAE YKSITTÄINEN KÄYTTÄJÄ ----
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || !user.isActive) {
      return res.status(404).json({ success: false, message: 'Käyttäjää ei löydy' });
    }

    const person = await Person.findOne({ userId: user._id });

    const scoreStats = await Score.aggregate([
      { $match: { userId: user._id } },
      { $group: {
          _id: null,
          totalGames: { $sum: 1 },
          avgPercentage: { $avg: '$percentage' },
          bestPercentage: { $max: '$percentage' },
      }},
    ]);

    res.json({
      success: true,
      user: {
        _id: user._id,
        username: user.username,
        role: user.role,
        createdAt: user.createdAt,
        firstName: person?.firstName || '',
        lastName: person?.lastName || '',
        email: person?.email || '',
      },
      scoreStats: scoreStats[0] || null,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Palvelinvirhe' });
  }
};

// ---- MUOKKAA KÄYTTÄJÄN TIETOJA ----
exports.updateUser = async (req, res) => {
  try {
    const { firstName, lastName, email, username } = req.body;

    const userUpdates   = {};
    const personUpdates = {};

    if (username) userUpdates.username = username.toLowerCase().trim();
    if (firstName) personUpdates.firstName = firstName.trim();
    if (lastName)  personUpdates.lastName  = lastName.trim();
    if (email)     personUpdates.email     = email.toLowerCase().trim();

    if (Object.keys(userUpdates).length === 0 && Object.keys(personUpdates).length === 0) {
      return res.status(400).json({ success: false, message: 'Ei päivitettäviä tietoja' });
    }

    let updatedUser   = await User.findById(req.params.id);
    let updatedPerson = await Person.findOne({ userId: req.params.id });

    if (!updatedUser || !updatedUser.isActive) {
      return res.status(404).json({ success: false, message: 'Käyttäjää ei löydy' });
    }

    if (Object.keys(userUpdates).length > 0) {
      updatedUser = await User.findByIdAndUpdate(req.params.id, userUpdates, { new: true, runValidators: true });
    }
    if (Object.keys(personUpdates).length > 0) {
      updatedPerson = await Person.findOneAndUpdate(
        { userId: req.params.id },
        personUpdates,
        { new: true, runValidators: true }
      );
    }

    await createLog({
      userId: req.user._id,
      username: req.user.username,
      event: 'admin_updated_user',
      req,
      targetUserId: updatedUser._id,
      targetUsername: updatedUser.username,
      details: `Päivitetty: ${[...Object.keys(userUpdates), ...Object.keys(personUpdates)].join(', ')}`,
    });

    res.json({
      success: true,
      message: 'Käyttäjän tiedot päivitetty',
      user: {
        _id: updatedUser._id,
        username: updatedUser.username,
        role: updatedUser.role,
        firstName: updatedPerson?.firstName || '',
        lastName: updatedPerson?.lastName || '',
        email: updatedPerson?.email || '',
      },
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: messages[0] });
    }
    res.status(500).json({ success: false, message: 'Palvelinvirhe' });
  }
};

// ---- VAIHDA ROOLI ----
exports.changeUserRole = async (req, res) => {
  try {
    const { role } = req.body;

    if (!['player', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Virheellinen rooli' });
    }
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Et voi muuttaa omaa rooliasi' });
    }

    const targetUser = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
    if (!targetUser) return res.status(404).json({ success: false, message: 'Käyttäjää ei löydy' });

    await createLog({
      userId: req.user._id,
      username: req.user.username,
      event: 'role_changed',
      req,
      targetUserId: targetUser._id,
      targetUsername: targetUser.username,
      details: `Rooli: ${role}`,
    });

    res.json({
      success: true,
      message: `${targetUser.username} rooli vaihdettu: ${role}`,
      user: targetUser,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Palvelinvirhe' });
  }
};

// ---- POISTA KÄYTTÄJÄ ----
exports.deleteUser = async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Et voi poistaa omaa tiliäsi' });
    }

    const targetUser = await User.findById(req.params.id);
    if (!targetUser || !targetUser.isActive) {
      return res.status(404).json({ success: false, message: 'Käyttäjää ei löydy' });
    }

    await createLog({
      userId: req.user._id,
      username: req.user.username,
      event: 'admin_deleted_user',
      req,
      targetUserId: targetUser._id,
      targetUsername: targetUser.username,
    });

    // Pehmeä poisto
    await User.findByIdAndUpdate(req.params.id, {
      isActive: false,
      username: `deleted_${targetUser._id}`,
      refreshTokens: [],
    });

    await Person.findOneAndUpdate(
      { userId: req.params.id },
      {
        firstName: 'Poistettu',
        lastName: 'Käyttäjä',
        email: `deleted_${targetUser._id}@deleted.invalid`,
      }
    );

    res.json({ success: true, message: `Käyttäjä ${targetUser.username} poistettu` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Palvelinvirhe' });
  }
};

// ---- LOKITAPAHTUMAT ----
exports.getLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50, userId = '', event = '', startDate = '', endDate = '' } = req.query;

    const query = {};
    if (userId) query.userId = userId;
    if (event)  query.event  = event;
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate)   query.timestamp.$lte = new Date(endDate);
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [logs, total] = await Promise.all([
      Log.find(query).sort({ timestamp: -1 }).skip(skip).limit(Number(limit)),
      Log.countDocuments(query),
    ]);

    await createLog({ userId: req.user._id, username: req.user.username, event: 'admin_viewed_logs', req });

    res.json({
      success: true,
      logs,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
        limit: Number(limit),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Palvelinvirhe' });
  }
};

// ---- TILASTOT ----
exports.getStats = async (req, res) => {
  try {
    const [totalUsers, totalAdmins, recentLogs, totalScores] = await Promise.all([
      User.countDocuments({ isActive: true, role: 'player' }),
      User.countDocuments({ isActive: true, role: 'admin' }),
      Log.find().sort({ timestamp: -1 }).limit(10),
      Score.countDocuments(),
    ]);

    res.json({
      success: true,
      stats: { totalUsers, totalAdmins, totalScores, recentLogs },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Palvelinvirhe' });
  }
};
