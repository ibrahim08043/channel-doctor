import { useState } from "react";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Channel profile image with a graceful fallback.
 *
 * YouTube serves channel avatars from `yt3.ggpht.com`, which refuses hotlinks
 * when the browser attaches a `Referer` header. `referrerPolicy="no-referrer"`
 * drops it so the image loads. If the URL is genuinely missing (null/empty) or
 * the image errors, we render an initials/user fallback instead of a blank box.
 */
export default function ChannelAvatar({
  src,
  alt,
  className,
}: {
  src?: string | null | undefined;
  alt?: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = !!src && !failed;
  const altLabel = alt || "";

  if (!showImage) {
    const initial = altLabel.trim().charAt(0).toUpperCase() || "?";
    return (
      <div
        className={cn(
          "grid shrink-0 place-items-center rounded-full border border-white/10 bg-gradient-to-br from-primary/20 to-accent/20 text-muted-foreground",
          className,
        )}
        aria-label={altLabel}
      >
        {initial && initial !== "?" ? (
          <span className="text-sm font-semibold">{initial}</span>
        ) : (
          <User className="h-1/2 w-1/2" />
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt || ""}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn("shrink-0 object-cover", className)}
    />
  );
}
