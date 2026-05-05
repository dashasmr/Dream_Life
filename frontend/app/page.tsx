"use client";

import { FormEvent, useEffect, useState } from "react";
import { API_URL, EventItem, EventType } from "@/lib/api";

const EVENT_TYPES: EventType[] = [
  "work_started",
  "task_completed",
  "expense_added",
  "cleaning_done"
];

export default function HomePage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [eventType, setEventType] = useState<EventType>("work_started");
  const [payloadText, setPayloadText] = useState('{"note":"manual event"}');
  const [error, setError] = useState<string | null>(null);

  async function loadEvents() {
    const response = await fetch(`${API_URL}/events?limit=20`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Failed to fetch events");
    }
    setEvents(await response.json());
  }

  useEffect(() => {
    loadEvents().catch((err: Error) => setError(err.message));
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(payloadText);
    } catch {
      setError("Payload must be valid JSON");
      return;
    }

    const response = await fetch(`${API_URL}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: eventType,
        source: "web",
        payload
      })
    });

    if (!response.ok) {
      setError("Failed to create event");
      return;
    }

    setPayloadText('{"note":"manual event"}');
    await loadEvents();
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-3xl font-bold">Life OS MVP - Events</h1>

      <form onSubmit={onSubmit} className="mt-6 grid gap-3 rounded-xl bg-slate-900 p-4">
        <label className="text-sm text-slate-300">Event type</label>
        <select
          className="rounded-md bg-slate-800 p-2"
          value={eventType}
          onChange={(e) => setEventType(e.target.value as EventType)}
        >
          {EVENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        <label className="text-sm text-slate-300">Payload JSON</label>
        <textarea
          className="min-h-24 rounded-md bg-slate-800 p-2 font-mono text-sm"
          value={payloadText}
          onChange={(e) => setPayloadText(e.target.value)}
        />

        <button className="rounded-md bg-indigo-600 px-4 py-2 font-medium hover:bg-indigo-500" type="submit">
          Add event
        </button>
      </form>

      {error && <p className="mt-4 text-red-400">{error}</p>}

      <section className="mt-8">
        <h2 className="text-xl font-semibold">Latest events</h2>
        <div className="mt-3 space-y-3">
          {events.map((item) => (
            <article key={item.id} className="rounded-lg bg-slate-900 p-3">
              <p className="font-medium">{item.type}</p>
              <p className="text-sm text-slate-400">{new Date(item.created_at).toLocaleString()}</p>
              <pre className="mt-2 overflow-auto rounded bg-slate-800 p-2 text-xs">
                {JSON.stringify(item.payload, null, 2)}
              </pre>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
