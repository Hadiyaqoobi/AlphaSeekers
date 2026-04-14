const nodemailer = require("nodemailer");

// Usage: SMTP_USER=x SMTP_PASS=x node reply-email.js <to> <subject> <body>
// Or pipe HTML body via environment: EMAIL_HTML="<html>...</html>"

async function main() {
  const to = process.env.EMAIL_TO;
  const subject = process.env.EMAIL_SUBJECT;
  const body = process.env.EMAIL_BODY || "";
  const htmlBody = process.env.EMAIL_HTML || "";

  if (!to || !subject) {
    console.error("Usage: EMAIL_TO=x EMAIL_SUBJECT=x EMAIL_BODY=x node reply-email.js");
    process.exit(1);
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
  };

  if (htmlBody) {
    mailOptions.html = htmlBody;
    mailOptions.text = body || htmlBody.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  } else {
    mailOptions.text = body;
  }

  const info = await transporter.sendMail(mailOptions);
  console.log("Reply sent successfully:", info.messageId);
}

main().catch(console.error);
