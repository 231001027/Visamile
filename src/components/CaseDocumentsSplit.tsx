type CaseDoc = {
  id: string;
  fileName: string;
  storageKey: string;
  type: string;
  createdAt: Date | string;
};

type StatusEvent = {
  toStatus: string;
  note?: string | null;
  createdAt: Date | string;
};

function toTime(value: Date | string): number {
  return new Date(value).getTime();
}

/** Split docs around the latest "additional documents requested" event. */
export function splitDocumentsByRequest(docs: CaseDoc[], statusHistory: StatusEvent[]) {
  const requests = statusHistory
    .filter((e) => e.toStatus === "ADDITIONAL_DOCS_REQUESTED")
    .sort((a, b) => toTime(a.createdAt) - toTime(b.createdAt));

  const latest = requests[requests.length - 1] ?? null;
  if (!latest) {
    return {
      hasSplit: false as const,
      previous: docs,
      additional: [] as CaseDoc[],
      requestNote: null as string | null,
      requestedAt: null as Date | null,
    };
  }

  const cutoff = toTime(latest.createdAt);
  const previous = docs.filter((d) => toTime(d.createdAt) <= cutoff);
  const additional = docs.filter((d) => toTime(d.createdAt) > cutoff);

  return {
    hasSplit: true as const,
    previous,
    additional,
    requestNote: latest.note ?? null,
    requestedAt: new Date(latest.createdAt),
  };
}

function DocList({ docs, empty }: { docs: CaseDoc[]; empty: string }) {
  if (docs.length === 0) {
    return <p className="text-sm text-ink/50">{empty}</p>;
  }
  return (
    <div className="space-y-2">
      {docs.map((d) => (
        <a
          key={d.id}
          href={`/api/documents/${d.storageKey}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between rounded-sm border border-line bg-white px-4 py-2 text-sm hover:bg-teal-50/40"
        >
          <span className="min-w-0 truncate">{d.fileName}</span>
          <span className="ml-3 shrink-0 text-xs uppercase text-ink/40">
            {d.type.replaceAll("_", " ")}
          </span>
        </a>
      ))}
    </div>
  );
}

/** Lists case documents; splits into previous vs additional after a docs request. */
export function CaseDocumentsSplit({
  documents,
  statusHistory,
}: {
  documents: CaseDoc[];
  statusHistory: StatusEvent[];
}) {
  const split = splitDocumentsByRequest(documents, statusHistory);

  if (!split.hasSplit) {
    return (
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink/50">
          Documents ({documents.length})
        </h2>
        <DocList docs={documents} empty="No documents uploaded yet." />
      </section>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink/50">
          Previous documents ({split.previous.length})
        </h2>
        <p className="mb-3 text-xs text-ink/45">
          Uploaded before the additional-document request
          {split.requestedAt
            ? ` on ${split.requestedAt.toLocaleString("en-IN")}`
            : ""}
          .
        </p>
        <DocList docs={split.previous} empty="No previous documents." />
      </section>

      <section>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-stamp-600">
          Additional documents submitted ({split.additional.length})
        </h2>
        {split.requestNote && (
          <p className="mb-3 text-sm text-stamp-700">{split.requestNote}</p>
        )}
        <DocList
          docs={split.additional}
          empty="Traveler has not uploaded the requested additional documents yet."
        />
      </section>
    </div>
  );
}
