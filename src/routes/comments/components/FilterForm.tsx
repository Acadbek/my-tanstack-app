import type { SearchValues } from '../types.ts';

interface FilterFormProps {
  draft: SearchValues;
  setDraft: (draft: SearchValues) => void;
  onSubmit: () => void;
  onReset: () => void;
}

export function FilterForm({ draft, setDraft, onSubmit, onReset }: FilterFormProps) {
  return (
    <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
      <form
        className="grid gap-4 md:grid-cols-12"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <div className="md:col-span-4">
          <label htmlFor="q" className="block text-sm font-medium text-zinc-300 mb-2">
            Search Comments
          </label>
          <input
            id="q"
            name="q"
            value={draft.q}
            onChange={(e) => setDraft({ ...draft, q: e.target.value })}
            placeholder="Search comment text…"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
        </div>

        <div className="md:col-span-3">
          <label htmlFor="username" className="block text-sm font-medium text-zinc-300 mb-2">
            Username Filter
          </label>
          <input
            id="username"
            name="username"
            value={draft.username}
            onChange={(e) => setDraft({ ...draft, username: e.target.value })}
            placeholder="@username"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
        </div>

        <div className="md:col-span-2">
          <label htmlFor="lead" className="block text-sm font-medium text-zinc-300 mb-2">
            Lead Status
          </label>
          <select
            id="lead"
            name="lead"
            value={draft.lead}
            onChange={(e) => setDraft({ ...draft, lead: e.target.value as SearchValues['lead'] })}
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          >
            <option value="all">All</option>
            <option value="lead">Hot Leads</option>
            <option value="nonlead">Non-leads</option>
          </select>
        </div>

        <div className="md:col-span-3">
          <label htmlFor="from" className="block text-sm font-medium text-zinc-300 mb-2">
            Date Range
          </label>
          <div className="flex gap-2">
            <input
              id="from"
              name="from"
              type="date"
              value={draft.from}
              onChange={(e) => setDraft({ ...draft, from: e.target.value })}
              className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
            <input
              id="to"
              name="to"
              type="date"
              value={draft.to}
              onChange={(e) => setDraft({ ...draft, to: e.target.value })}
              className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>
        </div>

        <div className="md:col-span-12 flex justify-end gap-3">
          <button
            type="button"
            onClick={onReset}
            className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium hover:bg-white/10 transition-all"
          >
            Clear Filters
          </button>
          <button
            type="submit"
            className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-medium hover:bg-blue-700 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Apply Filters
          </button>
        </div>
      </form>
    </div>
  );
}
