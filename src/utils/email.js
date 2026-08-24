const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendCode(to, code, purpose = "admin") {
  let subject = "Step Academy — Verification Code";
  let title = "Verification Code";
  let message = "Use this code to continue.";

  if (purpose === "admin") {
    subject = "AL-Hammad Academy — Admin Verification Code";
    title = "Admin Verification";
    message = "Use this code to verify your admin login.";
  }

  if (purpose === "forgot-password") {
    subject = "AL-Hammad Academy — Password Reset Code";
    title = "Password Reset";
    message = "Use this code to reset your AL-Hammad Academy password.";
  }

  const html = `
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
          AL-Hammad Academy
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
  `;

  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || "onboarding@resend.dev",
    to: [to],
    subject,
    text: `${message}\n\nYour verification code is ${code}.\n\nThis code expires in 10 minutes.`,
    html,
  });

  if (error) {
    console.error("RESEND EMAIL ERROR:", error);
    throw new Error("Failed to send verification email");
  }

  console.log("Verification email sent:", data);
  return data;
}

module.exports = sendCode;