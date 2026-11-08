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

const splitFilterValues = (value) =>
  (Array.isArray(value) ? value : String(value || '').split(','))
    .map((item) => item.trim())
    .filter(Boolean);

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getPackageMatches = (service, filters) => {
  const activePackages = (service.packages || []).filter((pkg) => !pkg.isArchived);
  if (!filters.hasPackageFilters) return activePackages;

  return activePackages.filter((pkg) => {
    const dietaryOptions = (pkg.dietaryOptions || []).map((item) => String(item).toLowerCase());
    const minOrder = Number(pkg.minOrder ?? 10);
    const maxGuests = pkg.maxGuests == null ? null : Number(pkg.maxGuests);
    return filters.dietary.every((item) => dietaryOptions.includes(item.toLowerCase())) &&
      (filters.maxPrice === null || Number(pkg.pricePerPlate) <= filters.maxPrice) &&
      (filters.guestCount === null ||
        (minOrder <= filters.guestCount && (maxGuests === null || filters.guestCount <= maxGuests)));
  });
};

const toPublicService = (service, matchingPackages, distanceKm) => {
  const result = { ...service, packages: matchingPackages };
  delete result.contactEmail;
  delete result.contactPhone;
  if (result.vendorId && typeof result.vendorId === 'object') {
    result.vendorId = result.vendorId._id
      ? String(result.vendorId._id)
      : (typeof result.vendorId.toHexString === 'function'
        ? result.vendorId.toHexString()
        : (result.vendorId.id || result.vendorId));
  }
  if (distanceKm !== undefined) result.distanceKm = distanceKm;
  return result;
};

/**
 * GET /api/catering
 * Browse active catering services with location, package, and pagination filters.
 */
