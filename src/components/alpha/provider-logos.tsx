import type { Provider } from "@/lib/agents";

// Real provider marks, recoloured to currentColor so they read on the dark UI.
export function ProviderLogo({ provider, size = 16, className = "" }: { provider: Provider; size?: number; className?: string }) {
  const common = { width: size, height: size, className, "aria-hidden": true } as const;
  if (provider === "anthropic")
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" {...common}>
        <path d="M13.827 3.52h3.603L24 20h-3.603l-6.57-16.48zm-7.258 0h3.767L16.906 20h-3.674l-1.343-3.461H5.017l-1.344 3.46H0L6.57 3.522zm4.132 9.959L8.453 7.687 6.205 13.48H10.7z" />
      </svg>
    );
  if (provider === "openai")
    return (
      <svg viewBox="0 0 256 260" fill="currentColor" {...common}>
        <path d="M239.184 106.203a64.716 64.716 0 0 0-5.576-53.103C219.452 28.459 191 15.784 163.213 21.74A65.586 65.586 0 0 0 52.096 45.22a64.716 64.716 0 0 0-43.23 31.36c-14.31 24.602-11.061 55.634 8.033 76.74a64.665 64.665 0 0 0 5.525 53.102c14.174 24.65 42.644 37.324 70.446 31.36a64.72 64.72 0 0 0 48.754 21.744c28.481.025 53.714-18.361 62.414-45.481a64.767 64.767 0 0 0 43.229-31.36c14.137-24.558 10.875-55.423-8.083-76.483ZM142.626 236.782a48.4 48.4 0 0 1-31.104-11.254l1.535-.87 51.67-29.826a8.6 8.6 0 0 0 4.247-7.366v-72.85l21.845 12.636a.8.8 0 0 1 .41.563v60.367c-.056 26.818-21.783 48.545-48.601 48.601l-.007-.001Zm-104.466-44.61a48.34 48.34 0 0 1-5.781-32.589l1.534.921 51.722 29.826a8.34 8.34 0 0 0 8.441 0l63.181-36.425v25.221a.87.87 0 0 1-.358.665l-52.335 30.184c-23.257 13.398-52.97 5.431-66.404-17.803l-.007-.001v.005Zm-13.614-113.11a48.5 48.5 0 0 1 25.578-21.333l-.012 1.803v59.65a8.29 8.29 0 0 0 4.195 7.316l63.079 36.425-21.845 12.636a.82.82 0 0 1-.768.051L47.28 145.516a48.6 48.6 0 0 1-22.735-66.404l-.007-.005.006-.02Zm179.466 41.695-63.08-36.63 21.847-12.583a.82.82 0 0 1 .768-.051l52.233 30.184a48.6 48.6 0 0 1-7.316 87.635v-61.391a8.5 8.5 0 0 0-4.4-7.213l-.052.049.001-.02Zm21.742-32.69-1.535-.922-51.619-30.081a8.39 8.39 0 0 0-8.492 0L82.099 129.71v-25.221a.72.72 0 0 1 .307-.665l52.233-30.133a48.6 48.6 0 0 1 72.236 50.339l-.052.021.001.001Zm-136.86 44.933-21.845-12.636a.87.87 0 0 1-.41-.563V103.86a48.6 48.6 0 0 1 79.657-37.318l-1.535.87-51.67 29.825a8.6 8.6 0 0 0-4.246 7.367l-.052 72.749.052-.001-.001.002Z" />
      </svg>
    );
  // openrouter
  return (
    <svg viewBox="0 0 512 512" fill="none" stroke="currentColor" {...common}>
      <path d="M3 248.945C18 248.945 76 236 106 219C136 202 136 202 198 158C276.497 102.293 332 120.945 423 120.945" strokeWidth="90" />
      <path d="M511 121.5L357.25 210.268L357.25 32.7324L511 121.5Z" fill="currentColor" />
      <path d="M0 249C15 249 73 261.945 103 278.945C133 295.945 133 295.945 195 339.945C273.497 395.652 329 377 420 377" strokeWidth="90" />
      <path d="M508 376.445L354.25 287.678L354.25 465.213L508 376.445Z" fill="currentColor" />
    </svg>
  );
}

export const PROVIDER_LABEL: Record<Provider, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  openrouter: "OpenRouter",
};

// Per-model brand marks (the lab behind the model, not just the API provider). Anthropic/OpenAI/
// OpenRouter use the inline SVGs above; the rest are brand logos served from /public.
const BRAND_IMG: Record<string, string> = {
  xai: "/logos/models/xai.ico",
  google: "/logos/models/google.ico",
  deepseek: "/logos/models/deepseek.ico",
  meta: "/logos/models/meta.ico",
  mistral: "/logos/models/mistral.ico",
  qwen: "/logos/models/qwen.png",
};

export function ModelLogo({ brand, size = 18, className = "" }: { brand: string; size?: number; className?: string }) {
  if (brand === "anthropic" || brand === "openai" || brand === "openrouter") {
    return <ProviderLogo provider={brand as Provider} size={size} className={`text-foreground ${className}`} />;
  }
  const src = BRAND_IMG[brand];
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={size} height={size} className={`rounded-[3px] object-contain ${className}`} style={{ width: size, height: size }} />;
  }
  return <span className={`inline-block rounded-[3px] bg-white/10 ${className}`} style={{ width: size, height: size }} />;
}
