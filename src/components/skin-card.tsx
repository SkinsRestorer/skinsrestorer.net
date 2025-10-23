"use client";

import { useEffect, useState } from "react";
import { ReactSkinview3d } from "react-skinview3d";
import {
  FlyingAnimation,
  IdleAnimation,
  RunningAnimation,
  type SkinViewer,
  WalkingAnimation,
} from "skinview3d";
import type { PlayerAnimation } from "skinview3d/libs/animation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

export type AnimationType = "walking" | "idle" | "running" | "flying";

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
  }
}

export function SkinCard(props: {
  skinUrl?: string;
  capeUrl?: string;
  model: "default" | "slim";
  animationType: AnimationType;
}) {
  const [animation, setAnimation] = useState<PlayerAnimation>(
    makeAnimation(props.animationType, null),
  );
  const [viewer, setViewer] = useState<SkinViewer | null>(null);

  useEffect(() => {
    setAnimation((oldAnimation) =>
      makeAnimation(props.animationType, oldAnimation),
    );
  }, [props.animationType]);

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
      <CardContent className="flex flex-row justify-center">
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
