import {
  Briefcase, Car, CircleDollarSign, Ellipsis, GraduationCap, HeartPulse, House, PartyPopper, Receipt, Repeat,
  ShoppingBag, ShoppingCart, Sparkles, TrendingUp, Utensils, ArrowLeftRight, CreditCard, PawPrint, Users, KeyRound, Droplet,
  Lightbulb, Wrench, Fuel, CarTaxiFront, Pill, Smile, Tv, Plane, Shirt, Wifi, Scissors, Apple, Bus, BookOpen, type LucideIcon,
} from "lucide-react";

const icons: Record<string, LucideIcon> = {
  "shopping-cart": ShoppingCart, house: House, receipt: Receipt, car: Car, utensils: Utensils, "heart-pulse": HeartPulse,
  "graduation-cap": GraduationCap, "party-popper": PartyPopper, "shopping-bag": ShoppingBag, repeat: Repeat,
  ellipsis: Ellipsis, briefcase: Briefcase, sparkles: Sparkles, "trending-up": TrendingUp,
  transfer: ArrowLeftRight, "card-payment": CreditCard, "paw-print": PawPrint, users: Users, "key-round": KeyRound, droplet: Droplet,
  lightbulb: Lightbulb, wrench: Wrench, fuel: Fuel, "car-taxi-front": CarTaxiFront, pill: Pill, smile: Smile, tv: Tv, plane: Plane,
  shirt: Shirt, wifi: Wifi, scissors: Scissors, apple: Apple, bus: Bus, "book-open": BookOpen,
};

export function CategoryIcon({ name, className = "" }: { name?: string | null; className?: string }) {
  const Icon = (name && icons[name]) || CircleDollarSign;
  return (
    <span className={`grid size-9 shrink-0 place-items-center rounded-pill bg-accent-soft text-accent ${className}`}>
      <Icon aria-hidden className="size-[18px]" />
    </span>
  );
}
