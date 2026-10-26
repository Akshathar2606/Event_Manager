const mongoose = require('mongoose');
const { Venue, VENUE_STATUS } = require('../models/Venue');
const { isValidObjectId, validateVenueInput } = require('../utils/venueValidation');

/**
 * Accesses mock venue store during in-memory automated tests
 */
const getStore = (req) => {
  return req.app && req.app.locals && req.app.locals.mockVenueStore
    ? req.app.locals.mockVenueStore
    : null;
};

/**
 * GET /api/venues
 * Browse venues with search, minimum capacity filter, facilities filter, and pagination.
 */
const getVenues = async (req, res, next) => {
  try {
    const {
      search,
      minCapacity,
      facilities,
      status,
      includeArchived,
      page = 1,
      limit = 10
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const isAdmin = req.user && req.user.role === 'administrator';
    const mockStore = getStore(req);

    // Filter in Mock Store (Test Runner)
    if (mockStore) {
      let list = Array.from(mockStore.values());

      // Archive filter
      if (!isAdmin || includeArchived !== 'true') {
        list = list.filter((v) => !v.isArchived);
      }

      // Status filter
      if (!isAdmin) {
        list = list.filter((v) => v.status === 'available');
      } else if (status && VENUE_STATUS.includes(status.toLowerCase())) {
        list = list.filter((v) => v.status === status.toLowerCase());
      }

      // Search filter (name or location)
      if (search && search.trim()) {
        const query = search.trim().toLowerCase();
        list = list.filter(
          (v) =>
            v.name.toLowerCase().includes(query) ||
            v.location.toLowerCase().includes(query) ||
            (v.description && v.description.toLowerCase().includes(query))
        );
      }

      // Minimum capacity filter
      if (minCapacity && !isNaN(Number(minCapacity))) {
        const min = Number(minCapacity);
        list = list.filter((v) => v.capacity >= min);
      }

      // Facilities filter
      if (facilities) {
        const requiredFacilities = (Array.isArray(facilities) ? facilities : facilities.split(','))
          .map((f) => f.trim().toLowerCase())
          .filter(Boolean);

        if (requiredFacilities.length > 0) {
          list = list.filter((v) => {
            const venueFacs = (v.facilities || []).map((f) => f.toLowerCase());
            return requiredFacilities.every((rf) => venueFacs.includes(rf));
          });
        }
      }

      const total = list.length;
      const paginated = list.slice(skip, skip + limitNum);

      return res.status(200).json({
        success: true,
        count: paginated.length,
        pagination: {
          total,
          page: pageNum,
          pages: Math.ceil(total / limitNum) || 1,
          limit: limitNum
        },
        data: paginated
      });
    }

    // Standard MongoDB Mongoose Path
    const query = {};

    // Archive visibility
    if (!isAdmin || includeArchived !== 'true') {
      query.isArchived = false;
    }

    // Status filter: Non-admins only see available venues
    if (!isAdmin) {
      query.status = 'available';
    } else if (status && VENUE_STATUS.includes(status.toLowerCase())) {
      query.status = status.toLowerCase();
    }

    // Search query
    if (search && search.trim()) {
      const searchTerm = search.trim();
      query.$or = [
        { name: { $regex: searchTerm, $options: 'i' } },
        { location: { $regex: searchTerm, $options: 'i' } }
      ];
    }

    // Min capacity filter
    if (minCapacity && !isNaN(Number(minCapacity))) {
      query.capacity = { $gte: Number(minCapacity) };
    }

    // Facilities filter ($all match)
    if (facilities) {
      const facArray = (Array.isArray(facilities) ? facilities : facilities.split(','))
        .map((f) => f.trim())
        .filter(Boolean);

      if (facArray.length > 0) {
        query.facilities = { $all: facArray };
      }
    }

    const total = await Venue.countDocuments(query);
    const venues = await Venue.find(query)
      .populate('createdBy', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    return res.status(200).json({
      success: true,
      count: venues.length,
      pagination: {
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum) || 1,
        limit: limitNum
      },
      data: venues
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/venues/:id
 * Retrieve single venue details.
 */
const getVenueById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid venue ID format. Must be a 24-character hexadecimal ObjectId.'
      });
    }

    const isAdmin = req.user && req.user.role === 'administrator';
    const mockStore = getStore(req);

    if (mockStore) {
      const venue = mockStore.get(id);
      if (!venue || (venue.isArchived && !isAdmin)) {
        return res.status(404).json({
          success: false,
          message: 'Venue not found.'
        });
      }
      return res.status(200).json({
        success: true,
        data: venue
      });
    }

    const venue = await Venue.findById(id).populate('createdBy', 'name email role');
    if (!venue || (venue.isArchived && !isAdmin)) {
      return res.status(404).json({
        success: false,
        message: 'Venue not found.'
      });
    }

    return res.status(200).json({
      success: true,
      data: venue
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/venues
 * Create a new venue (Administrator only).
 * Sets createdBy strictly from authenticated req.user.id.
 */
const createVenue = async (req, res, next) => {
  try {
    const validation = validateVenueInput(req.body, false);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed.',
        errors: validation.errors
      });
    }

    const { sanitized } = validation;
    const adminId = req.user.id;
    const mockStore = getStore(req);

    if (mockStore) {
      const newVenue = {
        id: new mongoose.Types.ObjectId().toString(),
        name: sanitized.name,
        description: sanitized.description || '',
        location: sanitized.location,
        capacity: sanitized.capacity,
        facilities: sanitized.facilities || [],
        images: sanitized.images || [],
        hourlyRate: sanitized.hourlyRate || 0,
        status: sanitized.status || 'available',
        isArchived: false,
        createdBy: {
          id: adminId,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      mockStore.set(newVenue.id, newVenue);

      return res.status(201).json({
        success: true,
        message: 'Venue created successfully.',
        data: newVenue
      });
    }

    const venue = await Venue.create({
      ...sanitized,
      createdBy: adminId
    });

    const populated = await Venue.findById(venue._id).populate('createdBy', 'name email role');

    return res.status(201).json({
      success: true,
      message: 'Venue created successfully.',
      data: populated
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/venues/:id
 * Update an existing venue (Administrator only).
 */
const updateVenue = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid venue ID format.'
      });
    }

    const validation = validateVenueInput(req.body, true);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed.',
        errors: validation.errors
      });
    }

    const { sanitized } = validation;
    const mockStore = getStore(req);

    if (mockStore) {
      const existing = mockStore.get(id);
      if (!existing || existing.isArchived) {
        return res.status(404).json({
          success: false,
          message: 'Venue not found.'
        });
      }

      const updated = {
        ...existing,
        ...sanitized,
        updatedAt: new Date().toISOString()
      };
      mockStore.set(id, updated);

      return res.status(200).json({
        success: true,
        message: 'Venue updated successfully.',
        data: updated
      });
    }

    const venue = await Venue.findById(id);
    if (!venue || venue.isArchived) {
      return res.status(404).json({
        success: false,
        message: 'Venue not found.'
      });
    }

    // Apply allowed updates
    Object.keys(sanitized).forEach((key) => {
      venue[key] = sanitized[key];
    });

    await venue.save();
    const populated = await Venue.findById(id).populate('createdBy', 'name email role');

    return res.status(200).json({
      success: true,
      message: 'Venue updated successfully.',
      data: populated
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/venues/:id/status
 * Toggle venue status between 'available' and 'maintenance' (Administrator only).
 */
const updateVenueStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid venue ID format.'
      });
    }

    if (!status || !VENUE_STATUS.includes(String(status).trim().toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `Invalid or missing status. Allowed values: ${VENUE_STATUS.join(', ')}.`
      });
    }

    const targetStatus = String(status).trim().toLowerCase();
    const mockStore = getStore(req);

    if (mockStore) {
      const existing = mockStore.get(id);
      if (!existing || existing.isArchived) {
        return res.status(404).json({
          success: false,
          message: 'Venue not found.'
        });
      }

      existing.status = targetStatus;
      existing.updatedAt = new Date().toISOString();
      mockStore.set(id, existing);

      return res.status(200).json({
        success: true,
        message: `Venue status updated to '${targetStatus}'.`,
        data: existing
      });
    }

    const venue = await Venue.findById(id);
    if (!venue || venue.isArchived) {
      return res.status(404).json({
        success: false,
        message: 'Venue not found.'
      });
    }

    venue.status = targetStatus;
    await venue.save();

    return res.status(200).json({
      success: true,
      message: `Venue status updated to '${targetStatus}'.`,
      data: venue
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/venues/:id
 * Safe deletion / archive strategy (Administrator only).
 * Sets isArchived: true and status: 'maintenance' to preserve historical event/booking integrity.
 */
const deleteVenue = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid venue ID format.'
      });
    }

    const mockStore = getStore(req);

    if (mockStore) {
      const existing = mockStore.get(id);
      if (!existing || existing.isArchived) {
        return res.status(404).json({
          success: false,
          message: 'Venue not found.'
        });
      }

      existing.isArchived = true;
      existing.status = 'maintenance';
      existing.updatedAt = new Date().toISOString();
      mockStore.set(id, existing);

      return res.status(200).json({
        success: true,
        message: 'Venue archived successfully to preserve historical booking integrity.'
      });
    }

    const venue = await Venue.findById(id);
    if (!venue || venue.isArchived) {
      return res.status(404).json({
        success: false,
        message: 'Venue not found.'
      });
    }

    // Soft delete / archive to ensure references from events and bookings are never broken
    venue.isArchived = true;
    venue.status = 'maintenance';
    await venue.save();

    return res.status(200).json({
      success: true,
      message: 'Venue archived successfully to preserve historical booking integrity.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getVenues,
  getVenueById,
  createVenue,
  updateVenue,
  updateVenueStatus,
  deleteVenue
};
