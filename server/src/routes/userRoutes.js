const express = require('express');
const { getUsers, updateUserStatus } = require('../controllers/adminUserController');
const { verifyToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

const router = express.Router();

router.get('/', verifyToken, authorizeRoles('administrator'), getUsers);
router.patch('/:id/status', verifyToken, authorizeRoles('administrator'), updateUserStatus);

module.exports = router;
