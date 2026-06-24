const express = require('express');
const router = express.Router();
const { checkUserExists, getUserSettings, updateUserSettings } = require('../controllers/userController');

router.post('/check', checkUserExists);
router.get('/settings/:uid', getUserSettings);
router.put('/settings/:uid', updateUserSettings);

module.exports = router;
