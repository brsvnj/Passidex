import {
  BatteryFull,
  Building2,
  CircleDot,
  Cpu,
  FlaskConical,
  Package,
  Shirt,
  Sofa,
  type LucideIcon,
} from "lucide-react";

/** Resolve the schema package's string icon name to a lucide component. */
const ICONS: Record<string, LucideIcon> = {
  Shirt,
  Sofa,
  BatteryFull,
  CircleDot,
  Cpu,
  FlaskConical,
  Building2,
};

export function iconFor(name: string): LucideIcon {
  return ICONS[name] ?? Package;
}
