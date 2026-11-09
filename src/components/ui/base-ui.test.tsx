import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

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
  assert.match(html, /aria-orientation="vertical"/);
});
import { Button } from "./button";
import { Select, SelectTrigger, SelectValue } from "./select";

test("renders the selected label before the popup mounts", () => {
  const html = renderToStaticMarkup(
    <Select
      items={[{ value: "walking", label: "Walking" }]}
      defaultValue="walking"
    >
      <SelectTrigger aria-label="Animation">
        <SelectValue />
      </SelectTrigger>
    </Select>,
  );
  assert.ok(html.includes("Walking"));
  assert.ok(!html.includes('role="option"'));
});

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
