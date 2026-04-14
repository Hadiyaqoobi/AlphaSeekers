const { ImapFlow } = require("imapflow");

async function main() {
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    logger: false,
  });

  await client.connect();

  const lock = await client.getMailboxLock("INBOX");
  try {
    const status = await client.status("INBOX", { messages: true, unseen: true });
    console.log(`\n=== INBOX: ${status.messages} total, ${status.unseen} unread ===\n`);

    // Fetch recent emails (last 20 or all if fewer)
    const limit = Math.max(1, status.messages - 19);
    const range = `${limit}:*`;

    const emails = [];
    for await (const message of client.fetch(range, {
      envelope: true,
      source: true,
      flags: true,
    })) {
      const from = message.envelope.from?.[0];
      const fromStr = from ? `${from.name || ""} <${from.address}>` : "Unknown";
      const subject = message.envelope.subject || "(no subject)";
      const date = message.envelope.date;
      const isUnread = !message.flags.has("\\Seen");

      // Parse body text from source
      let bodyText = "";
      if (message.source) {
        const raw = message.source.toString();
        // Try to extract plain text body
        const parts = raw.split(/\r?\n\r?\n/);
        if (parts.length > 1) {
          bodyText = parts.slice(1).join("\n\n").substring(0, 1000);
          // Remove base64 encoded content and HTML
          if (bodyText.match(/^[A-Za-z0-9+/=\s]+$/)) {
            try {
              bodyText = Buffer.from(bodyText.replace(/\s/g, ""), "base64").toString("utf8");
            } catch (e) {}
          }
          // Strip HTML tags for readability
          bodyText = bodyText.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        }
      }

      emails.push({
        seq: message.seq,
        uid: message.uid,
        from: fromStr,
        subject,
        date,
        unread: isUnread,
        preview: bodyText.substring(0, 300),
      });
    }

    // Print emails newest first
    emails.reverse();
    for (const e of emails) {
      const flag = e.unread ? "[UNREAD]" : "[read]";
      console.log(`${flag} #${e.seq} | From: ${e.from}`);
      console.log(`  Subject: ${e.subject}`);
      console.log(`  Date: ${e.date}`);
      if (e.preview) {
        console.log(`  Preview: ${e.preview}`);
      }
      console.log("---");
    }
  } finally {
    lock.release();
  }

  await client.logout();
}

main().catch(console.error);
