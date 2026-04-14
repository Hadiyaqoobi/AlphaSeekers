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
  .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%); padding: 45px 35px; text-align: center; }
  .header h1 { color: #ffffff; font-size: 24px; margin: 0; font-weight: 300; letter-spacing: 1px; }
  .header .name { color: #4da6ff; font-size: 32px; font-weight: 700; margin-top: 10px; }
  .header .sub { color: #8892a4; font-size: 13px; margin-top: 12px; letter-spacing: 2px; text-transform: uppercase; }
  .body { padding: 40px 35px; }
  .body p { color: #444; font-size: 15px; line-height: 1.9; margin-bottom: 16px; }
  .personal-note { background: linear-gradient(135deg, #fafbff, #f0f4ff); border: 1px solid #d8e2f4; border-radius: 14px; padding: 28px; margin: 25px 0; }
  .personal-note p { color: #333; font-size: 15px; line-height: 1.9; margin: 0; }
  .personal-note p + p { margin-top: 14px; }
  .ai-section { background: #f8f9fa; border-radius: 14px; padding: 28px; margin: 25px 0; border: 1px solid #e8e8e8; }
  .ai-section h3 { color: #0f3460; font-size: 18px; margin: 0 0 15px 0; }
  .ai-badge { display: inline-block; background: linear-gradient(135deg, #0f3460, #4da6ff); color: #fff; padding: 4px 14px; border-radius: 20px; font-size: 12px; font-weight: 600; letter-spacing: 1px; margin-bottom: 15px; }
  .capability { display: flex; align-items: flex-start; margin: 12px 0; }
  .cap-icon { font-size: 20px; margin-right: 14px; min-width: 28px; text-align: center; }
  .cap-text { color: #444; font-size: 14px; line-height: 1.6; }
  .cap-text strong { color: #1a1a2e; }
  .divider { height: 1px; background: linear-gradient(90deg, transparent, #ddd, transparent); margin: 30px 0; }
  .quote-box { background: linear-gradient(135deg, #0f3460, #1a1a2e); border-radius: 14px; padding: 30px; margin: 30px 0; text-align: center; }
  .quote-box p { color: #d0d8e8; font-size: 16px; line-height: 1.8; margin: 0; font-style: italic; }
  .quote-box .author { color: #4da6ff; font-size: 13px; margin-top: 12px; font-style: normal; letter-spacing: 1px; }
  .cta { text-align: center; margin: 30px 0; }
  .cta-btn { display: inline-block; background: linear-gradient(135deg, #0f3460, #4da6ff); color: #ffffff; padding: 14px 36px; border-radius: 30px; text-decoration: none; font-size: 15px; font-weight: 600; letter-spacing: 0.5px; }
  .closing { margin-top: 30px; }
  .closing p { color: #444; font-size: 15px; line-height: 1.9; }
  .signature { margin-top: 25px; padding-top: 20px; border-top: 1px solid #eee; }
  .signature .name { color: #1a1a2e; font-size: 17px; font-weight: 700; }
  .signature .title { color: #888; font-size: 13px; margin-top: 2px; }
  .footer { background: #f8f9fa; padding: 25px 35px; text-align: center; border-top: 1px solid #eee; }
  .footer p { color: #aaa; font-size: 11px; margin: 3px 0; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>A Quick Note From</h1>
    <div class="name">Hadi</div>
    <div class="sub">Before I Step Away</div>
  </div>
  
  <div class="body">
    <p>Hi Sahar,</p>
    
    <div class="personal-note">
      <p>I'm heading out for a personal retreat this week — a chance to step back, recharge, and think clearly. I'll be mostly offline and won't be able to respond to emails or messages myself.</p>
      <p>But before I go, I wanted to make sure you have everything you need. Because the last thing I want is for you to feel unsupported, even for a single day.</p>
      <p>That's why I spent time building something specifically for you.</p>
    </div>
    
    <div class="ai-section">
      <span class="ai-badge">ACTIVE STARTING NOW</span>
      <h3>Hadi AI — Your Mentor While I'm Away</h3>
      <p style="color: #555; font-size: 14px; line-height: 1.7; margin-bottom: 18px;">
        My digital twin is fully ready to support you. It's trained on everything I know about AlphaSeekers — every decision we've made, every feature we've built, every strategy we've discussed. It thinks the way I think and advises the way I would advise.
      </p>
      
      <div class="capability">
        <div class="cap-icon">🎯</div>
        <div class="cap-text"><strong>Team Meeting Prep</strong> — Ask about the presentation, how to handle specific situations, what to say if someone pushes back</div>
      </div>
      <div class="capability">
        <div class="cap-icon">📊</div>
        <div class="cap-text"><strong>Strategy & Decisions</strong> — Should we do X or Y? What's the priority this week? How do other nonprofits handle this?</div>
      </div>
      <div class="capability">
        <div class="cap-icon">💰</div>
        <div class="cap-text"><strong>Fundraising & Grants</strong> — Which funders to approach, how to write proposals, what foundations look for</div>
      </div>
      <div class="capability">
        <div class="cap-icon">👥</div>
        <div class="cap-text"><strong>Team Management</strong> — How to delegate, handle conflicts, motivate your team, run effective meetings</div>
      </div>
      <div class="capability">
        <div class="cap-icon">🏗️</div>
        <div class="cap-text"><strong>Board Building</strong> — How to recruit advisors, what to say when reaching out, structuring the board</div>
      </div>
      <div class="capability">
        <div class="cap-icon">💡</div>
        <div class="cap-text"><strong>Anything Else</strong> — Literally any question about running AlphaSeekers. No question is too small.</div>
      </div>
    </div>
    
    <div class="divider"></div>
    
    <p style="font-size: 16px; color: #1a1a2e; font-weight: 500;">How to use it:</p>
    <p>Simply send an email to <strong style="color: #0f3460;">alphaseekers2026@gmail.com</strong> with your question. Write naturally — like you're texting me. Hadi AI will reply with detailed, thoughtful guidance.</p>
    
    <p>You can email as many times as you want, about anything. There's no limit. Think of it as having a mentor who never sleeps, never gets tired, and always has time for you.</p>

    <div class="quote-box">
      <p>"The best leaders aren't the ones who have all the answers.<br>They're the ones who never stop looking for them."</p>
      <div class="author">That's you, Sahar.</div>
    </div>
    
    <div class="closing">
      <p>I want you to know something. I've worked with many organizations and many people. But what you're building with AlphaSeekers — for Afghan women, for education, for a future that so many people have given up on — this is rare. <em>You</em> are rare. The way you care about this mission, the way you show up for your team, the way you're willing to learn and grow as a leader — that's not something you can teach. You either have it or you don't.</p>
      
      <p>You have it.</p>
      
      <p>So while I'm away, don't hold back. Use Hadi AI like you'd use me. Ask hard questions. Challenge ideas. Think big. By the time I'm back, I want to hear about all the incredible decisions you made.</p>
      
      <p>AlphaSeekers is in the best possible hands — yours.</p>
    </div>
    
    <div class="cta">
      <a href="mailto:alphaseekers2026@gmail.com?subject=Question for Hadi AI" class="cta-btn">Email Hadi AI Now</a>
    </div>
    
    <div class="signature">
      <div class="name">Hadi Yaqoobi</div>
      <div class="title">See you in a week. Go make things happen.</div>
    </div>
  </div>
  
  <div class="footer">
    <p>AlphaSeekers &mdash; Empowering Afghan Students Through Education</p>
    <p>While Hadi is away, Hadi AI is available 24/7 at alphaseekers2026@gmail.com</p>
  </div>
</div>
</body>
</html>`;

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: "saharnikzad187@gmail.com",
    subject: "Stepping away for a week — but you're not alone",
    html: htmlBody,
    text: `Hi Sahar,

I'm heading out for a personal retreat this week and won't be available to respond myself. But I've made sure you're fully supported.

Hadi AI — my digital twin — is active and ready to help you with anything about AlphaSeekers. It knows everything I know about our platform, our strategy, and our mission. Just email alphaseekers2026@gmail.com with any question.

What you're building with AlphaSeekers is rare, Sahar. And you are rare. The way you care about this mission and show up for your team — that's real leadership.

Use Hadi AI like you'd use me. Ask hard questions, think big. By the time I'm back, I want to hear about all the incredible decisions you made.

AlphaSeekers is in the best possible hands — yours.

— Hadi Yaqoobi`,
  });

  console.log("Email sent successfully:", info.messageId);
}

main().catch(console.error);
