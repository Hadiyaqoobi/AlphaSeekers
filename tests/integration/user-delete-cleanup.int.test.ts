/**
 * Hard-deleting a user used to (a) destroy every support ticket and reply they
 * wrote (Cascade), and (b) orphan rows that hold a user id with no foreign key
 * — notes, homework, likes, flashcards, AI memory — leaving each liked post's
 * likeCount permanently one too high. Tickets now survive with a null reporter,
 * and deleteUserAccount clears the FK-less rows in the same transaction.
 *
 * Run: DATABASE_URL=postgresql://... RUN_DB_TESTS=1 npx vitest run tests/integration
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { deleteUserAccount } from "@/lib/platform/db-store";
import { getTicketById, listTickets } from "@/lib/platform/tickets";

const shouldRun = process.env.RUN_DB_TESTS === "1";
const d = shouldRun ? describe : describe.skip;
const TAG = "userdelcleanup";
const email = (s: string) => `${TAG}+${s}@example.com`;

async function cleanup() {
  await prisma.ticket.deleteMany({ where: { title: { startsWith: TAG } } });
  const users = await prisma.user.findMany({ where: { email: { startsWith: `${TAG}+` } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  if (ids.length) {
    await prisma.session.deleteMany({ where: { class: { teacherId: { in: ids } } } });
    await prisma.class.deleteMany({ where: { teacherId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
}

d("deleting a user", () => {
  beforeEach(cleanup);
  afterAll(cleanup);

  it("keeps their tickets and replies, and clears rows that have no foreign key", async () => {
    const [victim, author, teacher, admin] = await Promise.all(
      ["victim", "author", "teacher", "admin"].map((slug) =>
        prisma.user.create({
          data: {
            name: `${TAG} ${slug}`,
            email: email(slug),
            role: slug === "teacher" ? "TEACHER" : slug === "admin" ? "ADMIN" : "STUDENT",
            approvedAt: new Date(),
          },
          select: { id: true },
        }),
      ),
    );

    const ticket = await prisma.ticket.create({
      data: { title: `${TAG} broken page`, description: "x", reporterId: victim!.id },
    });
    await prisma.ticketComment.create({ data: { ticketId: ticket.id, authorId: victim!.id, body: "more detail" } });
    await prisma.ticketComment.create({ data: { ticketId: ticket.id, authorId: admin!.id, body: "on it" } });

    const klass = await prisma.class.create({
      data: { name: `${TAG} class`, subjectCategory: "x", description: "x", teacherId: teacher!.id, maxStudents: 5 },
    });
    const session = await prisma.session.create({
      data: { classId: klass.id, startTime: new Date(), endTime: new Date(Date.now() + 3600_000) },
    });
    const assignment = await prisma.homeworkAssignment.create({
      data: { sessionId: session.id, classId: klass.id, title: "hw", description: "x" },
    });
    await prisma.sessionNote.create({ data: { sessionId: session.id, studentId: victim!.id, content: "note" } });
    await prisma.homeworkSubmission.create({ data: { assignmentId: assignment.id, studentId: victim!.id, content: "answer" } });
    await prisma.spacedRepetitionItem.create({ data: { userId: victim!.id, term: "t", definition: "d" } });
    await prisma.aIConversation.create({ data: { userId: victim!.id, sessionId: "s", messages: [] } });

    const post = await prisma.studentPost.create({
      data: { authorId: author!.id, type: "article", title: "t", slug: `${TAG}-${Date.now()}`, likeCount: 2 },
    });
    await prisma.postLike.create({ data: { postId: post.id, userId: victim!.id } });
    await prisma.postLike.create({ data: { postId: post.id, userId: admin!.id } });

    const result = await deleteUserAccount(victim!.id);
    expect(result.status).toBe("DELETED");

    // Tickets and replies survive, attributed to nobody.
    const kept = await getTicketById(ticket.id);
    expect(kept).not.toBeNull();
    expect(kept!.reporter).toEqual({ id: "", name: null, email: null });
    expect(kept!.comments).toHaveLength(2);
    expect(kept!.comments.find((c) => c.body === "more detail")!.author.id).toBe("");
    expect(kept!.comments.find((c) => c.body === "on it")!.author.id).toBe(admin!.id);
    const listed = (await listTickets({}, 500)).find((t) => t.id === ticket.id);
    expect(listed?.reporter.name).toBeNull();

    // FK-less rows are gone, and the like no longer counts.
    expect(await prisma.sessionNote.count({ where: { studentId: victim!.id } })).toBe(0);
    expect(await prisma.homeworkSubmission.count({ where: { studentId: victim!.id } })).toBe(0);
    expect(await prisma.spacedRepetitionItem.count({ where: { userId: victim!.id } })).toBe(0);
    expect(await prisma.aIConversation.count({ where: { userId: victim!.id } })).toBe(0);
    expect(await prisma.postLike.count({ where: { userId: victim!.id } })).toBe(0);
    expect((await prisma.studentPost.findUniqueOrThrow({ where: { id: post.id } })).likeCount).toBe(1);
  });
});
