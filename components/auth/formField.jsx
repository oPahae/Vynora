export default function FormField({ icon: Icon, error, ...props }) {
  return (
    <div>
      <div
        className={`group flex items-center gap-3 h-12 rounded-xl2 border bg-surface px-4 transition-all ${
          error
            ? 'border-red-400 shadow-[0_0_0_4px_rgb(239_68_68/0.12)]'
            : 'border-slate-200 hover:border-slate-300 focus-within:border-brand-500 focus-within:shadow-ring'
        }`}
      >
        {Icon && <Icon size={18} className="text-slate-400 shrink-0 transition-colors group-focus-within:text-brand-500" />}
        <input
          {...props}
          aria-invalid={error ? true : undefined}
          className="w-full h-full bg-transparent text-[0.95rem] text-slate-900 placeholder:text-slate-400 outline-none"
        />
      </div>
      {error && <p className="text-red-500 text-xs mt-1.5 ms-1">{error}</p>}
    </div>
  );
}
