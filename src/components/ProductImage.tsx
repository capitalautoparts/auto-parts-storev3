import { useEffect, useState } from "react";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductImageProps {
  src?: string;
  alt: string;
  className?: string;
}

export function ProductImage({ src, alt, className }: ProductImageProps) {
  const [hasError, setHasError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setHasError(false); setLoaded(false); }, [src]);

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
    <div className={cn('relative rounded overflow-hidden bg-white', className)}>
    {!loaded && <Package aria-hidden="true" className="absolute inset-0 m-auto h-6 w-6 text-gray-400" />}
    <img
      src={src}
      alt={alt}
      className={cn('w-full h-full object-contain rounded', !loaded && 'opacity-0')}
      onLoad={() => setLoaded(true)}
      onError={() => setHasError(true)}
      loading="lazy"
    /></div>
  );
}
