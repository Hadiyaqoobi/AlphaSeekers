const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");

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

  const docsDir = path.join(__dirname, "..", "docs");

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
  .container { max-width: 640px; margin: 0 auto; background: #ffffff; }
  .header { background: linear-gradient(135deg, #1a1a2e, #0f3460); padding: 40px 35px; text-align: center; }
  .header h1 { color: #ffffff; font-size: 28px; margin: 0; letter-spacing: 1px; }
  .header p { color: #a8b4c8; font-size: 14px; margin-top: 8px; }
  .body { padding: 35px; }
  .body h2 { color: #1a1a2e; font-size: 22px; margin-top: 0; }
  .body p { color: #444; font-size: 15px; line-height: 1.8; }
  .file-box { background: #f8f9fa; border: 1px solid #e0e0e0; border-radius: 10px; padding: 20px; margin: 15px 0; display: flex; align-items: center; }
  .file-icon { font-size: 36px; margin-right: 18px; }
  .file-info h3 { margin: 0; color: #1a1a2e; font-size: 16px; }
  .file-info p { margin: 4px 0 0 0; color: #777; font-size: 13px; }
  .section { background: #f0f4ff; border-left: 4px solid #0f3460; border-radius: 0 8px 8px 0; padding: 18px 22px; margin: 20px 0; }
  .section h3 { color: #0f3460; margin: 0 0 8px 0; font-size: 16px; }
  .section ul { margin: 0; padding-left: 18px; color: #444; font-size: 14px; line-height: 1.9; }
  .highlight { background: #fff3e0; border-left: 4px solid #e94560; border-radius: 0 8px 8px 0; padding: 18px 22px; margin: 20px 0; }
  .highlight h3 { color: #e94560; margin: 0 0 8px 0; font-size: 16px; }
  .highlight p { color: #444; font-size: 14px; margin: 0; line-height: 1.7; }
  .footer { background: #f8f9fa; padding: 25px 35px; text-align: center; border-top: 1px solid #eee; }
  .footer p { color: #999; font-size: 12px; margin: 4px 0; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>ALPHASEEKERS</h1>
    <p>Team Meeting Materials</p>
  </div>
  <div class="body">
    <h2>Hi Sahar,</h2>
    <p>I've prepared two documents for your upcoming team meeting. These are designed to help you lead a productive, collaborative conversation with your team.</p>
    
    <p style="font-weight: 600; color: #1a1a2e; margin-top: 25px;">Attached files:</p>
    
    <div class="file-box">
      <div class="file-icon">🎯</div>
      <div class="file-info">
        <h3>Team Presentation (HTML)</h3>
        <p>17-slide interactive presentation — open in Chrome/Safari, press F for fullscreen, use arrow keys to navigate</p>
      </div>
    </div>
    
    <div class="file-box">
      <div class="file-icon">📋</div>
      <div class="file-info">
        <h3>Meeting Prep Guide (Word Document)</h3>
        <p>Your personal playbook — what to say on each slide, how to handle discussions, and after-meeting follow-up</p>
      </div>
    </div>

    <div class="section">
      <h3>What the Presentation Covers (17 slides)</h3>
      <ul>
        <li>Where we are today and what we've built</li>
        <li>Inspiration from organizations like Khan Academy and SOLA</li>
        <li>Proposed agile workflow — weekly planning meetings</li>
        <li>Proposed team roles (Programs Lead, Technology Lead, Operations Lead)</li>
        <li><strong>Building an Advisory Board</strong> — why, who, and their responsibilities</li>
        <li>Team availability and commitment discussion</li>
        <li>Working agreements — promises we make to each other</li>
        <li>Growth roadmap and funding reality</li>
        <li>Next steps and team feedback</li>
      </ul>
    </div>

    <div class="section">
      <h3>About the Advisory Board (New Slide)</h3>
      <ul>
        <li><strong>Why:</strong> Every successful nonprofit has advisors — funders expect it, and it builds credibility</li>
        <li><strong>What it is:</strong> An Advisory Board (not governing) — they advise, you and the team still run everything</li>
        <li><strong>Who we'd want:</strong> Education expert, nonprofit leader, fundraising advisor, community voice, tech advisor</li>
        <li><strong>Their responsibilities:</strong> Meet quarterly (4x/year), review progress, help find funding, mentor the leadership team</li>
        <li><strong>Key point:</strong> No financial commitment required from advisors — just expertise and time</li>
      </ul>
    </div>

    <div class="highlight">
      <h3>Important: Read the Prep Guide First</h3>
      <p>The Word document has exact phrases you can say on each slide, tips for handling silence, managing different personalities, and a template for your follow-up message after the meeting. Read it at least once before the meeting — it will make a big difference in your confidence.</p>
    </div>

    <div class="section">
      <h3>Quick Tips</h3>
      <ul>
        <li>Open the HTML file in Chrome or Safari</li>
        <li>Press <strong>F</strong> for fullscreen mode</li>
        <li>Use <strong>arrow keys</strong> to navigate between slides</li>
        <li>Practice the opening (Slide 2) out loud once or twice</li>
        <li>The green dashed boxes on slides are discussion prompts — pause and let the team talk</li>
        <li>Have a notebook ready to write down feedback</li>
      </ul>
    </div>

    <p style="margin-top: 25px;">Everything in the presentation is a <em>proposal</em>, not a final decision. The meeting is about hearing from your team and shaping things together. You've got this, Sahar.</p>
    
    <p>If you have any questions about the materials or want to adjust anything, just reply to this email.</p>
    
    <p style="margin-top: 25px;">Best,<br><strong>Hadi Yaqoobi</strong></p>
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
    subject: "AlphaSeekers — Your Team Meeting Presentation & Prep Guide",
    html: htmlBody,
    attachments: [
      {
        filename: "AlphaSeekers_Team_Presentation.html",
        path: path.join(docsDir, "AlphaSeekers_Team_Presentation.html"),
      },
      {
        filename: "Sahar_Meeting_Prep_Guide.docx",
        path: path.join(docsDir, "Sahar_Meeting_Prep_Guide.docx"),
      },
    ],
  });

  console.log("Email sent successfully:", info.messageId);
}

main().catch(console.error);
