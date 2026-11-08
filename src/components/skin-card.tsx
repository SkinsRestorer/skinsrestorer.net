"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  CrouchAnimation,
  FlyingAnimation,
  HitAnimation,
  IdleAnimation,
  RunningAnimation,
  SkinViewer,
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
import { startSkinPreview } from "@/lib/skin-preview";

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
  const canvas = useRef<HTMLCanvasElement>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const animationSelectId = useId();

  useEffect(() => {
    if (viewer !== null) {
      viewer.animation = animation;
      viewer.playerObject.skin.modelType = props.model;
    }
  }, [viewer, props.model, animation]);

  const normalizedSkinUrl = ensureHttpsTextureUrl(props.skinUrl);
  const normalizedCapeUrl = ensureHttpsTextureUrl(props.capeUrl);

  useEffect(() => {
    if (!canvas.current) return;
    const element = canvas.current;
    setPreviewFailed(false);
    const stop = startSkinPreview(
      () => new SkinViewer({ canvas: element, height: 300, width: 200 }),
      {
        skin:
          normalizedSkinUrl ||
          "https://textures.minecraft.net/texture/26c156a5a28ba3647b3de3b5bfec4d399670b1f063d6526ba201c2be01b60df5",
        cape: normalizedCapeUrl ?? undefined,
      },
      (current) => {
        current.autoRotate = true;
        setViewer(current);
      },
      () => {
        setViewer(null);
        setPreviewFailed(true);
      },
    );
    const lost = (event: Event) => {
      event.preventDefault();
      stop();
      setViewer(null);
      setPreviewFailed(true);
    };
    element.addEventListener("webglcontextlost", lost);
    return () => {
      element.removeEventListener("webglcontextlost", lost);
      stop();
    };
  }, [normalizedSkinUrl, normalizedCapeUrl]);

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
              {/* Wrap item labels in an element. Radix portals the selected
                  label into the trigger, and browser translation replaces bare
                  text nodes there, which makes React fail to remove them. */}
              <SelectGroup>
                <SelectItem value="walking">
                  <span>Walking</span>
                </SelectItem>
                <SelectItem value="idle">
                  <span>Idle</span>
                </SelectItem>
                <SelectItem value="running">
                  <span>Running</span>
                </SelectItem>
                <SelectItem value="flying">
                  <span>Flying</span>
                </SelectItem>
                <SelectItem value="wave">
                  <span>Wave</span>
                </SelectItem>
                <SelectItem value="crouch">
                  <span>Crouch</span>
                </SelectItem>
                <SelectItem value="hit">
                  <span>Hit</span>
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <canvas
          ref={canvas}
          height={300}
          width={200}
          hidden={previewFailed}
          aria-label="3D skin preview"
        />
        {previewFailed && (
          <output className="text-sm text-muted-foreground">
            The 3D preview is unavailable. You can still upload or generate your
            skin.
          </output>
        )}
      </CardContent>
    </Card>
  );
}
