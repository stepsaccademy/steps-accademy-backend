const router = require('express').Router();

const Content = require('../models/Content');
const auth = require('../middleware/auth');
const { roles } = auth;

/* =========================
   PUBLIC / APPROVED
========================= */

router.get(
  '/announcements',
  async (req, res) => {
    try {
      const announcements =
        await Content.find({
          type: 'announcement',
          status: 'approved',
        })
          .sort('-createdAt')
          .limit(50);

      res.json({ announcements });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        message: 'Unable to load announcements',
      });
    }
  }
);

router.get(
  '/books',
  async (req, res) => {
    try {
      const books =
        await Content.find({
          type: 'book',
          status: 'approved',
        })
          .sort('-createdAt')
          .limit(200);

      res.json({ books });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        message: 'Unable to load books',
      });
    }
  }
);

/* =========================
   TESTS
========================= */

router.get(
  '/tests',
  auth,
  async (req, res) => {
    try {
      const filter = {
        type: 'test',
        status: 'approved',
      };

      const tests =
        await Content.find(filter)
          .sort('-createdAt')
          .limit(200);

      res.json({ tests });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        message: 'Unable to load tests',
      });
    }
  }
);

/* =========================
   FILES
========================= */

router.get(
  '/files',
  auth,
  async (req, res) => {
    try {
      const filter = {
        type: 'file',
        status: 'approved',
      };

      const files =
        await Content.find(filter)
          .sort('-createdAt')
          .limit(200);

      res.json({ files });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        message: 'Unable to load files',
      });
    }
  }
);

/* =========================
   ADD ANNOUNCEMENT
========================= */

router.post(
  '/announcements',
  auth,
  async (req, res) => {
    try {
      const status =
        req.user.role === 'admin'
          ? 'approved'
          : 'pending';

      const content =
        await Content.create({
          ...req.body,
          type: 'announcement',
          createdBy: req.user._id,
          status,
        });

      res.status(201).json({
        message:
          status === 'approved'
            ? 'Announcement posted successfully'
            : 'Announcement submitted for approval',
        content,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          'Unable to create announcement',
      });
    }
  }
);

/* =========================
   ADD TEST
========================= */

router.post(
  '/tests',
  auth,
  async (req, res) => {
    try {
      const status =
        req.user.role === 'admin'
          ? 'approved'
          : 'pending';

      const content =
        await Content.create({
          ...req.body,
          type: 'test',
          createdBy: req.user._id,
          status,
        });

      res.status(201).json({
        message:
          status === 'approved'
            ? 'Test posted successfully'
            : 'Test submitted for approval',
        content,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: 'Unable to create test',
      });
    }
  }
);

/* =========================
   ADD FILE
========================= */

router.post(
  '/files',
  auth,
  async (req, res) => {
    try {
      const status =
        req.user.role === 'admin'
          ? 'approved'
          : 'pending';

      const content =
        await Content.create({
          ...req.body,
          type: 'file',
          createdBy: req.user._id,
          status,
        });

      res.status(201).json({
        message:
          status === 'approved'
            ? 'File posted successfully'
            : 'File submitted for approval',
        content,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: 'Unable to create file',
      });
    }
  }
);

/* =========================
   ADD BOOK
========================= */

router.post(
  '/books',
  auth,
  roles('admin'),
  async (req, res) => {
    try {
      const content =
        await Content.create({
          ...req.body,
          type: 'book',
          createdBy: req.user._id,
          status: 'approved',
        });

      res.status(201).json({
        message: 'Book added successfully',
        content,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: 'Unable to add book',
      });
    }
  }
);

module.exports = router;