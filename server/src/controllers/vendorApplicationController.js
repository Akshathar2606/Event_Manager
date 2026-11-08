const mongoose = require('mongoose');
const { VendorApplication } = require('../models/VendorApplication');
const { isValidObjectId } = require('../utils/venueValidation');
const { deliverNotification } = require('../services/workflowService');

const APPLICATION_STATUSES = ['pending', 'approved', 'rejected'];

const getApplicationStore = (req) => {
  if (process.env.NODE_ENV === 'production') return null;
  return req.app?.locals?.mockVendorApplicationStore || null;
};

const toApplicationResponse = (application, vendor) => ({
  id: application.id || application._id?.toString(),
  vendor: vendor
    ? { id: vendor.id || vendor._id?.toString(), name: vendor.name, email: vendor.email }
    : null,
  businessName: application.businessName,
  businessCategory: application.businessCategory,
  businessDescription: application.businessDescription,
  contactNumber: application.contactNumber,
  city: application.city,
  locality: application.locality,
  servicesOffered: application.servicesOffered || [],
  status: application.status,
  rejectionReason: application.rejectionReason || '',
  reviewedAt: application.reviewedAt || null,
  createdAt: application.createdAt,
  updatedAt: application.updatedAt
});

const getVendorFromStore = (req, vendorId) => {
  const users = req.app?.locals?.mockUserStore;
  return users?.get(String(vendorId)) || null;
};

const listVendorApplications = async (req, res, next) => {
  try {
    const status = req.query.status || 'pending';
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;
    if (status !== 'all' && !APPLICATION_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: all, ${APPLICATION_STATUSES.join(', ')}.`
      });
    }

    const applicationStore = getApplicationStore(req);
    if (applicationStore) {
      let applications = Array.from(applicationStore.values());
      if (status !== 'all') applications = applications.filter((app) => app.status === status);
      applications.sort((a, b) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
      const total = applications.length;
      const data = applications.slice(skip, skip + limit).map((application) =>
        toApplicationResponse(application, getVendorFromStore(req, application.vendorId))
      );
      return res.status(200).json({
        success: true,
        data,
        pagination: { total, page, pages: Math.ceil(total / limit) || 1, limit }
      });
    }

    const filter = status === 'all' ? {} : { status };
    const [applications, total] = await Promise.all([
      VendorApplication.find(filter)
        .populate('vendorId', 'name email')
        .sort({ createdAt: -1, _id: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      VendorApplication.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      data: applications.map((application) =>
        toApplicationResponse(application, application.vendorId)
      ),
      pagination: { total, page, pages: Math.ceil(total / limit) || 1, limit }
    });
  } catch (error) {
    next(error);
  }
};

const reviewApplication = async (req, res, next, nextStatus) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid vendor application ID.' });
    }

    let rejectionReason = '';
    if (nextStatus === 'rejected') {
      const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
        ? req.body
        : {};
      if (Object.keys(body).some((field) => field !== 'reason')) {
        return res.status(400).json({
          success: false,
          message: 'Only a rejection reason may be provided.'
        });
      }
      if (typeof body.reason !== 'string' || body.reason.trim().length < 5 || body.reason.trim().length > 500) {
        return res.status(400).json({
          success: false,
          message: 'A rejection reason between 5 and 500 characters is required.'
        });
      }
      rejectionReason = body.reason.trim();
    } else if (req.body && Object.keys(req.body).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Approval requests cannot include additional fields.'
      });
    }

    const applicationStore = getApplicationStore(req);
    if (applicationStore) {
      const application = Array.from(applicationStore.values()).find(
        (candidate) => String(candidate.id || candidate._id) === id
      );
      if (!application) {
        return res.status(404).json({ success: false, message: 'Vendor application not found.' });
      }
      if (String(application.vendorId) === String(req.user.id)) {
        return res.status(403).json({ success: false, message: 'Administrators cannot review their own vendor application.' });
      }
      const vendor = getVendorFromStore(req, application.vendorId);
      if (vendor && vendor.role !== 'vendor') {
        return res.status(409).json({ success: false, message: 'Application owner is not a vendor account.' });
      }
      if (application.status !== 'pending') {
        return res.status(409).json({ success: false, message: 'This vendor application has already been reviewed.' });
      }
      application.status = nextStatus;
      application.rejectionReason = rejectionReason;
      application.reviewedBy = req.user.id;
      application.reviewedAt = new Date().toISOString();
      application.updatedAt = application.reviewedAt;
      await deliverNotification(req, {
        recipientId: application.vendorId,
        actorId: req.user.id,
        type: nextStatus === 'approved' ? 'vendor_application_approved' : 'vendor_application_rejected',
        title: nextStatus === 'approved' ? 'Vendor application approved' : 'Vendor application rejected',
        message: nextStatus === 'approved'
          ? 'Your vendor application has been approved.'
          : 'Your vendor application has been rejected.',
        entityType: 'vendorApplication',
        entityId: application.id || application._id,
        dedupeKey: `vendor-application-${nextStatus}:${application.id || application._id}`
      });
      return res.status(200).json({
        success: true,
        message: `Vendor application ${nextStatus}.`,
        data: toApplicationResponse(application, vendor)
      });
    }

    const application = await VendorApplication.findById(id).populate('vendorId', 'name email role');
    if (!application) {
      return res.status(404).json({ success: false, message: 'Vendor application not found.' });
    }
    if (String(application.vendorId?._id) === String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Administrators cannot review their own vendor application.' });
    }
    if (application.vendorId?.role !== 'vendor') {
      return res.status(409).json({ success: false, message: 'Application owner is not a vendor account.' });
    }

    const reviewedAt = new Date();
    const updatedApplication = await VendorApplication.findOneAndUpdate(
      { _id: id, status: 'pending' },
      {
        $set: {
          status: nextStatus,
          rejectionReason,
          reviewedBy: new mongoose.Types.ObjectId(req.user.id),
          reviewedAt
        }
      },
      { new: true, runValidators: true }
    ).populate('vendorId', 'name email');
    if (!updatedApplication) {
      return res.status(409).json({ success: false, message: 'This vendor application has already been reviewed.' });
    }
    await deliverNotification(req, {
      recipientId: updatedApplication.vendorId._id || updatedApplication.vendorId,
      actorId: req.user.id,
      type: nextStatus === 'approved' ? 'vendor_application_approved' : 'vendor_application_rejected',
      title: nextStatus === 'approved' ? 'Vendor application approved' : 'Vendor application rejected',
      message: nextStatus === 'approved'
        ? 'Your vendor application has been approved.'
        : 'Your vendor application has been rejected.',
      entityType: 'vendorApplication',
      entityId: updatedApplication._id,
      dedupeKey: `vendor-application-${nextStatus}:${updatedApplication._id}`
    });
    return res.status(200).json({
      success: true,
      message: `Vendor application ${nextStatus}.`,
      data: toApplicationResponse(updatedApplication, updatedApplication.vendorId)
    });
  } catch (error) {
    next(error);
  }
};

const approveVendorApplication = (req, res, next) =>
  reviewApplication(req, res, next, 'approved');

const rejectVendorApplication = (req, res, next) =>
  reviewApplication(req, res, next, 'rejected');

module.exports = {
  listVendorApplications,
  approveVendorApplication,
  rejectVendorApplication
};