const browseCateringServices = async (req, res, next) => {
  try {
    const {
      search,
      dietary,
      cuisine,
      maxPrice,
      city,
      locality,
      guestCount,
      latitude,
      longitude,
      radiusKm,
      page = 1,
      limit = 10
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;
    const parsedMaxPrice = maxPrice === undefined || maxPrice === '' ? null : Number(maxPrice);
    const parsedGuestCount = guestCount === undefined || guestCount === '' ? null : Number(guestCount);
    if (parsedMaxPrice !== null && (!Number.isFinite(parsedMaxPrice) || parsedMaxPrice < 0)) {
      return res.status(400).json({ success: false, message: 'maxPrice must be a non-negative number.' });
    }
    if (parsedGuestCount !== null && (!Number.isInteger(parsedGuestCount) || parsedGuestCount < 1)) {
      return res.status(400).json({ success: false, message: 'guestCount must be a positive whole number.' });
    }

    const hasCompleteLocation = [latitude, longitude, radiusKm].every(
      (value) => value !== undefined && value !== ''
    );
    const geoValues = hasCompleteLocation ? [Number(latitude), Number(longitude), Number(radiusKm)] : null;
    if (
      geoValues &&
      (!geoValues.every(Number.isFinite) ||
        geoValues[0] < -90 || geoValues[0] > 90 ||
        geoValues[1] < -180 || geoValues[1] > 180 ||
        geoValues[2] <= 0)
    ) {
      return res.status(400).json({
        success: false,
        message: 'latitude, longitude, and radiusKm must be valid coordinates and a positive radius.'
      });
    }

    const isAdmin = req.user && req.user.role === 'administrator';
    const mockStore = getStore(req);
    const cuisines = splitFilterValues(cuisine);
    const dietaries = splitFilterValues(dietary);
    const normalizedFilters = {
      dietary: dietaries,
      maxPrice: parsedMaxPrice,
      guestCount: parsedGuestCount,
      hasPackageFilters: dietaries.length > 0 || parsedMaxPrice !== null || parsedGuestCount !== null
    };

    // Mock store filter path (for automated unit test runner)
    if (mockStore) {
      let list = Array.from(mockStore.values());

      list = list.filter((service) =>
        !service.isArchived && (isAdmin || service.isAvailable !== false)
      );

      if (search && search.trim()) {
        const query = search.trim().toLowerCase();
        list = list.filter((service) =>
          [service.businessName, service.serviceArea, service.city, service.locality,
            service.fullAddress, service.description, ...(service.cuisineTypes || [])]
            .some((value) => String(value || '').toLowerCase().includes(query))
        );
      }

      if (city && city.trim()) {
        list = list.filter((service) => String(service.city || '').toLowerCase() === city.trim().toLowerCase());
      }
      if (locality && locality.trim()) {
        list = list.filter((service) =>
          String(service.locality || '').toLowerCase() === locality.trim().toLowerCase()
        );
      }
      if (cuisines.length > 0) {
        list = list.filter((service) => (service.cuisineTypes || []).some((item) =>
          cuisines.some((filter) => String(item).toLowerCase() === filter.toLowerCase())
        ));
      }

      list = list.map((service) => ({
        service,
        packages: getPackageMatches(service, normalizedFilters)
      })).filter(({ packages }) => !normalizedFilters.hasPackageFilters || packages.length > 0);

      if (geoValues) {
        const [lat, lng, radius] = geoValues;
        const radians = (degrees) => degrees * Math.PI / 180;
        list = list.map(({ service, packages }) => {
          const coordinates = service.location?.type === 'Point' ? service.location.coordinates : null;
          if (!Array.isArray(coordinates) || coordinates.length !== 2) return null;
          const [vendorLng, vendorLat] = coordinates;
          const deltaLat = radians(vendorLat - lat);
          const deltaLng = radians(vendorLng - lng);
          const a = Math.sin(deltaLat / 2) ** 2 +
            Math.cos(radians(lat)) * Math.cos(radians(vendorLat)) * Math.sin(deltaLng / 2) ** 2;
          const distanceKm = 6371.0088 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          return distanceKm <= radius ? { service, packages, distanceKm } : null;
        }).filter(Boolean).sort((a, b) =>
          a.distanceKm - b.distanceKm ||
          String(a.service.id || a.service._id || '').localeCompare(
            String(b.service.id || b.service._id || '')
          )
        );
      } else {
        list.sort((a, b) => {
          const createdAtDiff = new Date(b.service.createdAt || 0) - new Date(a.service.createdAt || 0);
          if (createdAtDiff !== 0) return createdAtDiff;
          return String(a.service.id || a.service._id || '').localeCompare(
            String(b.service.id || b.service._id || '')
          );
        });
      }

      const total = list.length;
      const paginated = list.slice(skip, skip + limitNum).map(({ service, packages, distanceKm }) =>
        toPublicService(service, packages, distanceKm)
      );

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

    const conditions = [{ isArchived: false }];
    if (!isAdmin) conditions.push({ isAvailable: { $ne: false } });
    if (search && search.trim()) {
      const searchRegex = new RegExp(escapeRegex(search.trim()), 'i');
      conditions.push({
        $or: [
          { businessName: searchRegex },
          { serviceArea: searchRegex },
          { city: searchRegex },
          { locality: searchRegex },
          { fullAddress: searchRegex },
          { description: searchRegex },
          { cuisineTypes: searchRegex }
        ]
      });
    }
    if (city && city.trim()) {
      conditions.push({ city: new RegExp(`^${escapeRegex(city.trim())}$`, 'i') });
    }
    if (locality && locality.trim()) {
      conditions.push({ locality: new RegExp(`^${escapeRegex(locality.trim())}$`, 'i') });
    }
    if (cuisines.length > 0) {
      conditions.push({ cuisineTypes: { $in: cuisines.map((item) => new RegExp(`^${escapeRegex(item)}$`, 'i')) } });
    }

    if (normalizedFilters.hasPackageFilters) {
      const packageConditions = [{ isArchived: { $ne: true } }];
      if (dietaries.length > 0) {
        packageConditions.push({
          dietaryOptions: { $all: dietaries.map((item) => new RegExp(`^${escapeRegex(item)}$`, 'i')) }
        });
      }
      if (parsedMaxPrice !== null) packageConditions.push({ pricePerPlate: { $lte: parsedMaxPrice } });
      if (parsedGuestCount !== null) {
        packageConditions.push({
          $and: [
            { $or: [{ minOrder: { $exists: false } }, { minOrder: { $lte: parsedGuestCount } }] },
            { $or: [{ maxGuests: { $exists: false } }, { maxGuests: null }, { maxGuests: { $gte: parsedGuestCount } }] }
          ]
        });
      }
      conditions.push({ packages: { $elemMatch: { $and: packageConditions } } });
    }

    const query = conditions.length === 1 ? conditions[0] : { $and: conditions };
    let total;
    let serviceDocs;
    if (geoValues) {
      const [lat, lng, radius] = geoValues;
      const geoPipeline = [
        {
          $geoNear: {
            near: { type: 'Point', coordinates: [lng, lat] },
            key: 'location',
            distanceField: 'distanceMeters',
            maxDistance: radius * 1000,
            spherical: true,
            query
          }
        },
        { $sort: { distanceMeters: 1, _id: 1 } },
        {
          $facet: {
            metadata: [{ $count: 'total' }],
            data: [{ $skip: skip }, { $limit: limitNum }]
          }
        }
      ];
      const [result] = await CateringService.aggregate(geoPipeline);
      total = result?.metadata?.[0]?.total || 0;
      serviceDocs = (result?.data || []).map((service) => {
        service.distanceKm = Math.round((service.distanceMeters / 1000) * 100) / 100;
        delete service.distanceMeters;
        if (service._id) {
          service.id = service._id.toString();
          delete service._id;
        }
        service.packages = (service.packages || []).map((pkg) => {
          if (pkg._id) {
            pkg.id = pkg._id.toString();
            delete pkg._id;
          }
          return pkg;
        });
        return service;
      });
    } else {
      [total, serviceDocs] = await Promise.all([
        CateringService.countDocuments(query),
        CateringService.find(query).sort({ createdAt: -1, _id: 1 }).skip(skip).limit(limitNum)
      ]);
    }

    const sanitizedServices = serviceDocs.map((service) => {
      const obj = service.toObject ? service.toObject() : service;
      obj.packages = getPackageMatches(obj, normalizedFilters).map((pkg) => {
        if (pkg._id && !pkg.id) pkg.id = pkg._id.toString();
        return pkg;
      });
      return toPublicService(obj, obj.packages, obj.distanceKm);
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
      const data = { ...service, packages: filteredPackages };

      return res.status(200).json({
        success: true,
        data: isOwner || isAdmin
          ? data
          : toPublicService(data, filteredPackages)
      });
    }

    const service = await CateringService.findById(id);
    if (!service || (service.isArchived && !isAdmin)) {
      return res.status(404).json({
        success: false,
        message: 'Catering service not found.'
      });
    }

    const isOwner = service.vendorId && service.vendorId.toString() === userId;
    const obj = service.toObject();
    obj.packages = (obj.packages || []).filter((p) => isOwner || !p.isArchived);
    const data = isOwner || isAdmin ? obj : toPublicService(obj, obj.packages);

    return res.status(200).json({
      success: true,
      data
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
        city: sanitized.city || '',
        locality: sanitized.locality || '',
        fullAddress: sanitized.fullAddress || '',
        ...(sanitized.location !== undefined && sanitized.location !== null && {
          location: sanitized.location
        }),
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
        ...(sanitized.maxGuests !== undefined && sanitized.maxGuests !== null && {
          maxGuests: sanitized.maxGuests
        }),
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

      const validation = validatePackageInput(req.body, true, service.packages[pkgIndex]);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Package validation failed.',
          errors: validation.errors
        });
      }

      service.packages[pkgIndex] = {
        ...service.packages[pkgIndex],
        ...validation.sanitized,
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

    const validation = validatePackageInput(req.body, true, pkg);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Package validation failed.',
        errors: validation.errors
      });
    }

    Object.keys(validation.sanitized).forEach((key) => {
      pkg[key] = validation.sanitized[key];
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
