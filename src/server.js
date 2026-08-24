require('dotenv').config();

const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const auth = require('./middleware/auth');
const User = require('./models/User');
const Message = require('./models/Message');

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    credentials: true,
  },
});

app.set('trust proxy', 1);

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

app.use(
  express.json({
    limit: '1mb',
  })
);

app.use(
  cookieParser(
    process.env.COOKIE_SECRET
  )
);

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

/* HEALTH */
app.get(
  '/api/health',
  (req, res) => {
    res.json({
      ok: true,
      service:
        'AL-Hammad Academy API',
    });
  }
);

/* ROUTES */
app.use(
  '/api/auth',
  require('./routes/auth')
);

app.use(
  '/api/admin',
  require('./routes/admin')
);

app.use(
  '/api/content',
  require('./routes/content')
);

app.use(
  '/api/grades',
  require('./routes/grades')
);

app.use(
  '/api/dashboard',
  require('./routes/dashboard')
);

app.use(
  '/api/chat',
  require('./routes/chat')
);

/*
 * SOCKET AUTHENTICATION
 */
io.use(
  async (socket, next) => {
    try {
      const cookieHeader =
        socket.handshake.headers
          .cookie || '';

      const match =
        cookieHeader.match(
          /(?:^|;\s*)academy_token=([^;]+)/
        );

      if (!match) {
        return next(
          new Error('Unauthorized')
        );
      }

      const token =
        decodeURIComponent(match[1]);

      const payload =
        jwt.verify(
          token,
          process.env.JWT_SECRET
        );

      if (!payload?.id) {
        return next(
          new Error('Unauthorized')
        );
      }

      const user =
        await User.findById(
          payload.id
        ).select(
          '-passwordHash'
        );

      if (!user || !user.active) {
        return next(
          new Error('Unauthorized')
        );
      }

      socket.user = user;

      next();
    } catch (error) {
      console.error(
        'SOCKET AUTH ERROR:',
        error.message
      );

      next(
        new Error('Unauthorized')
      );
    }
  }
);

/*
 * SOCKET CHAT
 *
 * IMPORTANT:
 * Every sent message is saved in MongoDB
 * BEFORE it is broadcast.
 *
 * Therefore:
 * - receiver can receive it live
 * - conversation remains after refresh
 * - history remains after closing/reopening chat
 */
io.on(
  'connection',
  (socket) => {
    console.log(
      `CHAT CONNECTED: ${socket.user.username}`
    );

    socket.on(
      'joinConversation',
      ({ userId }) => {
        if (!userId) return;

        const room = [
          String(socket.user._id),
          String(userId),
        ]
          .sort()
          .join(':');

        socket.join(room);
      }
    );

    socket.on(
      'sendMessage',
      async (
        { to, text },
        callback
      ) => {
        try {
          const cleanText =
            String(text || '').trim();

          if (!to || !cleanText) {
            if (callback) {
              callback({
                ok: false,
                message:
                  'Message is empty.',
              });
            }

            return;
          }

          if (cleanText.length > 5000) {
            if (callback) {
              callback({
                ok: false,
                message:
                  'Message is too long.',
              });
            }

            return;
          }

          const receiver =
            await User.findOne({
              _id: to,
              active: true,
            }).select('_id');

          if (!receiver) {
            if (callback) {
              callback({
                ok: false,
                message:
                  'Receiver not found.',
              });
            }

            return;
          }

          const savedMessage =
            await Message.create({
              from: socket.user._id,
              to: receiver._id,
              text: cleanText,
              type: 'text',
            });

          const message =
            savedMessage.toObject();

          const room = [
            String(socket.user._id),
            String(receiver._id),
          ]
            .sort()
            .join(':');

          /*
           * Send to every socket currently
           * connected to this conversation.
           */
          io.to(room).emit(
            'message',
            message
          );

          /*
           * Also emit directly to receiver's
           * personal socket room.
           *
           * This helps when receiver is online
           * but has not opened the conversation.
           */
          io.to(
            `user:${String(
              receiver._id
            )}`
          ).emit(
            'message',
            message
          );

          if (callback) {
            callback({
              ok: true,
              message,
            });
          }
        } catch (error) {
          console.error(
            'SEND MESSAGE ERROR:',
            error
          );

          if (callback) {
            callback({
              ok: false,
              message:
                'Unable to send message.',
            });
          }
        }
      }
    );

    /*
     * Every connected user gets a private room.
     */
    socket.join(
      `user:${String(
        socket.user._id
      )}`
    );

    socket.on(
      'disconnect',
      () => {
        console.log(
          `CHAT DISCONNECTED: ${socket.user.username}`
        );
      }
    );
  }
);

/* ERROR HANDLER */
app.use(
  (err, req, res, next) => {
    console.error(err);

    res.status(500).json({
      message:
        'Internal server error',
    });
  }
);

/*
 * DATABASE + SERVER
 */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    const port =
      process.env.PORT || 5000;

    server.listen(
      port,
      () => {
        console.log(
          `API running on ${port}`
        );
      }
    );
  })
  .catch((error) => {
    console.error(
      'MongoDB connection failed',
      error
    );

    process.exit(1);
  });