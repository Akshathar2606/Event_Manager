const mongoose = require('mongoose');
const { CateringRequest, CATERING_REQUEST_STATUS } = require('../models/CateringRequest');
const { Event } = require('../models/Event');
const { CateringService } = require('../models/CateringService');
const { User } = require('../models/User');
const {
  isValidObjectId,
  validateCreateCateringRequestInput,
  validateRejectionInput,
  validateCancellationInput,
  validateCateringRequestQuery
} = require('../utils/cateringRequestValidation');

/**
 * Accesses mock catering request store during in-memory automated tests.
 */
const getStore = (req) => {
  if (process.env.NODE_ENV === 'production') return null;
  return req.app && req.app.locals && req.app.locals.mockCateringRequestStore
    ? req.app.locals.mockCateringRequestStore
    : null;
};

const getEventStore = (req) => {
  if (process.env.NODE_ENV === 'production') return null;
  return req.app && req.app.locals && req.app.locals.mockEventStore
    ? req.app.locals.mockEventStore
    : null;
};

const getCateringStore = (req) => {
  if (process.env.NODE_ENV === 'production') return null;
  return req.app && req.app.locals && req.app.locals.mockCateringStore
    ? req.app.locals.mockCateringStore
    : null;
};

const getUserStore = (req) => {
  if (process.env.NODE_ENV === 'production') return null;
  return req.app && req.app.locals && req.app.locals.mockUserStore
    ? req.app.locals.mockUserStore
    : null;
};

/**
 * Safely extracts ID string from ObjectId or populated object.
 */
const extractId = (val) => {
  if (!val) return null;
  if (typeof val === 'object') {
    return val.id || val._id?.toString() || val.toString();
  }
  return String(val);
};

/**
 * Populates event, cateringService, vendor, and organizer in mock objects for test consistency.
 */
const populateMockRequest = (request, req) => {
  const eventStore = getEventStore(req);
  const cateringStore = getCateringStore(req);
  const userStore = getUserStore(req);

  const populated = { ...request };

  // 1. Event
  const eventId = extractId(populated.event);
  if (eventId && eventStore) {
    const event = eventStore.get(eventId);
    if (event) {
      populated.event = {
        id: event.id || event._id,
        _id: event.id || event._id,
        title: event.title,
        category: event.category,
        startDateTime: event.startDateTime,
        endDateTime: event.endDateTime,
        status: event.status,
        capacity: event.capacity
      };
    }
  }

  // 2. Catering Service
  const serviceId = extractId(populated.cateringService);
  if (serviceId && cateringStore) {
    const service = cateringStore.get(serviceId);
    if (service) {
      populated.cateringService = {
        id: service.id || service._id,
        _id: service.id || service._id,
        businessName: service.businessName,
        serviceArea: service.serviceArea,
        contactEmail: service.contactEmail || '',
        contactPhone: service.contactPhone || '',
        cuisineTypes: service.cuisineTypes || [],
        isAvailable: service.isAvailable !== undefined ? service.isAvailable : true
      };
    }
  }

  // 3. Vendor User
  const vendorId = extractId(populated.vendor);
  if (vendorId && userStore) {
    const vendor = userStore.get(vendorId);
    if (vendor) {
      populated.vendor = {
        id: vendor.id || vendor._id,
        _id: vendor.id || vendor._id,
        name: vendor.name,
        email: vendor.email,
        phone: vendor.phone || '',
        organization: vendor.organization || ''
      };
    }
  }

  // 4. Organizer User
  const organizerId = extractId(populated.organizer);
  if (organizerId && userStore) {
    const organizer = userStore.get(organizerId);
    if (organizer) {
      populated.organizer = {
        id: organizer.id || organizer._id,
        _id: organizer.id || organizer._id,
        name: organizer.name,
        email: organizer.email,
        phone: organizer.phone || '',
        organization: organizer.organization || ''
      };
    }
  }

  return populated;
};

