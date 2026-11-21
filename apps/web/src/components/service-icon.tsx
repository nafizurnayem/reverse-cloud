import type { ComponentType } from "react";
import {
  AppWindow,
  BarChart,
  Binary,
  Bot,
  Boxes,
  CircuitBoard,
  Cloud,
  Code,
  Cpu,
  Database,
  DollarSign,
  Eye,
  Globe,
  HardDrive,
  Laptop,
  Layers,
  Layout,
  Lock,
  Network,
  Palette,
  PencilRuler,
  Rocket,
  Search,
  Server,
  Shield,
  Smartphone,
  Sparkles,
  Terminal,
  TrendingUp,
  Users,
  Workflow,
  Zap,
} from "lucide-react";

export const SERVICE_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  // Production Defaults (11 Core Capabilities)
  Globe,
  Cpu,
  Bot,
  Palette,
  Layers,
  Server,
  Network,
  TrendingUp,
  Users,
  DollarSign,
  Rocket,

  // Extended Web, App & Infrastructure
  Code,
  Terminal,
  Smartphone,
  Laptop,
  Layout,
  AppWindow,
  Cloud,
  Database,
  HardDrive,

  // AI & Workflow Automation
  Sparkles,
  Binary,
  Workflow,
  Zap,
  CircuitBoard,

  // Design, Security & Analytics
  PencilRuler,
  Eye,
  BarChart,
  Search,
  Shield,
  Lock,
  Boxes,
};

export const SERVICE_ICON_CATEGORIES: Array<{
  name: string;
  icons: Array<{ name: string; label: string; keywords: string[] }>;
}> = [
  {
    name: "Web, App & Cloud",
    icons: [
      { name: "Globe", label: "Globe / Web", keywords: ["web", "website", "internet", "global", "online"] },
      { name: "Code", label: "Code", keywords: ["code", "programming", "software", "developer", "scripts"] },
      { name: "Terminal", label: "Terminal", keywords: ["terminal", "cli", "shell", "console", "devops"] },
      { name: "Cloud", label: "Cloud", keywords: ["cloud", "hosting", "aws", "gcp", "serverless"] },
      { name: "Server", label: "Server", keywords: ["server", "backend", "linux", "hosting", "infrastructure"] },
      { name: "Database", label: "Database", keywords: ["database", "sql", "postgres", "data", "storage"] },
      { name: "Network", label: "Network / Architecture", keywords: ["network", "architecture", "topology", "mesh"] },
      { name: "Layers", label: "Layers / Full Stack", keywords: ["layers", "stack", "fullstack", "architecture"] },
      { name: "Smartphone", label: "Mobile App", keywords: ["mobile", "phone", "app", "ios", "android"] },
      { name: "Laptop", label: "Software / Laptop", keywords: ["laptop", "computer", "desktop", "software"] },
      { name: "AppWindow", label: "App Window", keywords: ["window", "ui", "app", "frontend", "interface"] },
      { name: "Layout", label: "Layout / CMS", keywords: ["layout", "cms", "templates", "dashboard"] },
      { name: "HardDrive", label: "Hard Drive", keywords: ["drive", "disk", "storage", "backup"] },
    ],
  },
  {
    name: "AI, Agents & Automation",
    icons: [
      { name: "Bot", label: "AI Bot / Agent", keywords: ["bot", "ai", "agent", "assistant", "llm"] },
      { name: "Cpu", label: "CPU / Intelligence", keywords: ["cpu", "chip", "compute", "processor", "hardware"] },
      { name: "Sparkles", label: "Sparkles / AI", keywords: ["sparkles", "ai", "magic", "smart", "generative"] },
      { name: "Workflow", label: "Workflow Automation", keywords: ["workflow", "automation", "pipeline", "process"] },
      { name: "Zap", label: "Zap / Fast API", keywords: ["zap", "fast", "speed", "api", "lightning"] },
      { name: "CircuitBoard", label: "Circuit Board", keywords: ["circuit", "hardware", "iot", "systems"] },
      { name: "Binary", label: "Binary / Scraping", keywords: ["binary", "data", "scraping", "parsing", "crawler"] },
    ],
  },
  {
    name: "Design, Business & Growth",
    icons: [
      { name: "Palette", label: "Palette / UI/UX", keywords: ["palette", "design", "ui", "ux", "colors", "brand"] },
      { name: "PencilRuler", label: "Design Specs", keywords: ["design", "prototype", "wireframe", "specs"] },
      { name: "Eye", label: "Preview / Vision", keywords: ["eye", "vision", "preview", "review"] },
      { name: "Rocket", label: "Rocket / Launch", keywords: ["rocket", "launch", "saas", "startup", "growth"] },
      { name: "TrendingUp", label: "Growth / Marketing", keywords: ["growth", "seo", "marketing", "analytics", "trends"] },
      { name: "BarChart", label: "Bar Chart", keywords: ["chart", "analytics", "stats", "metrics", "reports"] },
      { name: "Users", label: "Users / CRM", keywords: ["users", "crm", "leads", "customers", "team"] },
      { name: "DollarSign", label: "Monetization / AdSense", keywords: ["dollar", "adsense", "revenue", "money", "billing"] },
      { name: "Boxes", label: "Boxes / Microservices", keywords: ["boxes", "containers", "docker", "services"] },
      { name: "Search", label: "Search / Scraping", keywords: ["search", "scraping", "extractor", "crawler"] },
      { name: "Shield", label: "Shield / Security", keywords: ["shield", "security", "firewall", "protection"] },
      { name: "Lock", label: "Lock / Privacy", keywords: ["lock", "auth", "security", "encryption"] },
    ],
  },
];

export function isImageUrl(value?: string | null): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  return (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("data:image/") ||
    trimmed.includes("/storage/") ||
    /\.(png|jpe?g|webp|avif|svg)(\?.*)?$/i.test(trimmed)
  );
}

interface ServiceIconProps {
  icon?: string | null;
  className?: string;
  imgClassName?: string;
  alt?: string;
}

export function ServiceIcon({
  icon,
  className = "h-6 w-6",
  imgClassName = "h-full w-full object-contain",
  alt = "Service Icon",
}: ServiceIconProps) {
  if (!icon) {
    const Fallback = Globe;
    return <Fallback className={className} />;
  }

  const trimmed = icon.trim();

  // If it's an uploaded image path or external URL
  if (isImageUrl(trimmed)) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={trimmed}
        alt={alt}
        className={imgClassName}
        loading="lazy"
      />
    );
  }

  // Look up in vector icon dictionary
  const IconComponent = SERVICE_ICONS[trimmed] || Globe;
  return <IconComponent className={className} />;
}
