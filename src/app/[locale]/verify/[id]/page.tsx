import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

const certificates: Record<string, {
  recipient: string;
  role: string;
  course: string;
  startDate: string;
  issuedDate: string;
}> = {
  "AS-TEACH-2026-HN-8F4C": {
    recipient: "Hadia Noori",
    role: "Volunteer teacher",
    course: "Pre-intermediate English",
    startDate: "20 August 2026",
    issuedDate: "30 September 2026",
  },
};

export const metadata: Metadata = {
  title: "Verify a certificate | AlphaSeekers",
  robots: { index: false, follow: false },
};

export default function VerifyCertificatePage({
  params,
}: {
  params: { locale: string; id: string };
}) {
  const certificate = certificates[params.id];
  if (!certificate) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="rounded-2xl border border-green-200 bg-white p-8 shadow-sm">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-green-700">
          AlphaSeekers certificate verification
        </p>
        <h1 className="mb-6 text-3xl font-bold text-slate-900">Certificate verified</h1>
        <p className="mb-8 text-slate-600">
          This certificate was issued by AlphaSeekers. Match the details below
          with those printed on the certificate.
        </p>
        <dl className="grid gap-5 sm:grid-cols-2">
          {[
            ["Certificate ID", params.id],
            ["Recipient", certificate.recipient],
            ["Recognition", certificate.role],
            ["Class", certificate.course],
            ["Class start", certificate.startDate],
            ["Issued", certificate.issuedDate],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-sm text-slate-500">{label}</dt>
              <dd className="font-semibold text-slate-900">{value}</dd>
            </div>
          ))}
        </dl>
        <a className="mt-10 inline-block text-green-700 underline" href="/certificates/Hadia-Noori-AlphaSeekers-Teaching-Certificate.pdf">View certificate (PDF)</a>
        <br />
        <Link className="mt-4 inline-block text-green-700 underline" href={`/${params.locale}`}>
          AlphaSeekers home
        </Link>
      </div>
    </main>
  );
}
