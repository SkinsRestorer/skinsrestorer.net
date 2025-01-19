"use client";

import {useEffect, useState} from "react";
import {Label} from "~/components/ui/label";
import {Input} from "~/components/ui/input";
import {toast} from "sonner";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "~/components/ui/select";
import {Button} from "~/components/ui/button";
import FileSaver from "file-saver";

export const OnlineCard = () => {
  const [status, setStatus] = useState("loading")

  useEffect(() => {
    fetch("https://api.mineskin.org/get/delay").then(() => {
      setStatus("online")
    }).catch(() => {
      setStatus("offline")
    })
  }, [])

  return (
    <div
      className="nextra-card feature-card group h-fit">
      <div className="flex flex-row gap-2">
        <h2 className="text-lg font-bold">
          API Status
        </h2>
        <div
          className={`rounded-lg p-1 text-xs my-auto ${status === "loading" ? "bg-green-700" : status === "online" ? "bg-green-700" : "bg-red-700"}`}>
          {status === "loading" ? "" : status === "online" ? "ONLINE" : "OFFLINE"}
        </div>
      </div>
      <p className="mt-2">
        Powered by
        {" "}
        <a href="https://mineskin.org" target="_blank" rel="noopener noreferrer" className="underline">
          MineSkin
        </a>
      </p>
    </div>
  )
}

export const GenerateFileCard = () => {
  const [selectedFile, setSelectedFile] = useState(null)
  const [skinType, setSkinType] = useState("classic")
  const [customName, setCustomName] = useState("")
  const [loading, setLoading] = useState(false)

  async function skinChecker(skinURL) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = "Anonymous";
      image.src = skinURL;

      image.onload = () => {
        const detectCanvas = document.createElement("canvas");
        const detectCtx = detectCanvas.getContext("2d");
        detectCanvas.width = image.width;
        detectCanvas.height = image.height;
        detectCtx.drawImage(image, 0, 0);
        const px1 = detectCtx.getImageData(46, 52, 1, 12).data;
        const px2 = detectCtx.getImageData(54, 20, 1, 12).data;
        let allTransparent = true;
        for (let i = 3; i < 12 * 4; i += 4) {
          if (px1[i] === 255 || px2[i] === 255) {
            allTransparent = false;
            break;
          }
        }

        resolve(allTransparent);
      };

      image.onerror = () => {
        reject("Failed to load image.");
      };
    });
  }

  return (
    <div
      className="nextra-card feature-card group h-fit">
      <div className="flex flex-col gap-4">
        <div className="grid w-full max-w-sm items-center gap-1.5">
          <Label htmlFor="skin-png-file">Select skin .png file to generate</Label>
          <Input id="skin-png-file" type="file" accept=".png" onChange={(e) => {
            const file = e.target.files[0];
            setSelectedFile(file)

            toast.promise(skinChecker(URL.createObjectURL(file)).then(slim => {
              setSkinType(slim ? "slim" : "classic")
              return slim ? "slim" : "classic"
            }), {
              loading: "Detecting skin type...",
              success: v => `Skin file detected as a ${v} skin.`,
              error: e => `Failed to detect skin type: ${e}`
            })
          }}/>
        </div>
        <div className="grid w-full max-w-sm items-center gap-1.5">
          <Label htmlFor="skin-type">Skin type</Label>
          <Select value={skinType} onValueChange={value => {
            setSkinType(value)
          }}>
            <SelectTrigger id="skin-type" className="w-[180px]">
              <SelectValue placeholder="Skin type"/>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="classic">Classic</SelectItem>
              <SelectItem value="slim">Slim</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid w-full max-w-sm items-center gap-1.5">
          <Label htmlFor="custom-name">Desired /skin name (optional)</Label>
          <Input id="custom-name" type="text" placeholder="cool_skin_name"
                 value={customName} onChange={(e) => {
            setCustomName(e.target.value)
          }}/>
        </div>
        <Button onClick={() => {
          if (!selectedFile) {
            toast.warning("Please select a file to generate.")
            return
          }

          if (customName && !/^[a-z0-9_]+$/.test(customName)) {
            toast.warning("Invalid skin name. Skin name can only contain lowercase letters, numbers and underscores. (a-z0-9_)")
            return
          }

          const formData = new FormData();
          formData.append("file", selectedFile);
          formData.append("variant", skinType);

          setLoading(true)
          toast.promise(fetch("https://api.mineskin.org/generate/upload", {
            method: "POST",
            body: formData
          })
            .then(response => response.json())
            .then(response => {
              const signature = response["data"]["texture"]["signature"];
              const value = response["data"]["texture"]["value"];
              const fileData = {
                skinName: customName === "" ? String(response["id"]) : customName,
                value: value,
                signature: signature,
                dataVersion: 1
              };

              const blob = new Blob([JSON.stringify(fileData)], {
                type: "text/plain;charset=utf-8"
              });
              FileSaver.saveAs(blob, fileData.skinName + ".customskin");
            }), {
            loading: "Generating skin file...",
            success: "Skin file generated successfully.",
            error: e => `Failed to generate skin file: ${e}`,
            finally: () => setLoading(false)
          })
        }} disabled={loading}>
          Generate
        </Button>
      </div>
    </div>
  )
}

export const ReverseFileCard = () => {
  const [selectedFile, setSelectedFile] = useState(null)

  return (
    <div
      className="nextra-card feature-card group h-fit">
      <div className="flex flex-col gap-4">
        <div className="grid w-full max-w-sm items-center gap-1.5">
          <Label htmlFor="skin-file">Select skin file to reverse</Label>
          <Input id="skin-file" type="file" accept=".playerskin,.urlskin,.customskin,.legacyskin,.skin"
                 onChange={(e) => {
                   setSelectedFile(e.target.files[0])
                 }}/>
        </div>
        <Button onClick={() => {
          if (!selectedFile) {
            toast.warning("Please select a file to reverse.")
            return
          }

          toast.promise(selectedFile.text().then(text => {
            let rawValue;
            try {
              const textJson = JSON.parse(text);
              rawValue = textJson["value"];
            } catch (e) {
              toast.warning("Falling back to legacy skin format.", {
                description: "Please update SkinsRestorer as soon as possible.",
              })

              rawValue = text.split("\n")[0];
            }
            const decodedValue = JSON.parse(window.atob(rawValue));

            const skinUrl = decodedValue["textures"]["SKIN"]["url"];
            window.open(skinUrl);
          }), {
            loading: "Reversing skin file...",
            success: "Skin file reversed successfully.",
            error: e => `Failed to reverse skin file: ${e}`
          })
        }}>
          Reverse
        </Button>
      </div>
    </div>
  )
}
