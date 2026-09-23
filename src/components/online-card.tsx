"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function OnlineCard() {
  const [status, setStatus] = useState<"loading" | "online" | "offline">(
    "loading",
  );

  useEffect(() => {
    fetch("https://api.mineskin.org/v2/delay", {
      headers: {
        "User-Agent": "SkinsRestorer-Generator/1.0",
      },
    })
      .then((response) => setStatus(response.ok ? "online" : "offline"))
      .catch(() => setStatus("offline"));
  }, []);

  return (
    <Card className="group hover:shadow-lg transition-shadow duration-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">API Status</CardTitle>
          <div
            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
              status === "loading"
                ? "bg-status-loading text-status-loading-foreground"
                : status === "online"
                  ? "bg-status-online text-status-online-foreground"
                  : "bg-status-offline text-status-offline-foreground"
            }`}
          >
            {status.toUpperCase()}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription>
          Powered by{" "}
          <a
            href="https://mineskin.org"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-primary transition-colors"
          >
            MineSkin
          </a>
        </CardDescription>
      </CardContent>
    </Card>
  );
}
