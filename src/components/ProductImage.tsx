import { useState } from "react";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductImageProps {
  src?: string;
  alt: string;
  className?: string;
}

export function ProductImage({ src, alt, className }: ProductImageProps) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div
        className={cn(
          "bg-muted flex items-center justify-center text-muted-foreground rounded",
          className
        )}
      >
        <Package className="h-6 w-6" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={cn("object-cover rounded", className)}
      onError={() => setHasError(true)}
      loading="lazy"
    />
  );
}
