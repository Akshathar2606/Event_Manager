const requireApprovedVendor = (req, res, next) => {
  if (!req.user || req.user.role !== 'vendor') return next();

  const status = req.user.vendorApplicationStatus || 'approved';
  if (status === 'approved') return next();

  const isRejected = status === 'rejected';
  return res.status(403).json({
    success: false,
    code: isRejected ? 'VENDOR_APPLICATION_REJECTED' : 'VENDOR_APPLICATION_PENDING',
    message: isRejected
      ? 'Vendor access is unavailable because the application was rejected.'
      : 'Vendor access is pending administrator approval.',
    ...(isRejected && req.user.vendorRejectionReason && {
      rejectionReason: req.user.vendorRejectionReason
    })
  });
};

module.exports = {
  requireApprovedVendor
};
