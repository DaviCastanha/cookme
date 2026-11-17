import {
  Amphora,
  Apple,
  Baby,
  Banana,
  Bean,
  Beef,
  Beer,
  Bird,
  BookOpen,
  BottleWine,
  Cake,
  CakeSlice,
  Calendar,
  Candy,
  CandyCane,
  Carrot,
  ChefHat,
  Cherry,
  Citrus,
  Clock,
  Coffee,
  Cookie,
  CookingPot,
  Croissant,
  CupSoda,
  Dessert,
  Donut,
  Drumstick,
  Egg,
  EggFried,
  Fish,
  Flame,
  Flower,
  Folder,
  Gift,
  GlassWater,
  Grape,
  Ham,
  Hamburger,
  HandPlatter,
  Heart,
  House,
  IceCreamBowl,
  IceCreamCone,
  Leaf,
  LeafyGreen,
  Lollipop,
  Martini,
  Microwave,
  Milk,
  NotebookPen,
  Nut,
  PartyPopper,
  Pizza,
  Popcorn,
  Popsicle,
  Rabbit,
  Refrigerator,
  Salad,
  Sandwich,
  Send,
  Shrimp,
  Snowflake,
  Soup,
  Sparkles,
  Sprout,
  Star,
  Sun,
  Timer,
  TreePine,
  Users,
  Utensils,
  UtensilsCrossed,
  Vegan,
  Wheat,
  Wine,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react';
import type { ColorName, ExplorerItem } from '@/lib/schemas';

/** Icon library offered for folders and recipes, grouped for the picker. Keys are stored in the data files. */
export const ICON_GROUPS: { label: string; icons: Record<string, LucideIcon> }[] = [
  {
    label: 'Cozinha',
    icons: {
      'chef-hat': ChefHat,
      'cooking-pot': CookingPot,
      utensils: Utensils,
      'utensils-crossed': UtensilsCrossed,
      'hand-platter': HandPlatter,
      flame: Flame,
      microwave: Microwave,
      refrigerator: Refrigerator,
      timer: Timer,
      clock: Clock,
      'book-open': BookOpen,
      'notebook-pen': NotebookPen,
      folder: Folder,
    },
  },
  {
    label: 'Pratos',
    icons: {
      soup: Soup,
      salad: Salad,
      pizza: Pizza,
      hamburger: Hamburger,
      sandwich: Sandwich,
      croissant: Croissant,
      wheat: Wheat,
      'egg-fried': EggFried,
      egg: Egg,
      beef: Beef,
      drumstick: Drumstick,
      ham: Ham,
      fish: Fish,
      shrimp: Shrimp,
      bean: Bean,
      popcorn: Popcorn,
    },
  },
  {
    label: 'Frutas e verduras',
    icons: {
      carrot: Carrot,
      'leafy-green': LeafyGreen,
      leaf: Leaf,
      sprout: Sprout,
      vegan: Vegan,
      apple: Apple,
      banana: Banana,
      cherry: Cherry,
      citrus: Citrus,
      grape: Grape,
      nut: Nut,
    },
  },
  {
    label: 'Doces',
    icons: {
      'cake-slice': CakeSlice,
      cake: Cake,
      cookie: Cookie,
      donut: Donut,
      dessert: Dessert,
      candy: Candy,
      'candy-cane': CandyCane,
      lollipop: Lollipop,
      'ice-cream-cone': IceCreamCone,
      'ice-cream-bowl': IceCreamBowl,
      popsicle: Popsicle,
    },
  },
  {
    label: 'Bebidas',
    icons: {
      'cup-soda': CupSoda,
      coffee: Coffee,
      milk: Milk,
      'glass-water': GlassWater,
      wine: Wine,
      'bottle-wine': BottleWine,
      beer: Beer,
      martini: Martini,
      amphora: Amphora,
    },
  },
  {
    label: 'Ocasiões',
    icons: {
      heart: Heart,
      star: Star,
      sparkles: Sparkles,
      'party-popper': PartyPopper,
      gift: Gift,
      'tree-pine': TreePine,
      calendar: Calendar,
      sun: Sun,
      snowflake: Snowflake,
      flower: Flower,
      house: House,
      users: Users,
      baby: Baby,
      bird: Bird,
      rabbit: Rabbit,
      send: Send,
    },
  },
];

export const ICON_LIBRARY: Record<string, LucideIcon> = Object.assign({}, ...ICON_GROUPS.map((g) => g.icons));

export function defaultIconFor(item: Pick<ExplorerItem, 'type'>): string {
  return item.type === 'folder' ? 'folder' : 'utensils';
}

export function defaultColorFor(item: Pick<ExplorerItem, 'type'>): ColorName {
  return item.type === 'folder' ? 'cinnamon' : 'pepper';
}

export function NamedIcon({ name, ...props }: { name: string } & LucideProps) {
  const Component = ICON_LIBRARY[name] ?? Utensils;
  return <Component {...props} />;
}

/** Icon of an explorer item, honouring its custom icon/color. */
export function ItemIcon({
  item,
  size = 16,
  soft = false,
}: {
  item: Pick<ExplorerItem, 'type' | 'icon' | 'color'>;
  size?: number;
  /** Render inside a tinted rounded square. */
  soft?: boolean;
}) {
  const name = item.icon ?? defaultIconFor(item);
  const color = item.color ?? defaultColorFor(item);
  const icon = (
    <NamedIcon
      name={name}
      size={size}
      strokeWidth={1.8}
      style={{ color: `var(--palette-${color})`, flexShrink: 0 }}
      aria-hidden
    />
  );
  if (!soft) return icon;
  return (
    <span
      style={{
        display: 'inline-grid',
        placeItems: 'center',
        width: size + 16,
        height: size + 16,
        borderRadius: 'var(--radius-sm)',
        background: `var(--palette-${color}-soft)`,
        flexShrink: 0,
      }}
    >
      {icon}
    </span>
  );
}
