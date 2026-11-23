import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
import { ToggleGroup, ToggleGroupItem } from "./toggle-group";

test("vertical tabs pass their orientation to the accessible tab list", () => {
  const html = renderToStaticMarkup(
    <Tabs orientation="vertical" defaultValue="library">
      <TabsList>
        <TabsTrigger value="library">Library</TabsTrigger>
        <TabsTrigger value="gallery">Gallery</TabsTrigger>
      </TabsList>
      <TabsContent value="library">Saved skins</TabsContent>
      <TabsContent value="gallery">Catalog</TabsContent>
    </Tabs>,
  );
  assert.match(html, /aria-orientation="vertical"/u);
});
import { Button } from "./button";

test("composes a link button without adding a nested button", () => {
  const html = renderToStaticMarkup(
    <Button render={<a href="/docs" />} nativeButton={false}>
      Documentation
    </Button>,
  );
  assert.ok(html.includes('href="/docs"'));
  assert.ok(html.includes("Documentation"));
  assert.ok(!html.includes("<button"));
});

test("vertical toggle groups give Base UI their orientation", () => {
  const html = renderToStaticMarkup(
    <ToggleGroup orientation="vertical" aria-label="Tool">
      <ToggleGroupItem value="pencil">Pencil</ToggleGroupItem>
      <ToggleGroupItem value="eraser">Eraser</ToggleGroupItem>
    </ToggleGroup>,
  );
  assert.match(
    html,
    /role="group"[^>]*data-orientation="vertical"|data-orientation="vertical"[^>]*role="group"/u,
  );
});
