const express = require('express');
const router = express.Router();
const { checkUserExists } = require('../controllers/userController');

router.post('/check', checkUserExists);

module.exports = router;
