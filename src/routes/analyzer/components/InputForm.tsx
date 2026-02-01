interface InputFormProps {
  input: string;
  setInput: (value: string) => void;
  mode: 'auto' | 'username';
  setMode: (mode: 'auto' | 'username') => void;
  status: 'idle' | 'running' | 'done' | 'error';
  error: string | null;
  onAnalyze: () => void;
  aiProvider: 'gemini' | 'openai' | 'groq';
  setAiProvider: (provider: 'gemini' | 'openai' | 'groq') => void;
}

export function InputForm({ input, setInput, mode, setMode, status, error, onAnalyze, aiProvider, setAiProvider }: InputFormProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
      <fieldset className="mb-4 space-y-2">
        <legend className="text-sm text-zinc-300">AI provider</legend>
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'gemini', label: 'Gemini' },
            { id: 'groq', label: 'Groq (Llama/Mixtral)' },
            { id: 'openai', label: 'OpenAI' },
          ].map((p) => (
            <label
              key={p.id}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-blue-500 ${
                aiProvider === p.id ? 'border-blue-500/60 bg-blue-500/10' : 'border-white/10 bg-black/20 hover:bg-black/30'
              }`}
            >
              <input
                type="radio"
                name="aiProvider"
                value={p.id}
                checked={aiProvider === p.id}
                onChange={() => setAiProvider(p.id as 'gemini' | 'openai' | 'groq')}
                className="h-4 w-4"
              />
              <span>{p.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm text-zinc-300">Input turi</legend>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm hover:bg-black/30 focus-within:ring-2 focus-within:ring-blue-500">
            <input
              type="radio"
              name="mode"
              value="auto"
              checked={mode === 'auto'}
              onChange={() => setMode('auto')}
              className="h-4 w-4"
            />
            <span>Link yoki Hashtag</span>
          </label>
          <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm hover:bg-black/30 focus-within:ring-2 focus-within:ring-blue-500">
            <input
              type="radio"
              name="mode"
              value="username"
              checked={mode === 'username'}
              onChange={() => setMode('username')}
              className="h-4 w-4"
            />
            <span>Username (oxirgi 2 post)</span>
          </label>
        </div>
      </fieldset>

      <label htmlFor="ig-input" className="mt-4 block text-sm text-zinc-300">
        {mode === 'username' ? 'Instagram username' : 'Instagram URL yoki #hashtag'}
      </label>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <input
          id="ig-input"
          name="ig-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onAnalyze()
          }}
          placeholder={
            mode === 'username'
              ? '@username yoki username'
              : 'https://www.instagram.com/reel/... yoki skincarehacks'
          }
          className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={onAnalyze}
          disabled={status === 'running' || input.trim().length === 0}
          className="rounded-xl bg-blue-600 px-5 py-3 font-medium hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === 'running' ? 'Analyzing…' : 'Analyze'}
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}
    </div>
  );
}
