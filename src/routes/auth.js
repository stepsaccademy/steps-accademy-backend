const router = require("express").Router();

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const User = require("../models/User");
const Device = require("../models/Device");

const auth = require("../middleware/auth");
const sendCode = require("../utils/email");

function token(id) {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function safe(u) {
  return {
    id: u._id,
    role: u.role,
    name: u.name,
    username: u.username,
    email: u.email,
    phone: u.phone,
    studentId: u.studentId,
    teacherId: u.teacherId,
    subjects: u.subjects,
    className: u.className,
    avatar: u.avatar
  };
}

function cookieOptions(maxAge) {
  return {
    httpOnly: true,
    sameSite: "none",
    secure: true,
    maxAge
  };
}


/*
==================================================
SEED ADMIN
==================================================
*/

router.post("/seed-admin", async (req, res) => {
  try {
    if (process.env.NODE_ENV === "production") {
      return res.status(404).end();
    }

    const { name, username, email, password } = req.body;

    if (!username || !password || !email) {
      return res.status(400).json({
        message: "Username, email and password are required"
      });
    }

    const normalizedUsername = String(username)
      .trim()
      .toLowerCase();

    const existing = await User.findOne({
      username: normalizedUsername
    });

    if (existing) {
      return res.status(409).json({
        message: "Username already exists"
      });
    }

    const user = await User.create({
      role: "admin",
      name: String(name || "Step Academy Principal").trim(),
      username: normalizedUsername,
      email: String(email).trim().toLowerCase(),
      passwordHash: await bcrypt.hash(String(password), 12),
      active: true
    });

    return res.json({
      message: "Admin created successfully",
      user: safe(user)
    });

  } catch (error) {
    console.error("SEED ADMIN ERROR:", error);

    return res.status(500).json({
      message: "Unable to create admin"
    });
  }
});

/*
==================================================
LOGIN
==================================================
*/

router.post("/login", async (req, res) => {
  try {
    let { role, username, password } = req.body;

    if (!role || !username || !password) {
      return res.status(400).json({
        message: "Role, username and password are required"
      });
    }

    role = String(role).trim().toLowerCase();

    username = String(username)
      .trim()
      .toLowerCase();

    password = String(password);

    const allowedRoles = [
      "student",
      "teacher",
      "admin"
    ];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        message: "Invalid role"
      });
    }

    console.log(
      `LOGIN ATTEMPT -> role=${role}, username=${username}`
    );

    const user = await User.findOne({
      role,
      username,
      active: true
    });

    if (!user) {
      console.log(
        `LOGIN FAILED -> user not found: ${role}/${username}`
      );

      return res.status(401).json({
        message: "Invalid username or password"
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!passwordMatches) {
      console.log(
        `LOGIN FAILED -> wrong password: ${role}/${username}`
      );

      return res.status(401).json({
        message: "Invalid username or password"
      });
    }

    /*
    ==============================================
    ADMIN DEVICE AUTHENTICATION
    ==============================================
    */

    if (role === "admin") {

      const trustedDevice =
        req.cookies?.academy_device;

      if (trustedDevice) {

        const tokenHash = crypto
          .createHash("sha256")
          .update(trustedDevice)
          .digest("hex");

        const device = await Device.findOne({
          user: user._id,
          tokenHash,
          expiresAt: {
            $gt: new Date()
          }
        });

        if (device) {

          device.lastSeen = new Date();
          await device.save();

          res.cookie(
            "academy_token",
            token(user._id),
            cookieOptions(7 * 24 * 60 * 60 * 1000)
          );

          return res.json({
            user: safe(user)
          });
        }
      }

      /*
      ----------------------------------------------
      NEW ADMIN DEVICE -> OTP
      ----------------------------------------------
      */

      const code = String(
        Math.floor(
          100000 + Math.random() * 900000
        )
      );

      const pendingToken = jwt.sign(
        {
          id: user._id,
          code
        },
        process.env.JWT_SECRET,
        {
          expiresIn: "10m"
        }
      );

      res.cookie(
        "academy_pending",
        pendingToken,
        cookieOptions(10 * 60 * 1000)
      );

      await sendCode(
        user.email ||
        process.env.ADMIN_VERIFY_EMAIL,
        code
      );

      console.log(
        `ADMIN OTP SENT -> ${user.email || process.env.ADMIN_VERIFY_EMAIL}`
      );

      return res.json({
        requiresOtp: true
      });
    }

    /*
    ==============================================
    STUDENT / TEACHER LOGIN
    ==============================================
    */

    res.cookie(
      "academy_token",
      token(user._id),
      cookieOptions(7 * 24 * 60 * 60 * 1000)
    );

    return res.json({
      user: safe(user)
    });

  } catch (error) {

    console.error("LOGIN ERROR:", error);

    return res.status(500).json({
      message: "Login failed"
    });
  }
});

