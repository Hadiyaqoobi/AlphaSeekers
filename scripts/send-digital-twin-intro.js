const nodemailer = require("nodemailer");

async function main() {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
  .container { max-width: 640px; margin: 0 auto; background: #ffffff; }
  .header { background: linear-gradient(135deg, #1a1a2e, #16213e, #0f3460); padding: 40px 35px; text-align: center; }
  .header h1 { color: #ffffff; font-size: 26px; margin: 0; }
  .header .sub { color: #4da6ff; font-size: 14px; margin-top: 8px; letter-spacing: 3px; text-transform: uppercase; }
  .body { padding: 35px; }
  .body h2 { color: #1a1a2e; font-size: 22px; margin-top: 0; }
  .body p { color: #444; font-size: 15px; line-height: 1.8; }
  .intro-box { background: linear-gradient(135deg, #f0f4ff, #e8f0fe); border: 1px solid #c8d8f0; border-radius: 12px; padding: 25px; margin: 20px 0; text-align: center; }
  .intro-box h3 { color: #0f3460; font-size: 20px; margin: 0 0 10px 0; }
  .intro-box p { color: #555; font-size: 14px; margin: 4px 0; }
  .section { background: #f8f9fa; border-left: 4px solid #0f3460; border-radius: 0 8px 8px 0; padding: 18px 22px; margin: 20px 0; }
  .section h3 { color: #0f3460; margin: 0 0 10px 0; font-size: 16px; }
  .section ul { margin: 0; padding-left: 18px; color: #444; font-size: 14px; line-height: 2; }
  .highlight { background: #e8f5e9; border-left: 4px solid #4ecca3; border-radius: 0 8px 8px 0; padding: 18px 22px; margin: 20px 0; }
  .highlight h3 { color: #2e7d32; margin: 0 0 8px 0; font-size: 16px; }
  .highlight p { color: #444; font-size: 14px; margin: 0; line-height: 1.7; }
  .how-box { background: #fff3e0; border-left: 4px solid #e94560; border-radius: 0 8px 8px 0; padding: 18px 22px; margin: 20px 0; }
  .how-box h3 { color: #e94560; margin: 0 0 8px 0; font-size: 16px; }
  .how-box p { color: #444; font-size: 14px; margin: 0; line-height: 1.7; }
  .cta { background: #0f3460; color: #fff; text-align: center; padding: 25px; border-radius: 12px; margin: 25px 0; }
  .cta h3 { margin: 0 0 8px 0; font-size: 18px; }
  .cta p { color: #a8b4c8; font-size: 14px; margin: 0; }
  .cta a { color: #4da6ff; text-decoration: none; font-size: 16px; }
  .footer { background: #f8f9fa; padding: 25px 35px; text-align: center; border-top: 1px solid #eee; }
  .footer p { color: #999; font-size: 12px; margin: 4px 0; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>Meet Your New Mentor</h1>
    <div class="sub">Hadi AI &mdash; Digital Twin</div>
  </div>
  <div class="body">
    <h2>Hi Sahar,</h2>
    
    <p>I have something exciting to share with you. As AlphaSeekers grows, I want to make sure you always have support and guidance available — even when I'm not online or available in person.</p>
    
    <p>So I've built something:</p>
    
    <div class="intro-box">
      <h3>Hadi AI</h3>
      <p>A digital version of me — trained to think like me, work like me, and advise like me.</p>
      <p style="color: #0f3460; font-weight: 600; margin-top: 12px;">Your always-available mentor for AlphaSeekers.</p>
    </div>
    
    <p>Think of it as having a version of me that's always available to answer your questions, help you think through decisions, and support you as CEO of AlphaSeekers.</p>

    <div class="section">
      <h3>What Hadi AI Can Help You With</h3>
      <ul>
        <li><strong>Team Management</strong> — How to lead meetings, handle team issues, delegate tasks</li>
        <li><strong>Strategy</strong> — Decisions about programs, courses, expansion</li>
        <li><strong>Fundraising</strong> — Grant writing tips, funder research, proposal feedback</li>
        <li><strong>Board Building</strong> — How to recruit advisors, what to ask them</li>
        <li><strong>Platform Questions</strong> — How features work, what to prioritize</li>
        <li><strong>Presentation & Communication</strong> — How to present to partners, donors, or your team</li>
        <li><strong>General Advice</strong> — Anything about running AlphaSeekers</li>
      </ul>
    </div>

    <div class="how-box">
      <h3>How It Works</h3>
      <p>Simply reply to this email or send a new email to <strong>alphaseekers2026@gmail.com</strong> with any question, problem, or idea. Hadi AI will read your message and reply with thoughtful, detailed guidance — the same kind of advice I would give you.</p>
    </div>

    <div class="highlight">
      <h3>What You Should Know</h3>
      <p>This is an AI assistant built by me (Hadi) specifically for you and AlphaSeekers. It has deep knowledge about our platform, our team structure, nonprofit management, fundraising, and everything we've discussed. It thinks the way I think and gives the kind of advice I would give.</p>
      <p style="margin-top: 10px;">Of course, the real Hadi is always here too. If you ever need to talk to me directly, just say so in your email and I'll get back to you personally.</p>
    </div>

    <div class="cta">
      <h3>Try It Now</h3>
      <p>Reply to this email with any question about AlphaSeekers.</p>
      <p style="margin-top: 8px;">For example: <em>"How should I prepare for the team meeting?"</em></p>
      <p style="margin-top: 4px;">or <em>"What should I focus on this week?"</em></p>
      <p style="margin-top: 12px;"><a href="mailto:alphaseekers2026@gmail.com">alphaseekers2026@gmail.com</a></p>
    </div>

    <p>I built this because I believe in you and in AlphaSeekers. You deserve to have support available whenever you need it — and now you do.</p>
    
    <p style="margin-top: 25px;">With belief in everything you're building,<br><strong>Hadi Yaqoobi</strong></p>
    <p style="color: #999; font-size: 13px; margin-top: 5px;"><em>P.S. — Hadi AI will sign its emails as "Hadi AI" so you always know which Hadi you're talking to.</em></p>
  </div>
  <div class="footer">
    <p>AlphaSeekers — Empowering Afghan Students Through Education</p>
    <p>alphaseekers2026@gmail.com</p>
  </div>
</div>
</body>
</html>`;

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: "saharnikzad187@gmail.com",
    subject: "Meet Hadi AI — Your Always-Available Mentor for AlphaSeekers",
    html: htmlBody,
    text: "Hi Sahar, I've built an AI version of myself — Hadi AI — to mentor and support you as CEO of AlphaSeekers. Simply email alphaseekers2026@gmail.com anytime with any question about running AlphaSeekers, and Hadi AI will reply with guidance. Try it now! — Hadi",
  });

  console.log("Email sent successfully:", info.messageId);
}

main().catch(console.error);
