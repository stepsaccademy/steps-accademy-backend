const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendCode(to, code, purpose = "admin") {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log(`[DEV OTP] ${to}: ${code}`);
    return;
  }

  let subject = "Step Academy — Verification Code";
  let title = "Verification Code";
  let message = "Use this code to continue.";

  if (purpose === "admin") {
    subject =
      "Step Academy — Admin Verification Code";
    title = "Admin Verification";
    message =
      "Use this code to verify your admin login.";
  }

  if (purpose === "forgot-password") {
    subject =
      "Step Sciences Academy — Password Reset Code";
    title = "Password Reset";
    message =
      "Use this code to reset your Step Academy password.";
  }

  await transporter.sendMail({
    from: `"Step Sciences Academy" <${process.env.SMTP_USER}>`,
    to,
    subject,
    text: `${message}\n\nYour verification code is ${code}.\n\nThis code expires in 10 minutes.`,
    html: `
      <div style="
        margin:0;
        padding:40px 20px;
        background:#080b12;
        font-family:Arial,sans-serif;
      ">
        <div style="
          max-width:520px;
          margin:auto;
          background:#111722;
          border:1px solid #263142;
          border-radius:20px;
          padding:35px;
          color:#ffffff;
          text-align:center;
        ">

          <h1 style="
            margin:0 0 10px;
            font-size:26px;
          ">
            Step SCIENCES ACADEMY
          </h1>

          <h2 style="
            margin:25px 0 10px;
          ">
            ${title}
          </h2>

          <p style="
            color:#aeb8c7;
            line-height:1.7;
          ">
            ${message}
          </p>

          <div style="
            margin:30px auto;
            padding:18px;
            max-width:250px;
            border-radius:14px;
            background:#182231;
            font-size:32px;
            font-weight:700;
            letter-spacing:8px;
          ">
            ${code}
          </div>

          <p style="
            color:#8d99aa;
            font-size:13px;
          ">
            This code expires in 10 minutes.
          </p>

          <p style="
            color:#6f7b8c;
            font-size:12px;
            margin-top:25px;
          ">
            If you did not request this code, please ignore this email.
          </p>

        </div>
      </div>
    `,
  });
}

module.exports = sendCode;