router.post("/resend-code", async (req, res) => {
  try {
    const pending = req.cookies?.academy_pending;

    if (!pending) {
      return res.status(400).json({
        message: "Verification session expired. Login again."
      });
    }

    const payload = jwt.verify(
      pending,
      process.env.JWT_SECRET
    );

    if (!payload?.id) {
      return res.status(400).json({
        message: "Verification session expired. Login again."
      });
    }

    const user = await User.findById(payload.id);

    if (!user || user.role !== "admin" || !user.active) {
      return res.status(401).json({
        message: "Unable to resend verification code."
      });
    }

    const code = String(
      Math.floor(100000 + Math.random() * 900000)
    );

    const newPendingToken = jwt.sign(
      {
        id: user._id,
        code
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "10m"
      }
    );

    res.cookie(
      "academy_pending",
      newPendingToken,
      cookieOptions(10 * 60 * 1000)
    );

    await sendCode(
      user.email || process.env.ADMIN_VERIFY_EMAIL,
      code,
      "admin"
    );

    console.log(
      `ADMIN OTP RESENT -> ${
        user.email || process.env.ADMIN_VERIFY_EMAIL
      }`
    );

    return res.json({
      message: "A new verification code has been sent."
    });

  } catch (error) {
    console.error("RESEND OTP ERROR:", error.message);

    return res.status(400).json({
      message: "Unable to resend code. Login again."
    });
  }
});

/*
==================================================
VERIFY ADMIN DEVICE
==================================================
*/

router.post("/verify-device", async (req, res) => {
  try {

    const pending = req.cookies?.academy_pending;

    if (!pending) {
      return res.status(400).json({
        message: "Verification session expired"
      });
    }

    const payload = jwt.verify(
      pending,
      process.env.JWT_SECRET
    );

    if (
      !payload?.id ||
      !payload?.code ||
      String(payload.code) !== String(req.body.otp)
    ) {
      return res.status(400).json({
        message: "Invalid verification code"
      });
    }

    const rawDeviceToken =
      crypto.randomBytes(32).toString("hex");

    const tokenHash = crypto
      .createHash("sha256")
      .update(rawDeviceToken)
      .digest("hex");

    await Device.create({
      user: payload.id,
      tokenHash,
      label: "Trusted browser",
      lastSeen: new Date(),
      expiresAt: new Date(
        Date.now() + 365 * 24 * 60 * 60 * 1000
      )
    });

    const user = await User.findById(payload.id);

    if (!user || !user.active) {
      return res.status(401).json({
        message: "Admin account unavailable"
      });
    }

    res.clearCookie("academy_pending");

    res.cookie(
      "academy_device",
      rawDeviceToken,
      cookieOptions(365 * 24 * 60 * 60 * 1000)
    );

    res.cookie(
      "academy_token",
      token(user._id),
      cookieOptions(7 * 24 * 60 * 60 * 1000)
    );

    return res.json({
      user: safe(user)
    });

  } catch (error) {
    console.error("VERIFY DEVICE ERROR:", {
      name: error.name,
      message: error.message,
      code: error.code,
    });

    if (error.name === "TokenExpiredError") {
      return res.status(400).json({
        message: "Verification token expired."
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(400).json({
        message: "Verification token is invalid."
      });
    }

    return res.status(400).json({
      message: "Verification failed."
    });
  }
});
/*
==================================================
CURRENT USER
==================================================
*/

router.get(
  "/me",
  auth,
  (req, res) => {
    return res.json({
      user: safe(req.user)
    });
  }
);

/*
==================================================
LOGOUT
==================================================
*/

router.post("/logout", (req, res) => {

  res.clearCookie("academy_token");

  return res.json({
    ok: true
  });
});

/*
==================================================
PROFILE UPDATE
==================================================
*/

router.patch(
  "/profile",
  auth,
  async (req, res) => {

    try {

      const allowed = [
        "name",
        "username",
        "email",
        "phone"
      ];

      for (const field of allowed) {

        if (req.body[field] !== undefined) {

          let value = String(req.body[field]).trim();

          if (
            field === "username" ||
            field === "email"
          ) {
            value = value.toLowerCase();
          }

          req.user[field] = value;
        }
      }

      if (req.body.password) {

        req.user.passwordHash =
          await bcrypt.hash(
            String(req.body.password),
            12
          );
      }

      await req.user.save();

      return res.json({
        message: "Profile updated",
        user: safe(req.user)
      });

    } catch (error) {

      console.error(
        "PROFILE UPDATE ERROR:",
        error
      );

      return res.status(500).json({
        message: "Profile update failed"
      });
    }
  }
);

/*
==================================================
FORGOT PASSWORD - SEND CODE
==================================================
*/

router.post("/forgot-password", async (req, res) => {
  try {
    let { role, username } = req.body;

    role = String(role || "").trim().toLowerCase();
    username = String(username || "").trim().toLowerCase();

    if (!role || !username) {
      return res.status(400).json({
        message: "Role and username are required."
      });
    }

    const allowedRoles = [
      "student",
      "teacher",
      "admin"
    ];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        message: "Invalid role."
      });
    }

    const user = await User.findOne({
      role,
      username,
      active: true
    });

    /*
      Security:
      We don't reveal whether account exists.
    */

    if (!user || !user.email) {
      return res.json({
        message:
          "If the account exists and has an email, a verification code has been sent."
      });
    }

    const code = String(
      Math.floor(100000 + Math.random() * 900000)
    );

    const resetToken = jwt.sign(
      {
        id: user._id,
        code,
        purpose: "password-reset"
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "10m"
      }
    );

    res.cookie(
      "academy_reset",
      resetToken,
      cookieOptions(10 * 60 * 1000)
    );

    await sendCode(
      user.email,
      code,
      "forgot-password"
    );

    console.log(
      `PASSWORD RESET OTP SENT -> ${user.email}`
    );

    return res.json({
      message:
        "If the account exists and has an email, a verification code has been sent."
    });

  } catch (error) {
    console.error(
      "FORGOT PASSWORD ERROR:",
      error
    );

    return res.status(500).json({
      message: "Unable to process password reset."
    });
  }
});


