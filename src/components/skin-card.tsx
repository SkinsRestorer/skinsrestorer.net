"use client";

import { ReactSkinview3d } from "react-skinview3d";
import { WalkingAnimation } from "skinview3d";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

export function SkinCard(props: {
  skinUrl?: string;
  capeUrl?: string;
  model: "default" | "slim";
}) {
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
          }}
          options={{
            animation: new WalkingAnimation(),
            model: props.model,
          }}
        />
      </CardContent>
    </Card>
  );
}
