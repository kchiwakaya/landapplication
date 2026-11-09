import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import * as React from "react";

import { cn } from "@/lib/utils";

const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Root ref={ref} className={cn("grid gap-2", className)} {...props} />
));
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName;

/**
 * A selectable "option card" — the tick-box rows on the paper form rendered
 * as bordered choices that are easy to hit with a mouse.
 */
const RadioCard = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item> & {
    title: React.ReactNode;
    description?: React.ReactNode;
  }
>(({ className, title, description, ...props }, ref) => (
  <RadioGroupPrimitive.Item
    ref={ref}
    className={cn(
      "group flex w-full items-start gap-3 rounded-md border border-input bg-card px-3.5 py-3 text-left transition-colors",
      "hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20",
      "data-[state=checked]:border-primary data-[state=checked]:bg-forest-100/50",
      className,
    )}
    {...props}
  >
    <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-input bg-card group-data-[state=checked]:border-primary">
      <RadioGroupPrimitive.Indicator className="size-2 rounded-full bg-primary" />
    </span>
    <span className="flex flex-col gap-0.5">
      <span className="text-[13.5px] font-medium leading-tight">{title}</span>
      {description && <span className="text-[12px] text-muted-foreground">{description}</span>}
    </span>
  </RadioGroupPrimitive.Item>
));
RadioCard.displayName = "RadioCard";

export { RadioCard, RadioGroup };

