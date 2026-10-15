import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CertificateActions } from "@/components/certificates/certificate-actions";
import { CertificateSheet } from "@/components/certificates/certificate-sheet";
import { certificateQrSvg } from "@/lib/certificates/qr";
import { certificateVerifyUrl, findCertificateForVerify } from "@/lib/platform/certificates";

/**
 * Public page a certificate's QR code opens. It answers one question for
 * whoever scanned it (an employer, a school): did AlphaSeekers really issue
 * this? The certificate is English, so the page is too.
 */

export const metadata: Metadata = {
  title: "Verify a certificate | AlphaSeekers",
  robots: { index: false, follow: false },
};

function longDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export default async function VerifyCertificatePage({
  params,
}: {
  params: { locale: string; id: string };
}) {
  const certificate = await findCertificateForVerify(params.id);
  if (!certificate) notFound();

  const revoked = Boolean(certificate.revokedAt);
  const teacher = certificate.kind === "TEACHER_RECOGNITION";
  const details: Array<[string, string]> = certificate.legacyPdf
    ? [
        ["Certificate ID", certificate.code],
        ["Recipient", certificate.recipientName],
        ["Recognition", certificate.legacyRole ?? "Volunteer teacher"],
        ["Class", certificate.className],
        ["Class start", certificate.legacyStart ?? ""],
        ["Issued", longDate(certificate.issuedAt)],
      ]
    : [
        ["Certificate ID", certificate.code],
        ["Awarded to", certificate.recipientName],
        ["Certificate", teacher ? "Recognition for teaching service" : "Completion of a course"],
        ["Class", certificate.className],
        ...(teacher ? [] : ([["Teacher", certificate.teacherName]] as Array<[string, string]>)),
        ...(certificate.detail ? ([[teacher ? "Term" : "Length", certificate.detail]] as Array<[string, string]>) : []),
        ...(certificate.hours ? ([["Teaching hours", certificate.hours]] as Array<[string, string]>) : []),
        ["Issued", longDate(certificate.issuedAt)],
      ];

  const qrSvg = !revoked && !certificate.legacyPdf ? await certificateQrSvg(certificateVerifyUrl(certificate.code)) : "";

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-16">
      <div
        className={`panel panel-strong rounded-2xl border p-6 sm:p-8 ${revoked ? "border-red-400/60" : "border-neon-500/40"}`}
      >
        <p className={`mb-3 text-sm font-semibold uppercase tracking-widest ${revoked ? "text-red-300" : "text-neon-400"}`}>
          AlphaSeekers certificate verification
        </p>
        <h1 className="mb-4 text-3xl font-bold text-ink-main">
          {revoked ? "This certificate was cancelled" : "Certificate verified"}
        </h1>
        <p className="mb-8 text-ink-soft">
          {revoked
            ? `AlphaSeekers cancelled this certificate on ${longDate(certificate.revokedAt as string)}. It is no longer valid.`
            : "This certificate was issued by AlphaSeekers. Match the details below with those printed on the certificate."}
        </p>
        <dl className="grid gap-5 sm:grid-cols-2">
          {details.map(([label, value]) => (
            <div key={label}>
              <dt className="text-sm text-ink-soft">{label}</dt>
              <dd className="font-semibold text-ink-main" dir="auto">
                {value}
              </dd>
            </div>
          ))}
        </dl>

        {certificate.legacyPdf ? (
          <a className="mt-10 inline-block text-neon-400 underline" href={certificate.legacyPdf}>
            View certificate (PDF)
          </a>
        ) : null}
      </div>

      {!revoked && !certificate.legacyPdf ? (
        <section className="mt-8 space-y-4">
          <CertificateActions content={certificate} qrSvg={qrSvg} />
          <div className={`certificate-print-area mx-auto ${teacher ? "max-w-xl" : ""}`}>
            <CertificateSheet content={certificate} qrSvg={qrSvg} />
          </div>
        </section>
      ) : null}

      <Link className="mt-8 inline-block text-neon-400 underline" href={`/${params.locale}`}>
        AlphaSeekers home
      </Link>
    </main>
  );
}
