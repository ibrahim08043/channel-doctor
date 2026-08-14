import { useUser } from "@clerk/clerk-react";
import { Card } from "@/components/ui/card";
import ChannelAvatar from "@/components/ChannelAvatar";
import { User as UserIcon, Mail, Youtube, Crown } from "lucide-react";
import type { ConnectedProfile } from "@workspace/api-client-react";

export default function ProfileCard({ profile }: { profile: ConnectedProfile }) {
  const { user } = useUser();
  const name = user?.fullName || user?.firstName || profile.name || "Creator";
  const email = user?.primaryEmailAddress?.emailAddress || profile.email;
  const avatar = user?.imageUrl || profile.avatar;

  return (
    <Card className="space-y-4 p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <UserIcon className="h-4 w-4 text-primary" /> Your profile
      </h2>
      <div className="flex items-center gap-3">
        {avatar ? (
          <img src={avatar} alt={name} className="h-14 w-14 rounded-full object-cover" />
        ) : (
          <div className="grid h-14 w-14 place-items-center rounded-full bg-primary/15 text-primary">
            <UserIcon className="h-6 w-6" />
          </div>
        )}
        <div className="min-w-0">
          <div className="font-semibold">{name}</div>
          {email && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Mail className="h-3 w-3" /> {email}
            </div>
          )}
          <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs">
            <Crown className="h-3 w-3 text-amber-400" />
            {profile.plan === "pro" ? "Pro plan" : "Free plan"}
          </div>
        </div>
      </div>
      {profile.channelId && (
        <div className="flex items-center gap-3 rounded-md border border-border/60 bg-secondary/30 p-3">
          {profile.channelThumbnail && (
            <ChannelAvatar src={profile.channelThumbnail} alt={profile.channelTitle} className="h-10 w-10 rounded-full" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Youtube className="h-3 w-3" /> Connected channel
            </div>
            <div className="truncate text-sm font-medium">{profile.channelTitle}</div>
          </div>
        </div>
      )}
    </Card>
  );
}
