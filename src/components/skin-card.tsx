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
} from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

export type AnimationType =
  | "walking"
  | "idle"
  | "running"
  | "flying"
  | "wave"
  | "crouch"
  | "hit";

function makeAnimation(
  type: AnimationType,
  oldAnimation: PlayerAnimation | null,
): PlayerAnimation {
  switch (type) {
    case "walking":
      if (oldAnimation && oldAnimation instanceof WalkingAnimation) {
        return oldAnimation;
      } else {
        return new WalkingAnimation();
      }
    case "idle":
      if (oldAnimation && oldAnimation instanceof IdleAnimation) {
        return oldAnimation;
      } else {
        return new IdleAnimation();
      }
    case "running":
      if (oldAnimation && oldAnimation instanceof RunningAnimation) {
        return oldAnimation;
      } else {
        return new RunningAnimation();
      }
    case "flying":
      if (oldAnimation && oldAnimation instanceof FlyingAnimation) {
        return oldAnimation;
      } else {
        return new FlyingAnimation();
      }
    case "wave":
      if (oldAnimation && oldAnimation instanceof WaveAnimation) {
        return oldAnimation;
      } else {
        return new WaveAnimation();
      }
    case "crouch":
      if (oldAnimation && oldAnimation instanceof CrouchAnimation) {
        return oldAnimation;
      } else {
        return new CrouchAnimation();
      }
    case "hit":
      if (oldAnimation && oldAnimation instanceof HitAnimation) {
        return oldAnimation;
      } else {
        return new HitAnimation();
      }
  }
}

export function SkinCard(props: {
  skinUrl?: string;
  capeUrl?: string;
  model: "default" | "slim";
}) {
  const [animationType, setAnimationType] = useState<AnimationType>("walking");
  const [animation, setAnimation] = useState<PlayerAnimation>(
    makeAnimation(animationType, null),
  );
  const [viewer, setViewer] = useState<SkinViewer | null>(null);
  const animationSelectId = useId();

  useEffect(() => {
    setAnimation((oldAnimation) => makeAnimation(animationType, oldAnimation));
  }, [animationType]);

  useEffect(() => {
    if (viewer !== null) {
      viewer.animation = animation;
      viewer.playerObject.skin.modelType = props.model;
    }
  }, [viewer, props.model, animation]);

  return (
    <Card className="group hover:shadow-lg transition-shadow duration-200">
      <CardHeader>
        <CardTitle>Skin preview</CardTitle>
        <CardDescription>
          See a preview of your skin before uploading it.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 items-center">
        <div className="w-full max-w-xs space-y-2">
          <Label htmlFor={animationSelectId}>Animation</Label>
          <Select
            value={animationType}
            onValueChange={(value) => {
              setAnimationType(value as AnimationType);
            }}
          >
            <SelectTrigger id={animationSelectId}>
              <SelectValue placeholder="Choose an animation" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="walking">Walking</SelectItem>
              <SelectItem value="idle">Idle</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="flying">Flying</SelectItem>
              <SelectItem value="wave">Wave</SelectItem>
              <SelectItem value="crouch">Crouch</SelectItem>
              <SelectItem value="hit">Hit</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <ReactSkinview3d
          height={300}
          width={200}
          skinUrl={
            props.skinUrl ||
            "https://textures.minecraft.net/texture/26c156a5a28ba3647b3de3b5bfec4d399670b1f063d6526ba201c2be01b60df5"
          }
          capeUrl={props.capeUrl}
          onReady={({ viewer }) => {
            viewer.autoRotate = true;
            setViewer(viewer);
          }}
          options={{
            animation: animation,
            model: props.model,
          }}
        />
      </CardContent>
    </Card>
  );
}
