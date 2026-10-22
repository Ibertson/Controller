import {
  ArrowLeftRight, Baby, BookOpen, Briefcase, BriefcaseBusiness, Bus, Car, CarTaxiFront, Church, CircleDollarSign, Clapperboard, Coffee,
  Coins, CreditCard, Droplet, Dumbbell, Ellipsis, Flower2, Fuel, Gamepad2, Gem, GraduationCap, Hammer, Hand, HandCoins, HeartPulse,
  House, KeyRound, Landmark, Lightbulb, Mars, Music, PartyPopper, PawPrint, Percent, PiggyBank, Pill, Plane, Receipt, Repeat,
  School, Scissors, Share2, Shirt, ShoppingBag, ShoppingCart, Smile, Sparkles, TrendingUp, Truck, Tv, Users, Utensils,
  UtensilsCrossed, Venus, Wifi, Wrench, Apple, type LucideIcon,
} from "lucide-react";
import { inkOn } from "@/lib/categories";

export const categoryIcons: Record<string, LucideIcon> = {
  "shopping-cart": ShoppingCart, house: House, receipt: Receipt, car: Car, utensils: Utensils, "heart-pulse": HeartPulse,
  "graduation-cap": GraduationCap, "party-popper": PartyPopper, "shopping-bag": ShoppingBag, repeat: Repeat,
  ellipsis: Ellipsis, briefcase: Briefcase, sparkles: Sparkles, "trending-up": TrendingUp,
  transfer: ArrowLeftRight, "card-payment": CreditCard, "paw-print": PawPrint, users: Users, "key-round": KeyRound, droplet: Droplet,
  lightbulb: Lightbulb, wrench: Wrench, fuel: Fuel, "car-taxi-front": CarTaxiFront, pill: Pill, smile: Smile, tv: Tv, plane: Plane,
  shirt: Shirt, wifi: Wifi, scissors: Scissors, apple: Apple, bus: Bus, "book-open": BookOpen,
  dumbbell: Dumbbell, coffee: Coffee, hand: Hand, "share-2": Share2, "gamepad-2": Gamepad2, music: Music, baby: Baby, hammer: Hammer,
  truck: Truck, gem: Gem, landmark: Landmark, "briefcase-business": BriefcaseBusiness, school: School, "hand-coins": HandCoins,
  percent: Percent, clapperboard: Clapperboard, "utensils-crossed": UtensilsCrossed, "piggy-bank": PiggyBank, coins: Coins,
  venus: Venus, mars: Mars, church: Church, "flower-2": Flower2,
};

export function CategoryIcon({ name, color, className = "" }: { name?: string | null; color?: string | null; className?: string }) {
  const Icon = (name && categoryIcons[name]) || CircleDollarSign;
  return (
    <span className={`grid size-9 shrink-0 place-items-center rounded-pill ${color ? "" : "bg-accent-soft text-accent"} ${className}`}
      style={color ? { background: color, color: inkOn(color) } : undefined}>
      <Icon aria-hidden className="size-[18px]" />
    </span>
  );
}
