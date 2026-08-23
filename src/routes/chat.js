const router = require('express').Router();

const User = require('../models/User');
const Message = require('../models/Message');

const auth = require('../middleware/auth');

function escapeRegex(value) {
  return String(value || '').replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  );
}

/*
 * Search academy members.
 *
 * Phone number is intentionally returned ONLY to admin.
 * Students and teachers see names/usernames/roles,
 * not other people's phone numbers.
 */
router.get(
  '/users',
  auth,
  async (req, res) => {
    try {
      const q = String(
        req.query.q || ''
      ).trim();

      if (q.length < 2) {
        return res.json({
          users: [],
        });
      }

      const re = new RegExp(
        escapeRegex(q),
        'i'
      );

      const users = await User.find({
        active: true,
        _id: {
          $ne: req.user._id,
        },
        $or: [
          { name: re },
          { username: re },
          { studentId: re },
          { teacherId: re },
          { phone: re },
        ],
      })
        .select(
          'name username role studentId teacherId phone avatar'
        )
        .limit(30)
        .lean();

      const safeUsers = users.map(
        (person) => {
          const output = {
            _id: person._id,
            name: person.name,
            username: person.username,
            role: person.role,
            studentId: person.studentId,
            teacherId: person.teacherId,
            avatar: person.avatar,
          };

          if (req.user.role === 'admin') {
            output.phone = person.phone;
          }

          return output;
        }
      );

      return res.json({
        users: safeUsers,
      });
    } catch (error) {
      console.error(
        'CHAT SEARCH ERROR:',
        error
      );

      return res.status(500).json({
        message: 'Unable to search chat users.',
      });
    }
  }
);

/*
 * Get one user safely.
 */
router.get(
  '/user/:id',
  auth,
  async (req, res) => {
    try {
      const person = await User.findOne({
        _id: req.params.id,
        active: true,
      })
        .select(
          'name username role studentId teacherId phone avatar'
        )
        .lean();

      if (!person) {
        return res.status(404).json({
          message: 'User not found.',
        });
      }

      const output = {
        _id: person._id,
        name: person.name,
        username: person.username,
        role: person.role,
        studentId: person.studentId,
        teacherId: person.teacherId,
        avatar: person.avatar,
      };

      if (req.user.role === 'admin') {
        output.phone = person.phone;
      }

      return res.json({
        user: output,
      });
    } catch (error) {
      console.error(
        'CHAT USER ERROR:',
        error
      );

      return res.status(500).json({
        message: 'Unable to open user.',
      });
    }
  }
);

/*
 * Persistent conversation history.
 */
router.get(
  '/messages/:userId',
  auth,
  async (req, res) => {
    try {
      const otherUserId =
        req.params.userId;

      const messages =
        await Message.find({
          $or: [
            {
              from: req.user._id,
              to: otherUserId,
            },
            {
              from: otherUserId,
              to: req.user._id,
            },
          ],
        })
          .sort({
            createdAt: 1,
          })
          .limit(1000)
          .lean();

      return res.json({
        messages,
      });
    } catch (error) {
      console.error(
        'CHAT HISTORY ERROR:',
        error
      );

      return res.status(500).json({
        message:
          'Unable to load conversation history.',
      });
    }
  }
);

module.exports = router;