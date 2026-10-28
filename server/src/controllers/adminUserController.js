const mongoose = require('mongoose');
const { User, USER_ROLES } = require('../models/User');
const { isValidObjectId } = require('../utils/venueValidation');

const SAFE_USER_FIELDS = [
  'id',
  'name',
  'email',
  'role',
  'phone',
  'organization',
  'isActive',
  'createdAt',
  'updatedAt'
];

const getStore = (req) => {
  return req.app && req.app.locals && req.app.locals.mockUserStore
    ? req.app.locals.mockUserStore
    : null;
};

const toSafeUser = (user) => {
  const source = typeof user.toObject === 'function' ? user.toObject() : user;
  const safeUser = {};

  for (const field of SAFE_USER_FIELDS) {
    if (field === 'id') {
      const id = source._id || source.id;
      if (id !== undefined && id !== null) {
        safeUser.id = id.toString();
      }
    } else if (source[field] !== undefined) {
      safeUser[field] = source[field];
    }
  }

  return safeUser;
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getPagination = (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
  return { page, limit, skip: (page - 1) * limit };
};

const getUsers = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const search = req.query.search;
    const role = req.query.role;
    const isActiveValue = req.query.isActive;

    if (search !== undefined && typeof search !== 'string') {
      return res.status(400).json({ success: false, message: 'Search must be a string.' });
    }
    if (role !== undefined && (typeof role !== 'string' || !USER_ROLES.includes(role))) {
      return res.status(400).json({
        success: false,
        message: `Role must be one of: ${USER_ROLES.join(', ')}.`
      });
    }
    if (isActiveValue !== undefined && !['true', 'false'].includes(isActiveValue)) {
      return res.status(400).json({
        success: false,
        message: 'isActive must be either true or false.'
      });
    }

    const activeFilter =
      isActiveValue === undefined ? undefined : isActiveValue === 'true';
    const query = {};
    if (role) query.role = role;
    if (activeFilter !== undefined) query.isActive = activeFilter;
    if (search && search.trim()) {
      const searchRegex = new RegExp(escapeRegex(search.trim()), 'i');
      query.$or = [{ name: searchRegex }, { email: searchRegex }];
    }

    const mockStore = getStore(req);
    if (mockStore) {
      let users = Array.from(mockStore.values());

      if (role) users = users.filter((user) => user.role === role);
      if (activeFilter !== undefined) {
        users = users.filter((user) => user.isActive === activeFilter);
      }
      if (search && search.trim()) {
        const searchTerm = search.trim().toLowerCase();
        users = users.filter(
          (user) =>
            (user.name || '').toLowerCase().includes(searchTerm) ||
            (user.email || '').toLowerCase().includes(searchTerm)
        );
      }

      users.sort((a, b) => {
        const dateDifference =
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        return dateDifference || String(a.id || a._id).localeCompare(String(b.id || b._id));
      });

      const total = users.length;
      const data = users.slice(skip, skip + limit).map(toSafeUser);

      return res.status(200).json({
        success: true,
        count: data.length,
        pagination: { total, page, pages: Math.ceil(total / limit) || 1, limit },
        data
      });
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select('name email role phone organization isActive createdAt updatedAt')
        .sort({ createdAt: -1, _id: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(query)
    ]);

    const data = users.map(toSafeUser);
    return res.status(200).json({
      success: true,
      count: data.length,
      pagination: { total, page, pages: Math.ceil(total / limit) || 1, limit },
      data
    });
  } catch (error) {
    next(error);
  }
};

const updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body || {};
    const normalizedId = id.toLowerCase();

    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID.' });
    }
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isActive must be a boolean.'
      });
    }
    if (!isActive && String(req.user.id).toLowerCase() === normalizedId) {
      return res.status(400).json({
        success: false,
        message: 'Administrators cannot deactivate their own account.'
      });
    }

    const mockStore = getStore(req);
    if (mockStore) {
      const user = mockStore.get(normalizedId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }
      if (user.isActive === isActive) {
        return res.status(409).json({
          success: false,
          message: `User account is already ${isActive ? 'active' : 'inactive'}.`
        });
      }
      if (!isActive && user.role === 'administrator') {
        const activeAdministratorCount = Array.from(mockStore.values()).filter(
          (candidate) => candidate.role === 'administrator' && candidate.isActive === true
        ).length;
        if (activeAdministratorCount <= 1) {
          return res.status(409).json({
            success: false,
            message: 'The last active administrator cannot be deactivated.'
          });
        }
      }

      user.isActive = isActive;
      user.updatedAt = new Date().toISOString();
      mockStore.set(normalizedId, user);
      return res.status(200).json({
        success: true,
        message: `User account ${isActive ? 'activated' : 'deactivated'} successfully.`,
        user: toSafeUser(user)
      });
    }

    const client = mongoose.connection.client;
    const isReplicaSet =
      client &&
      client.topology &&
      (client.topology.description.type === 'ReplicaSetWithPrimary' ||
        client.topology.description.type === 'Sharded');

    if (!isReplicaSet) {
      return res.status(503).json({
        success: false,
        message:
          'Database transactions are unavailable on the current deployment topology. User status changes require a replica set or sharded MongoDB deployment.'
      });
    }

    const session = await mongoose.startSession();
    const maxRetries = 3;
    let attempt = 0;

    try {
      while (attempt < maxRetries) {
        attempt += 1;
        session.startTransaction();

        try {
          let user = await User.findById(id).session(session);
          if (!user) {
            await session.abortTransaction();
            return res.status(404).json({ success: false, message: 'User not found.' });
          }
          if (user.isActive === isActive) {
            await session.abortTransaction();
            return res.status(409).json({
              success: false,
              message: `User account is already ${isActive ? 'active' : 'inactive'}.`
            });
          }

          if (!isActive && user.role === 'administrator') {
            // Every administrator deactivation writes the same active admin first.
            // MongoDB then aborts concurrent transactions that made the count from
            // a stale snapshot; their retry observes the committed active-admin set.
            const serializationAdmin = await User.findOneAndUpdate(
              { role: 'administrator', isActive: true },
              { $inc: { __v: 1 } },
              {
                session,
                new: true,
                sort: { _id: 1 },
                timestamps: false
              }
            );

            if (!serializationAdmin) {
              await session.abortTransaction();
              return res.status(409).json({
                success: false,
                message: 'No active administrator is available to serialize this change.'
              });
            }

            user = await User.findById(id).session(session);
            if (!user || !user.isActive || user.role !== 'administrator') {
              await session.abortTransaction();
              return res.status(409).json({
                success: false,
                message: 'The administrator account status changed. Please retry the request.'
              });
            }

            const activeAdministratorCount = await User.countDocuments({
              role: 'administrator',
              isActive: true
            }).session(session);
            if (activeAdministratorCount <= 1) {
              await session.abortTransaction();
              return res.status(409).json({
                success: false,
                message: 'The last active administrator cannot be deactivated.'
              });
            }
          }

          const updatedUser = await User.findOneAndUpdate(
            { _id: id, isActive: user.isActive },
            { $set: { isActive } },
            { session, new: true, runValidators: true }
          );
          if (!updatedUser) {
            await session.abortTransaction();
            return res.status(409).json({
              success: false,
              message: 'The user account status changed. Please retry the request.'
            });
          }

          await session.commitTransaction();
          return res.status(200).json({
            success: true,
            message: `User account ${isActive ? 'activated' : 'deactivated'} successfully.`,
            user: toSafeUser(updatedUser)
          });
        } catch (innerError) {
          try {
            await session.abortTransaction();
          } catch (abortError) {
            // The transaction may already have been aborted by MongoDB.
          }

          const isTransient =
            innerError.hasErrorLabel &&
            innerError.hasErrorLabel('TransientTransactionError');
          const isWriteConflict =
            innerError.code === 112 ||
            (innerError.message && innerError.message.includes('WriteConflict'));

          if ((isTransient || isWriteConflict) && attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, attempt * 50));
            continue;
          }
          throw innerError;
        }
      }

      return res.status(409).json({
        success: false,
        message: 'Could not serialize the user status change. Please retry the request.'
      });
    } finally {
      await session.endSession();
    }
  } catch (error) {
    if (error instanceof mongoose.Error.CastError) {
      return res.status(400).json({ success: false, message: 'Invalid user ID.' });
    }
    next(error);
  }
};

module.exports = {
  getUsers,
  updateUserStatus
};
