const mongoose = require('mongoose');
const { CateringService } = require('../models/CateringService');
const {
  isValidObjectId,
  validateCateringProfileInput,
  validatePackageInput
} = require('../utils/cateringValidation');

/**
 * Accesses mock catering store during in-memory automated tests
 */
const getStore = (req) => {
  return req.app && req.app.locals && req.app.locals.mockCateringStore
    ? req.app.locals.mockCateringStore
    : null;
};

/**
 * GET /api/catering
 * Browse active catering services with search, dietary filters, cuisine filters, and pagination.
 */
const browseCateringServices = async (req, res, next) => {
  try {
    const {
      search,
      dietary,
      cuisine,
      maxPrice,
      page = 1,
      limit = 10
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const isAdmin = req.user && req.user.role === 'administrator';
    const mockStore = getStore(req);

    // Mock store filter path (for automated unit test runner)
    if (mockStore) {
      let list = Array.from(mockStore.values());

      // Filter active and non-archived
      if (!isAdmin) {
        list = list.filter((s) => !s.isArchived && s.isAvailable);
      } else {
        list = list.filter((s) => !s.isArchived);
      }

      // Search keyword filter
      if (search && search.trim()) {
        const query = search.trim().toLowerCase();
        list = list.filter(
          (s) =>
            s.businessName.toLowerCase().includes(query) ||
            s.serviceArea.toLowerCase().includes(query) ||
            (s.description && s.description.toLowerCase().includes(query))
        );
      }

      // Cuisine filter
      if (cuisine) {
        const cuisines = (Array.isArray(cuisine) ? cuisine : cuisine.split(','))
          .map((c) => c.trim().toLowerCase())
          .filter(Boolean);
        if (cuisines.length > 0) {
          list = list.filter((s) => {
            const sc = (s.cuisineTypes || []).map((c) => c.toLowerCase());
            return cuisines.some((c) => sc.includes(c));
          });
        }
      }

      // Dietary filter (matches services that have at least one package with requested dietary options)
      if (dietary) {
        const requestedDietary = (Array.isArray(dietary) ? dietary : dietary.split(','))
          .map((d) => d.trim().toLowerCase())
          .filter(Boolean);

        if (requestedDietary.length > 0) {
          list = list.filter((s) => {
            const activePkgs = (s.packages || []).filter((p) => !p.isArchived);
            return activePkgs.some((p) => {
              const pkgDietary = (p.dietaryOptions || []).map((d) => d.toLowerCase());
              return requestedDietary.every((rd) => pkgDietary.includes(rd));
            });
          });
        }
      }

      // Max price filter
      if (maxPrice && !isNaN(Number(maxPrice))) {
        const max = Number(maxPrice);
        list = list.filter((s) => {
          const activePkgs = (s.packages || []).filter((p) => !p.isArchived);
          return activePkgs.some((p) => p.pricePerPlate <= max);
        });
      }

      const total = list.length;
      const paginated = list.slice(skip, skip + limitNum).map((s) => {
        // Exclude archived packages for public browsing
        const cleanPackages = (s.packages || []).filter((p) => !p.isArchived);
        return { ...s, packages: cleanPackages };
      });

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
    const query = { isArchived: false };
    if (!isAdmin) {
      query.isAvailable = true;
    }

    if (search && search.trim()) {
      const q = search.trim();
      query.$or = [
        { businessName: { $regex: q, $options: 'i' } },
        { serviceArea: { $regex: q, $options: 'i' } }
      ];
    }

    if (cuisine) {
      const cuisines = (Array.isArray(cuisine) ? cuisine : cuisine.split(','))
        .map((c) => c.trim())
        .filter(Boolean);
      if (cuisines.length > 0) {
        query.cuisineTypes = { $in: cuisines };
      }
    }

    if (dietary) {
      const dietaries = (Array.isArray(dietary) ? dietary : dietary.split(','))
        .map((d) => d.trim())
        .filter(Boolean);
      if (dietaries.length > 0) {
        query['packages.dietaryOptions'] = { $all: dietaries };
      }
    }

    if (maxPrice && !isNaN(Number(maxPrice))) {
      query['packages.pricePerPlate'] = { $lte: Number(maxPrice) };
    }

    const total = await CateringService.countDocuments(query);
    const services = await CateringService.find(query)
      .populate('vendorId', 'name email phone organization')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Clean archived packages
    const sanitizedServices = services.map((s) => {
      const obj = s.toObject();
      obj.packages = (obj.packages || []).filter((p) => !p.isArchived);
      return obj;
    });

    return res.status(200).json({
      success: true,
      count: sanitizedServices.length,
      pagination: {
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum) || 1,
        limit: limitNum
      },
      data: sanitizedServices
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/catering/:id
 * Retrieve a single catering vendor profile and their active packages.
 */
const getCateringServiceById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid catering service ID format. Must be a 24-character ObjectId.'
      });
    }

    const mockStore = getStore(req);
    const userId = req.user && req.user.id;
    const isAdmin = req.user && req.user.role === 'administrator';

    if (mockStore) {
      const service = mockStore.get(id);
      if (!service || (service.isArchived && !isAdmin)) {
        return res.status(404).json({
          success: false,
          message: 'Catering service not found.'
        });
      }

      const isOwner = service.vendorId === userId || service.vendorId?.id === userId;
      const filteredPackages = (service.packages || []).filter((p) => isOwner || !p.isArchived);

      return res.status(200).json({
        success: true,
        data: { ...service, packages: filteredPackages }
      });
    }

    const service = await CateringService.findById(id).populate('vendorId', 'name email phone organization');
    if (!service || (service.isArchived && !isAdmin)) {
      return res.status(404).json({
        success: false,
        message: 'Catering service not found.'
      });
    }

    const isOwner = service.vendorId && (service.vendorId._id ? service.vendorId._id.toString() : service.vendorId.toString()) === userId;
    const obj = service.toObject();
    obj.packages = (obj.packages || []).filter((p) => isOwner || !p.isArchived);

    return res.status(200).json({
      success: true,
      data: obj
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/catering/my-profile
 * Retrieve authenticated vendor's own catering service profile.
 */
const getMyCateringProfile = async (req, res, next) => {
  try {
    const vendorId = req.user.id;
    const mockStore = getStore(req);

    if (mockStore) {
      const service = Array.from(mockStore.values()).find(
        (s) => (s.vendorId === vendorId || s.vendorId?.id === vendorId) && !s.isArchived
      );
      if (!service) {
        return res.status(404).json({
          success: false,
          message: 'Catering profile has not been created yet. Please create your vendor profile.'
        });
      }
      return res.status(200).json({
        success: true,
        data: service
      });
    }

    const service = await CateringService.findOne({ vendorId, isArchived: false })
      .populate('vendorId', 'name email phone organization');

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Catering profile has not been created yet. Please create your vendor profile.'
      });
    }

    return res.status(200).json({
      success: true,
      data: service.toObject()
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/catering
 * Create catering service profile (Vendor only).
 * Sourced strictly from authenticated req.user.id.
 */
const createCateringProfile = async (req, res, next) => {
  try {
    const vendorId = req.user.id;

    const validation = validateCateringProfileInput(req.body, false);
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
      // Check for existing profile
      const existing = Array.from(mockStore.values()).find(
        (s) => (s.vendorId === vendorId || s.vendorId?.id === vendorId) && !s.isArchived
      );
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'A catering profile already exists for this vendor account.'
        });
      }

      const newService = {
        id: new mongoose.Types.ObjectId().toString(),
        vendorId: {
          id: vendorId,
          name: req.user.name,
          email: req.user.email,
          phone: req.user.phone || '',
          organization: req.user.organization || ''
        },
        businessName: sanitized.businessName,
        description: sanitized.description || '',
        contactEmail: sanitized.contactEmail || req.user.email,
        contactPhone: sanitized.contactPhone || req.user.phone || '',
        serviceArea: sanitized.serviceArea,
        cuisineTypes: sanitized.cuisineTypes || [],
        packages: [],
        isAvailable: true,
        isArchived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      mockStore.set(newService.id, newService);

      return res.status(201).json({
        success: true,
        message: 'Catering profile created successfully.',
        data: newService
      });
    }

    // Check duplicate profile in DB
    const existingService = await CateringService.findOne({ vendorId, isArchived: false });
    if (existingService) {
      return res.status(409).json({
        success: false,
        message: 'A catering profile already exists for this vendor account.'
      });
    }

    const service = await CateringService.create({
      ...sanitized,
      vendorId,
      contactEmail: sanitized.contactEmail || req.user.email,
      contactPhone: sanitized.contactPhone || req.user.phone || ''
    });

    const populated = await CateringService.findById(service._id).populate('vendorId', 'name email phone organization');

    return res.status(201).json({
      success: true,
      message: 'Catering profile created successfully.',
      data: populated.toObject()
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A catering profile already exists for this vendor account.'
      });
    }
    next(error);
  }
};

/**
 * PUT /api/catering/my-profile
 * Update authenticated vendor's own catering service profile.
 */
const updateMyCateringProfile = async (req, res, next) => {
  try {
    const vendorId = req.user.id;

    const validation = validateCateringProfileInput(req.body, true);
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
      const existing = Array.from(mockStore.values()).find(
        (s) => (s.vendorId === vendorId || s.vendorId?.id === vendorId) && !s.isArchived
      );
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Catering profile not found. Please create your profile first.'
        });
      }

      const updated = {
        ...existing,
        ...sanitized,
        updatedAt: new Date().toISOString()
      };
      mockStore.set(existing.id, updated);

      return res.status(200).json({
        success: true,
        message: 'Catering profile updated successfully.',
        data: updated
      });
    }

    const service = await CateringService.findOne({ vendorId, isArchived: false });
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Catering profile not found. Please create your profile first.'
      });
    }

    // Apply updates
    Object.keys(sanitized).forEach((key) => {
      service[key] = sanitized[key];
    });

    await service.save();
    const populated = await CateringService.findById(service._id).populate('vendorId', 'name email phone organization');

    return res.status(200).json({
      success: true,
      message: 'Catering profile updated successfully.',
      data: populated.toObject()
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/catering/my-profile/availability
 * Toggle vendor service availability.
 */
const updateMyAvailability = async (req, res, next) => {
  try {
    const vendorId = req.user.id;
    const { isAvailable } = req.body;

    if (typeof isAvailable !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isAvailable boolean field is required.'
      });
    }

    const mockStore = getStore(req);

    if (mockStore) {
      const existing = Array.from(mockStore.values()).find(
        (s) => (s.vendorId === vendorId || s.vendorId?.id === vendorId) && !s.isArchived
      );
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Catering profile not found.'
        });
      }

      existing.isAvailable = isAvailable;
      existing.updatedAt = new Date().toISOString();
      mockStore.set(existing.id, existing);

      return res.status(200).json({
        success: true,
        message: `Service availability set to ${isAvailable ? 'available' : 'unavailable'}.`,
        data: existing
      });
    }

    const service = await CateringService.findOne({ vendorId, isArchived: false });
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Catering profile not found.'
      });
    }

    service.isAvailable = isAvailable;
    await service.save();

    return res.status(200).json({
      success: true,
      message: `Service availability set to ${isAvailable ? 'available' : 'unavailable'}.`,
      data: service.toObject()
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/catering/my-profile/packages
 * Add a catering package to authenticated vendor's profile.
 */
const addPackage = async (req, res, next) => {
  try {
    const vendorId = req.user.id;

    const validation = validatePackageInput(req.body, false);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Package validation failed.',
        errors: validation.errors
      });
    }

    const { sanitized } = validation;
    const mockStore = getStore(req);

    if (mockStore) {
      const service = Array.from(mockStore.values()).find(
        (s) => (s.vendorId === vendorId || s.vendorId?.id === vendorId) && !s.isArchived
      );
      if (!service) {
        return res.status(404).json({
          success: false,
          message: 'Catering profile not found. Please create your profile before adding packages.'
        });
      }

      const newPackage = {
        id: new mongoose.Types.ObjectId().toString(),
        name: sanitized.name,
        description: sanitized.description || '',
        pricePerPlate: sanitized.pricePerPlate,
        minOrder: sanitized.minOrder || 10,
        menuItems: sanitized.menuItems || [],
        dietaryOptions: sanitized.dietaryOptions || [],
        isArchived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      service.packages = service.packages || [];
      service.packages.push(newPackage);
      service.updatedAt = new Date().toISOString();
      mockStore.set(service.id, service);

      return res.status(201).json({
        success: true,
        message: 'Catering package added successfully.',
        data: newPackage
      });
    }

    const service = await CateringService.findOne({ vendorId, isArchived: false });
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Catering profile not found. Please create your profile before adding packages.'
      });
    }

    service.packages.push(sanitized);
    await service.save();

    const createdPackage = service.packages[service.packages.length - 1];

    return res.status(201).json({
      success: true,
      message: 'Catering package added successfully.',
      data: createdPackage.toObject()
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/catering/my-profile/packages/:packageId
 * Update an existing catering package.
 */
const updatePackage = async (req, res, next) => {
  try {
    const vendorId = req.user.id;
    const { packageId } = req.params;

    if (!isValidObjectId(packageId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid package ID format.'
      });
    }

    const validation = validatePackageInput(req.body, true);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Package validation failed.',
        errors: validation.errors
      });
    }

    const { sanitized } = validation;
    const mockStore = getStore(req);

    if (mockStore) {
      const service = Array.from(mockStore.values()).find(
        (s) => (s.vendorId === vendorId || s.vendorId?.id === vendorId) && !s.isArchived
      );
      if (!service) {
        return res.status(404).json({
          success: false,
          message: 'Catering profile not found.'
        });
      }

      const pkgIndex = (service.packages || []).findIndex(
        (p) => (p.id === packageId || p._id === packageId) && !p.isArchived
      );
      if (pkgIndex === -1) {
        return res.status(404).json({
          success: false,
          message: 'Catering package not found.'
        });
      }

      service.packages[pkgIndex] = {
        ...service.packages[pkgIndex],
        ...sanitized,
        updatedAt: new Date().toISOString()
      };
      mockStore.set(service.id, service);

      return res.status(200).json({
        success: true,
        message: 'Package updated successfully.',
        data: service.packages[pkgIndex]
      });
    }

    const service = await CateringService.findOne({ vendorId, isArchived: false });
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Catering profile not found.'
      });
    }

    const pkg = service.packages.id(packageId);
    if (!pkg || pkg.isArchived) {
      return res.status(404).json({
        success: false,
        message: 'Catering package not found.'
      });
    }

    Object.keys(sanitized).forEach((key) => {
      pkg[key] = sanitized[key];
    });

    await service.save();

    return res.status(200).json({
      success: true,
      message: 'Package updated successfully.',
      data: pkg.toObject()
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/catering/my-profile/packages/:packageId
 * Safely archive a package to protect future/historical booking references.
 */
const archivePackage = async (req, res, next) => {
  try {
    const vendorId = req.user.id;
    const { packageId } = req.params;

    if (!isValidObjectId(packageId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid package ID format.'
      });
    }

    const mockStore = getStore(req);

    if (mockStore) {
      const service = Array.from(mockStore.values()).find(
        (s) => (s.vendorId === vendorId || s.vendorId?.id === vendorId) && !s.isArchived
      );
      if (!service) {
        return res.status(404).json({
          success: false,
          message: 'Catering profile not found.'
        });
      }

      const pkg = (service.packages || []).find(
        (p) => (p.id === packageId || p._id === packageId) && !p.isArchived
      );
      if (!pkg) {
        return res.status(404).json({
          success: false,
          message: 'Catering package not found.'
        });
      }

      pkg.isArchived = true;
      pkg.updatedAt = new Date().toISOString();
      mockStore.set(service.id, service);

      return res.status(200).json({
        success: true,
        message: 'Package archived successfully.'
      });
    }

    const service = await CateringService.findOne({ vendorId, isArchived: false });
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Catering profile not found.'
      });
    }

    const pkg = service.packages.id(packageId);
    if (!pkg || pkg.isArchived) {
      return res.status(404).json({
        success: false,
        message: 'Catering package not found.'
      });
    }

    pkg.isArchived = true;
    await service.save();

    return res.status(200).json({
      success: true,
      message: 'Package archived successfully.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  browseCateringServices,
  getCateringServiceById,
  getMyCateringProfile,
  createCateringProfile,
  updateMyCateringProfile,
  updateMyAvailability,
  addPackage,
  updatePackage,
  archivePackage
};
