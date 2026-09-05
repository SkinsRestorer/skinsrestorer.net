"use client";

import { useEffect, useId, useState } from "react";
import { ReactSkinview3d } from "react-skinview3d";
import {
  CrouchAnimation,
  FlyingAnimation,
  HitAnimation,
  IdleAnimation,
  RunningAnimation,
  type SkinViewer,
  WalkingAnimation,
  WaveAnimation,
} from "skinview3d";
import type { PlayerAnimation } from "skinview3d/libs/animation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ensureHttpsTextureUrl } from "@/lib/textures";

const animations = {
  walking: WalkingAnimation,
  idle: IdleAnimation,
  running: RunningAnimation,
  flying: FlyingAnimation,
  wave: WaveAnimation,
  crouch: CrouchAnimation,
  hit: HitAnimation,
};

type AnimationType = keyof typeof animations;

export function SkinCard(props: {
  skinUrl?: string;
  capeUrl?: string;
  model: "default" | "slim";
}) {
  const [animationType, setAnimationType] = useState<AnimationType>("walking");
  const [animation, setAnimation] = useState<PlayerAnimation>(
    () => new WalkingAnimation(),
  );
  const [viewer, setViewer] = useState<SkinViewer | null>(null);
  const animationSelectId = useId();

  useEffect(() => {
    if (viewer !== null) {
      viewer.animation = animation;
      viewer.playerObject.skin.modelType = props.model;
    }
  }, [viewer, props.model, animation]);

  const normalizedSkinUrl = ensureHttpsTextureUrl(props.skinUrl);
  const normalizedCapeUrl = ensureHttpsTextureUrl(props.capeUrl);

  return (
    <Card className="group hover:shadow-lg transition-shadow duration-200">
      <CardHeader>
        <CardTitle>Skin preview</CardTitle>
        <CardDescription>
          See a preview of your skin before uploading it.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 items-center">
        <div className="w-full max-w-xs flex flex-col gap-2">
          <Label htmlFor={animationSelectId}>Animation</Label>
          <Select
            value={animationType}
            onValueChange={(value) => {
              const type = value as AnimationType;
              setAnimationType(type);
              const Animation = animations[type];
              setAnimation((current) =>
                current instanceof Animation ? current : new Animation(),
              );
            }}
          >
            <SelectTrigger id={animationSelectId}>
              <SelectValue placeholder="Choose an animation" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="walking">Walking</SelectItem>
                <SelectItem value="idle">Idle</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="flying">Flying</SelectItem>
                <SelectItem value="wave">Wave</SelectItem>
                <SelectItem value="crouch">Crouch</SelectItem>
                <SelectItem value="hit">Hit</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <ReactSkinview3d
          height={300}
          width={200}
          skinUrl={
            normalizedSkinUrl ||
            "https://textures.minecraft.net/texture/26c156a5a28ba3647b3de3b5bfec4d399670b1f063d6526ba201c2be01b60df5"
          }
          capeUrl={normalizedCapeUrl ?? undefined}
          onReady={({ viewer }) => {
            viewer.autoRotate = true;
            setViewer(viewer);
          }}
          options={{
            animation,
            model: props.model,
          }}
        />
      </CardContent>
    </Card>
  );
}
