import { Filter } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ProductFilterPillProps {
  productFilter: "Intraday" | "Delivery";
}

export function ProductFilterPill({ productFilter }: ProductFilterPillProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] cursor-default font-medium text-amber-500">
          <Filter className="size-2.5" />
          {productFilter}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p>Filtered: {productFilter} only</p>
      </TooltipContent>
    </Tooltip>
  );
}

