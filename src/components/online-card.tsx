"use client";

import { useEffect, useState } from "react";
import { runHttpEffect } from "@/lib/effect-http";
import { fetchMineSkinStatusEffect } from "@/lib/mineskin";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useT } from "@/lib/i18n-react";

export function OnlineCard() {
  const t = useT();
  const [status, setStatus] = useState<"loading" | "online" | "offline">(
    "loading",
  );

  useEffect(() => {
    const controller = new AbortController();
    void runHttpEffect(fetchMineSkinStatusEffect, controller.signal)
      .then((online) => {
        if (!controller.signal.aborted)
          setStatus(online ? "online" : "offline");
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus("offline");
      });
    return () => controller.abort();
  }, []);

  return (
    <Card className="group hover:shadow-lg transition-shadow duration-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{t("API Status")}</CardTitle>
          <div
            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
              status === "loading"
                ? "bg-status-loading text-status-loading-foreground"
                : status === "online"
                  ? "bg-status-online text-status-online-foreground"
                  : "bg-status-offline text-status-offline-foreground"
            }`}
          >
            {t(status.toUpperCase())}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription>
          {t("Powered by")}{" "}
          <a
            href="https://mineskin.org"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-primary transition-colors"
          >
            {t("MineSkin")}
          </a>
        </CardDescription>
      </CardContent>
    </Card>
  );
}
