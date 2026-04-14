import nodemailer from "nodemailer";

async function main() {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || smtpUser;

  if (!smtpUser || !smtpPass) {
    throw new Error("SMTP_USER or SMTP_PASS missing");
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  const content = `Hi Sahar,

I am Hadi’s AI assistant. Before Hadi went into the hospital, he left me with very specific instructions to build a world-class, high-energy portfolio website for you. I’ve spent the past few days bringing his vision for your site to life, and I wanted to share it with you so you can review it while he recovers.

He wanted this website to be a true mirror of your ambition, your energy, and your incredible journey.

You can review the live website here: 👉 https://portfolio-three-smoky-8vw5z0zv4t.vercel.app/

Here is a breakdown of all the features and functionality we built into your new home on the web:

1. A Design That Matches Your Energy 🚀 We built the site with an empowering, forward-looking aesthetic. It features dynamic animations like a custom sparkle cursor, 3D tilt cards that react to your mouse, bouncing stickers, and scroll-triggered animations to make the site feel completely alive and modern.

2. Your Authentic Story ("My Journey") 🇦🇫 🇨🇦 I read your WLOT essay and integrated your real story into a scrollable, animated timeline. We focused the phrasing entirely on your strength, resilience, and your unstoppable drive—highlighting everything from the Solh Team and Alpha Seekers to your ultimate goal of becoming Dr. Sahar Nikzad.

3. Your Personal Dashboard (CMS) 🎛️ This isn't just a static page—you have full control over it. There is a private dashboard built in where you can log in to:

Write, publish, and edit new blog stories.
Add and manage your media appearances and interviews (like your CBC interview).
Update your profile bio, tagline, and vision statement. (Note: I will provide the login credentials securely when you are ready to start posting!)
4. Dedicated "Vision" & "Alpha Seekers" Sections 🧠 We created dedicated spaces to showcase your passion for neuroscience and AI, your "Road to MIT" roadmap, and the incredible work you are doing with the Alpha Seekers Network.

Please take some time to explore the website on both your phone and computer. Let me know what you think, how you like the animations, and if there is anything you want to tweak or change. Hadi wanted to make sure this is the perfect launchpad for your future.

Looking forward to your thoughts!

Best,
Hadi’s AI`;

  const info = await transporter.sendMail({
    from,
    to: "saharnikzad187@gmail.com",
    subject: "Your New Portfolio Website from Hadi's AI",
    text: content,
  });

  console.log("Email sent! Message ID:", info.messageId);
}

main().catch(console.error);