/**
 * POST /api/catering-requests
 * Create a new catering request for an organizer's event.
 */
const createCateringRequest = async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== 'organizer') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. Only organizers can submit catering requests.'
      });
    }

    const organizerId = req.user.id;
    const validation = validateCreateCateringRequestInput(req.body);

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed.',
        errors: validation.errors
      });
    }

    const { eventId, cateringServiceId, packageId, guestCount, serviceDateTime, notes } = validation.sanitized;
    const mockStore = getStore(req);
    const eventStore = getEventStore(req);
    const cateringStore = getCateringStore(req);

    // 1. Fetch Event
    let event = null;
    if (eventStore) {
      event = eventStore.get(eventId);
    } else if (mongoose.connection.readyState === 1) {
      event = await Event.findOne({ _id: eventId, isArchived: false });
    }

    if (!event || event.isArchived) {
      return res.status(404).json({
        success: false,
        message: 'Event not found.'
      });
    }

    if (event.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot request catering for a cancelled event.'
      });
    }

    // Verify Organizer Event Ownership
    const eventOrganizerId = extractId(event.organizer);
    if (String(eventOrganizerId) !== String(organizerId)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You can only request catering for events you organize.'
      });
    }

    // 2. Fetch Catering Service
    let cateringService = null;
    if (cateringStore) {
      cateringService = cateringStore.get(cateringServiceId);
    } else if (mongoose.connection.readyState === 1) {
      cateringService = await CateringService.findOne({ _id: cateringServiceId, isArchived: false });
    }

    if (!cateringService || cateringService.isArchived) {
      return res.status(404).json({
        success: false,
        message: 'Catering service not found.'
      });
    }

    if (cateringService.isAvailable === false) {
      return res.status(400).json({
        success: false,
        message: 'Selected catering service is currently marked as unavailable.'
      });
    }

    // 3. Find Package in Catering Service
    const packages = cateringService.packages || [];
    const selectedPkg = packages.find((p) => String(p._id || p.id) === String(packageId));

    if (!selectedPkg || selectedPkg.isArchived) {
      return res.status(400).json({
        success: false,
        message: 'Selected catering package does not exist or has been archived.'
      });
    }

    // 4. Validate Guest Count against Package Minimum & Event Capacity
    if (guestCount < selectedPkg.minOrder) {
      return res.status(400).json({
        success: false,
        message: `Guest count (${guestCount}) is below the package minimum order of ${selectedPkg.minOrder} people.`
      });
    }

    if (event.capacity && guestCount > event.capacity) {
      return res.status(400).json({
        success: false,
        message: `Guest count (${guestCount}) exceeds event capacity of ${event.capacity} people.`
      });
    }

    // 5. Server-Authoritative Price Calculation & Package Snapshot
    const pricePerPlate = Number(selectedPkg.pricePerPlate);
    const quotedPrice = Math.round(pricePerPlate * guestCount * 100) / 100;
    const vendorId = extractId(cateringService.vendorId);

    const packageSnapshot = {
      packageId: selectedPkg._id || selectedPkg.id,
      name: selectedPkg.name,
      description: selectedPkg.description || '',
      pricePerPlate: selectedPkg.pricePerPlate,
      minOrder: selectedPkg.minOrder,
      menuItems: Array.isArray(selectedPkg.menuItems) ? [...selectedPkg.menuItems] : [],
      dietaryOptions: Array.isArray(selectedPkg.dietaryOptions) ? [...selectedPkg.dietaryOptions] : []
    };

    const effectiveServiceTime = serviceDateTime || event.startDateTime;

    // In-memory Mock Store path
    if (mockStore) {
      const newRequest = {
        id: new mongoose.Types.ObjectId().toString(),
        event: eventId,
        organizer: organizerId,
        cateringService: cateringServiceId,
        vendor: vendorId,
        selectedPackage: packageSnapshot,
        guestCount,
        pricePerPlate,
        quotedPrice,
        serviceDateTime: effectiveServiceTime,
        notes,
        status: 'pending',
        respondedAt: null,
        vendorNotes: '',
        rejectionReason: '',
        cancelledAt: null,
        cancellationReason: '',
        isArchived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockStore.set(newRequest.id, newRequest);

      return res.status(201).json({
        success: true,
        message: 'Catering request submitted successfully.',
        data: populateMockRequest(newRequest, req)
      });
    }

    // Database path
    const requestDoc = await CateringRequest.create({
      event: eventId,
      organizer: organizerId,
      cateringService: cateringServiceId,
      vendor: vendorId,
      selectedPackage: packageSnapshot,
      guestCount,
      pricePerPlate,
      quotedPrice,
      serviceDateTime: effectiveServiceTime,
      notes,
      status: 'pending'
    });

    await requestDoc.populate('event', 'title category startDateTime endDateTime venue status capacity');
    await requestDoc.populate('cateringService', 'businessName serviceArea contactEmail contactPhone cuisineTypes isAvailable');
    await requestDoc.populate('vendor', 'name email phone organization');
    await requestDoc.populate('organizer', 'name email phone organization');

    return res.status(201).json({
      success: true,
      message: 'Catering request submitted successfully.',
      data: requestDoc
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/catering-requests
 * Retrieve catering requests for the authenticated organizer.
 */
const getOrganizerCateringRequests = async (req, res, next) => {
  try {
    const isOrganizer = req.user && req.user.role === 'organizer';
    const isAdmin = req.user && req.user.role === 'administrator';

    if (!isOrganizer && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. Only organizers can access personal catering requests.'
      });
    }

    const organizerId = req.user.id;
    const { page, limit, status, eventId } = validateCateringRequestQuery(req.query);
    const mockStore = getStore(req);

    if (mockStore) {
      let filtered = Array.from(mockStore.values()).filter((item) => {
        if (item.isArchived) return false;
        if (!isAdmin && String(extractId(item.organizer)) !== String(organizerId)) return false;
        if (status && item.status !== status) return false;
        if (eventId && String(extractId(item.event)) !== String(eventId)) return false;
        return true;
      });

      filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      const total = filtered.length;
      const pages = Math.ceil(total / limit) || 1;
      const skip = (page - 1) * limit;
      const paginated = filtered.slice(skip, skip + limit).map((r) => populateMockRequest(r, req));

      return res.status(200).json({
        success: true,
        count: paginated.length,
        pagination: { total, page, limit, pages },
        data: paginated
      });
    }

    // Database query
    const query = { isArchived: false };
    if (!isAdmin) {
      query.organizer = organizerId;
    }
    if (status) query.status = status;
    if (eventId) query.event = eventId;

    const total = await CateringRequest.countDocuments(query);
    const pages = Math.ceil(total / limit) || 1;
    const skip = (page - 1) * limit;

    const requests = await CateringRequest.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('event', 'title category startDateTime endDateTime venue status capacity')
      .populate('cateringService', 'businessName serviceArea contactEmail contactPhone cuisineTypes isAvailable')
      .populate('vendor', 'name email phone organization')
      .populate('organizer', 'name email phone organization');

    return res.status(200).json({
      success: true,
      count: requests.length,
      pagination: { total, page, limit, pages },
      data: requests
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/catering-requests/incoming
 * Retrieve incoming catering requests directed to the authenticated vendor.
 */
const getVendorCateringRequests = async (req, res, next) => {
  try {
    const isVendor = req.user && req.user.role === 'vendor';
    const isAdmin = req.user && req.user.role === 'administrator';

    if (!isVendor && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. Only catering vendors can view incoming catering requests.'
      });
    }

    const vendorId = req.user.id;
    const { page, limit, status, eventId } = validateCateringRequestQuery(req.query);
    const mockStore = getStore(req);

    if (mockStore) {
      let filtered = Array.from(mockStore.values()).filter((item) => {
        if (item.isArchived) return false;
        if (!isAdmin && String(extractId(item.vendor)) !== String(vendorId)) return false;
        if (status && item.status !== status) return false;
        if (eventId && String(extractId(item.event)) !== String(eventId)) return false;
        return true;
      });

      filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      const total = filtered.length;
      const pages = Math.ceil(total / limit) || 1;
      const skip = (page - 1) * limit;
      const paginated = filtered.slice(skip, skip + limit).map((r) => populateMockRequest(r, req));

      return res.status(200).json({
        success: true,
        count: paginated.length,
        pagination: { total, page, limit, pages },
        data: paginated
      });
    }

    // Database query
    const query = { isArchived: false };
    if (!isAdmin) {
      query.vendor = vendorId;
    }
    if (status) query.status = status;
    if (eventId) query.event = eventId;

    const total = await CateringRequest.countDocuments(query);
    const pages = Math.ceil(total / limit) || 1;
    const skip = (page - 1) * limit;

    const requests = await CateringRequest.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('event', 'title category startDateTime endDateTime venue status capacity')
      .populate('cateringService', 'businessName serviceArea contactEmail contactPhone cuisineTypes isAvailable')
      .populate('vendor', 'name email phone organization')
      .populate('organizer', 'name email phone organization');

    return res.status(200).json({
      success: true,
      count: requests.length,
      pagination: { total, page, limit, pages },
      data: requests
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/catering-requests/:id
 * Retrieve a single catering request by ID.
 * Strictly checks authorization (Requester organizer, recipient vendor, or administrator).
 */
const getCateringRequestById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const mockStore = getStore(req);

    let request = null;
    if (mockStore) {
      request = mockStore.get(id);
    } else if (mongoose.connection.readyState === 1) {
      request = await CateringRequest.findOne({ _id: id, isArchived: false })
        .populate('event', 'title category startDateTime endDateTime venue status capacity')
        .populate('cateringService', 'businessName serviceArea contactEmail contactPhone cuisineTypes isAvailable')
        .populate('vendor', 'name email phone organization')
        .populate('organizer', 'name email phone organization');
    }

    if (!request || request.isArchived) {
      return res.status(404).json({
        success: false,
        message: 'Catering request not found.'
      });
    }

    const userId = req.user.id;
    const userRole = req.user.role;
    const organizerId = extractId(request.organizer);
    const vendorId = extractId(request.vendor);

    const isAuthorized =
      userRole === 'administrator' ||
      String(organizerId) === String(userId) ||
      String(vendorId) === String(userId);

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You do not have permission to view this catering request.'
      });
    }

    const data = mockStore ? populateMockRequest(request, req) : request;

    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/catering-requests/:id/accept
 * Vendor accepts an incoming catering request.
 */
const acceptCateringRequest = async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== 'vendor') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. Only catering vendors can accept requests.'
      });
    }

    const { id } = req.params;
    const vendorNotes = req.body.notes || req.body.vendorNotes || '';
    const mockStore = getStore(req);

    if (mockStore) {
      const request = mockStore.get(id);

      if (!request || request.isArchived) {
        return res.status(404).json({
          success: false,
          message: 'Catering request not found.'
        });
      }

      // Check Vendor Ownership
      const requestVendorId = extractId(request.vendor);
      if (String(requestVendorId) !== String(req.user.id)) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden. You are not authorized to respond to this catering request.'
        });
      }

      // Lifecycle check
      if (request.status === 'accepted') {
        return res.status(400).json({
          success: false,
          message: 'Catering request is already accepted.'
        });
      }

      if (request.status === 'rejected') {
        return res.status(400).json({
          success: false,
          message: 'Cannot accept a request that has already been rejected.'
        });
      }

      if (request.status === 'cancelled') {
        return res.status(400).json({
          success: false,
          message: 'Cannot accept a request that has been cancelled.'
        });
      }

      request.status = 'accepted';
      request.respondedAt = new Date().toISOString();
      request.vendorNotes = typeof vendorNotes === 'string' ? vendorNotes.trim().slice(0, 1000) : '';
      request.updatedAt = new Date().toISOString();

      return res.status(200).json({
        success: true,
        message: 'Catering request accepted successfully.',
        data: populateMockRequest(request, req)
      });
    }

    // Database path - Atomic status transition
    const filter = {
      _id: id,
      vendor: req.user.id,
      isArchived: false
    };

    // First check existence and ownership for clear error reporting
    const existing = await CateringRequest.findOne(filter);
    if (!existing) {
      const existsGeneral = await CateringRequest.findById(id);
      if (existsGeneral && String(extractId(existsGeneral.vendor)) !== String(req.user.id)) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden. You are not authorized to respond to this catering request.'
        });
      }
      return res.status(404).json({
        success: false,
        message: 'Catering request not found.'
      });
    }

    if (existing.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot accept a request with status '${existing.status}'.`
      });
    }

    // Atomic update
    const updated = await CateringRequest.findOneAndUpdate(
      { _id: id, status: 'pending', vendor: req.user.id },
      {
        $set: {
          status: 'accepted',
          respondedAt: new Date(),
          vendorNotes: typeof vendorNotes === 'string' ? vendorNotes.trim().slice(0, 1000) : ''
        }
      },
      { new: true }
    )
      .populate('event', 'title category startDateTime endDateTime venue status capacity')
      .populate('cateringService', 'businessName serviceArea contactEmail contactPhone cuisineTypes isAvailable')
      .populate('vendor', 'name email phone organization')
      .populate('organizer', 'name email phone organization');

    if (!updated) {
      return res.status(400).json({
        success: false,
        message: 'Request status was modified by another concurrent operation.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Catering request accepted successfully.',
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/catering-requests/:id/reject
 * Vendor rejects an incoming catering request with mandatory reason.
 */
const rejectCateringRequest = async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== 'vendor') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. Only catering vendors can reject requests.'
      });
    }

    const { id } = req.params;
    const validation = validateRejectionInput(req.body);

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed.',
        errors: validation.errors
      });
    }

    const { rejectionReason, vendorNotes } = validation.sanitized;
    const mockStore = getStore(req);

    if (mockStore) {
      const request = mockStore.get(id);

      if (!request || request.isArchived) {
        return res.status(404).json({
          success: false,
          message: 'Catering request not found.'
        });
      }

      // Check Vendor Ownership
      const requestVendorId = extractId(request.vendor);
      if (String(requestVendorId) !== String(req.user.id)) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden. You are not authorized to respond to this catering request.'
        });
      }

      // Lifecycle check
      if (request.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: `Cannot reject a request with status '${request.status}'.`
        });
      }

      request.status = 'rejected';
      request.respondedAt = new Date().toISOString();
      request.rejectionReason = rejectionReason;
      if (vendorNotes) request.vendorNotes = vendorNotes;
      request.updatedAt = new Date().toISOString();

      return res.status(200).json({
        success: true,
        message: 'Catering request rejected.',
        data: populateMockRequest(request, req)
      });
    }

    // Database path
    const filter = {
      _id: id,
      vendor: req.user.id,
      isArchived: false
    };

    const existing = await CateringRequest.findOne(filter);
    if (!existing) {
      const existsGeneral = await CateringRequest.findById(id);
      if (existsGeneral && String(extractId(existsGeneral.vendor)) !== String(req.user.id)) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden. You are not authorized to respond to this catering request.'
        });
      }
      return res.status(404).json({
        success: false,
        message: 'Catering request not found.'
      });
    }

    if (existing.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot reject a request with status '${existing.status}'.`
      });
    }

    // Atomic update
    const updated = await CateringRequest.findOneAndUpdate(
      { _id: id, status: 'pending', vendor: req.user.id },
      {
        $set: {
          status: 'rejected',
          respondedAt: new Date(),
          rejectionReason,
          ...(vendorNotes ? { vendorNotes } : {})
        }
      },
      { new: true }
    )
      .populate('event', 'title category startDateTime endDateTime venue status capacity')
      .populate('cateringService', 'businessName serviceArea contactEmail contactPhone cuisineTypes isAvailable')
      .populate('vendor', 'name email phone organization')
      .populate('organizer', 'name email phone organization');

    if (!updated) {
      return res.status(400).json({
        success: false,
        message: 'Request status was modified by another concurrent operation.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Catering request rejected.',
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/catering-requests/:id/cancel
 * Organizer cancels their own catering request.
 */
const cancelCateringRequest = async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== 'organizer') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. Only the organizer who created this request can cancel it.'
      });
    }

    const { id } = req.params;
    const validation = validateCancellationInput(req.body);

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed.',
        errors: validation.errors
      });
    }

    const { cancellationReason } = validation.sanitized;
    const mockStore = getStore(req);
    const eventStore = getEventStore(req);

    if (mockStore) {
      const request = mockStore.get(id);

      if (!request || request.isArchived) {
        return res.status(404).json({
          success: false,
          message: 'Catering request not found.'
        });
      }

      // Check Organizer Ownership
      const requestOrgId = extractId(request.organizer);
      if (String(requestOrgId) !== String(req.user.id)) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden. You can only cancel catering requests for your own events.'
        });
      }

      // Lifecycle check
      if (request.status === 'cancelled') {
        return res.status(400).json({
          success: false,
          message: 'Catering request is already cancelled.'
        });
      }

      if (request.status === 'rejected') {
        return res.status(400).json({
          success: false,
          message: 'Cannot cancel a request that has already been rejected.'
        });
      }

      // If accepted, verify event has not started
      if (request.status === 'accepted') {
        const eventId = extractId(request.event);
        const event = eventStore ? eventStore.get(eventId) : null;
        if (event && event.startDateTime && new Date(event.startDateTime) <= new Date()) {
          return res.status(400).json({
            success: false,
            message: 'Cannot cancel catering request for an event that has already started.'
          });
        }
      }

      request.status = 'cancelled';
      request.cancelledAt = new Date().toISOString();
      request.cancellationReason = cancellationReason || '';
      request.updatedAt = new Date().toISOString();

      return res.status(200).json({
        success: true,
        message: 'Catering request cancelled successfully.',
        data: populateMockRequest(request, req)
      });
    }

    // Database path
    const request = await CateringRequest.findById(id).populate('event');

    if (!request || request.isArchived) {
      return res.status(404).json({
        success: false,
        message: 'Catering request not found.'
      });
    }

    // Check Organizer Ownership
    const requestOrgId = extractId(request.organizer);
    if (String(requestOrgId) !== String(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You can only cancel catering requests for your own events.'
      });
    }

    // Lifecycle check
    if (request.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Catering request is already cancelled.'
      });
    }

    if (request.status === 'rejected') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a request that has already been rejected.'
      });
    }

    // If accepted, check event timing
    if (request.status === 'accepted') {
      const event = request.event;
      if (event && event.startDateTime && new Date(event.startDateTime) <= new Date()) {
        return res.status(400).json({
          success: false,
          message: 'Cannot cancel catering request for an event that has already started.'
        });
      }
    }

    request.status = 'cancelled';
    request.cancelledAt = new Date();
    request.cancellationReason = cancellationReason || '';
    await request.save();

    await request.populate('event', 'title category startDateTime endDateTime venue status capacity');
    await request.populate('cateringService', 'businessName serviceArea contactEmail contactPhone cuisineTypes isAvailable');
    await request.populate('vendor', 'name email phone organization');
    await request.populate('organizer', 'name email phone organization');

    return res.status(200).json({
      success: true,
      message: 'Catering request cancelled successfully.',
      data: request
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCateringRequest,
  getOrganizerCateringRequests,
  getVendorCateringRequests,
  getCateringRequestById,
  acceptCateringRequest,
  rejectCateringRequest,
  cancelCateringRequest
};