/*
==================================================
RESEND PASSWORD RESET CODE
==================================================
*/

router.post("/resend-reset-code", async (req, res) => {
  try {
    const resetCookie = req.cookies?.academy_reset;

    if (!resetCookie) {
      return res.status(400).json({
        message: "Password reset session expired."
      });
    }

    const payload = jwt.verify(
      resetCookie,
      process.env.JWT_SECRET
    );

    if (
      !payload?.id ||
      payload.purpose !== "password-reset"
    ) {
      return res.status(400).json({
        message: "Password reset session expired."
      });
    }

    const user = await User.findById(payload.id);

    if (!user || !user.active || !user.email) {
      return res.status(400).json({
        message: "Unable to resend code."
      });
    }

    const code = String(
      Math.floor(100000 + Math.random() * 900000)
    );

    const newResetToken = jwt.sign(
      {
        id: user._id,
        code,
        purpose: "password-reset"
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "10m"
      }
    );

    res.cookie(
      "academy_reset",
      newResetToken,
      cookieOptions(10 * 60 * 1000)
    );

    await sendCode(
      user.email,
      code,
      "forgot-password"
    );

    return res.json({
      message: "A new password reset code has been sent."
    });

  } catch (error) {
    console.error(
      "RESEND RESET ERROR:",
      error.message
    );

    return res.status(400).json({
      message: "Unable to resend code."
    });
  }
});


/*
==================================================
VERIFY PASSWORD RESET CODE
==================================================
*/

router.post("/verify-reset-code", async (req, res) => {
  try {
    const resetCookie = req.cookies?.academy_reset;

    if (!resetCookie) {
      return res.status(400).json({
        message: "Verification expired. Start again."
      });
    }

    const payload = jwt.verify(
      resetCookie,
      process.env.JWT_SECRET
    );

    if (
      !payload?.id ||
      payload.purpose !== "password-reset"
    ) {
      return res.status(400).json({
        message: "Invalid verification session."
      });
    }

    if (
      String(payload.code) !==
      String(req.body.otp || "")
    ) {
      return res.status(400).json({
        message: "Invalid verification code."
      });
    }

    const verifiedToken = jwt.sign(
      {
        id: payload.id,
        purpose: "password-reset-verified"
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "10m"
      }
    );

    res.cookie(
      "academy_reset_verified",
      verifiedToken,
      cookieOptions(10 * 60 * 1000)
    );

    return res.json({
      message: "Code verified successfully."
    });

  } catch (error) {
    console.error(
      "VERIFY RESET ERROR:",
      error.message
    );

    return res.status(400).json({
      message: "Verification expired. Start again."
    });
  }
});


/*
==================================================
RESET PASSWORD
==================================================
*/

router.post("/reset-password", async (req, res) => {
  try {
    const verifiedCookie =
      req.cookies?.academy_reset_verified;

    if (!verifiedCookie) {
      return res.status(400).json({
        message: "Password reset verification expired."
      });
    }

    const payload = jwt.verify(
      verifiedCookie,
      process.env.JWT_SECRET
    );

    if (
      !payload?.id ||
      payload.purpose !== "password-reset-verified"
    ) {
      return res.status(400).json({
        message: "Invalid password reset session."
      });
    }

    const password = String(
      req.body.password || ""
    );

    if (password.length < 8) {
      return res.status(400).json({
        message:
          "Password must contain at least 8 characters."
      });
    }

    const user = await User.findById(payload.id);

    if (!user || !user.active) {
      return res.status(400).json({
        message: "Account unavailable."
      });
    }

    user.passwordHash =
      await bcrypt.hash(password, 12);

    await user.save();

    res.clearCookie("academy_reset");
    res.clearCookie("academy_reset_verified");

    return res.json({
      message: "Password reset successfully."
    });

  } catch (error) {
    console.error(
      "RESET PASSWORD ERROR:",
      error.message
    );

    return res.status(400).json({
      message: "Password reset session expired."
    });
  }
});

module.exports = router;